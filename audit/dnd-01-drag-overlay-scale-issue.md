# DnD Issue: Drag Overlay Scale Modifier Bug

**File**: `src/components/Dashboard.tsx:134-140`
**Severity**: Medium
**Type**: Bug

## Description

The scale modifier for drag operations divides the transform by `uiScale`, but this creates incorrect visual positioning when the UI is scaled.

```typescript
const scaleModifier: Modifier = useCallback(({ transform }) => {
  return {
    ...transform,
    x: transform.x / appearanceSettings.uiScale,
    y: transform.y / appearanceSettings.uiScale,
  };
}, [appearanceSettings.uiScale]);
```

## Problem

When `uiScale` is not 1.0 (e.g., 0.75 or 1.5), the drag overlay position becomes desynchronized from the actual pointer position. This is because:

1. The dashboard container is scaled via CSS `transform: scale(uiScale)`
2. The pointer events already provide coordinates in the scaled coordinate space
3. Dividing by uiScale double-compensates for the scale

## Expected Behavior

The drag overlay should follow the pointer position accurately regardless of UI scale setting.

## Steps to Reproduce

1. Set UI scale to 0.75 (Settings > Appearance)
2. Start dragging a tab or island
3. Observe the drag overlay position relative to the pointer
4. The overlay will appear offset from the cursor

## Suggested Fix

Either:
- Remove the scale modifier entirely and let dnd-kit handle coordinates natively
- OR: Calculate the offset based on the container's bounding rect, not just dividing by scale

## Files to Modify

- `src/components/Dashboard.tsx`
