# DnD Workstream 3: Scale Compensation and Geometry Accuracy (P1)

## Goal
Ensure drag collision and proximity-gap behavior remain accurate under UI scaling and scrolling.

## Scope
- `src/components/Dashboard.tsx`
- `src/hooks/useProximityGap.ts`
- `src/contexts/PointerPositionContext.tsx` (only if tuning needed)
- `src/components/__tests__/dndScaling.test.ts`
- `src/hooks/__tests__/useProximityGap.test.ts`

## Problem Statement
The dashboard applies CSS scaling (`uiScale`) but DnD currently lacks explicit transform compensation. Gap expansion also depends on cached rects that can become stale while scrolling.

## Implementation Plan
1. Add DnD scale modifier.
- Apply modifier in `DndContext` to normalize drag transform coordinates by `uiScale`.
- Keep behavior no-op when `uiScale === 1`.

2. Refresh proximity-gap geometry while dragging.
- Recompute or safely refresh gap rect on scroll/resize during active drag.
- Preserve movement-threshold optimization to avoid excessive recalculation.

3. Keep current gap-height behavior.
- Retain dynamic gap height based on active dragged element height plus row gap.
- Preserve cross-panel suppression of gap expansion.

## Required Tests
1. Scale modifier: coordinates are compensated for `uiScale != 1`.
2. Scale modifier: no change when `uiScale == 1`.
3. Proximity gap expands correctly after scroll while dragging.
4. Proximity gap stays collapsed for cross-panel drags.

## Acceptance Criteria
- Drag pointer alignment and collision accuracy are correct at non-1.0 UI scales.
- Gap expansion tracks true element position during scroll.
- No meaningful drag performance regression.

## Verification Commands
```bash
npm run test:fail-only
npm run build
```
