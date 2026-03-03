# Fix: Vault Sync Disabled Prematurely Before Quota Is Filled

## Summary

Vault sync is being disabled well before Chrome sync storage is actually full. The root cause is a **fundamentally wrong byte-counting model**: the code uses `compressed.length * 2` and `TextEncoder().encode()` (UTF-8) to predict storage usage, but Chrome measures quota as `JSON.stringify(value).length + key.length` per item — which is the JS string `.length` property (UTF-16 code units), NOT UTF-8 byte counts. This mismatch causes massive over-estimation of storage usage, triggering premature fallbacks.

### Status of Prior Fixes

Bugs 1 (quota.total vs quota.available), 2 (settings reserve), 4 (persistVault 100% pre-check), 5 (init auto-disable), and 6 (dismiss banner) have already been applied. **The issues below are the remaining unfixed root causes.**

---

## Bug 7 (ROOT CAUSE): Wrong byte measurement model — `compressed.length * 2` vs Chrome's actual counting

**Files:** `src/services/vaultService.ts`, `src/store/slices/useVaultSlice.ts`

**Problem:** Chrome's sync storage docs state:

> QUOTA_BYTES (102,400): "as measured by the **JSON stringification of every value plus every key's length**"
> QUOTA_BYTES_PER_ITEM (8,192): "as measured by the **JSON stringification of its value plus its key length**"

This means Chrome counts: `JSON.stringify(chunkValue).length + key.length` per item. For a string value `"abc"`, `JSON.stringify("abc")` produces `'"abc"'` (length 5 — includes quotes). The `.length` property returns UTF-16 code units, not bytes.

However, `tryCompressionTiers` (line 518-519) does:

```ts
const minifiedBytes = minifiedCompressed.length * 2;
```

This doubles the character count, assuming each UTF-16 code unit = 2 bytes. But Chrome doesn't count actual bytes — it counts `.length`. So a compressed string of `.length = 50000` is counted by Chrome as ~50002 (value + quotes), but the code estimates it as 100,000 — **2x over-estimation**.

Similarly, `checkQuotaBeforeSave` uses `compressed.length * 2` to check if data fits. This means items are rejected at ~50% of actual capacity.

**Fix:**

1. **In `tryCompressionTiers`**: Replace `compressed.length * 2` with the actual Chrome quota cost. The total quota cost of a compressed vault stored across N chunks is:

```ts
function calculateChromeSyncCost(compressed: string): number {
  // Simulate how createPreciseChunks would split this, 
  // and sum JSON.stringify(chunk).length + key.length for each chunk
  // Plus the meta key cost
  let totalCost = 0;
  let offset = 0;
  let chunkIndex = 0;
  
  while (offset < compressed.length) {
    const key = `${VAULT_CHUNK_PREFIX}${chunkIndex}`;
    // Per-item limit: JSON.stringify(value).length + key.length <= 8192
    const maxCharsPerChunk = CHROME_SYNC_ITEM_MAX_BYTES - key.length - 2; // -2 for JSON string quotes
    const chunkLength = Math.min(maxCharsPerChunk, compressed.length - offset);
    
    // Chrome quota cost for this item: JSON.stringify(chunkString).length + key.length
    // JSON.stringify of a string adds 2 quote chars: chunkLength + 2
    totalCost += chunkLength + 2 + key.length;
    
    offset += chunkLength;
    chunkIndex++;
  }
  
  return totalCost;
}
```

Then in `tryCompressionTiers`, replace:
```ts
const minifiedBytes = minifiedCompressed.length * 2;
if (minifiedBytes <= availableBytes) {
```
with:
```ts
const minifiedCost = calculateChromeSyncCost(minifiedCompressed);
if (minifiedCost <= availableBytes) {
```

And the same for the `regularBytes` check.

2. **In `checkQuotaBeforeSave`**: Replace `compressed.length * 2` with `calculateChromeSyncCost(compressed)` in the Tier 2 check.

3. **`availableBytes` in `saveVault`**: Since `quota.total` and `quota.used` come from `getBytesInUse()` (Chrome's internal measurement), and our predictions now use the same measurement model, the comparison `minifiedCost <= availableBytes` is now apples-to-apples.

---

## Bug 8: `createPreciseChunks` uses UTF-8 encoding, under-filling each chunk

**File:** `src/services/vaultService.ts` lines 460-506

**Problem:** `createPreciseChunks` uses `new TextEncoder().encode(chunk).length` to measure each chunk's size against `CHROME_SYNC_ITEM_MAX_BYTES`. But `TextEncoder().encode()` produces UTF-8 bytes, while Chrome's QUOTA_BYTES_PER_ITEM uses `JSON.stringify(value).length + key.length` (JS string `.length`).

`LZString.compressToUTF16` produces characters in the BMP (U+0000–U+FFFF). Each such character is 1 JS code unit (`.length` = 1) but can be 1-3 UTF-8 bytes. For the typical LZ-string output with many characters in the U+0100–U+FFFF range, UTF-8 encoding is 2-3x larger than `.length`.

This means each chunk is filled to only ~33-50% of what Chrome actually allows per item, resulting in **2-3x more chunks than necessary**. More chunks means more key overhead, reducing total usable capacity.

**Fix:** Replace the UTF-8 binary search in `createPreciseChunks` with a simple character-count calculation:

```ts
function createPreciseChunks(compressed: string): { chunks: string[]; keys: string[] } {
  const chunks: string[] = [];
  const keys: string[] = [];

  let offset = 0;
  let chunkIndex = 0;

  while (offset < compressed.length) {
    const key = `${VAULT_CHUNK_PREFIX}${chunkIndex}`;
    // Chrome measures: JSON.stringify(value).length + key.length <= 8192
    // JSON.stringify of a string adds 2 quote chars
    const maxChars = CHROME_SYNC_ITEM_MAX_BYTES - key.length - 2;

    const end = Math.min(offset + maxChars, compressed.length);
    chunks.push(compressed.slice(offset, end));
    keys.push(key);

    offset = end;
    chunkIndex++;
  }

  return { chunks, keys };
}
```

**Note:** This removes the `TextEncoder` import (`getByteLength`) if it's no longer used elsewhere. Check for other usages before removing.

**However**, there's a caveat: wOxxOm (Chromium contributor) noted that Chrome may internally convert to UTF-8 for the per-item limit. If this is the case, the current UTF-8 approach for per-item limits is correct but the `* 2` approach for total quota is wrong (since `getBytesInUse` would also be returning UTF-8 counts). To handle this ambiguity safely:

**Recommended approach:** Keep the UTF-8 measurement for `createPreciseChunks` (safe/conservative for per-item limits), but fix the total quota estimation (Bug 7) to match what `getBytesInUse()` actually reports. Since `getBytesInUse()` is the source of truth for total quota, and `tryCompressionTiers` is compared against `quota.total` (which comes from `getBytesInUse`), the size estimation in `tryCompressionTiers` must match `getBytesInUse`'s measurement model.

**Practical fix:** After compressing, do a trial calculation of what `getBytesInUse` would report by simulating the chunk split with the same logic as `createPreciseChunks`, then summing the UTF-8 sizes:

```ts
function estimateBytesInUse(compressed: string): number {
  const encoder = new TextEncoder();
  let total = 0;
  let offset = 0;
  let chunkIndex = 0;

  while (offset < compressed.length) {
    const key = `${VAULT_CHUNK_PREFIX}${chunkIndex}`;
    const maxBytes = CHROME_SYNC_ITEM_MAX_BYTES - key.length - 2;

    // Use same binary search as createPreciseChunks to find chunk boundary
    let low = offset;
    let high = compressed.length;
    let bestEnd = offset;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const chunk = compressed.slice(offset, mid);
      const bytes = encoder.encode(chunk).length;

      if (bytes <= maxBytes) {
        bestEnd = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestEnd === offset) bestEnd = offset + 1;

    const chunk = compressed.slice(offset, bestEnd);
    // getBytesInUse reports: key.length + JSON.stringify(value) in UTF-8
    // We approximate: key UTF-8 length + value UTF-8 length + 2 (JSON quotes)
    total += encoder.encode(key).length + encoder.encode(chunk).length + 2;

    offset = bestEnd;
    chunkIndex++;
  }

  return total;
}
```

Then in `tryCompressionTiers`, replace `compressed.length * 2` with `estimateBytesInUse(compressed)`.

**This is more expensive than `* 2` but is done per compression tier (max 3 tiers × 2 variants = 6 calls), and accuracy prevents the premature fallback.**

However, this duplicates the chunk-splitting logic. A simpler approach: since `createPreciseChunks` already computes the chunks, refactor so that `tryCompressionTiers` can call a lightweight "estimate only" version that returns the estimated total bytes without actually creating chunk arrays.

---

## Bug 9: `tryCompressionTiers` exhaustion throws error → catch block triggers `fallbackToLocal`

**File:** `src/services/vaultService.ts` lines 537, 839-864

**Problem:** When `tryCompressionTiers` exhausts all tiers, it throws `new Error('Vault too large for any compression tier')`. The `catch` block in `saveVault` (line 839) catches this and returns `{ success: true, fallbackToLocal: true }`. This is correct behavior — falling back to local when sync can't fit the data.

**However**, because of Bug 7 (2x over-estimation), `tryCompressionTiers` reports data as "too large" when it actually fits. Fixing Bug 7 and Bug 8 will fix this indirectly by making the size calculations accurate.

No additional code change needed — fixing the byte measurement model resolves this.

---

## Bug 10: `quotaService.getVaultQuota()` doesn't count meta key overhead

**File:** `src/services/quotaService.ts` lines 53-76

**Problem:** `getVaultQuota` calls `getBytesInUse(vaultKeys)` where `vaultKeys` includes `VAULT_META_KEY` and all chunk keys. The quota `total` is `CHROME_SYNC_QUOTA_BYTES - settingsBytes`. But the meta key (`vault_meta`) also consumes quota — it stores the `VaultMeta` object which includes `chunkKeys` array, checksum, timestamp, etc. As the number of chunks grows, the meta key itself grows (because it stores all chunk key names).

Currently this is implicitly handled because `getBytesInUse(vaultKeys)` includes the meta key's bytes in `used`. But when **predicting** whether new data will fit (in `tryCompressionTiers`), the meta key overhead is not included in the size estimate. For a vault with 10 chunks, the meta object can be 300-500 bytes.

**Fix:** Add meta overhead estimation to `estimateBytesInUse` / `calculateChromeSyncCost`:

```ts
// After computing chunks, estimate meta overhead
const meta = {
  version: STORAGE_VERSION,
  chunkCount: chunkCount,
  chunkKeys: keys,
  checksum: 'a'.repeat(64), // SHA-256 hex is always 64 chars
  timestamp: Date.now(),
  compressed: true,
  compressionTier: tier,
  minified: true,
  domainDedup: false
};
const metaCost = encoder.encode(JSON.stringify(meta)).length + VAULT_META_KEY.length;
total += metaCost;
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/services/vaultService.ts` | Add `estimateBytesInUse()` helper; update `tryCompressionTiers` to use it instead of `compressed.length * 2`; include meta overhead in estimate |
| `src/store/slices/useVaultSlice.ts` | Update `checkQuotaBeforeSave` Tier 2 to use the same estimation function (import from vaultService or extract to shared util) |
| `src/constants.ts` | No changes needed |
| `src/services/quotaService.ts` | No changes needed (already fixed) |

## Implementation Notes

1. The `estimateBytesInUse` function should be exported from `vaultService.ts` (or a shared utility) so `checkQuotaBeforeSave` in the vault slice can use the same logic.

2. The `VAULT_QUOTA_SAFETY_MARGIN_BYTES` (2048) can likely be reduced to ~512 bytes now that the estimates are accurate, but keep it at 2048 for safety since Chrome's internal accounting may have undocumented overhead (~40 bytes sync server meta per item, per wOxxOm).

3. After applying these fixes, the effective usable vault capacity should roughly **double** compared to the current broken state, since the `* 2` over-estimation is removed.

4. `checkQuotaBeforeSave` should keep its tiered approach but update the tiers:
   - **Tier 1 (fast):** Raw JSON `.length` of the uncompressed test vault. If this is less than `maxBytes`, compression will only make it smaller → definitely fits.
   - **Tier 2 (accurate):** Actually compress, then call `estimateBytesInUse()` to get the real predicted cost. Compare against `quota.total - VAULT_QUOTA_SAFETY_MARGIN_BYTES`.
   - **Tier 3:** Return `{ allowed: false, shouldSwitchToLocal: true }`.

## Verification

After all changes:

```bash
npm run test:fail-only   # fix any broken tests
npm run build            # ensure compilation
```

Update any tests in:
- `src/services/__tests__/quotaService.test.ts`
- `src/services/__tests__/vaultService.test.ts`
- `src/services/__tests__/vaultAdvanced.test.ts`
- `src/store/slices/__tests__/useVaultSlice.test.ts`
- `src/components/__tests__/VaultPanel.test.tsx`
- `src/components/__tests__/QuotaExceededModal.test.tsx`
- `src/utils/__tests__/errorCases.test.ts`
