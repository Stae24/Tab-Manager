# Vault Sync Fallback Triggered Too Early: Investigation + Fix Plan

## Problem Summary
User logs show a contradictory sequence:
- Quota pre-check reports plenty of space (`available: 98191` bytes).
- Compression selector reports fit (`16684 <= 98191`).
- Save fails immediately with `Resource::kQuotaBytesPerItem quota exceeded`.
- Code then triggers fallback to local storage and auto-disables sync.

This means total-capacity checks are passing, but at least one **single sync item** exceeds `QUOTA_BYTES_PER_ITEM` during `chrome.storage.sync.set()`.

## Confirmed Root Cause
The per-item sizing math in vault chunking/estimation does not match how Chrome enforces per-item quota for string values.

### Where the mismatch happens
1. `estimateBytesInUse()` models item cost with raw UTF-8 chunk bytes + `2` quote bytes.
   - File: `src/services/vaultService.ts` lines ~35-97
2. `createPreciseChunks()` uses the same raw UTF-8 chunk bytes to push each chunk up to `CHROME_SYNC_ITEM_MAX_BYTES - key.length - 2`.
   - File: `src/services/vaultService.ts` lines ~530-576
3. Save path relies on those checks, then writes all items in one `chrome.storage.sync.set(storageData)` call.
   - File: `src/services/vaultService.ts` lines ~792-934

### Why this causes early fallback
Some UTF-16 characters in compressed strings are escaped when stringified for storage accounting (for example C1/control-like ranges). That can add bytes beyond the current `+2` quote assumption.

So a chunk can be “estimated” to fit exactly (for example `8192`) but actual storage-accounted size is `>8192`, causing `kQuotaBytesPerItem` even though overall vault quota is healthy.

I reproduced this with a local script: a chunk computed at `est: 8192` had an actual stringified size of `8193`, which is enough to fail the write.

## Fix Strategy (Implementation Plan)

### 1. Align per-item measurement with storage reality
- Add a shared helper in `vaultService` that computes per-item size using the storage-relevant representation:
  - `itemBytes = byteLength(key) + byteLength(JSON.stringify(value))`
- Stop using raw `encoder.encode(chunk).length + 2` for per-item decisions.

Files:
- `src/services/vaultService.ts`

### 2. Make chunking boundary use the new item-size helper
- Update `createPreciseChunks()` binary search predicate to test candidate chunks with the helper above.
- Keep a small buffer (for example `PER_ITEM_SAFETY_BUFFER_BYTES = 8..16`) to avoid boundary off-by-one and implementation variance.
- Keep existing single-char guard, but evaluate it via the same helper.

Files:
- `src/services/vaultService.ts`

### 3. Update estimation logic to use identical math
- Update `estimateBytesInUse()` so chunk and meta estimates use the same size function as chunking.
- This ensures “fits” logs are trustworthy and consistent with write behavior.

Files:
- `src/services/vaultService.ts`

### 4. Add graceful retry before fallback on per-item quota errors
- In `saveVault()` catch path, detect `kQuotaBytesPerItem` specifically.
- Retry once with stricter chunk limits (larger buffer / smaller max item size) before falling back to local.
- Only fallback after retry fails.

Files:
- `src/services/vaultService.ts`

### 5. Improve diagnostics
- Log max predicted per-item bytes before write (meta + max chunk).
- On write failure, log predicted bytes for each item key to pinpoint offender.

Files:
- `src/services/vaultService.ts`

## Test Plan

### Unit tests to add/adjust
1. **Per-item boundary correctness**
- Verify chunk builder never emits chunk keys whose computed storage item size exceeds `CHROME_SYNC_ITEM_MAX_BYTES`.
- Include values requiring escaping (`\u0080`, `\u2028`, quotes/backslashes) in test data.

2. **Regression for early fallback**
- Mock a scenario where old math would allow the write but storage rejects per-item size.
- Assert new behavior retries with stricter chunking and succeeds without `fallbackToLocal`.

3. **Estimator/chunker consistency**
- Assert `estimateBytesInUse()` upper-bounds actual bytes measured from generated `storageData` representation for chunked payloads.

Likely files:
- `src/services/__tests__/vaultService.test.ts`
- `src/utils/__tests__/vaultStorage.test.ts` (if legacy wrappers still cover this path)

## Acceptance Criteria
- No `fallbackToLocal` when only issue is near-boundary per-item chunk sizing.
- `saveVault()` succeeds for datasets that previously failed with `kQuotaBytesPerItem` despite healthy total quota.
- Logs no longer report “fits” followed by immediate per-item quota failure in the same save attempt.
- Existing test suite + new regression tests pass.

## Execution Order for Next Agent
1. Implement shared item-size helper and refactor chunking + estimator to use it.
2. Add per-item retry path in `saveVault()` for `kQuotaBytesPerItem`.
3. Add/adjust tests.
4. Run verification loop:
   - `npm run test:fail-only`
   - `npm run build`
