# OVERVIEW

Recursive optimistic move engine for hierarchical Tab and Island reordering.

## MOVE ENGINE

- **Logic**: `moveItemOptimistically` in `useStore.ts`.
- **Recursion**: Unbinds source, recalculates path, and inserts at target.
- **Locking**: `isUpdating` guard blocks re-entrant moves during browser sync.
- **Namespacing**: Vault items MUST use `vault-` prefix to avoid ID collisions.

## STORAGE STRATEGY

- **Tiering**:
  - `chrome.storage.local`: Large Vault data (prevents sync quota overflow).
  - `chrome.storage.sync`: Small UI settings (Theme, Scale).
- **Writes**: Debounced and atomic; local writes prioritized for latency.

## ANTI-PATTERNS

- **No Mutation**: Use immutable updates only.
- **No Loose Equality**: Use `===` for ID checks (prevents string/number mismatch).
- **No Direct API**: Always use `utils/chromeApi.ts` wrappers.
