# Rendering & Positioning - Implementation Guide

## Quick Reference

### File Structure
```
src/
├── components/
│   ├── LivePanel.tsx        # Main virtualized list (rowItems, virtualizer)
│   ├── VaultPanel.tsx       # Same pattern as LivePanel
│   ├── VirtualizedLiveList.tsx
│   ├── TabCard.tsx          # Individual tab rendering
│   ├── Island.tsx           # Group rendering
│   └── DroppableGap.tsx     # Gap component
├── hooks/
│   └── useProximityGap.ts   # Gap expansion logic
├── contexts/
│   └── PointerPositionContext.tsx
└── constants.ts             # VIRTUAL_ROW_ESTIMATE_SIZE = 40
```

---

## Implementation Tasks

### Task 1: Fix Synchronous Reflows in useProximityGap

**File**: `src/hooks/useProximityGap.ts`

**Current Problem** (lines 44-63):
```typescript
const gapRect = gapRef.current.getBoundingClientRect(); // TRIGGERS REFLOW
```

**Solution**: Cache position at drag start and use CSS-based detection:

```typescript
// Proposed approach:
// 1. Get gap position ONCE when drag starts
// 2. Use CSS :hover or pointer-events for expansion detection
// 3. Remove getBoundingClientRect from effect
```

**Implementation Steps**:
1. Create a ref to cache gap position
2. Update cached position only when drag starts/ends
3. Replace rect-based detection with CSS-based approach
4. Consider using `ResizeObserver` for dynamic content

---

### Task 2: Dynamic Row Height Estimation

**Files**: 
- `src/components/LivePanel.tsx`
- `src/components/VaultPanel.tsx`

**Current Problem**:
```typescript
// Fixed 40px estimate
estimateSize: () => VIRTUAL_ROW_ESTIMATE_SIZE,
```

**Solution**: Measure actual heights and update estimates:

```typescript
// Proposed approach:
// 1. Use measureElement callback from virtualizer
// 2. Store measured heights in a Map by index
// 3. Use measured height for subsequent renders
// 4. Fall back to estimate for new items
```

**Implementation Steps**:
1. Add a `Map<number, number>` ref to store measured heights
2. Pass `measureElement` to row container divs
3. On measurement, update the Map and virtualizer
4. Handle collapsed/expanded island states specially

---

### Task 3: Optimize rowItems Memoization

**Files**:
- `src/components/LivePanel.tsx:219-234`
- `src/components/VaultPanel.tsx:116-130`

**Current Problem**:
```typescript
const rowItems = useMemo(() => {
  const rows: DashboardRow[] = [];
  (islands || []).forEach((item, index) => {
    // Complex logic
  });
  return rows;
}, [islands, searchQuery]);
```

**Solution**: 
1. Extract row creation to utility function
2. Add proper memoization
3. Consider using `React.memo` for row components

---

### Task 4: Improve Pointer Position Tracking

**File**: `src/contexts/PointerPositionContext.tsx`

**Current Problem**:
```typescript
// Only stores latest position
pendingPositionRef.current = { x: e.clientX, y: e.clientY };
```

**Solution**:
1. Use position interpolation for smoother updates
2. Consider using CSS `pointer-events` throttling
3. Batch updates using `requestAnimationFrame` properly

---

## Testing Checklist

After implementing fixes:

1. **Performance**: Check for jank during drag operations
2. **Scroll accuracy**: Verify items are correctly positioned in viewport
3. **Gap behavior**: Test gap expansion during drag
4. **Mixed content**: Test with various densities and collapsed islands

---

## Constants Reference

```typescript
// From src/constants.ts
VIRTUAL_ROW_ESTIMATE_SIZE = 40      // Fixed row height estimate
VIRTUAL_ROW_OVERSCAN = 10            // Items to render outside viewport
VIRTUAL_ROW_GAP_PX = 8               // Gap between rows
TAB_LOAD_DELAY_BASE_MS = 50          // Favicon loading delay
INTERSECTION_OBSERVER_MARGIN_PX = 500 // Observer margin
```

---

## Related Test Files

- `src/hooks/__tests__/useProximityGap.test.ts`
- `src/components/__tests__/DroppableGap.test.tsx`
- `src/store/slices/__tests__/useTabSlice.test.ts`
