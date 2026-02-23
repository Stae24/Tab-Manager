# Vault Storage Compression Full Optimization Plan

This document outlines an optimization strategy to significantly improve storage efficiency in `chrome.storage.sync` for the Tab Manager Vault, which can be enacted by another agent. 

## 1. Multi-tier Compression (Data Degradation Strategy)
Currently, if the full vault payload fails to fit within available quota after LZ-String compression, the save fails entirely and falls back to local storage. Instead, implement compression tiers to proactively drop non-essential data before compressing.

**Implementation Steps:**
- Create `COMPRESSION_TIERS` in `src/services/vaultService.ts`.
- **Tier 1 (Standard)**: Compress the full vault object as is (`LZString.compressToUTF16(JSON.stringify(vault))`).
- **Tier 2 (No Favicons)**: Strip `favicon` strings from vault items before compression. Favicons can consume significant string size and are mostly visual sugar.
- **Tier 3 (Minimal)**: Strip `favicon`, `color`, and `collapsed` properties. Keep only routing properties (`id`, `title`, `url`, `savedAt`, `originalId`).
- Iterate through these tiers when checking `quota.available` vs the `compressedBytes`. Save using the highest-fidelity tier that fits.
- Update UI (e.g. `src/store/slices/useVaultSlice.ts` to reflect the active compression tier) when degradation happens.

## 2. Incremental (Differential) Saves
To avoid constantly compacting and chunking the entire array of data when a single item changes, track modifications (Added/Deleted/Updated).

**Implementation Steps:**
- In `vaultService.ts`, introduce short-lived state to track `dirtyItems` and `deletedItems`.
- Add a new chunk reserved for deltas (e.g., `vault_diff`).
- When a change occurs, compute a JSON patch `{"added": [...], "deleted": [...]}` instead of stringifying the entire vault.
- Compress the patch and save it to the `vault_diff` key.
- Update `loadVault` to apply the `vault_diff` patch over the chunks to assemble the in-memory array.
- Only run full compression/compaction of the main chunks occasionally (e.g., when the `vault_diff` reaches 30% of max chunk size, or every 15 minutes of idle time).

## 3. Structural Minification (Alias Dictionary)
Since each object contains repetitive string keys (`"id"`, `"title"`, `"url"`, `"favicon"`, `"savedAt"`), their repetition adds bloat before LZ-String processing.

**Implementation Steps:**
- Map the array of objects to array of arrays, or use brief aliases:
  `{i: "id", t: "title", u: "url", f: "favicon", s: "savedAt"}`.
- Before stringification arrays take significantly less space: 
  `[["id1", "Title 1", "https://url", "b64...", 170923]]`.
- Reconstruct the full object array in `loadVault` using the array indices.

## 4. Better Chunk Boundaries
The current overhead buffering in chunk splitting (`JSON_OVERHEAD_BUFFER_BYTES = 128`) and pessimistic byte checks in the loop can leave space on the table.
- Use explicit byte encoders `TextEncoder().encode()` to exactly partition UTF-16 characters up to `CHROME_SYNC_ITEM_MAX_BYTES - keyLength` without guesswork.

## Target Files for Changes
- `src/services/vaultService.ts`
- `src/store/slices/useVaultSlice.ts`
- `src/types/index.ts` (For new `CompressionTier` types)
- `src/utils/__tests__/vaultStorage.test.ts`
