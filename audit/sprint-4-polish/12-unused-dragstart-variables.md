# DnD Issue: Unused Variables and Incomplete State in handleDragStart

**File**: `src/components/Dashboard.tsx:191-224`
**Severity**: Low
**Type**: Code Quality

## Description

The `handleDragStart` function has unused destructured variables and inconsistent state management.

```typescript
const handleDragStart = (event: DragStartEvent) => {
  const data = event.active.data.current as DragData | undefined;
  if (data) setActiveItem(data);

  const { islands, vault } = useStore.getState();
  const found = findItemInList(islands, event.active.id) || findItemInList(vault, event.active.id);
  if (found) {
    const { item, index, containerId } = found;
    const isIslandItem = 'tabs' in item;  // item is used
    // index and containerId are never used after destructuring
    setDragStartInfo({
      index,
      containerId,
      groupId: isIslandItem ? -1 : (item as TabType).groupId ?? -1,
      windowId: isIslandItem
        ? ((item as IslandType).tabs[0]?.windowId ?? -1)
        : (item as TabType).windowId ?? -1
    });
    // ...
  }

  const isGroup = data && 'island' in data && data.type === 'island';
  setIsDraggingGroup(!!isGroup);

  const isVault = event.active.id.toString().startsWith('vault-') ||
    (data?.type === 'island' && data.island.id.toString().startsWith('vault-')) ||
    (data?.type === 'tab' && data.tab.id.toString().startsWith('vault-'));

  setIsDraggingVaultItem(isVault);
};
```

## Problems

1. **Unused destructured variable**: `containerId` is destructured but never used in the function.

2. **Redundant type checks**: The `isVault` determination uses three different checks which suggests uncertainty about the ID format.

3. **Data vs found inconsistency**: Uses both `event.active.data.current` and `findItemInList` for item info, which could be inconsistent.

4. **Missing null check**: If `found` is null, `setDragStartInfo` is not called, leaving stale state.

5. **`setDragStartInfo` not reset on error**: If drag fails, this state persists.

## Expected Behavior

Clean code with consistent state management and no unused variables.

## Suggested Fix

```typescript
const handleDragStart = (event: DragStartEvent) => {
  const data = event.active.data.current as DragData | undefined;
  if (data) setActiveItem(data);

  const { islands, vault } = useStore.getState();
  const found = findItemInList(islands, event.active.id) || findItemInList(vault, event.active.id);
  
  if (found) {
    const { item, index } = found;
    const isIslandItem = 'tabs' in item;
    
    setDragStartInfo({
      index,
      containerId: found.containerId,
      groupId: isIslandItem ? -1 : (item as TabType).groupId ?? -1,
      windowId: isIslandItem
        ? ((item as IslandType).tabs[0]?.windowId ?? -1)
        : (item as TabType).windowId ?? -1
    });

    const numericId = parseNumericId(event.active.id);
    if (numericId !== null) {
      addPendingOperation(numericId);
    }
  } else {
    // Reset drag start info if item not found
    setDragStartInfo(null);
  }

  // Simplified group detection
  const isGroup = data?.type === 'island';
  setIsDraggingGroup(isGroup);

  // Simplified vault detection using utility
  const isVault = isVaultId(event.active.id) || 
    (data?.type === 'island' && isVaultId(data.island.id)) ||
    (data?.type === 'tab' && isVaultId(data.tab.id));
  setIsDraggingVaultItem(isVault);
};
```

## Files to Modify

- `src/components/Dashboard.tsx`
