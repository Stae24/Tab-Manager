# Phase 4: Background Script Tests

**Target Coverage:** 75%+
**Estimated Tests:** ~80
**Priority:** MEDIUM
**Duration:** ~2 hours

---

## Overview

The background script (`src/background.ts`) is the extension's service worker. It handles:
- Tab/group event listeners
- Message passing from popup/content scripts
- Tab freezing (discard)
- Island creation triggers

Current coverage: **40.62%**

Uncovered lines: 6-27, 36-39, 47-53, 60-64, 70-78, 93-96, 103

---

## File to Modify

```
src/__tests__/background.test.ts
```

---

## Current Test Coverage Analysis

### What's Currently Tested (Lines 45-81)

```typescript
// ✓ Listener registration
it('should register a named message listener and remove it on suspend', ...)

// ✓ Message handling: START_ISLAND_CREATION
it('messageListener should handle START_ISLAND_CREATION', ...)

// ✓ Message handling: FREEZE_TAB
it('messageListener should handle FREEZE_TAB', ...)
```

### What's NOT Tested

| Lines | Feature | Tests Needed |
|-------|---------|--------------|
| 6-27 | Tab event handlers | onCreated, onRemoved, onUpdated, onMoved |
| 36-39 | Group event handlers | onCreated, onUpdated, onRemoved, onMoved |
| 47-53 | Tab created handler | Badge update, context sync |
| 60-64 | Tab removed handler | Badge update, cleanup |
| 70-78 | Tab updated handler | Title/URL changes, audible state |
| 93-96 | Group handlers | Group state changes |
| 103 | Action click handler | Open popup/trigger action |

---

## Part 1: Read Background Script

Before writing tests, understand the actual implementation:

```bash
# Read the background script
cat src/background.ts
```

---

## Part 2: Test Suite - Tab Event Handlers

### Test Suite: `chrome.tabs.onCreated`

```typescript
describe('background - Tab Events', () => {
  let tabCreatedHandler: Function;
  let tabRemovedHandler: Function;
  let tabUpdatedHandler: Function;
  let tabMovedHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import background to register handlers
    await import('../background');
    
    // Extract registered handlers
    tabCreatedHandler = (chrome.tabs.onCreated.addListener as Mock).mock.calls[0]?.[0];
    tabRemovedHandler = (chrome.tabs.onRemoved.addListener as Mock).mock.calls[0]?.[0];
    tabUpdatedHandler = (chrome.tabs.onUpdated.addListener as Mock).mock.calls[0]?.[0];
    tabMovedHandler = (chrome.tabs.onMoved.addListener as Mock).mock.calls[0]?.[0];
  });

  describe('onCreated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(tabCreatedHandler).toBeDefined();
    });

    it('handles tab creation event', () => {
      const mockTab = { id: 1, title: 'New Tab', url: 'https://example.com' };
      
      tabCreatedHandler(mockTab);
      
      // Verify expected behavior (e.g., badge update, state sync)
    });

    it('ignores tabs without ID', () => {
      const mockTab = { title: 'No ID' };
      
      // Should not throw
      expect(() => tabCreatedHandler(mockTab)).not.toThrow();
    });

    it('handles pinned tabs', () => {
      const mockTab = { id: 1, pinned: true };
      
      tabCreatedHandler(mockTab);
      
      // Verify pinned tab handling
    });

    it('handles grouped tabs', () => {
      const mockTab = { id: 1, groupId: 10 };
      
      tabCreatedHandler(mockTab);
      
      // Verify grouped tab handling
    });
  });

  describe('onRemoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(tabRemovedHandler).toBeDefined();
    });

    it('handles tab removal event', () => {
      tabRemovedHandler(1, { windowId: 1, isWindowClosing: false });
      
      // Verify cleanup behavior
    });

    it('ignores removal during window close', () => {
      tabRemovedHandler(1, { windowId: 1, isWindowClosing: true });
      
      // Verify no action taken when window is closing
    });

    it('handles removal of grouped tab', () => {
      // If tab was in a group, verify group state update
      tabRemovedHandler(1, { windowId: 1, isWindowClosing: false });
    });
  });

  describe('onUpdated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(tabUpdatedHandler).toBeDefined();
    });

    it('handles title change', () => {
      const changeInfo = { title: 'New Title' };
      const tab = { id: 1, title: 'Old Title' };
      
      tabUpdatedHandler(1, changeInfo, tab);
      
      // Verify title update handling
    });

    it('handles URL change', () => {
      const changeInfo = { url: 'https://newurl.com' };
      const tab = { id: 1, url: 'https://oldurl.com' };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });

    it('handles audible state change', () => {
      const changeInfo = { audible: true };
      const tab = { id: 1, audible: false };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });

    it('handles muted state change', () => {
      const changeInfo = { mutedInfo: { muted: true } };
      const tab = { id: 1 };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });

    it('handles discarded state change', () => {
      const changeInfo = { discarded: true };
      const tab = { id: 1 };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });

    it('handles favIconUrl change', () => {
      const changeInfo = { favIconUrl: 'https://example.com/icon.png' };
      const tab = { id: 1 };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });

    it('ignores status: loading events', () => {
      const changeInfo = { status: 'loading' };
      const tab = { id: 1 };
      
      tabUpdatedHandler(1, changeInfo, tab);
      
      // Verify minimal processing for loading events
    });

    it('handles status: complete events', () => {
      const changeInfo = { status: 'complete' };
      const tab = { id: 1 };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });

    it('handles pinned state change', () => {
      const changeInfo = { pinned: true };
      const tab = { id: 1 };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });

    it('handles groupId change', () => {
      const changeInfo = { groupId: 10 };
      const tab = { id: 1, groupId: -1 };
      
      tabUpdatedHandler(1, changeInfo, tab);
    });
  });

  describe('onMoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onMoved.addListener).toHaveBeenCalled();
      expect(tabMovedHandler).toBeDefined();
    });

    it('handles tab move within window', () => {
      const moveInfo = { windowId: 1, fromIndex: 0, toIndex: 5 };
      
      tabMovedHandler(1, moveInfo);
      
      // Verify move handling
    });

    it('handles tab move between windows', () => {
      const moveInfo = { windowId: 2, fromIndex: 0, toIndex: 0 };
      
      tabMovedHandler(1, moveInfo);
    });
  });
});
```

---

## Part 3: Test Suite - Group Event Handlers

### Test Suite: `chrome.tabGroups.*` Events

```typescript
describe('background - Group Events', () => {
  let groupCreatedHandler: Function;
  let groupUpdatedHandler: Function;
  let groupRemovedHandler: Function;
  let groupMovedHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    await import('../background');
    
    groupCreatedHandler = (chrome.tabGroups.onCreated.addListener as Mock).mock.calls[0]?.[0];
    groupUpdatedHandler = (chrome.tabGroups.onUpdated.addListener as Mock).mock.calls[0]?.[0];
    groupRemovedHandler = (chrome.tabGroups.onRemoved.addListener as Mock).mock.calls[0]?.[0];
    groupMovedHandler = (chrome.tabGroups.onMoved.addListener as Mock).mock.calls[0]?.[0];
  });

  describe('onCreated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onCreated.addListener).toHaveBeenCalled();
      expect(groupCreatedHandler).toBeDefined();
    });

    it('handles group creation', () => {
      const group = { id: 10, title: 'New Group', color: 'blue', windowId: 1 };
      
      groupCreatedHandler(group);
      
      // Verify group creation handling
    });
  });

  describe('onUpdated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onUpdated.addListener).toHaveBeenCalled();
      expect(groupUpdatedHandler).toBeDefined();
    });

    it('handles title change', () => {
      const group = { id: 10, title: 'Updated Title' };
      
      groupUpdatedHandler(group);
    });

    it('handles color change', () => {
      const group = { id: 10, color: 'red' };
      
      groupUpdatedHandler(group);
    });

    it('handles collapsed state change', () => {
      const group = { id: 10, collapsed: true };
      
      groupUpdatedHandler(group);
    });
  });

  describe('onRemoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onRemoved.addListener).toHaveBeenCalled();
      expect(groupRemovedHandler).toBeDefined();
    });

    it('handles group removal', () => {
      const group = { id: 10, windowId: 1 };
      
      groupRemovedHandler(group);
      
      // Verify cleanup
    });
  });

  describe('onMoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onMoved.addListener).toHaveBeenCalled();
      expect(groupMovedHandler).toBeDefined();
    });

    it('handles group move', () => {
      const group = { id: 10, windowId: 1 };
      
      groupMovedHandler(group);
    });
  });
});
```

---

## Part 4: Test Suite - Message Handlers

### Test Suite: All Message Types

```typescript
describe('background - Message Handlers', () => {
  let messageListener: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    await import('../background');
    
    messageListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];
  });

  describe('START_ISLAND_CREATION', () => {
    it('responds with success', async () => {
      const sendResponse = vi.fn();
      
      const result = messageListener(
        { type: 'START_ISLAND_CREATION' },
        {},
        sendResponse
      );
      
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('FREEZE_TAB', () => {
    it('discards specified tab', async () => {
      const sendResponse = vi.fn();
      chrome.tabs.discard.mockResolvedValue({ id: 1 });
      
      const result = messageListener(
        { type: 'FREEZE_TAB', tabId: 1 },
        {},
        sendResponse
      );
      
      expect(result).toBe(true); // Indicates async response
      
      await vi.waitFor(() => {
        expect(chrome.tabs.discard).toHaveBeenCalledWith(1);
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
      });
    });

    it('handles discard failure', async () => {
      const sendResponse = vi.fn();
      chrome.tabs.discard.mockRejectedValue(new Error('Cannot discard'));
      
      messageListener(
        { type: 'FREEZE_TAB', tabId: 1 },
        {},
        sendResponse
      );
      
      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({ success: false })
        );
      });
    });

    it('handles already discarded tab', async () => {
      const sendResponse = vi.fn();
      chrome.tabs.discard.mockResolvedValue(null); // Already discarded
      
      messageListener(
        { type: 'FREEZE_TAB', tabId: 1 },
        {},
        sendResponse
      );
      
      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalled();
      });
    });
  });

  describe('GET_TAB_COUNT', () => {
    it('returns current tab count', async () => {
      const sendResponse = vi.fn();
      chrome.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      
      messageListener(
        { type: 'GET_TAB_COUNT' },
        {},
        sendResponse
      );
      
      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ count: 2 });
      });
    });
  });

  describe('SYNC_TABS', () => {
    it('triggers tab sync', async () => {
      const sendResponse = vi.fn();
      
      messageListener(
        { type: 'SYNC_TABS' },
        {},
        sendResponse
      );
      
      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
      });
    });
  });

  describe('Unknown message type', () => {
    it('returns false for unhandled messages', () => {
      const sendResponse = vi.fn();
      
      const result = messageListener(
        { type: 'UNKNOWN_TYPE' },
        {},
        sendResponse
      );
      
      expect(result).toBe(false);
    });
  });

  describe('Message validation', () => {
    it('handles missing type field', () => {
      const sendResponse = vi.fn();
      
      const result = messageListener({}, {}, sendResponse);
      
      expect(result).toBe(false);
    });

    it('handles null message', () => {
      const sendResponse = vi.fn();
      
      const result = messageListener(null, {}, sendResponse);
      
      expect(result).toBe(false);
    });
  });
});
```

---

## Part 5: Test Suite - Action Handler

### Test Suite: `chrome.action.onClicked`

```typescript
describe('background - Action Handler', () => {
  let actionClickHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    await import('../background');
    
    actionClickHandler = (chrome.action.onClicked.addListener as Mock).mock.calls[0]?.[0];
  });

  describe('onClicked handler', () => {
    it('is registered on startup', () => {
      expect(chrome.action.onClicked.addListener).toHaveBeenCalled();
      expect(actionClickHandler).toBeDefined();
    });

    it('opens extension popup on click', () => {
      actionClickHandler({ id: 1 });
      
      // Verify popup opened or default action triggered
    });

    it('handles click without window ID', () => {
      actionClickHandler({});
      
      // Should not throw
    });
  });
});
```

---

## Part 6: Test Suite - Lifecycle

### Test Suite: Service Worker Lifecycle

```typescript
describe('background - Lifecycle', () => {
  describe('onSuspend handler', () => {
    it('removes message listener on suspend', async () => {
      vi.resetModules();
      
      await import('../background');
      
      const suspendHandler = (chrome.runtime.onSuspend.addListener as Mock).mock.calls[0][0];
      const registeredListener = (chrome.runtime.onMessage.addListener as Mock).mock.calls[0][0];
      
      suspendHandler();
      
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(registeredListener);
    });

    it('handles multiple suspend calls gracefully', async () => {
      vi.resetModules();
      
      await import('../background');
      
      const suspendHandler = (chrome.runtime.onSuspend.addListener as Mock).mock.calls[0][0];
      
      suspendHandler();
      suspendHandler(); // Second call
      
      // Should not throw or call removeListener twice
    });
  });

  describe('Module initialization', () => {
    it('registers all event listeners on import', async () => {
      vi.resetModules();
      
      await import('../background');
      
      expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onMoved.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onRemoved.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onMoved.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onSuspend.addListener).toHaveBeenCalled();
    });

    it('does not re-register on subsequent imports', async () => {
      vi.resetModules();
      
      await import('../background');
      const firstCallCount = (chrome.tabs.onCreated.addListener as Mock).mock.calls.length;
      
      await import('../background');
      const secondCallCount = (chrome.tabs.onCreated.addListener as Mock).mock.calls.length;
      
      // Due to module caching, should not increase
      expect(secondCallCount).toBe(firstCallCount);
    });
  });
});
```

---

## Part 7: Test Suite - Edge Cases

### Test Suite: Edge Cases and Error Handling

```typescript
describe('background - Edge Cases', () => {
  describe('Error handling', () => {
    it('handles chrome API errors gracefully', async () => {
      vi.resetModules();
      chrome.tabs.query.mockRejectedValue(new Error('API error'));
      
      // Should not throw during import
      await expect(import('../background')).resolves.toBeDefined();
    });

    it('handles missing chrome API gracefully', async () => {
      const originalChrome = global.chrome;
      // @ts-ignore
      delete global.chrome;
      
      // Should handle missing chrome object
      await expect(import('../background')).resolves.toBeDefined();
      
      global.chrome = originalChrome;
    });
  });

  describe('Concurrent operations', () => {
    it('handles rapid tab events', async () => {
      vi.resetModules();
      await import('../background');
      
      const tabCreatedHandler = (chrome.tabs.onCreated.addListener as Mock).mock.calls[0][0];
      
      // Rapid fire events
      for (let i = 0; i < 100; i++) {
        tabCreatedHandler({ id: i, title: `Tab ${i}` });
      }
      
      // Should handle without error
    });
  });

  describe('Memory management', () => {
    it('cleans up references on suspend', async () => {
      vi.resetModules();
      await import('../background');
      
      const suspendHandler = (chrome.runtime.onSuspend.addListener as Mock).mock.calls[0][0];
      
      suspendHandler();
      
      // Verify any cached data is cleared
    });
  });
});
```

---

## Verification Commands

```bash
# Run background tests
npx vitest run src/__tests__/background.test.ts

# Coverage for background
npx vitest run --coverage src/background.ts

# Target: 75%+ coverage
```

---

## Success Criteria

- [ ] All tab event handlers tested
- [ ] All group event handlers tested
- [ ] All message types tested
- [ ] Action click handler tested
- [ ] Lifecycle events tested
- [ ] Edge cases covered
- [ ] `background.ts` coverage >= 75%
- [ ] No unhandled promise rejections in tests
