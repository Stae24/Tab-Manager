# DnD Issue: Pending Operation Leak on Drag Cancel

**File**: `src/components/Dashboard.tsx:239-432`
**Severity**: High
**Type**: Bug

## Description

When a drag operation is cancelled (user presses Escape, component unmounts, or unexpected error), the pending operation added in `handleDragStart` may never be removed.

```typescript
const handleDragStart = (event: DragStartEvent) => {
  // ...
  // Add to pending operations to block background sync during drag
  const numericId = parseNumericId(event.active.id);
  if (numericId !== null) {
    addPendingOperation(numericId);
  }
  // ...
};

const handleDragEnd = async (event: DragEndEvent) => {
  // ...
  const cleanupPendingOperation = () => {
    if (numericActiveId !== null) {
      removePendingOperation(numericActiveId);
    }
  };
  // ...
};
```

## Problems

1. **No handleDragCancel**: The DndContext doesn't have an `onDragCancel` handler, so cancelled drags never clean up.

2. **Component unmount during drag**: If Dashboard unmounts while dragging, `handleDragEnd` is never called.

3. **Error in handleDragEnd**: If an error is thrown before `cleanupPendingOperation()` is called, the pending operation persists.

4. **isUpdating state not reset**: The `pendingOperations` Set blocks `syncLiveTabs` indefinitely if operations aren't cleaned up.

## Expected Behavior

Pending operations should always be cleaned up, even on cancel or error.

## Steps to Reproduce

1. Start dragging a tab
2. Press Escape to cancel the drag
3. Try to sync tabs (they may not sync properly)
4. Check `isUpdating` state - it may remain true

## Suggested Fix

Add `onDragCancel` handler:

```typescript
const handleDragCancel = () => {
  const numericActiveId = parseNumericId(activeItem?.type === 'island' 
    ? activeItem.island.id 
    : activeItem?.tab?.id);
  
  if (numericActiveId !== null) {
    removePendingOperation(numericActiveId);
  }
  
  setActiveItem(null);
  setIsDraggingVaultItem(false);
  setIsDraggingGroup(false);
};

// In JSX:
<DndContext
  // ...
  onDragCancel={handleDragCancel}
>
```

Also consider adding a cleanup effect:

```typescript
useEffect(() => {
  return () => {
    // Clear all pending operations on unmount
    clearPendingOperations();
  };
}, []);
```

## Files to Modify

- `src/components/Dashboard.tsx`
