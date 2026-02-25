# DnD Issue: Incomplete Error Handling in Create Island Flow

**File**: `src/components/Dashboard.tsx:285-341`
**Severity**: Medium
**Type**: Bug

## Description

The `create-island-dropzone` drag end handling has incomplete error handling that could leave the application in an inconsistent state.

```typescript
if (overIdStr === 'create-island-dropzone' && !isVaultSource) {
  const resolveTabId = (): number | null => { ... };
  const tabId = resolveTabId();

  if (!tabId) {
    logger.error(`[FAILED] Could not resolve Tab ID...`);
    cleanupPendingOperation();
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.pinned) {
      logger.warn('[ISLAND] Cannot create island from pinned tab');
      cleanupPendingOperation();
      return;
    }
    // ... create island logic
  } catch (e) {
    logger.error('[ISLAND] Tab no longer exists or access denied', e);
    await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });
  } finally {
    setIsCreatingIsland(false);
    setCreatingTabId(null);
  }
  cleanupPendingOperation();
  return;
}
```

## Problems

1. **Missing cleanup in pinned tab case**: If the tab is pinned, `setIsCreatingIsland(false)` and `setCreatingTabId(null)` are never called.

2. **No `isCreatingIsland` state reset in early returns**: Multiple early return paths don't reset the loading state.

3. **`createIsland` can return null silently**: When `createIsland` returns null, the error is logged but no user feedback is provided.

4. **Runtime message may fail silently**: `chrome.runtime.sendMessage` calls don't have error handling.

## Expected Behavior

All code paths should properly clean up loading states and pending operations.

## Steps to Reproduce

1. Start dragging a pinned tab
2. Drop it on the "Create Island" zone
3. Observe that `isCreatingIsland` state is never properly reset
4. The UI may show a stale loading indicator

## Suggested Fix

```typescript
if (overIdStr === 'create-island-dropzone' && !isVaultSource) {
  // ... resolution logic ...
  
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.pinned) {
      logger.warn('[ISLAND] Cannot create island from pinned tab');
      return; // finally block will handle cleanup
    }
    // ... rest of logic
  } catch (e) {
    logger.error('[ISLAND] Failed:', e);
  } finally {
    // ALWAYS clean up
    setIsCreatingIsland(false);
    setCreatingTabId(null);
    try {
      await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });
    } catch {}
    cleanupPendingOperation();
  }
  return;
}
```

## Files to Modify

- `src/components/Dashboard.tsx`
