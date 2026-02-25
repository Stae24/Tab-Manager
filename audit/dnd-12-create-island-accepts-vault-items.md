# DnD Issue: Create Island Dropzone Accepts Vault Items

**File**: `src/components/Dashboard.tsx:285`
**Severity**: Medium
**Type**: Bug

## Description

The `create-island-dropzone` is designed to create islands from live tabs, but the check for vault source happens AFTER entering the create island flow, not before.

```typescript
if (overIdStr === 'create-island-dropzone' && !isVaultSource) {
  // ... create island logic
}
```

## Problems

1. **Late rejection**: The check `!isVaultSource` is correct but happens inside the branch, not as a pre-condition for showing the dropzone.

2. **Visual feedback issue**: The dropzone may show "create island" state even when dragging vault items.

3. **No visual indication of rejection**: When a vault item is dragged to the create zone, there's no visual feedback that this operation is not allowed.

4. **UI state can be misleading**: In `LivePanel.tsx`:
```typescript
<div
  ref={setCreateRef}
  id="new-island-dropzone"
  className={cn(
    // ...
    isDraggingGroup && "opacity-30 cursor-not-allowed grayscale"
  )}
>
```
This checks `isDraggingGroup` but not `isVaultSource`.

## Expected Behavior

The create island dropzone should:
1. Not be highlighted when dragging vault items
2. Show a "not allowed" cursor when vault items are dragged over
3. Provide clear visual feedback that the operation is invalid

## Steps to Reproduce

1. Have vault items visible
2. Start dragging a vault item
3. Drag it over the "Create Island" zone
4. The zone highlights as if accepting the drop
5. Drop the item - nothing happens (silently rejected)

## Suggested Fix

In `LivePanel.tsx`, add check for vault items:

```typescript
const { setNodeRef: setCreateRef, isOver: isCreateOver } = useDroppable({
  id: 'create-island-dropzone',
  // Add data to identify this dropzone
  data: { accepts: ['live-tab'] }
});

// In className:
<div
  ref={setCreateRef}
  id="new-island-dropzone"
  className={cn(
    "p-10 border-2 border-dashed border-gx-gray/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group flex-shrink-0 cursor-pointer",
    isCreatingIsland && "border-gx-cyan bg-gx-cyan/5 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse-glow",
    !isCreatingIsland && isCreateOver && !isDraggingGroup && !isDraggingVaultItem && "border-gx-accent bg-gx-accent/10",
    !isCreatingIsland && !isCreateOver && "hover:border-gx-accent/50 hover:bg-gx-accent/5",
    (isDraggingGroup || isDraggingVaultItem) && "opacity-30 cursor-not-allowed grayscale"
  )}
>
```

Pass `isDraggingVaultItem` to LivePanel from Dashboard:

```typescript
<LivePanel
  // ... other props
  isDraggingVaultItem={isDraggingVaultItem}
  isDraggingGroup={isDraggingGroup}
/>
```

## Files to Modify

- `src/components/Dashboard.tsx`
- `src/components/LivePanel.tsx`
