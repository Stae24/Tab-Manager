# src/store AGENTS.md

## OVERVIEW
Zustand state engine composed of 5 slices. Orchestrates Live Workspace (active tabs/groups) and Neural Vault (archives) with optimistic updates, command-pattern undo/redo, and cross-window sync.

## SLICE ARCHITECTURE
- **useTabSlice**: `islands`, `moveItemOptimistically`, `syncLiveTabs`, drag state
- **useVaultSlice**: `vault`, `moveToVault`, `restoreFromVault`, `saveToVault`
- **useUISlice**: `dividerPosition`, `showVault`, `searchQuery`, `sortOption`
- **useAppearanceSlice**: `theme`, `accentColor`, `density`, `vaultSyncEnabled`
- **useCommandSlice**: `executeCommand`, `undo`, `redo`, command history

## UTILS (store/utils.ts)
- `parseNumericId()`: Strips `live-tab-*` prefix → numeric Chrome ID
- `isTab()` / `isIsland()` / `isVaultItem()`: Type guards
- `findItemInList()`: Recursive item search across nested structures
- `syncSettings()`: Debounced settings persistence (1000ms)
- `defaultAppearanceSettings`: Fallback config object

## MOVE ENGINE
`moveItemOptimistically` is the core drag-and-drop engine:
- **Atomic State**: Deep-clones state, calculates move, single render cycle
- **Frame-Aligned**: Uses `requestAnimationFrame` to prevent React Error #185
- **Update Lock**: `isUpdating` flag blocks background sync during local moves
- **ID Normalization**: `parseNumericId()` strips prefixes before Chrome API calls

## COMMAND PATTERN (Undo/Redo)
Located in `src/store/commands/`:
- `MoveTabCommand`: Records from/to positions, window, group
- `MoveIslandCommand`: Records group relocation
- `executeCommand()`: Pushes to history, executes, updates UI
- `undo()`/`redo()`: Replays inverse/forward commands

## STORAGE & SYNC
- **Settings** → `chrome.storage.sync` (debounced 1000ms)
- **Vault** → `chrome.storage.sync` (chunked/compressed) OR `chrome.storage.local`
- **effectiveSyncEnabled**: Tracks whether vault sync is actually active (false if quota exceeded)
- **vaultQuota**: Real-time quota monitoring with warning levels

## INITIALIZATION FLOW
1. Load settings → apply to state
2. `migrateFromLegacy()` → upgrade old storage format
3. `loadVault()` → decompress + verify checksum
4. Check quota → auto-disable sync if critical
5. Watch `chrome.storage.onChanged` → cross-window sync

## ANTI-PATTERNS
- **Immutable Violations**: Direct push/splice on `islands`/`vault`
- **API Guard Bypassing**: Chrome API calls without `isUpdating` check
- **Loose ID Comparison**: `==` instead of `===` with stringified IDs
- **Transient Data Persistence**: Raw `chrome.tabs.Tab` objects
- **Direct API Interaction**: `chrome.*` outside services/utils
