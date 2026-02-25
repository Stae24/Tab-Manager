# DnD Issue: Inconsistent Cross-Panel Drag Detection

**File**: `src/components/Dashboard.tsx:264-268`
**Severity**: Medium
**Type**: Bug

## Description

The detection logic for determining if an item is from the vault or live panel uses inconsistent string prefix matching that could fail in edge cases.

```typescript
const activeIdStr = activeId.toString();
const overIdStr = overId.toString();
const isVaultSource = activeIdStr.startsWith('vault-');

const isVaultTarget = overIdStr === 'vault-dropzone' || 
                      overIdStr === 'vault-bottom' || 
                      overIdStr.startsWith('vault-');
```

## Problems

1. **Inconsistent detection logic**: `isVaultSource` uses `startsWith('vault-')`, but this would match `vault-group-1-123` but NOT match `vault-tab-1-123` in some cases.

2. **ID format inconsistency**: Vault IDs are generated as `vault-${originalId}-${timestamp}`, but the detection assumes all vault IDs start exactly with `vault-`.

3. **`isVaultTarget` combines different patterns**: It checks both exact matches and prefix matches in a way that could cause confusion.

4. **Related issue in handleDragStart**:
```typescript
const isVault = event.active.id.toString().startsWith('vault-') ||
  (data?.type === 'island' && data.island.id.toString().startsWith('vault-')) ||
  (data?.type === 'tab' && data.tab.id.toString().startsWith('vault-'));
```
This triple-check suggests uncertainty about the ID format.

## Expected Behavior

Cross-panel detection should be consistent and reliable for all ID formats.

## Steps to Reproduce

1. Create a vault item and observe its ID format
2. Start dragging the item
3. The drag state detection should work correctly

## Suggested Fix

Create a utility function for consistent ID detection:

```typescript
// In store/utils.ts
export const isVaultId = (id: UniqueIdentifier): boolean => {
  const idStr = String(id);
  return idStr.startsWith('vault-');
};

export const isLiveId = (id: UniqueIdentifier): boolean => {
  const idStr = String(id);
  return idStr.startsWith('live-');
};

// Usage in Dashboard.tsx
const isVaultSource = isVaultId(activeId);
const isVaultTarget = isVaultId(overId) || 
                      overIdStr === 'vault-dropzone' || 
                      overIdStr === 'vault-bottom';
```

## Files to Modify

- `src/store/utils.ts`
- `src/components/Dashboard.tsx`
