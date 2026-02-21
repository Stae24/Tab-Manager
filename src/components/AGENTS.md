# src/components AGENTS.md

## OVERVIEW
UI layer for dual-panel tactical dashboard (Live Workspace vs. Neural Vault). DnD orchestration via @dnd-kit, GX-themed styling.

---

## COMPONENT HIERARCHY

```
Dashboard.tsx (DndContext orchestrator)
├── Sidebar.tsx (settings toggle, vault count)
├── LivePanel.tsx (active tabs/groups)
│   ├── Island.tsx (group container, collapsible)
│   │   └── TabCard.tsx (draggable tab)
│   └── DroppableGap.tsx (proximity-expanded drop zones)
├── VaultPanel.tsx (archived items)
│   └── VaultGroup.tsx (vault group container)
├── AppearanceSettingsPanel.tsx (theme, density, sync toggle)
├── QuotaWarningBanner.tsx (storage warnings)
├── QuotaExceededModal.tsx (quota exceeded action)
├── ContextMenu.tsx (right-click actions)
├── Favicon.tsx (cached favicon rendering)
├── SearchBar.tsx (search input with autocomplete)
└── ErrorBoundary.tsx (error containment)
```

---

## DND FLOW (@dnd-kit)

**Sensors:** `PointerSensor` (8px activation) + `KeyboardSensor`

**Pattern:**
1. `DragStartEvent` → set `activeItem` state
2. `DragOverEvent` → calculate proximity gap expansion
3. `DragEndEvent` → execute move via command pattern

### handleDragEnd Logic

| Source | Target | Action |
|--------|--------|--------|
| Live Tab | Vault Area | `moveToVault()` |
| Vault Item | Live Area | `restoreFromVault()` |
| Live Tab | Create Zone | `createIsland()` |
| Live Tab | Live Tab | `MoveTabCommand` |
| Island | Island | `MoveIslandCommand` |

---

## STYLING (GX Theme)

| Token | Value |
|-------|-------|
| Accent | `#7f22fe` (purple) |
| Neon Glow | `shadow-[0_0_8px_rgba(127,34,254,0.5)]` |
| Group Borders | `getIslandBorderColor()` maps Chrome TabGroupColor |
| Dark Mode | `isDarkMode` state toggles `dark` class |

---

## STATE LOCKING

```typescript
// Always lock during async Chrome operations
setIsUpdating(true);
try {
  await tabService.moveTab(...);
} finally {
  setIsUpdating(false);
}
```

---

## USAGE

```typescript
// Destructure selectors at top
const islands = useStore(state => state.islands);
const moveItem = useStore(state => state.moveItemOptimistically);

// Memoize callbacks
const handleDragEnd = useCallback((event: DragEndEvent) => {
  // Cross-panel detection via ID prefix
  if (activeId.startsWith('vault-')) {
    restoreFromVault(activeId);
  }
}, [dependencies]);
```

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Chrome API in components | Use store actions / services |
| Direct `isUpdating` bypass | Always check/set flag |
| Inline styles for theme | Use Tailwind + `cn()` |
