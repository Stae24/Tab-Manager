# DnD Issue: Drag State Not Reset on Component Unmount

**File**: `src/components/Dashboard.tsx:105-118`
**Severity**: Medium
**Type**: Bug

## Description

If the Dashboard component unmounts during an active drag operation, several pieces of drag-related state are not cleaned up.

```typescript
const [isDraggingVaultItem, setIsDraggingVaultItem] = useState(false);
const [isDraggingGroup, setIsDraggingGroup] = useState(false);
const [isCreatingIsland, setIsCreatingIsland] = useState(false);
const [creatingTabId, setCreatingTabId] = useState<UniversalId | null>(null);
const [dragStartInfo, setDragStartInfo] = useState<{
  index: number;
  containerId: UniqueIdentifier;
  groupId: number;
  windowId: number;
} | null>(null);
```

## Problems

1. **No cleanup effect**: These states are set during drag but never cleaned up if component unmounts.

2. **Store state leakage**: `pendingOperations` in the store is updated via `addPendingOperation` but the cleanup call to `removePendingOperation` is in `handleDragEnd`, which won't fire if component unmounts.

3. **Potential for stale state**: If user navigates away during drag, the next time they return, `isUpdating` may still be true.

4. **Active item state**: `activeItem` is also React state that would be lost on unmount.

## Expected Behavior

All drag-related state should be cleaned up when the component unmounts.

## Steps to Reproduce

1. Start dragging a tab
2. While dragging, close the tab manager extension popup (or navigate away)
3. Reopen the extension
4. Some tabs may not sync properly if `pendingOperations` is still set

## Suggested Fix

Add cleanup effect:

```typescript
useEffect(() => {
  return () => {
    // Clear any pending drag operations on unmount
    clearPendingOperations();
  };
}, [clearPendingOperations]);

// Also ensure handleDragCancel exists and clears state
const handleDragCancel = useCallback(() => {
  setActiveItem(null);
  setIsDraggingVaultItem(false);
  setIsDraggingGroup(false);
  setDragStartInfo(null);
  setIsCreatingIsland(false);
  setCreatingTabId(null);
  
  // Clear pending operations
  const numericActiveId = activeItem 
    ? parseNumericId(activeItem.type === 'island' ? activeItem.island.id : activeItem.tab.id)
    : null;
  if (numericActiveId !== null) {
    removePendingOperation(numericActiveId);
  }
}, [activeItem, removePendingOperation]);
```

## Files to Modify

- `src/components/Dashboard.tsx`
