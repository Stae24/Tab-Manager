import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockStorageSyncGet = vi.fn();
const mockStorageSyncRemove = vi.fn();
const mockStorageSyncGetBytesInUse = vi.fn();
const mockLocalStorageGet = vi.fn();
const mockLocalStorageGetBytesInUse = vi.fn();

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: mockStorageSyncGet,
      remove: mockStorageSyncRemove,
      getBytesInUse: mockStorageSyncGetBytesInUse,
    },
    local: {
      get: mockLocalStorageGet,
      getBytesInUse: mockLocalStorageGetBytesInUse,
    },
  },
});

describe('quotaService', () => {
  let quotaService: typeof import('../quotaService').quotaService;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    quotaService = (await import('../quotaService')).quotaService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getVaultQuota', () => {
    it('returns correct quota info', async () => {
      mockStorageSyncGet.mockResolvedValue({ vault_meta: { chunkKeys: ['vault_chunk_0'] } });
      mockStorageSyncGetBytesInUse.mockResolvedValue(5000);

      const quota = await quotaService.getVaultQuota();

      expect(quota.used).toBe(5000);
      expect(quota).toHaveProperty('available');
      expect(quota).toHaveProperty('total');
      expect(quota).toHaveProperty('percentage');
      expect(quota).toHaveProperty('warningLevel');
    });

    it('returns zero used when no vault chunks', async () => {
      mockStorageSyncGet.mockResolvedValue({});
      mockStorageSyncGetBytesInUse.mockResolvedValue(0);

      const quota = await quotaService.getVaultQuota();

      expect(quota.used).toBe(0);
    });
  });

  describe('getStorageStats', () => {
    it('returns storage statistics', async () => {
      mockStorageSyncGetBytesInUse.mockResolvedValue(10000);
      mockLocalStorageGet.mockResolvedValue({ vault: [] });

      const stats = await quotaService.getStorageStats();

      expect(stats.syncUsed).toBe(10000);
      expect(stats.syncTotal).toBe(102400);
      expect(stats).toHaveProperty('localUsed');
      expect(stats).toHaveProperty('vaultItemCount');
    });
  });

  describe('cleanupOrphanedChunks', () => {
    it('returns 0 when no meta exists', async () => {
      mockStorageSyncGet.mockResolvedValue({});

      const count = await quotaService.cleanupOrphanedChunks();

      expect(count).toBe(0);
    });

    it('removes orphaned chunks', async () => {
      mockStorageSyncGet.mockResolvedValue({
        vault_meta: { chunkKeys: ['vault_chunk_0', 'vault_chunk_1'] },
        vault_chunk_0: 'data',
        vault_chunk_1: 'data',
        vault_chunk_2: 'orphaned',
        vault_chunk_3: 'orphaned',
      });
      mockStorageSyncRemove.mockResolvedValue(undefined);

      const count = await quotaService.cleanupOrphanedChunks();

      expect(mockStorageSyncRemove).toHaveBeenCalledWith(['vault_chunk_2', 'vault_chunk_3']);
      expect(count).toBe(2);
    });

    it('returns 0 when no orphaned chunks', async () => {
      mockStorageSyncGet.mockResolvedValue({
        vault_meta: { chunkKeys: ['vault_chunk_0'] },
        vault_chunk_0: 'data',
      });

      const count = await quotaService.cleanupOrphanedChunks();

      expect(mockStorageSyncRemove).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });
  });

  describe('getStorageHealth', () => {
    it('returns healthy when usage is low', async () => {
      mockStorageSyncGet.mockResolvedValue({});
      mockStorageSyncGetBytesInUse.mockResolvedValue(10000);

      const health = await quotaService.getStorageHealth();

      expect(health).toBe('healthy');
    });

    it('returns degraded when usage is high', async () => {
      mockStorageSyncGet.mockResolvedValue({});
      mockStorageSyncGetBytesInUse.mockResolvedValue(90000);

      const health = await quotaService.getStorageHealth();

      expect(health).toBe('degraded');
    });

    it('returns critical when usage is very high', async () => {
      mockStorageSyncGet.mockResolvedValue({});
      mockStorageSyncGetBytesInUse.mockResolvedValue(100000);

      const health = await quotaService.getStorageHealth();

      expect(health).toBe('critical');
    });
  });

  describe('getStorageReport', () => {
    it('returns comprehensive report', async () => {
      mockStorageSyncGetBytesInUse.mockResolvedValue(10000);
      mockStorageSyncGet.mockResolvedValue({
        vault_meta: { timestamp: 1234567890, chunkKeys: [] },
      });
      mockLocalStorageGet.mockResolvedValue({ vault: [{ id: 'test' }] });
      mockLocalStorageGetBytesInUse.mockResolvedValue(5000);

      const report = await quotaService.getStorageReport();

      expect(report.health).toBe('healthy');
      expect(report.syncUsed).toBe(10000);
      expect(report.vaultItemCount).toBe(1);
      expect(report.lastSyncTime).toBe(1234567890);
    });

    it('handles missing vault_meta', async () => {
      mockStorageSyncGetBytesInUse.mockResolvedValue(10000);
      mockStorageSyncGet.mockResolvedValue({});
      mockLocalStorageGet.mockResolvedValue({});
      mockLocalStorageGetBytesInUse.mockResolvedValue(0);

      const report = await quotaService.getStorageReport();

      expect(report.health).toBe('healthy');
      expect(report.lastSyncTime).toBe(null);
      expect(report.vaultItemCount).toBe(0);
    });
  });

  describe('getVaultQuota edge cases', () => {
    it('handles sync storage errors gracefully', async () => {
      mockStorageSyncGet.mockRejectedValue(new Error('Storage error'));
      mockStorageSyncGetBytesInUse.mockResolvedValue(0);

      await expect(quotaService.getVaultQuota()).rejects.toThrow('Storage error');
    });

    it('correctly calculates 0% percentage', async () => {
      mockStorageSyncGet.mockResolvedValue({ vault_meta: { chunkKeys: ['vault_chunk_0'] } });
      mockStorageSyncGetBytesInUse.mockResolvedValue(0);

      const quota = await quotaService.getVaultQuota();

      expect(quota.percentage).toBe(0);
      expect(quota.warningLevel).toBe('none');
    });

    it('correctly calculates percentage near 100%', async () => {
      mockStorageSyncGet.mockResolvedValue({ vault_meta: { chunkKeys: ['vault_chunk_0'] } });
      mockStorageSyncGetBytesInUse.mockResolvedValue(90000);

      const quota = await quotaService.getVaultQuota();

      expect(quota.percentage).toBeGreaterThan(0.8);
      expect(quota.warningLevel).toBe('critical');
    });

    it('handles percentage > 100% when quota exceeded', async () => {
      mockStorageSyncGet.mockResolvedValue({ vault_meta: { chunkKeys: ['vault_chunk_0'] } });
      mockStorageSyncGetBytesInUse.mockImplementation((keys: string | string[] | null) => {
        if (keys === null || (Array.isArray(keys) && keys.includes('vault_chunk_0'))) {
          return Promise.resolve(150000);
        }
        return Promise.resolve(5000);
      });

      const quota = await quotaService.getVaultQuota();

      expect(quota.percentage).toBeGreaterThan(1);
      expect(quota.warningLevel).toBe('critical');
    });
  });

  describe('cleanupOrphanedChunks edge cases', () => {
    it('handles partial chunk deletion failure', async () => {
      mockStorageSyncGet.mockResolvedValue({
        vault_meta: { chunkKeys: ['vault_chunk_0'] },
        vault_chunk_0: 'data',
        vault_chunk_1: 'orphaned',
        vault_chunk_2: 'orphaned',
      });
      mockStorageSyncRemove.mockRejectedValue(new Error('Partial failure'));

      const count = await quotaService.cleanupOrphanedChunks();

      expect(count).toBe(0);
    });
  });

  describe('getStorageHealth edge cases', () => {
    it('returns degraded when local storage has issues', async () => {
      mockStorageSyncGet.mockResolvedValue({});
      mockStorageSyncGetBytesInUse.mockResolvedValue(10000);
      mockLocalStorageGetBytesInUse.mockResolvedValue(5000000);

      const health = await quotaService.getStorageHealth();

      expect(health).toBe('healthy');
    });

    it('handles sync storage errors gracefully', async () => {
      mockStorageSyncGet.mockRejectedValue(new Error('Sync error'));
      mockStorageSyncGetBytesInUse.mockRejectedValue(new Error('Sync error'));

      const health = await quotaService.getStorageHealth();

      expect(health).toBe('degraded');
    });
  });
});
