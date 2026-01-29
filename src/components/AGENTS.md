# src/components AGENTS.md

## OVERVIEW
UI layer for the Opera GX Island Manager. Centered around a dual-panel tactical dashboard (Live Workspace vs. Neural Vault) with heavy emphasis on drag-and-drop orchestration and GX-themed visual feedback.

## UI ARCHITECTURE
- **Dashboard.tsx (Monolithic)**: Orchestrates the `DndContext`. Contains `LivePanel` (active tabs/groups) and `VaultPanel` (archived items).
- **Island.tsx**: Interactive group container. Handles collapsing, renaming, and nested sortable tabs.
- **TabCard.tsx**: Atomic draggable unit. Responsive to density settings and discarded states.
- **Refactor Targets**:
  - Extract `LivePanel` and `VaultPanel` to standalone files.
  - Move DnD logic from `Dashboard.tsx` into a `useDashboardDnd` hook.
  - Decouple proximity tracking logic (`useProximityGap`) into a specialized utility.

## DND FLOW (dnd-kit)
- **Sensors**: `PointerSensor` (activation distance: 8px) + `KeyboardSensor`.
- **Proximity Gaps**: `useProximityGap` and `DroppableGap` expand invisible droppable zones between Islands to prevent "target jumping" during reordering.
- **Cross-Panel Logic**: `handleDragEnd` detects moves via ID namespacing (`vault-*` prefix).
  - **Live -> Vault**: Triggers `moveToVault` (archive).
  - **Vault -> Live**: Triggers `restoreFromVault` (unarchive).
  - **Live -> Create Zone**: Triggers `createIsland` for tactical grouping.
- **Optimistic UI**: `moveItemOptimistically` updates Zustand state immediately; `syncLiveTabs` reconciles with Chrome API on drop.

## STYLING PATTERNS (GX THEME)
- **Neon Accents**: `shadow-[0_0_8px_rgba(127,34,254,0.5)]` for interactive headers.
- **Glow/Pulse**: `animate-pulse-glow` for loading (`isCreatingIsland`) and active drag states.
- **Borders**: `Island` borders map to Chrome's `TabGroupColor` via `getIslandBorderColor`.
- **Panel Feedback**: `LivePanel` uses `bg-gx-accent/5` when items are hovered; `VaultPanel` uses `bg-gx-red/5` for archiving intent.

## NOTES
- **State Locking**: `useStore.setIsUpdating(true)` during drag prevents background sync from overriding optimistic layout.
- **UI Scaling**: `scaleModifier` in `DndContext` ensures drag coordinates remain accurate across different zoom levels.
