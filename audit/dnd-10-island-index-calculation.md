# DnD Issue: Incorrect Browser Index Calculation for Island Moves

**File**: `src/components/Dashboard.tsx:343-412`
**Severity**: High
**Type**: Bug

## Description

When moving islands (groups), the browser index calculation may be incorrect due to how tabs within groups are counted.

```typescript
if (!isVaultSource && !isVaultTarget && overIdStr !== 'create-island-dropzone') {
  setIsLoading(true);

  try {
    let browserIndex = 0;
    let targetItem: LiveItem | null = null;
    let targetIslandId: UniversalId | null = null;
    let isMovingGroup = false;

    for (const item of finalIslands) {
      if (String(item.id) === String(activeId)) {
        targetItem = item;
        isMovingGroup = 'tabs' in item;
        break;
      }
      if ('tabs' in item && item.tabs) {
        const nested = item.tabs?.find((t: TabType) => String(t.id) === String(activeId));
        if (nested) {
          targetItem = nested;
          targetIslandId = item.id;
          browserIndex += item.tabs?.indexOf(nested) ?? 0;
          break;
        }
        browserIndex += item.tabs?.length ?? 0;  // This counts ALL tabs in group
      } else {
        browserIndex += 1;
      }
    }
    // ...
  }
}
```

## Problems

1. **Index calculation adds tab position within group**: When finding a nested tab, `browserIndex += item.tabs?.indexOf(nested)` adds the position WITHIN the group, not the total tabs before it.

2. **Off-by-one potential**: The loop doesn't account for the fact that Chrome tab indices are 0-based and include ALL tabs, including those in groups.

3. **Race condition**: `finalIslands` is fetched fresh from store during drag end, but may have changed since drag start.

4. **Incorrect `toIndex` for island moves**: The `MoveIslandCommand` receives `fromIndex` and `toIndex`, but `toIndex` is calculated based on item position, not actual Chrome tab index.

## Expected Behavior

When moving an island, the target index should be the Chrome tab index where the group should be positioned.

## Steps to Reproduce

1. Create groups: Group A (2 tabs), Tab B (loose), Group C (3 tabs)
2. Move Group A to after Group C
3. The final position may be incorrect because index calculation doesn't properly account for all tabs

## Example Scenario

```
Initial Chrome indices:
Tab A1 (idx 0), Tab A2 (idx 1), Tab B (idx 2), Tab C1 (idx 3), Tab C2 (idx 4), Tab C3 (idx 5)

Loop calculation for moving Group C:
- Iterate Group A: browserIndex += 2 (now 2)
- Iterate Tab B: browserIndex += 1 (now 3)
- Find Group C: targetItem = Group C, isMovingGroup = true, break

Result: browserIndex = 3, but Group C starts at index 3 in Chrome
```

The index calculation appears correct for finding the item, but the `toIndex` passed to `MoveIslandCommand` uses `browserIndex` which is the START of where we found the item, not where we want to move it TO.

## Suggested Fix

The index calculation needs to determine where the dragged item should end up, not where items currently are. Consider:

```typescript
// When dropping on a gap or specific position
let targetIndex = 0;
for (let i = 0; i < finalIslands.length; i++) {
  const item = finalIslands[i];
  if (String(item.id) === String(overId)) {
    // Found the drop target - this is where we want to be
    break;
  }
  // Add the size of this item to get correct position
  targetIndex += 'tabs' in item ? (item.tabs?.length ?? 1) : 1;
}
```

## Files to Modify

- `src/components/Dashboard.tsx`
- `src/store/commands/MoveIslandCommand.ts`
