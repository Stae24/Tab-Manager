# Optimistic Move Analysis and Improvements

This document outlines a deep dive into the optimistic move logic inside `src/store/operations/moveItem.ts` and its integration in `src/components/Dashboard.tsx`. Several critical bugs and inefficiencies were discovered that affect absolute drag-and-drop precision and correctly syncing the layout to the Chrome Tabs API.

---

## 1. `Dashboard.tsx`: Incorrect `browserIndex` Calculation
**Severity**: High | **File**: `src/components/Dashboard.tsx`

### The Bug
During an `onDragEnd` event, `Dashboard.tsx` must tell the Chrome API (`MoveTabCommand` / `MoveIslandCommand`) the absolute index to move the dragged item to. It does this by iterating over `finalIslands` (the state *after* the optimistic move was applied).

However, the logic inside `Dashboard.tsx` breaks the loop when it encounters **`overId`** instead of **`activeId`**:

```typescript
// src/components/Dashboard.tsx
for (const item of finalIslands) {
  if (String(item.id) === String(activeId)) {
    targetItem = item;
    isMovingGroup = 'tabs' in item;
    // ERROR: Does not break here!
  }
  if (String(item.id) === String(overId)) {
    break; // ERROR: Breaks on overId, returning index of hover target instead of active target!
  }
  // ... browserIndex calculations
}
```

Since `finalIslands` is *already* optimistically sorted, tracking the position of the item we hovered over (`overId`) is completely inaccurate (its index shifted due to the move). 
Worse, if the user dropped on a **gap** (e.g., `live-gap-2`), `overId` is a gap string, which is never found in `finalIslands`. The loop completes without breaking, setting `browserIndex` to the total length of all tabs. **Result:** Dropping on a gap silently thrusts the tab to the very end of the Chrome window!

### The Fix
Refactor the loop to identify the exact index of `activeId` within `finalIslands` and `break` immediately, since `activeId` represents the final, correctly computed location of the dragged tab.

---

## 2. `moveItem.ts`: Off-by-1 Shift Bug on Drag Down
**Severity**: Medium | **File**: `src/store/operations/moveItem.ts` -> `applyOptimisticMove`

### The Bug
When mutating arrays for the optimistic UI state, `applyOptimisticMove` uses two `splice` operations.

```typescript
const [movedItem] = sourceArr.splice(resolvedIndex, 1);
const safeTargetIndex = Math.max(0, Math.min(Number(target.targetIndex), targetArr.length));
targetArr.splice(safeTargetIndex, 0, movedItem);
```

When dragging an item **downwards** within the **same container** (e.g. `sourceArr === targetArr` and `resolvedIndex < targetIndex`), the first `splice` removes the dragged item. This causes all subsequent elements in the array to shift left by `1`.
When the item is inserted at `safeTargetIndex` on the *shrunken* array, the item is inserted one position too far down! This makes dropping an item into a lower `DroppableGap` visually skip a slot.

### The Fix
Detect the shift and decrement the `targetIndex`.

```typescript
let safeTargetIndex = Math.max(0, Math.min(Number(target.targetIndex), targetArr.length));
if (sourceArr === targetArr && resolvedIndex < safeTargetIndex) {
  safeTargetIndex -= 1;
}
targetArr.splice(safeTargetIndex, 0, movedItem);
```

---

## 3. `moveItem.ts`: Forced Append Prevents "Insert Before Last"
**Severity**: Low | **File**: `src/store/operations/moveItem.ts` -> `calculateMoveTarget`

### The Bug
When dragging an external tab into a group and hovering over the group's **last** tab, the math intercepts the insertion and forces `targetIndex + 1`:

```typescript
if (targetIndex === targetGroup.tabs.length - 1) {
  targetIndex = targetIndex + 1; // Forces appending to the end
}
```

The author likely added this because without it, the `active` item invariably shifts the hovered item down, leaving no ability to formally append an item to the bottom of a group. However, by strictly intercepting the last index, the user **can no longer insert an external tab *before* the last tab** in a group.

### The Fix
`prepareOptimisticMove` should ideally receive geometric context. If `dnd-kit`'s `over.rect` (the bounding box of the hovered element) and the pointer coordinates were evaluated in the component, a flag (`dropDirection: 'top' | 'bottom'`) could be passed to `moveItemOptimistically`. This cleanly resolves the ambiguity of whether to insert before or after the hovered item at a given index.

---

## 4. `moveItem.ts`: Inefficient, Redundant Array Traversal
**Severity**: Low | **File**: `src/store/operations/moveItem.ts` -> `determineTargetPanel`

### The Bug
To verify the destination panel of cross-panel moves:

```typescript
if (over) {
  if (isItemInList(islands, overId)) return true;
  if (isItemInList(vault, overId)) return false;
}
```

`isItemInList` initiates a deep loop across all `islands` and nested `tabs`. This traversal repeats what `findItemInList` already did instantly prior! 

### The Fix
Since Tab Manager namespaces IDs, evaluating the string is perfectly fast and valid. Reconfigure the module to import `isLiveId` and `isVaultId` from `store/utils.ts`.

```typescript
import { isLiveId, isVaultId } from '../utils';

if (over) {
  if (isLiveId(overId)) return true;
  if (isVaultId(overId)) return false;
}
```
