# DnD Issue: Drag Overlay Ignores User Opacity Setting

**File**: `src/components/Dashboard.tsx:513`
**Severity**: Low
**Type**: Bug

## Description

The DragOverlay uses a hardcoded opacity value instead of the user's `dragOpacity` setting.

```typescript
<DragOverlay dropAnimation={{ 
  sideEffects: defaultDropAnimationSideEffects({ 
    styles: { active: { opacity: '0.1' } } 
  }) 
}}>
```

Meanwhile, the actual draggable items respect the setting:

```typescript
// Island.tsx:83
opacity: isDragging && !isOverlay ? appearanceSettings.dragOpacity : 1,

// TabCard.tsx:77
opacity: isDragging && !isOverlay ? appearanceSettings.dragOpacity : 1,
```

## Problems

1. **Inconsistent visual feedback**: The "ghost" item left behind uses user's opacity, but the overlay being dragged uses hardcoded 0.1.

2. **Hardcoded value**: The opacity `0.1` should respect the same setting as the source items.

3. **User preference ignored**: Users can set drag opacity from 0.1 to 1.0, but the overlay ignores this.

## Expected Behavior

The drag overlay should use the same opacity setting as the source item for consistency.

## Steps to Reproduce

1. Go to Settings > Appearance
2. Set Drag Opacity to 1.0 (fully visible)
3. Drag a tab
4. Observe that the dragged overlay is nearly invisible (0.1 opacity)
5. The source item ghost respects the 1.0 setting

## Suggested Fix

```typescript
<DragOverlay dropAnimation={{ 
  sideEffects: defaultDropAnimationSideEffects({ 
    styles: { active: { opacity: String(appearanceSettings.dragOpacity) } } 
  }) 
}}>
```

## Files to Modify

- `src/components/Dashboard.tsx`
