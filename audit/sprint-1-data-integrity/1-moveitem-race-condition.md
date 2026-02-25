# DnD Issue: Race Condition in moveItemOptimistically

**File**: `src/store/slices/useTabSlice.ts:168-214`
**Severity**: High
**Type**: Bug

## Description

The `moveItemOptimistically` function uses `requestAnimationFrame` debouncing with closure-captured variables that can become stale during rapid drag operations.

```typescript
moveItemOptimistically: (() => {
  let pendingId: UniqueIdentifier | null = null;
  let pendingOverId: UniqueIdentifier | null = null;
  let updateScheduled = false;
  let rafId: number | null = null;

  return (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
    pendingId = activeId;
    pendingOverId = overId;

    if (updateScheduled) return;
    updateScheduled = true;

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      // ... uses pendingId and pendingOverId
    });
  };
})();
```

## Problems

1. **Stale closure variables**: If a new drag starts before the RAF fires, the pending IDs are overwritten but `updateScheduled` is already true, causing the new values to be processed immediately.

2. **RAF not cancelled on unmount**: The IIFE closure persists beyond component lifecycle.

3. **No cleanup on drag cancel**: If drag is cancelled, the pending state persists until next RAF.

4. **Missing state reset**: After RAF callback, `updateScheduled` is set to false, but if a drag is in progress, this could cause duplicate updates.

## Expected Behavior

Rapid drag-over events should be coalesced properly without losing or mixing state.

## Steps to Reproduce

1. Start dragging a tab quickly over multiple drop targets
2. Move rapidly back and forth between positions
3. Observe that the final position may not match where the item was dropped

## Suggested Fix

Consider using a ref-based approach with proper cleanup:

```typescript
// Move to component level or use useRef
const dragDebounceRef = useRef<{
  pendingId: UniqueIdentifier | null;
  pendingOverId: UniqueIdentifier | null;
  rafId: number | null;
}>({ pendingId: null, pendingOverId: null, rafId: null });

// Clear on unmount
useEffect(() => {
  return () => {
    if (dragDebounceRef.current.rafId) {
      cancelAnimationFrame(dragDebounceRef.current.rafId);
    }
  };
}, []);
```

## Files to Modify

- `src/store/slices/useTabSlice.ts`
