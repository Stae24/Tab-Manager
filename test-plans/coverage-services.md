# Services Test Coverage Plan

## Overview

This plan covers test improvements for `src/services/`. Current overall coverage: **80.42%**, target: **85%** (maintain and improve).

---

## 1. tabService.ts

**Current Coverage:** 81.7%  
**Target Coverage:** 85%  
**Uncovered Lines:** 250-261, 298, 329-349, 465

### File Analysis

Tab service provides Chrome API wrappers for tab operations with retry logic.

### Uncovered Code Analysis

| Lines | Function | Description |
|-------|----------|-------------|
| 250-261 | `updateTabGroupCollapse` | Brave browser visual refresh workaround |
| 298 | `closeTabs` | Single tab ID branch |
| 329-349 | `duplicateIsland` | Island duplication logic |
| 465 | `consolidateAndGroupTabs` | Error handling branch |

### Test Cases Needed

```typescript
// src/services/__tests__/tabService.test.ts (expand existing)

describe('tabService', () => {
  // Existing tests cover basic operations - need to add:

  describe('updateTabGroupCollapse', () => {
    it('should update collapse state', async () => {
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 1, collapsed: true } as any);
      vi.mocked(chrome.tabGroups.get).mockResolvedValue({ id: 1, collapsed: true } as any);
      
      const result = await tabService.updateTabGroupCollapse(1, true);
      
      expect(result).toBe(true);
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, { collapsed: true });
    });

    it('should return false if collapse not applied', async () => {
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 1 } as any);
      vi.mocked(chrome.tabGroups.get).mockResolvedValue({ id: 1, collapsed: false } as any);
      
      const result = await tabService.updateTabGroupCollapse(1, true);
      
      expect(result).toBe(false);
    });

    it('should apply Brave visual refresh workaround', async () => {
      // Mock Brave browser
      vi.mocked(getCachedCapabilities).mockReturnValue({
        vendor: 'brave',
        supportsGroupCollapse: true,
        supportsSingleTabGroups: true,
      });
      
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 1, collapsed: true } as any);
      vi.mocked(chrome.tabGroups.get).mockResolvedValue({ id: 1, collapsed: true } as any);
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 10, windowId: 1 }]);
      vi.mocked(chrome.tabs.create).mockResolvedValue({ id: 99 } as any);
      vi.mocked(chrome.tabs.group).mockResolvedValue(1);
      vi.mocked(chrome.tabs.ungroup).mockResolvedValue({});
      vi.mocked(chrome.tabs.remove).mockResolvedValue(undefined);
      
      await tabService.updateTabGroupCollapse(1, true);
      
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'about:blank',
        windowId: 1,
        active: false,
      });
      expect(chrome.tabs.remove).toHaveBeenCalledWith(99);
    });

    it('should handle Brave workaround errors gracefully', async () => {
      vi.mocked(getCachedCapabilities).mockReturnValue({
        vendor: 'brave',
        supportsGroupCollapse: true,
        supportsSingleTabGroups: true,
      });
      
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 1, collapsed: true } as any);
      vi.mocked(chrome.tabGroups.get).mockResolvedValue({ id: 1, collapsed: true } as any);
      vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 10, windowId: 1 }]);
      vi.mocked(chrome.tabs.create).mockResolvedValue({ id: 99 } as any);
      vi.mocked(chrome.tabs.group).mockRejectedValue(new Error('Group failed'));
      vi.mocked(chrome.tabs.remove).mockResolvedValue(undefined);
      
      // Should not throw
      await expect(tabService.updateTabGroupCollapse(1, true)).resolves.toBe(true);
    });

    it('should handle get group error', async () => {
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 1 } as any);
      vi.mocked(chrome.tabGroups.get).mockRejectedValue(new Error('Not found'));
      
      const result = await tabService.updateTabGroupCollapse(1, true);
      
      expect(result).toBe(true); // Still returns success
    });
  });

  describe('closeTabs', () => {
    it('should close single tab with number', async () => {
      vi.mocked(chrome.tabs.remove).mockResolvedValue(undefined);
      
      await tabService.closeTabs(123);
      
      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
    });

    it('should close multiple tabs with array', async () => {
      vi.mocked(chrome.tabs.remove).mockResolvedValue(undefined);
      
      await tabService.closeTabs([1, 2, 3]);
      
      expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe('duplicateIsland', () => {
    it('should duplicate all tabs in island', async () => {
      const mockTabs = [
        { id: 1, windowId: 1, url: 'https://example.com', active: false, index: 0 },
        { id: 2, windowId: 1, url: 'https://test.com', active: true, index: 1 },
      ];
      
      vi.mocked(chrome.tabs.get)
        .mockResolvedValueOnce(mockTabs[0] as any)
        .mockResolvedValueOnce(mockTabs[1] as any);
      
      vi.mocked(chrome.tabs.create)
        .mockResolvedValueOnce({ id: 101 } as any)
        .mockResolvedValueOnce({ id: 102 } as any);
      
      vi.mocked(chrome.tabs.group).mockResolvedValue(500);
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 500 } as any);
      
      const result = await tabService.duplicateIsland([1, 2]);
      
      expect(result).toEqual([101, 102]);
      expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [101, 102] });
    });

    it('should handle missing tabs gracefully', async () => {
      vi.mocked(chrome.tabs.get)
        .mockResolvedValueOnce({ id: 1, windowId: 1, url: 'https://example.com' } as any)
        .mockRejectedValueOnce(new Error('Tab not found'));
      
      vi.mocked(chrome.tabs.create).mockResolvedValue({ id: 101 } as any);
      vi.mocked(chrome.tabs.group).mockResolvedValue(500);
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 500 } as any);
      
      const result = await tabService.duplicateIsland([1, 2]);
      
      expect(result).toEqual([101]);
    });

    it('should skip tabs without URLs', async () => {
      vi.mocked(chrome.tabs.get)
        .mockResolvedValueOnce({ id: 1, windowId: 1, url: undefined } as any)
        .mockResolvedValueOnce({ id: 2, windowId: 1, url: 'https://example.com' } as any);
      
      vi.mocked(chrome.tabs.create).mockResolvedValue({ id: 101 } as any);
      vi.mocked(chrome.tabs.group).mockResolvedValue(500);
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 500 } as any);
      
      const result = await tabService.duplicateIsland([1, 2]);
      
      expect(result).toEqual([101]);
    });

    it('should not create group for single tab', async () => {
      vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 1, windowId: 1, url: 'https://example.com' } as any);
      vi.mocked(chrome.tabs.create).mockResolvedValue({ id: 101 } as any);
      
      const result = await tabService.duplicateIsland([1]);
      
      expect(result).toEqual([101]);
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
  });

  describe('consolidateAndGroupTabs', () => {
    it('should consolidate tabs from different windows', async () => {
      vi.mocked(chrome.windows.getLastFocused).mockResolvedValue({ id: 1 } as any);
      vi.mocked(chrome.tabs.get)
        .mockResolvedValueOnce({ id: 10, windowId: 2, url: 'https://example.com', pinned: false } as any)
        .mockResolvedValueOnce({ id: 11, windowId: 1, url: 'https://test.com', pinned: false } as any);
      vi.mocked(chrome.tabs.move).mockResolvedValue({} as any);
      vi.mocked(chrome.tabs.group).mockResolvedValue(100);
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 10, groupId: 100, index: 0 },
        { id: 11, groupId: 100, index: 1 },
      ] as any);
      vi.mocked(chrome.tabGroups.move).mockResolvedValue({ id: 100 } as any);
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 100 } as any);
      
      await tabService.consolidateAndGroupTabs([10, 11], { color: 'blue' });
      
      expect(chrome.tabs.move).toHaveBeenCalledWith(10, { windowId: 1, index: -1 });
      expect(chrome.tabs.group).toHaveBeenCalled();
    });

    it('should skip pinned tabs', async () => {
      vi.mocked(chrome.windows.getLastFocused).mockResolvedValue({ id: 1 } as any);
      vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 10, windowId: 1, url: 'https://example.com', pinned: true } as any);
      
      await tabService.consolidateAndGroupTabs([10], { color: 'blue' });
      
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    it('should skip restricted URLs', async () => {
      vi.mocked(chrome.windows.getLastFocused).mockResolvedValue({ id: 1 } as any);
      vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 10, windowId: 1, url: 'chrome://settings', pinned: false } as any);
      
      await tabService.consolidateAndGroupTabs([10], { color: 'blue' });
      
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    it('should apply random color when specified', async () => {
      vi.mocked(chrome.windows.getLastFocused).mockResolvedValue({ id: 1 } as any);
      vi.mocked(chrome.tabs.get)
        .mockResolvedValueOnce({ id: 10, windowId: 1, url: 'https://example.com', pinned: false } as any)
        .mockResolvedValueOnce({ id: 11, windowId: 1, url: 'https://test.com', pinned: false } as any);
      vi.mocked(chrome.tabs.group).mockResolvedValue(100);
      vi.mocked(chrome.tabs.query).mockResolvedValue([
        { id: 10, groupId: 100, index: 0 },
        { id: 11, groupId: 100, index: 1 },
      ] as any);
      vi.mocked(chrome.tabGroups.move).mockResolvedValue({ id: 100 } as any);
      vi.mocked(chrome.tabGroups.update).mockResolvedValue({ id: 100 } as any);
      
      await tabService.consolidateAndGroupTabs([10, 11], { color: 'random' });
      
      expect(chrome.tabGroups.update).toHaveBeenCalled();
      const colorArg = vi.mocked(chrome.tabGroups.update).mock.calls[0][1];
      expect(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']).toContain(colorArg.color);
    });

    it('should handle no target window', async () => {
      vi.mocked(chrome.windows.getLastFocused).mockResolvedValue({} as any);
      
      await tabService.consolidateAndGroupTabs([10], { color: 'blue' });
      
      // Should exit early without error
    });

    it('should handle consolidation error', async () => {
      vi.mocked(chrome.windows.getLastFocused).mockRejectedValue(new Error('No window'));
      
      await tabService.consolidateAndGroupTabs([10], { color: 'blue' });
      
      // Should handle error gracefully
    });

    it('should handle tab move error', async () => {
      vi.mocked(chrome.windows.getLastFocused).mockResolvedValue({ id: 1 } as any);
      vi.mocked(chrome.tabs.get).mockResolvedValue({ id: 10, windowId: 2, url: 'https://example.com', pinned: false } as any);
      vi.mocked(chrome.tabs.move).mockRejectedValue(new Error('Move failed'));
      
      await tabService.consolidateAndGroupTabs([10], { color: 'blue' });
      
      // Should continue without the failed tab
    });
  });
});
```

---

## 2. vaultService.ts

**Current Coverage:** 78.45%  
**Target Coverage:** 85%  
**Uncovered Lines:** Various

### File Analysis

Vault service handles vault storage operations including:
- Load/save vault
- Migration from legacy format
- Compression
- Sync vs local storage

### Test Cases Needed

```typescript
// src/services/__tests__/vaultService.test.ts (expand existing)

describe('vaultService', () => {
  // Focus on uncovered edge cases:

  describe('loadVault', () => {
    it('should handle corrupted sync data', async () => {
      vi.mocked(chrome.storage.sync.get).mockResolvedValue({ vault_meta: { corrupted: true } });
      vi.mocked(chrome.storage.local.get).mockResolvedValue({ vault: [] });
      
      const result = await vaultService.loadVault({ syncEnabled: true });
      
      expect(result.fallbackToLocal).toBe(true);
    });

    it('should migrate from legacy format on load', async () => {
      // Test legacy migration during load
    });
  });

  describe('saveVault', () => {
    it('should handle quota exceeded during save', async () => {
      vi.mocked(chrome.storage.sync.set).mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
      vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
      
      const result = await vaultService.saveVault([], { syncEnabled: true });
      
      expect(result.fallbackToLocal).toBe(true);
    });

    it('should compress data when needed', async () => {
      // Test compression logic
    });
  });

  describe('recoverVaultSync', () => {
    it('should recover from backup', async () => {
      // Test sync recovery
    });

    it('should handle recovery failure', async () => {
      // Test recovery failure handling
    });
  });

  describe('disableVaultSync', () => {
    it('should clear sync storage', async () => {
      vi.mocked(chrome.storage.sync.clear).mockResolvedValue(undefined);
      vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
      
      await vaultService.disableVaultSync([]);
      
      expect(chrome.storage.sync.clear).toHaveBeenCalled();
    });
  });
});
```

---

## 3. quotaService.ts

**Current Coverage:** Good (maintain)  
**Target Coverage:** 85%

### Test Cases to Maintain

```typescript
// Ensure existing tests cover:
- getVaultQuota with sync enabled
- getVaultQuota with sync disabled
- cleanupOrphanedChunks
- Quota percentage calculations
```

---

## 4. settingsService.ts

**Current Coverage:** Good (maintain)  
**Target Coverage:** 85%

### Test Cases to Maintain

```typescript
// Ensure existing tests cover:
- loadSettings
- saveSettings
- watchSettings
- Settings change propagation
```

---

## Implementation Order

1. **tabService.ts** - Expand existing tests for uncovered branches
2. **vaultService.ts** - Add edge case tests
3. **quotaService.ts** - Maintain coverage
4. **settingsService.ts** - Maintain coverage

## Test File Locations

- `src/services/__tests__/tabService.test.ts` (EXPAND)
- `src/services/__tests__/vaultService.test.ts` (EXPAND)
- `src/services/__tests__/quotaService.test.ts` (MAINTAIN)
- `src/services/__tests__/settingsService.test.ts` (MAINTAIN)

## Mock Setup

```typescript
// Standard Chrome API mocks
const chromeMock = {
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    move: vi.fn(),
    remove: vi.fn(),
    discard: vi.fn(),
    update: vi.fn(),
    duplicate: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    move: vi.fn(),
  },
  windows: {
    getLastFocused: vi.fn(),
    WINDOW_ID_CURRENT: -2,
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeMock);

// Navigator mock for clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
});
```

## Dependencies

- `vitest` - Test framework
- `../utils/browser` - Browser detection
- `../utils/logger` - Logging utility
