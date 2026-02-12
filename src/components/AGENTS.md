# src/components AGENTS.md

## OVERVIEW
UI layer for dual-panel tactical dashboard (Live Workspace vs. Neural Vault). DnD orchestration via @dnd-kit, GX-themed styling.

## COMPONENT HIERARCHY
```
Dashboard.tsx (DndContext orchestrator)
├── Sidebar.tsx (settings toggle, vault count)
├── LivePanel.tsx (active tabs/groups)
│   ├── Island.tsx (group container, collapsible)
│   │   └── TabCard.tsx (draggable tab)
│   └── DroppableGap.tsx (proximity-expanded drop zones)
├── VaultPanel.tsx (archived items)
├── AppearanceSettingsPanel.tsx (theme, density, sync toggle)
├── QuotaWarningBanner.tsx (storage warnings)
├── QuotaExceededModal.tsx (quota exceeded action)
├── ContextMenu.tsx (right-click actions)
├── Favicon.tsx (cached favicon rendering)
└── ErrorBoundary.tsx (error containment)
```

## DND FLOW (@dnd-kit)
- **Sensors**: `PointerSensor` (8px activation) + `KeyboardSensor`
- **Proximity Gaps**: `useProximityGap` expands drop zones during drag
- **Cross-Panel**: ID prefix detection (`vault-*` vs `live-*`)
- **Optimistic UI**: `moveItemOptimistically` → immediate state update
- **Command Pattern**: `MoveTabCommand`/`MoveIslandCommand` for undo

### handleDragEnd Logic
| Source | Target | Action |
|--------|--------|--------|
| Live Tab | Vault Area | `moveToVault()` |
| Vault Item | Live Area | `restoreFromVault()` |
| Live Tab | Create Zone | `createIsland()` |
| Live Tab | Live Tab | Reorder via command |
| Island | Island | Reorder group |

## STYLING (GX Theme)
- **Accent**: `gx-accent: #7f22fe` (purple)
- **Neon Glow**: `shadow-[0_0_8px_rgba(127,34,254,0.5)]`
- **Borders**: `getIslandBorderColor()` maps Chrome TabGroupColor
- **Dark Mode**: `isDarkMode` state toggles `dark` class

## STATE LOCKING
`isUpdating` flag during drag prevents background sync from overriding optimistic layout. Always set before Chrome API calls, clear after.

## NOTES
- **scaleModifier**: Adjusts drag coordinates for zoom levels
- **isCreatingIsland**: Shows loading state during group creation
- **searchQuery**: Filters all tabs, groups results by option
