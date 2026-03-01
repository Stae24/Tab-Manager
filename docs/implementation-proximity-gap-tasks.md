# useProximityGap Implementation Tasks

## Task 1: Extract Proximity Thresholds as Constants

**File**: `src/constants.ts`

Add the following constants:

```typescript
export const PROXIMITY_THRESHOLD_UP_REM = 1;
export const PROXIMITY_THRESHOLD_DOWN_REM = 3;
```

**File**: `src/hooks/useProximityGap.ts`

Update lines 55-56 to use the constants.

---

## Task 2: Remove Dead Code

**File**: `src/hooks/useProximityGap.ts`

Remove lines 45-48:

```typescript
// REMOVE THIS BLOCK - getBoundingClientRect never returns null
if (!gapRect) {
  setExpanded(false);
  return;
}
```

---

## Task 3: Optimize getBoundingClientRect Calls

**File**: `src/hooks/useProximityGap.ts`

Add a ref to cache the last pointer position and only recalculate bounds when pointer moves significantly:

```typescript
const lastCalculationRef = useRef<{ x: number; y: number; gapTop: number } | null>(null);

// In useEffect, before getBoundingClientRect:
const shouldRecalculate = !lastCalculationRef.current || 
  Math.abs(pointerPosition.x - lastCalculationRef.current.x) > 2 ||
  Math.abs(pointerPosition.y - lastCalculationRef.current.y) > 2;

if (!shouldRecalculate && lastCalculationRef.current) {
  // Use cached values for proximity check
  const { gapTop } = lastCalculationRef.current;
  // ... rest of logic using cached gapTop
  return;
}

// After getBoundingClientRect:
lastCalculationRef.current = { x: pointerPosition.x, y: pointerPosition.y, gapTop: gapRect.top };
```

Alternative: Use `requestAnimationFrame` throttling via a ref.

---

## Task 4: Consolidate Panel Type Checks

**File**: `src/hooks/useProximityGap.ts`

Replace lines 26-37 with:

```typescript
const activeId = String(active.id);
const isCrossPanelDrag = 
  (panelType === 'live' && isVaultId(activeId)) ||
  (panelType === 'vault' && isLiveId(activeId));

if (isCrossPanelDrag) {
  setExpanded(false);
  setExpandedHeight(0);
  return;
}
```

---

## Task 5: Add Explicit Height Null Safety

**File**: `src/hooks/useProximityGap.ts`

Update lines 62-66:

```typescript
if (shouldExpand && active.rect?.current?.initial?.height != null) {
  setExpandedHeight(active.rect.current.initial.height + VIRTUAL_ROW_GAP_PX);
} else if (shouldExpand) {
  // Fallback height if rect info unavailable
  setExpandedHeight(VIRTUAL_ROW_GAP_PX);
} else {
  setExpandedHeight(0);
}
```

---

## Task 6: Add Cleanup Function

**File**: `src/hooks/useProximityGap.ts`

Add cleanup to the useEffect:

```typescript
useEffect(() => {
  // ... existing logic ...

  return () => {
    // Reset state on unmount or before next effect run
    lastCalculationRef.current = null;
  };
}, [active, isDraggingGroup, pointerPosition, panelType]);
```

---

## Task 7: Add Missing Test Cases

**File**: `src/hooks/__tests__/useProximityGap.test.ts`

Add tests for:
1. Panel type restrictions (vault item in live panel should not expand)
2. Cross-panel drag prevention
3. Missing rect.initial.height fallback behavior
4. Rapid pointer position updates (performance)

---

## Verification

After implementing changes:

1. Run `npm run test:fail-only`
2. Run `npm run build`
3. Manual test: Drag items and verify gap expansion still works correctly
4. Check for any console errors during drag operations
