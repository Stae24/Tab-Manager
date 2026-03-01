# useProximityGap Analysis

## Overview

The `useProximityGap` hook (`src/hooks/useProximityGap.ts`) manages the visual expansion of drop zones (gaps) during drag operations. It determines when a gap should expand based on pointer proximity.

## Current Implementation

```typescript
const expandUp = distance < 0 && Math.abs(distance) < 1 * baseRem;
const expandDown = distance >= 0 && distance < 3 * baseRem;
```

## Identified Issues

### 1. Performance: Unthrottled getBoundingClientRect Calls

**Location**: `useProximityGap.ts:44`

**Problem**: `getBoundingClientRect()` is called on every pointer position update. This triggers synchronous reflow/layout calculations which is expensive.

**Impact**: Can cause jank during drag operations, especially with many gaps rendered.

**Fix**: Use `useMemo` with a shallow comparison or RAF-based throttling to batch reads.

---

### 2. Asymmetric Proximity Thresholds (Potential UX Issue)

**Location**: `useProximityGap.ts:55-56`

**Problem**: 
- `expandUp` threshold: 1rem (16px at default)
- `expandDown` threshold: 3rem (48px at default)

The asymmetry (1rem vs 3rem) may be intentional for UX reasons (easier to "catch" gaps from below), but it's undocumented and inconsistent.

**Fix**: Document the reasoning or make thresholds configurable/extract as constants.

---

### 3. Redundant Null Check for getBoundingClientRect

**Location**: `useProximityGap.ts:45-48`

**Problem**: `getBoundingClientRect()` always returns a `DOMRect`, never `null`. The check `if (!gapRect)` is always false.

**Fix**: Remove the dead code path.

---

### 4. Missing useLayoutEffect for DOM Measurements

**Location**: `useProximityGap.ts:19`

**Problem**: Using `useEffect` for DOM measurements that affect visual output can cause a one-frame flicker.

**Fix**: Consider `useLayoutEffect` for synchronous DOM reads before paint, or verify that the current behavior doesn't cause visible issues.

---

### 5. Unsafe Property Chain Access

**Location**: `useProximityGap.ts:62`

```typescript
if (shouldExpand && active.rect.current && active.rect.current.initial) {
  setExpandedHeight(active.rect.current.initial.height + VIRTUAL_ROW_GAP_PX);
}
```

**Problem**: While technically safe with the guards, TypeScript might not fully validate the nested optional chain. The `height` property is accessed without explicit validation.

**Fix**: Add explicit type narrowing or optional chaining.

---

### 6. Duplicate Panel Type Restriction Logic

**Location**: `useProximityGap.ts:30-37`

```typescript
if (panelType === 'live' && isVaultItem) {
  setExpanded(false);
  return;
}
if (panelType === 'vault' && isLiveItem) {
  setExpanded(false);
  return;
}
```

**Problem**: Redundant pattern that could be simplified.

**Fix**: Consolidate into a single `shouldSkipPanel` check.

---

### 7. No Cleanup on Unmount/Active Change

**Location**: `useProximityGap.ts` (missing)

**Problem**: If the component unmounts while expanded, or if `active` changes without the effect re-running, state could be inconsistent.

**Fix**: Add cleanup function in `useEffect`.

---

### 8. Scroll Position Not Considered

**Location**: `useProximityGap.ts:44`

**Problem**: `getBoundingClientRect()` returns viewport-relative coordinates, which is correct. However, if the container scrolls during a drag, gaps that were in the proximity zone may no longer be, but the expansion state won't update until the next pointer move.

**Impact**: Minor - would require user to move pointer after scrolling to update gap state.

---

### 9. Magic Numbers Not Extracted as Constants

**Location**: `useProximityGap.ts:55-56`

**Problem**: Threshold values (1rem, 3rem) are hardcoded inline.

**Fix**: Extract to named constants:
```typescript
const PROXIMITY_THRESHOLD_UP_REM = 1;
const PROXIMITY_THRESHOLD_DOWN_REM = 3;
```

---

## Suggested Fixes Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| High | #1 Performance (getBoundingClientRect) | Medium |
| Medium | #3 Dead code removal | Low |
| Medium | #9 Extract magic numbers | Low |
| Low | #4 useLayoutEffect consideration | Low |
| Low | #6 Consolidate panel type checks | Low |
| Low | #2 Document threshold asymmetry | Low |

## Test Coverage

Current tests cover:
- Basic state returns
- Null active handling
- isDraggingGroup handling
- ref callback combination
- Proximity expansion (above and below)
- Horizontal bounds checking
- Memory leak prevention (no event listeners)

Missing test coverage:
- Panel type restrictions (live vs vault items)
- Scroll position changes during drag
- Rapid pointer position changes
- expandedHeight calculation with different rect values
