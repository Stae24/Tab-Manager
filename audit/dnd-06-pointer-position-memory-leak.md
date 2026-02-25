# DnD Issue: Potential Memory Leak in PointerPositionProvider

**File**: `src/contexts/PointerPositionContext.tsx:25-67`
**Severity**: Low
**Type**: Bug

## Description

The `PointerPositionProvider` uses `requestAnimationFrame` with refs but has potential cleanup issues.

```typescript
export const PointerPositionProvider: React.FC<PointerPositionProviderProps> = ({ 
  children, 
  isDragging 
}) => {
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<PointerPosition | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    pendingPositionRef.current = { x: e.clientX, y: e.clientY };
    
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      if (pendingPositionRef.current) {
        setPointerPosition(pendingPositionRef.current);
      }
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    if (!isDragging) {
      setPointerPosition(null);
      return;
    }

    document.addEventListener('pointermove', handlePointerMove);
    
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDragging, handlePointerMove]);
```

## Problems

1. **Pending RAF not processed**: If the effect cleanup runs while a RAF is pending, the RAF callback may still try to call `setPointerPosition` on an unmounted component.

2. **No cleanup of pendingPositionRef**: The ref could hold stale position data.

3. **State update after unmount**: React will warn about state updates on unmounted components if RAF fires after cleanup.

## Expected Behavior

The context should clean up all resources and avoid state updates after unmount.

## Steps to Reproduce

1. Start a drag operation
2. Quickly unmount the Dashboard component (e.g., navigate away)
3. Check console for React warnings about state updates on unmounted components

## Suggested Fix

Add a mounted flag:

```typescript
export const PointerPositionProvider: React.FC<PointerPositionProviderProps> = ({ 
  children, 
  isDragging 
}) => {
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<PointerPosition | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    pendingPositionRef.current = { x: e.clientX, y: e.clientY };
    
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      if (pendingPositionRef.current && isMountedRef.current) {
        setPointerPosition(pendingPositionRef.current);
      }
      rafRef.current = null;
    });
  }, []);

  // ... rest
```

## Files to Modify

- `src/contexts/PointerPositionContext.tsx`
