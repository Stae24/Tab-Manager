# DnD Issue: DroppableGap Lacks Drop Validation

**File**: `src/components/DroppableGap.tsx`, `src/hooks/useProximityGap.ts`
**Severity**: Medium
**Type**: Enhancement/Bug

## Description

The `DroppableGap` component and `useProximityGap` hook don't validate whether the current drop target is valid for the dragged item type.

```typescript
// DroppableGap.tsx
export const DroppableGap: React.FC<DroppableGapProps> = ({ index, panelType, isDraggingGroup }) => {
  const { active } = useDndContext();
  const gapId = `${panelType}-gap-${index}`;
  const { ref, expanded } = useProximityGap(
    gapId,
    active,
    isDraggingGroup
  );
  // ...
};

// useProximityGap.ts
useEffect(() => {
  if (!active || !gapRef.current || isDraggingGroup) {
    setExpanded(false);
    return;
  }
  // ... proximity calculation
}, [active, isDraggingGroup, pointerPosition]);
```

## Problems

1. **No item type validation**: A vault item can show gaps in the live panel (though the drop would be rejected later).

2. **Group vs Tab inconsistency**: `isDraggingGroup` is used to hide gaps when dragging groups, but this is passed from parent and could be inconsistent with actual drag data.

3. **Cross-panel gaps visible**: Gaps appear even when dragging across panels where drops are not allowed.

4. **No feedback for invalid drops**: User sees gap expansion but drop is silently rejected.

## Expected Behavior

Gaps should only expand for valid drop targets:
- Live items should only show gaps in live panel
- Vault items should only show gaps in vault panel  
- Groups should not show gaps between group items (they can only be at root level)

## Steps to Reproduce

1. Start dragging a vault item
2. Hover over the live panel
3. Observe that gaps may still expand even though drop will be rejected

## Suggested Fix

Add validation in `useProximityGap`:

```typescript
export const useProximityGap = (
  gapId: string, 
  active: Active | null, 
  isDraggingGroup?: boolean,
  panelType?: 'live' | 'vault'
) => {
  // ... existing code ...

  useEffect(() => {
    if (!active || !gapRef.current || isDraggingGroup) {
      setExpanded(false);
      return;
    }

    // Validate cross-panel drops
    const activeId = String(active.id);
    const isVaultItem = activeId.startsWith('vault-');
    const isLiveItem = activeId.startsWith('live-');
    
    if (panelType === 'live' && isVaultItem) {
      setExpanded(false);
      return;
    }
    if (panelType === 'vault' && isLiveItem) {
      setExpanded(false);
      return;
    }

    // ... rest of proximity calculation
  }, [active, isDraggingGroup, pointerPosition, panelType]);

  return { ref, isOver, expanded };
};
```

## Files to Modify

- `src/hooks/useProximityGap.ts`
- `src/components/DroppableGap.tsx`
