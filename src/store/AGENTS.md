# src/store AGENTS.md

## OVERVIEW
Zustand state engine with 5 slices. Orchestrates Live Workspace and Neural Vault with optimistic updates, command-pattern undo/redo, and cross-window sync.

---

## STRUCTURE

```
store/
├── useStore.ts      # Main store creation, initialization
├── types.ts         # StoreState interface
├── utils.ts         # Type guards, helpers
├── slices/
│   ├── useTabSlice.ts       # islands, moveItemOptimistically
│   ├── useVaultSlice.ts     # vault, moveToVault, restoreFromVault
│   ├── useUISlice.ts        # dividerPosition, showVault, search
│   ├── useAppearanceSlice.ts # theme, accentColor, density
│   └── useCommandSlice.ts   # executeCommand, undo, redo
└── commands/
    ├── types.ts             # Command interface
    ├── MoveTabCommand.ts    # Tab relocation undo/redo
    └── MoveIslandCommand.ts # Group relocation undo/redo
```

---

## SLICE OVERVIEW

| Slice | State | Key Actions |
|-------|-------|-------------|
| useTabSlice | `islands`, `isUpdating` | `moveItemOptimistically`, `syncLiveTabs` |
| useVaultSlice | `vault`, `vaultQuota` | `moveToVault`, `restoreFromVault`, `saveToVault` |
| useUISlice | `dividerPosition`, `showVault` | `setDividerPosition`, `setShowVault` |
| useAppearanceSlice | `appearanceSettings` | `setAppearanceSettings` |
| useCommandSlice | `commandHistory` | `executeCommand`, `undo`, `redo` |

---

## UTILS (store/utils.ts)

| Function | Purpose |
|----------|---------|
| `parseNumericId()` | Strips `live-tab-*` prefix → numeric Chrome ID |
| `isTab()` / `isIsland()` | Type guards |
| `isVaultItem()` | Type guard for vault items |
| `findItemInList()` | Recursive item search |
| `defaultAppearanceSettings` | Fallback config object |

---

## MOVE ENGINE

`moveItemOptimistically` is the core drag-and-drop engine:
- **Atomic State**: Deep-clones state, calculates move, single render
- **Frame-Aligned**: Uses `requestAnimationFrame` to prevent React Error #185
- **Update Lock**: `isUpdating` flag blocks background sync during moves
- **ID Normalization**: `parseNumericId()` strips prefixes before Chrome API calls

---

## INITIALIZATION FLOW

1. Load settings → apply to state
2. `migrateFromLegacy()` → upgrade old storage format
3. `loadVaultWithRetry()` → decompress + verify checksum
4. Check quota → auto-disable sync if critical
5. Watch `chrome.storage.onChanged` → cross-window sync

---

## USAGE

```typescript
// Selector pattern (reactive)
const islands = useStore(state => state.islands);
const moveItem = useStore(state => state.moveItemOptimistically);

// Inside effects (fresh state)
useEffect(() => {
  useStore.getState().syncLiveTabs();
}, []);
```

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Direct `islands.push()` | Create new array for immutability |
| Chrome API without `isUpdating` | Set flag before, clear after |
| `==` for ID comparison | `String(a) === String(b)` |
| Raw `chrome.tabs.Tab` objects | Use normalized `Tab` type |
