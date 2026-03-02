# Vault Persistence Data Loss — Implementation Plan

## Root Cause Analysis

The vault diff system in `vaultService.ts` has a **fatal flaw** that causes data loss on reload. The core issue is that diffs are computed against an **in-memory** `previousVaultState` (which updates after every save), but are applied on load against the **persisted base snapshot** in sync storage (which is only updated during full saves). Each diff save **overwrites** the previous diff, so intermediate changes are silently lost.

### Data Loss Reproduction

1. **Full save**: vault = `[A, B, C]` → base in sync = `[A, B, C]`, `previousVaultState = [A, B, C]`
2. **Add D**: `computeDiff([A,B,C], [A,B,C,D])` → diff = `{added:[D]}`. Small enough → **diff mode**. Only diff is saved (overwrites sync's `vault_diff` key). Base chunks are NOT updated. `previousVaultState = [A,B,C,D]`
3. **Add E**: `computeDiff([A,B,C,D], [A,B,C,D,E])` → diff = `{added:[E]}`. **Overwrites** previous diff. `previousVaultState = [A,B,C,D,E]`
4. **Reload**: loads base `[A,B,C]` from chunks, applies diff `{added:[E]}` → **result = `[A,B,C,E]`**. **D is lost.**

This compounds with every subsequent diff-mode save: only the most recent change survives a reload, all intermediate additions/deletions vanish.

### Secondary Issues

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | **Diff overwrites lose intermediate changes** (core bug above) | `saveVault` L807–828, `saveDiff` L559–562 | **Critical** |
| 2 | **No write serialization** — rapid saves can interleave, corrupting `previousVaultState` | `saveVault` (no mutex) | High |
| 3 | **Diff-mode saves don't update `vault_meta` timestamp** — the `watchSettings` listener in `useStore.ts:243` only reloads on `vault_meta` changes, so diff-only saves don't trigger cross-instance sync | `saveVault` L810–825 | Medium |
| 4 | **`COMPACT_IDLE_INTERVAL_MS` is defined but never used** — there is no compaction logic to fold accumulated diffs back into a full save | `constants.ts:18` | Low (dead code) |

---

## Implementation Plan

### Approach: Remove the Diff System Entirely

The diff system is an optimization to reduce write size, but it introduces a fundamental correctness issue that cannot be reliably fixed without adding significant complexity (diff accumulation, compaction scheduling, base-tracking). Since the full save path already has compression tiers, minification, and domain dedup, the size savings from diffs are marginal compared to the risk of data loss.

**Always perform full saves. Remove all diff-related code paths.**

### Phase 1: Remove Diff Save Path

**File: `src/services/vaultService.ts`**

1. **Delete the following functions** (they become dead code):
   - `computeDiff` (L438–446)
   - `shouldUseDiffMode` (L448–459)
   - `loadDiff` (L535–557)
   - `saveDiff` (L559–562)
   - `applyDiff` (L564–569)

2. **Remove the `previousVaultState` module-level variable** (L436) and all assignments to it:
   - L797: `previousVaultState = vault;` (local-only save path)
   - L817: `previousVaultState = vault;` (diff-mode save path)
   - L922: `previousVaultState = vault;` (full-save path)
   - L777: `previousVaultState = parsed;` (load path)

3. **Remove the diff-mode branch in `saveVault`** (L805–829):
   ```
   // DELETE this entire block:
   const diff = previousVaultState ? computeDiff(previousVaultState, vault) : null;
   if (diff && shouldUseDiffMode(diff, vault)) {
     ... (lines 807-828)
   }
   ```

4. **Remove diff application in `loadVault`** (L771–775):
   ```
   // DELETE this block:
   const diff = await loadDiff();
   if (diff) {
     logger.info('VaultService', `Applying diff: ...`);
     parsed = await applyDiff(parsed, diff);
   }
   ```

5. **Keep the existing `VAULT_DIFF_KEY` cleanup** on full save (L917) — this ensures any leftover diff from before the fix is cleaned up on the next save.

### Phase 2: Add Write Serialization

**File: `src/services/vaultService.ts`**

Add a simple promise-based mutex to prevent concurrent saves from interleaving:

1. Add a module-level save lock:
   ```typescript
   let saveLock: Promise<VaultStorageResult> | null = null;
   ```

2. Wrap `saveVault` so each call waits for the previous one to complete before starting:
   ```typescript
   saveVault: async (vault, config) => {
     const doSave = async (): Promise<VaultStorageResult> => {
       // ... existing full-save logic (minus diff code) ...
     };

     if (saveLock) {
       await saveLock.catch(() => {});
     }
     saveLock = doSave();
     try {
       return await saveLock;
     } finally {
       saveLock = null;
     }
   }
   ```

### Phase 3: Clean Up Dead Constants and Types

1. **File: `src/constants.ts`** — Remove:
   - `VAULT_DIFF_KEY` (L16)
   - `DIFF_COMPACT_THRESHOLD` (L17)
   - `COMPACT_IDLE_INTERVAL_MS` (L18)

2. **File: `src/types/index.ts`** — Remove:
   - `VaultDiff` interface (L102–106)
   - `diffKey` field from `VaultMeta` (L117)

3. **File: `src/services/storageKeys.ts`** — Remove `VAULT_DIFF_KEY` from the import in `vaultService.ts` (it's imported from `constants.ts`). Confirm `clearAllVaultChunks` in `vaultService.ts` L479 still references `VAULT_DIFF_KEY` for cleanup — keep this reference temporarily or inline the string `'vault_diff'` with a comment that it's for legacy cleanup only.

### Phase 4: Update Tests

**File: `src/services/__tests__/vaultAdvanced.test.ts`**

1. **Remove or rewrite the "Incremental Diffs" test block** (L180–194) — this test asserts diff mode is used; it should instead assert that a full save always occurs.

2. **Add a new test: "consecutive saves preserve all items on reload"**:
   - Save vault `[A, B, C]`
   - Save vault `[A, B, C, D]`
   - Save vault `[A, B, C, D, E]`
   - Load vault
   - Assert loaded vault has all 5 items

3. **Add a new test: "concurrent saves don't lose data"**:
   - Fire off multiple `saveVault` calls concurrently
   - Verify the final persisted state matches the last call's input

**File: `src/services/__tests__/vaultService.test.ts`** — Verify existing tests pass. No changes expected since they test the full-save path.

### Phase 5: Verify

1. Run `npm run test:fail-only` — ensure no regressions
2. Run `npm run build` — ensure compilation succeeds
3. Manual smoke test: add tabs to vault one at a time, reload extension, verify all tabs persist

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/services/vaultService.ts` | Remove diff functions, diff branch in saveVault, diff application in loadVault, `previousVaultState`. Add save mutex. |
| `src/constants.ts` | Remove `VAULT_DIFF_KEY`, `DIFF_COMPACT_THRESHOLD`, `COMPACT_IDLE_INTERVAL_MS` |
| `src/types/index.ts` | Remove `VaultDiff` interface, `diffKey` from `VaultMeta` |
| `src/services/__tests__/vaultAdvanced.test.ts` | Replace diff test with consecutive-save correctness test |

## Risk Assessment

- **Low risk**: The full-save path is already battle-tested with compression tiers, chunking, checksums, and verification. We're removing the fragile optimization layer, not touching the proven persistence core.
- **Performance**: Each save will write full chunks instead of a small diff. Given vault sizes are typically <100KB compressed and Chrome sync has a 100KB limit, the impact is negligible. The compression/minification system already handles size efficiently.
