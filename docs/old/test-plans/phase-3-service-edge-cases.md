# Phase 3: Service Edge Cases

**Target Coverage:** 90%+
**Estimated Tests:** ~100
**Priority:** MEDIUM-HIGH
**Duration:** ~2-3 hours

---

## Overview

Services wrap Chrome APIs with retry logic and error handling. Current coverage:
- `tabService.ts`: 78.29%
- `vaultService.ts`: 75.70%
- `quotaService.ts`: 86.41%

The uncovered lines are primarily:
- Retry logic with exponential backoff
- Compression fallback paths
- Chunk migration
- Checksum verification errors

---

## Files to Modify

```
src/services/__tests__/
├── tabService.test.ts       # Expand existing
├── vaultService.test.ts     # Expand existing (or create)
└── quotaService.test.ts     # Expand existing
```

---

## Part 1: `tabService.test.ts`

### Missing Coverage Areas

| Lines | Feature | Tests Needed |
|-------|---------|--------------|
| 29 | Error handling | Move tab error |
| 93-94 | Edge case | Tab not found |
| 130-131 | Edge case | Group not found |
| 156-157 | Error path | Update failure |
| 174 | Error path | Group update failure |
| 192-193 | Edge case | Collapse not supported |
| 231-237 | Retry logic | Exponential backoff |
| 247-272 | Retry logic | Max retries exceeded |
| 298 | Error path | Create island failure |
| 329-349 | Consolidation | Complex group creation |
| 435-436 | Edge case | Query empty result |
| 442 | Error path | Get current window tabs error |
| 465 | Edge case | Tab without URL |

### Test Suite: Retry Logic

```typescript
describe('tabService - Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withRetry helper', () => {
    it('retries on retryable errors (dragging)', async () => {
      chrome.tabs.move
        .mockRejectedValueOnce(new Error('Tabs being dragged'))
        .mockRejectedValueOnce(new Error('Tabs being dragged'))
        .mockResolvedValueOnce({ id: 1 });

      const result = await tabService.moveTab(1, 5);

      expect(chrome.tabs.move).toHaveBeenCalledTimes(3);
      expect(result).toBeDefined();
    });

    it('retries on "not editable" errors', async () => {
      chrome.tabs.move
        .mockRejectedValueOnce(new Error('Not editable'))
        .mockResolvedValueOnce({ id: 1 });

      await tabService.moveTab(1, 5);

      expect(chrome.tabs.move).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff', async () => {
      chrome.tabs.move
        .mockRejectedValueOnce(new Error('dragging'))
        .mockRejectedValueOnce(new Error('dragging'))
        .mockResolvedValueOnce({ id: 1 });

      const promise = tabService.moveTab(1, 5);
      
      // First retry after ~100ms
      await vi.advanceTimersByTimeAsync(100);
      // Second retry after ~200ms
      await vi.advanceTimersByTimeAsync(200);
      
      await promise;

      expect(chrome.tabs.move).toHaveBeenCalledTimes(3);
    });

    it('throws after max retries exceeded', async () => {
      chrome.tabs.move.mockRejectedValue(new Error('dragging'));

      await expect(tabService.moveTab(1, 5)).rejects.toThrow('dragging');
      expect(chrome.tabs.move).toHaveBeenCalledTimes(3); // MAX_SYNC_RETRIES
    });

    it('does not retry on non-retryable errors', async () => {
      chrome.tabs.move.mockRejectedValueOnce(new Error('Tab not found'));

      await expect(tabService.moveTab(1, 5)).rejects.toThrow('Tab not found');
      expect(chrome.tabs.move).toHaveBeenCalledTimes(1);
    });

    it('logs retry attempts', async () => {
      const loggerSpy = vi.spyOn(logger, 'warn');
      
      chrome.tabs.move
        .mockRejectedValueOnce(new Error('dragging'))
        .mockResolvedValueOnce({ id: 1 });

      await tabService.moveTab(1, 5);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('retry'),
        expect.any(Object)
      );
    });
  });
});
```

### Test Suite: Move Operations

```typescript
describe('tabService - Move Operations', () => {
  describe('moveTab', () => {
    it('moves tab to new index', async () => {
      chrome.tabs.move.mockResolvedValue({ id: 1 });

      await tabService.moveTab(1, 5, 1);

      expect(chrome.tabs.move).toHaveBeenCalledWith(1, { index: 5, windowId: 1 });
    });

    it('moves tab without windowId', async () => {
      chrome.tabs.move.mockResolvedValue({ id: 1 });

      await tabService.moveTab(1, 5);

      expect(chrome.tabs.move).toHaveBeenCalledWith(1, { index: 5 });
    });

    it('handles tab not found error', async () => {
      chrome.tabs.move.mockRejectedValue(new Error('No tab with id'));

      await expect(tabService.moveTab(999, 5)).rejects.toThrow();
    });
  });

  describe('moveIsland', () => {
    it('moves group to new index', async () => {
      chrome.tabGroups.move.mockResolvedValue({ id: 10 });

      await tabService.moveIsland(10, 3, 1);

      expect(chrome.tabGroups.move).toHaveBeenCalledWith(10, { index: 3, windowId: 1 });
    });

    it('handles group not found', async () => {
      chrome.tabGroups.move.mockRejectedValue(new Error('No group'));

      await expect(tabService.moveIsland(999, 3)).rejects.toThrow();
    });
  });
});
```

### Test Suite: Group Operations

```typescript
describe('tabService - Group Operations', () => {
  describe('createIsland', () => {
    it('creates group with tabs', async () => {
      chrome.tabs.group.mockResolvedValue(10);
      chrome.tabGroups.update.mockResolvedValue({ id: 10 });

      await tabService.createIsland([1, 2, 3], 'My Group', 'blue');

      expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [1, 2, 3] });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(10, {
        title: 'My Group',
        color: 'blue'
      });
    });

    it('throws if no tabs provided', async () => {
      await expect(tabService.createIsland([], 'Empty')).rejects.toThrow();
    });

    it('uses default color if not specified', async () => {
      chrome.tabs.group.mockResolvedValue(10);
      chrome.tabGroups.update.mockResolvedValue({ id: 10 });

      await tabService.createIsland([1], 'Group');

      expect(chrome.tabGroups.update).toHaveBeenCalledWith(10, {
        title: 'Group',
        color: 'grey'
      });
    });
  });

  describe('updateTabGroupCollapse', () => {
    it('updates collapsed state', async () => {
      chrome.tabGroups.update.mockResolvedValue({ id: 10, collapsed: true });

      const result = await tabService.updateTabGroupCollapse(10, true);

      expect(result).toBe(true);
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(10, { collapsed: true });
    });

    it('returns false on error', async () => {
      chrome.tabGroups.update.mockRejectedValue(new Error('Not supported'));

      const result = await tabService.updateTabGroupCollapse(10, true);

      expect(result).toBe(false);
    });
  });

  describe('consolidateAndGroupTabs', () => {
    it('consolidates scattered tabs then groups', async () => {
      chrome.tabs.query.mockResolvedValue([
        { id: 1, index: 0 },
        { id: 2, index: 5 },
        { id: 3, index: 10 },
      ]);
      chrome.tabs.move.mockResolvedValue({ id: 1 });
      chrome.tabs.group.mockResolvedValue(10);
      chrome.tabGroups.update.mockResolvedValue({ id: 10 });

      await tabService.consolidateAndGroupTabs([1, 2, 3], { color: 'random' });

      // Should move tabs to contiguous positions
      expect(chrome.tabs.move).toHaveBeenCalledTimes(3);
      expect(chrome.tabs.group).toHaveBeenCalled();
    });

    it('handles random color selection', async () => {
      chrome.tabs.query.mockResolvedValue([{ id: 1, index: 0 }]);
      chrome.tabs.move.mockResolvedValue({ id: 1 });
      chrome.tabs.group.mockResolvedValue(10);
      chrome.tabGroups.update.mockResolvedValue({ id: 10 });

      await tabService.consolidateAndGroupTabs([1], { color: 'random' });

      expect(chrome.tabGroups.update).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ color: expect.any(String) })
      );
    });
  });
});
```

### Test Suite: Query Operations

```typescript
describe('tabService - Query Operations', () => {
  describe('getLiveTabsAndGroups', () => {
    it('returns normalized tabs and groups', async () => {
      chrome.tabs.query.mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'https://a.com', groupId: -1 },
        { id: 2, title: 'Tab 2', url: 'https://b.com', groupId: 10 },
      ]);
      chrome.tabGroups.query.mockResolvedValue([
        { id: 10, title: 'Group', color: 'blue', collapsed: false }
      ]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toHaveLength(2);
      
      const group = result.find(i => 'tabs' in i);
      expect(group.title).toBe('Group');
      expect(group.tabs).toHaveLength(1);
    });

    it('handles pinned tabs correctly', async () => {
      chrome.tabs.query.mockResolvedValue([
        { id: 1, title: 'Pinned', url: 'https://a.com', pinned: true, groupId: -1 },
      ]);
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result[0].pinned).toBe(true);
    });

    it('handles discarded tabs', async () => {
      chrome.tabs.query.mockResolvedValue([
        { id: 1, title: 'Discarded', discarded: true, groupId: -1 },
      ]);
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result[0].discarded).toBe(true);
    });

    it('handles tabs without URLs', async () => {
      chrome.tabs.query.mockResolvedValue([
        { id: 1, title: 'No URL', groupId: -1 },
      ]);
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result[0].url).toBe('');
    });

    it('handles empty results', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toEqual([]);
    });
  });

  describe('getCurrentWindowTabs', () => {
    it('returns tabs for current window', async () => {
      chrome.tabs.query.mockResolvedValue([
        { id: 1, windowId: 1 },
        { id: 2, windowId: 1 },
      ]);

      const result = await tabService.getCurrentWindowTabs();

      expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
      expect(result).toHaveLength(2);
    });

    it('handles query error', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      await expect(tabService.getCurrentWindowTabs()).rejects.toThrow('Query failed');
    });
  });
});
```

### Test Suite: Close Operations

```typescript
describe('tabService - Close Operations', () => {
  describe('closeTab', () => {
    it('removes single tab', async () => {
      chrome.tabs.remove.mockResolvedValue(undefined);

      await tabService.closeTab(1);

      expect(chrome.tabs.remove).toHaveBeenCalledWith(1);
    });

    it('handles close error', async () => {
      chrome.tabs.remove.mockRejectedValue(new Error('Tab not found'));

      await expect(tabService.closeTab(999)).rejects.toThrow();
    });
  });

  describe('closeTabs', () => {
    it('removes multiple tabs', async () => {
      chrome.tabs.remove.mockResolvedValue(undefined);

      await tabService.closeTabs([1, 2, 3]);

      expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('handles partial failure gracefully', async () => {
      chrome.tabs.remove.mockRejectedValue(new Error('Some tabs not found'));

      await expect(tabService.closeTabs([1, 999])).rejects.toThrow();
    });
  });
});
```

---

## Part 2: `vaultService.test.ts`

### Missing Coverage Areas

| Lines | Feature | Tests Needed |
|-------|---------|--------------|
| 169, 171 | Quota edge cases | 0 items, 100% full |
| 186-187 | Error path | getBytesInUse failure |
| 543-569 | Compression | LZString compression |
| 595-596 | Checksum | Verification failure |
| 655-656, 690-691 | Migration | Legacy format |
| 714-715, 726-727 | Chunking | Large vault split |
| 749-768 | Decompression | Corrupt data |
| 840, 845 | Sync toggle | Mode switching |
| 852-853 | Storage error | Quota exceeded |
| 921-929 | Chunk load | Multi-chunk assembly |
| 940-951 | Chunk migration | Old format upgrade |
| 963-969, 976-977 | Validation | Checksum mismatch |
| 989-990 | Fallback | Local storage |

### Test Suite: Compression

```typescript
describe('vaultService - Compression', () => {
  describe('compressVault', () => {
    it('compresses vault data with LZString', () => {
      const vault = [{ id: 'vault-1', title: 'Test' }];
      
      const result = vaultService.compressVault(vault);
      
      expect(result.compressed).toBeDefined();
      expect(result.compressed.length).toBeLessThan(JSON.stringify(vault).length);
    });

    it('returns original if compression fails', () => {
      // Mock LZString to throw
      vi.spyOn(LZString, 'compressToUTF16').mockReturnValue(null);
      
      const vault = [{ id: 'vault-1' }];
      const result = vaultService.compressVault(vault);
      
      expect(result.fallback).toBe(true);
    });

    it('calculates correct compression ratio', () => {
      const vault = Array.from({ length: 100 }, (_, i) => ({
        id: `vault-${i}`,
        title: `Item ${i}`,
      }));
      
      const result = vaultService.compressVault(vault);
      
      expect(result.ratio).toBeLessThan(1);
    });
  });

  describe('decompressVault', () => {
    it('decompresses vault data', () => {
      const original = [{ id: 'vault-1', title: 'Test' }];
      const compressed = LZString.compressToUTF16(JSON.stringify(original));
      
      const result = vaultService.decompressVault(compressed);
      
      expect(result).toEqual(original);
    });

    it('handles corrupt compressed data', () => {
      const corruptData = 'corrupted!!!###';
      
      expect(() => vaultService.decompressVault(corruptData)).toThrow();
    });

    it('validates checksum', () => {
      const data = { vault: [], checksum: 'invalid' };
      const compressed = LZString.compressToUTF16(JSON.stringify(data));
      
      expect(() => vaultService.decompressVault(compressed)).toThrow('checksum');
    });
  });
});
```

### Test Suite: Chunked Storage

```typescript
describe('vaultService - Chunked Storage', () => {
  describe('saveChunkedVault', () => {
    it('splits large vault into chunks', async () => {
      const largeVault = Array.from({ length: 500 }, (_, i) => ({
        id: `vault-${i}`,
        title: `Item ${i}`.repeat(50),
        url: `https://example.com/${i}`,
      }));

      await vaultService.saveChunkedVault(largeVault, true);

      // Should have called storage.set multiple times with chunk keys
      expect(chrome.storage.sync.set).toHaveBeenCalledTimes(expect.any(Number));
    });

    it('stores chunk metadata', async () => {
      await vaultService.saveChunkedVault([{ id: 'v1' }], true);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'vault_meta': expect.any(Object),
        })
      );
    });

    it('clears old chunks before saving new', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        vault_meta: { chunks: ['vault_0', 'vault_1'] },
      });

      await vaultService.saveChunkedVault([], true);

      expect(chrome.storage.sync.remove).toHaveBeenCalledWith(['vault_0', 'vault_1']);
    });
  });

  describe('loadChunkedVault', () => {
    it('assembles chunks in correct order', async () => {
      const chunk1 = JSON.stringify([{ id: 'v1' }]);
      const chunk2 = JSON.stringify([{ id: 'v2' }]);
      
      chrome.storage.sync.get
        .mockResolvedValueOnce({ vault_meta: { chunks: ['vault_0', 'vault_1'], checksum: '...' } })
        .mockResolvedValueOnce({ vault_0: chunk1, vault_1: chunk2 });

      const result = await vaultService.loadChunkedVault();

      expect(result).toHaveLength(2);
    });

    it('handles missing chunks', async () => {
      chrome.storage.sync.get
        .mockResolvedValueOnce({ vault_meta: { chunks: ['vault_0', 'vault_1'] } })
        .mockResolvedValueOnce({ vault_0: '[]' }); // vault_1 missing

      await expect(vaultService.loadChunkedVault()).rejects.toThrow();
    });

    it('migrates old format', async () => {
      const oldFormat = [{ id: 'v1', title: 'Old' }];
      chrome.storage.sync.get.mockResolvedValue({
        vault: JSON.stringify(oldFormat),
      });

      const result = await vaultService.loadChunkedVault();

      expect(result).toEqual(oldFormat);
    });
  });
});
```

### Test Suite: Sync Mode Toggle

```typescript
describe('vaultService - Sync Mode', () => {
  describe('toggleSyncMode', () => {
    it('enables sync mode', async () => {
      const vault = [{ id: 'vault-1' }];
      
      const result = await vaultService.toggleSyncMode(vault, true);

      expect(result.success).toBe(true);
      expect(chrome.storage.sync.set).toHaveBeenCalled();
    });

    it('disables sync mode and migrates to local', async () => {
      const vault = [{ id: 'vault-1' }];
      
      const result = await vaultService.toggleSyncMode(vault, false);

      expect(result.success).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(chrome.storage.sync.remove).toHaveBeenCalled();
    });

    it('handles quota exceeded during enable', async () => {
      chrome.storage.sync.set.mockRejectedValue(new Error('QUOTA_BYTES_EXCEEDED'));
      
      const vault = [{ id: 'vault-1' }];
      const result = await vaultService.toggleSyncMode(vault, true);

      expect(result.success).toBe(false);
      expect(result.fallbackToLocal).toBe(true);
    });
  });

  describe('disableVaultSync', () => {
    it('migrates data to local storage', async () => {
      const vault = [{ id: 'vault-1' }];
      
      await vaultService.disableVaultSync(vault);

      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(chrome.storage.sync.remove).toHaveBeenCalled();
    });

    it('returns error on migration failure', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('Local failed'));
      
      const result = await vaultService.disableVaultSync([{ id: 'v1' }]);

      expect(result.success).toBe(false);
    });
  });
});
```

### Test Suite: Checksum Validation

```typescript
describe('vaultService - Checksum', () => {
  describe('calculateChecksum', () => {
    it('produces consistent hash', () => {
      const data = [{ id: 'v1' }];
      
      const hash1 = vaultService.calculateChecksum(data);
      const hash2 = vaultService.calculateChecksum(data);

      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different data', () => {
      const data1 = [{ id: 'v1' }];
      const data2 = [{ id: 'v2' }];
      
      const hash1 = vaultService.calculateChecksum(data1);
      const hash2 = vaultService.calculateChecksum(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validateChecksum', () => {
    it('returns true for valid checksum', () => {
      const data = [{ id: 'v1' }];
      const checksum = vaultService.calculateChecksum(data);

      expect(vaultService.validateChecksum(data, checksum)).toBe(true);
    });

    it('returns false for invalid checksum', () => {
      const data = [{ id: 'v1' }];

      expect(vaultService.validateChecksum(data, 'invalid')).toBe(false);
    });

    it('returns false for modified data', () => {
      const data = [{ id: 'v1' }];
      const checksum = vaultService.calculateChecksum(data);
      const modified = [{ id: 'v2' }];

      expect(vaultService.validateChecksum(modified, checksum)).toBe(false);
    });
  });
});
```

---

## Part 3: `quotaService.test.ts`

### Missing Coverage Areas

| Lines | Feature | Tests Needed |
|-------|---------|--------------|
| 33-40 | Edge cases | Zero usage, 100% usage |
| 169, 171 | Error path | getBytesInUse failure |
| 186-187 | Logging | Debug output |

### Test Suite: Quota Calculation

```typescript
describe('quotaService - Quota Calculation', () => {
  describe('getVaultQuota', () => {
    it('returns quota info for sync storage', async () => {
      chrome.storage.sync.getBytesInUse.mockResolvedValue(5000);
      
      const result = await quotaService.getVaultQuota();

      expect(result.used).toBe(5000);
      expect(result.total).toBe(102400); // SYNC_QUOTA_BYTES
      expect(result.available).toBe(97400);
      expect(result.percentage).toBeCloseTo(0.049, 2);
    });

    it('returns quota info for local storage', async () => {
      // When sync is disabled
      
      const result = await quotaService.getVaultQuota(false);

      expect(result.total).toBeGreaterThan(102400); // Local has more
    });

    it('handles zero usage', async () => {
      chrome.storage.sync.getBytesInUse.mockResolvedValue(0);
      
      const result = await quotaService.getVaultQuota();

      expect(result.percentage).toBe(0);
      expect(result.warningLevel).toBe('none');
    });

    it('detects warning level at 80%', async () => {
      chrome.storage.sync.getBytesInUse.mockResolvedValue(81920); // 80%
      
      const result = await quotaService.getVaultQuota();

      expect(result.warningLevel).toBe('warning');
    });

    it('detects critical level at 95%', async () => {
      chrome.storage.sync.getBytesInUse.mockResolvedValue(97280); // 95%
      
      const result = await quotaService.getVaultQuota();

      expect(result.warningLevel).toBe('critical');
    });

    it('handles getBytesInUse error', async () => {
      chrome.storage.sync.getBytesInUse.mockRejectedValue(new Error('Failed'));
      
      await expect(quotaService.getVaultQuota()).rejects.toThrow();
    });
  });

  describe('logQuotaDetails', () => {
    it('logs quota information', async () => {
      const loggerSpy = vi.spyOn(logger, 'debug');
      chrome.storage.sync.getBytesInUse.mockResolvedValue(5000);

      await quotaService.logQuotaDetails();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('quota'),
        expect.any(Object)
      );
    });
  });

  describe('orphaned chunks', () => {
    it('detects orphaned chunks', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        vault_0: '...',
        vault_1: '...',
        vault_old_0: '...', // orphaned
      });
      chrome.storage.sync.getBytesInUse.mockResolvedValue(1000);

      const result = await quotaService.getVaultQuota();

      expect(result.orphanedChunks).toBeGreaterThan(0);
    });
  });
});
```

---

## Verification Commands

```bash
# Run service tests
npx vitest run src/services/__tests__

# Coverage for services
npx vitest run --coverage src/services

# Specific files
npx vitest run src/services/__tests__/tabService.test.ts
npx vitest run src/services/__tests__/vaultService.test.ts
npx vitest run src/services/__tests__/quotaService.test.ts
```

---

## Success Criteria

- [ ] `tabService.ts` coverage >= 90%
- [ ] `vaultService.ts` coverage >= 90%
- [ ] `quotaService.ts` coverage >= 95%
- [ ] All retry logic paths tested
- [ ] Compression/decompression tested
- [ ] Checksum validation tested
- [ ] Chunked storage tested
- [ ] Sync mode toggle tested
- [ ] Error handling paths covered
