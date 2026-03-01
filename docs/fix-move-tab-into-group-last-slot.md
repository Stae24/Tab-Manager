# Fix: Tab Lands One Position Too High When Moving Up Into Group's Last Slot

## Bug Description

When dragging a tab from **below a group** (root level) **upward** into the **last slot of that group**, the drop indicator correctly shows the tab will become the last item in the group, but after the drop the tab ends up **one position higher** (second to last). The previous last tab gets pushed down instead of remaining in place.

**Only occurs when:** Moving a root-level tab upward into the last position of a group.

## Root Cause

In `src/store/operations/moveItem.ts`, the `calculateMoveTarget` function (line 84–85) sets:

```typescript
targetContainerId = over.containerId;  // the group ID
targetIndex = over.index;              // the over tab's index within the group
```

When the dragged tab (at root level, below the group) hovers over the last tab in the group (e.g., index 2), `targetIndex` is set to `2`. The `applyOptimisticMove` function then splices the dragged tab at index 2, **pushing the existing last tab to index 3**. The dragged tab ends up second-to-last instead of last.

### Trace of the Bug

**Setup:** `root = [Group, TabD]`, `Group.tabs = [TabA, TabB, TabC]`

1. User drags `TabD` (root index 1) upward over `TabC` (group index 2)
2. `calculateMoveTarget` returns `{ targetContainerId: groupId, targetIndex: 2 }`
3. `applyOptimisticMove`:
   - Removes `TabD` from root → `root = [Group]`
   - Inserts `TabD` at index 2 in group → `Group.tabs = [TabA, TabB, TabD, TabC]`
4. **Result:** `TabD` is second-to-last. **Expected:** `TabD` should be last → `[TabA, TabB, TabC, TabD]`

The issue is that for cross-container moves from below, inserting at the over item's index places the dragged item **before** the over item rather than **after** it.

## Fix

### File: `src/store/operations/moveItem.ts`

In `calculateMoveTarget`, after the existing island/group header check (after line 98), add logic to detect cross-container moves where the active tab is below the target group and adjust `targetIndex` by +1:

```typescript
// After line 98 (after the closing brace of the island check block):

// Cross-container fix: when a root tab moves upward into a group,
// insert AFTER the over item, not before it.
if (
  !isActiveGroup &&
  active.containerId === 'root' &&
  targetContainerId !== 'root'
) {
  const currentRoot = activeInLive ? islands : vault;
  const groupRootIndex = currentRoot.findIndex(
    (i) => String(i.id) === String(targetContainerId)
  );
  if (groupRootIndex !== -1 && active.index > groupRootIndex) {
    targetIndex = over.index + 1;
  }
}
```

**Why this works:**
- `active.containerId === 'root'` — the dragged item is at root level (not inside a group)
- `targetContainerId !== 'root'` — the target is inside a group (not root)
- `active.index > groupRootIndex` — the dragged item is **below** the group in the root list (moving upward)
- `over.index + 1` — inserts **after** the over item instead of before it

**Why this doesn't break other cases:**
- Moving **downward** into a group (active above the group): `active.index < groupRootIndex` → condition is false → no adjustment → inserting before the over item is correct
- Dropping on a **group header** (Island): handled earlier by lines 87–98 which set `targetIndex = 0` → `targetContainerId` is already set to the group ID with index 0, and the condition `targetContainerId !== 'root'` would be true but `over.index + 1` = 1 which... wait, no — the group header check sets `targetContainerId = over.item.id` and `targetIndex = 0`, but `over.containerId` at that point is `'root'`, so `over.index` is the group's root index. Our fix wouldn't interact badly because the block on lines 87–98 only fires when `over.item` has `tabs` (is an Island), and in that case it either sets `targetContainerId = 'root'` (so our check `targetContainerId !== 'root'` fails) or sets `targetIndex = 0` for non-collapsed groups (where our fix would run but `over.index` in that branch refers to the group header's root index, not a tab inside the group... actually this needs care).

**Correction:** To be safe, this fix should also verify that `over.containerId !== 'root'` (the over item is actually inside a group, not a root-level item):

```typescript
if (
  !isActiveGroup &&
  active.containerId === 'root' &&
  over.containerId !== 'root' &&
  targetContainerId !== 'root'
) {
  const currentRoot = activeInLive ? islands : vault;
  const groupRootIndex = currentRoot.findIndex(
    (i) => String(i.id) === String(targetContainerId)
  );
  if (groupRootIndex !== -1 && active.index > groupRootIndex) {
    targetIndex = over.index + 1;
  }
}
```

This ensures the fix only applies when dragging over a **tab inside a group**, not when dragging over the group header itself.

### No Other Files Need Changes

The `handleDragEnd` in `Dashboard.tsx` calculates `browserIndex` from `finalIslands` (the post-optimistic-move state). If the optimistic move places the tab correctly, `handleDragEnd` will calculate the correct browser index automatically.

## Tests

### File: `src/store/slices/__tests__/useTabSlice.test.ts`

Add these tests inside the existing `describe('moveItemOptimistically', ...)` block:

**Test 1 — The bug fix:**
```typescript
it('move tab from below group into group places tab after over item (last slot)', () => {
  const groupTab1 = createMockTab({ id: 'live-tab-10', groupId: 1 });
  const groupTab2 = createMockTab({ id: 'live-tab-11', groupId: 1 });
  const groupTab3 = createMockTab({ id: 'live-tab-12', groupId: 1 });
  const island = createMockIsland({
    id: 'live-group-1',
    collapsed: false,
    tabs: [groupTab1, groupTab2, groupTab3],
  });
  const tabBelow = createMockTab({ id: 'live-tab-20', index: 1 });
  // Root: [Group(tabs: [10, 11, 12]), Tab20]
  store = createTestStore({ islands: [island, tabBelow] });

  // Drag Tab20 over the last tab in the group (Tab12)
  store.getState().moveItemOptimistically('live-tab-20', 'live-tab-12');
  advanceTime(150);

  const islands = store.getState().islands;
  const updatedIsland = islands.find(i => String(i.id) === 'live-group-1') as Island;
  expect(updatedIsland.tabs).toHaveLength(4);
  // Tab20 should be LAST (after Tab12), not second-to-last
  expect(String(updatedIsland.tabs[3].id)).toBe('live-tab-20');
  expect(String(updatedIsland.tabs[2].id)).toBe('live-tab-12');
});
```

**Test 2 — Ensure moving from above still works correctly:**
```typescript
it('move tab from above group into group places tab before over item', () => {
  const tabAbove = createMockTab({ id: 'live-tab-20', index: 0 });
  const groupTab1 = createMockTab({ id: 'live-tab-10', groupId: 1 });
  const groupTab2 = createMockTab({ id: 'live-tab-11', groupId: 1 });
  const island = createMockIsland({
    id: 'live-group-1',
    collapsed: false,
    tabs: [groupTab1, groupTab2],
  });
  // Root: [Tab20, Group(tabs: [10, 11])]
  store = createTestStore({ islands: [tabAbove, island] });

  // Drag Tab20 over the first tab in the group (Tab10)
  store.getState().moveItemOptimistically('live-tab-20', 'live-tab-10');
  advanceTime(150);

  const islands = store.getState().islands;
  const updatedIsland = islands.find(i => String(i.id) === 'live-group-1') as Island;
  expect(updatedIsland.tabs).toHaveLength(3);
  // Tab20 should be FIRST (before Tab10)
  expect(String(updatedIsland.tabs[0].id)).toBe('live-tab-20');
  expect(String(updatedIsland.tabs[1].id)).toBe('live-tab-10');
});
```

## Verification

```bash
npm run test:fail-only
npm run build
```
