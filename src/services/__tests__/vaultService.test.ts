import { describe, it, expect, vi, beforeEach } from 'vitest';
import LZString from 'lz-string';

const syncStore: Record<string, any> = {};
const localStore: Record<string, any> = {};

const mockStorageSyncGet = vi.fn().mockImplementation((keys) => {
    const result: Record<string, any> = {};
    if (typeof keys === 'string') {
        result[keys] = syncStore[keys];
    } else if (Array.isArray(keys)) {
        keys.forEach(k => {
            if (syncStore[k] !== undefined) result[k] = syncStore[k];
        });
    } else {
        Object.assign(result, syncStore);
    }
    return Promise.resolve(result);
});
const mockStorageSyncSet = vi.fn().mockImplementation((data) => {
    Object.assign(syncStore, data);
    return Promise.resolve();
});
const mockStorageSyncRemove = vi.fn().mockImplementation((keys) => {
    if (typeof keys === 'string') delete syncStore[keys];
    else if (Array.isArray(keys)) keys.forEach(k => delete syncStore[k]);
    return Promise.resolve();
});
const mockStorageSyncGetBytesInUse = vi.fn().mockResolvedValue(0);

const mockStorageLocalGet = vi.fn().mockImplementation((keys) => {
    const result: Record<string, any> = {};
    if (typeof keys === 'string') {
        result[keys] = localStore[keys];
    } else if (Array.isArray(keys)) {
        keys.forEach(k => {
            if (localStore[k] !== undefined) result[k] = localStore[k];
        });
    } else {
        Object.assign(result, localStore);
    }
    return Promise.resolve(result);
});
const mockStorageLocalSet = vi.fn().mockImplementation((data) => {
    Object.assign(localStore, data);
    return Promise.resolve();
});
const mockStorageLocalRemove = vi.fn().mockImplementation((keys) => {
    if (typeof keys === 'string') delete localStore[keys];
    else if (Array.isArray(keys)) keys.forEach(k => delete localStore[k]);
    return Promise.resolve();
});

vi.stubGlobal('chrome', {
    storage: {
        sync: {
            get: mockStorageSyncGet,
            set: mockStorageSyncSet,
            remove: mockStorageSyncRemove,
            getBytesInUse: mockStorageSyncGetBytesInUse,
        },
        local: {
            get: mockStorageLocalGet,
            set: mockStorageLocalSet,
            remove: mockStorageLocalRemove,
        },
    },
});

vi.mock('../quotaService', () => ({
    quotaService: {
        getVaultQuota: vi.fn().mockResolvedValue({
            used: 0,
            total: 102400,
            available: 102400,
            percentage: 0,
            warningLevel: 'none'
        }),
        cleanupOrphanedChunks: vi.fn().mockResolvedValue(undefined),
    }
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }
}));

// Mock crypto.subtle for checksums
if (!global.crypto) {
    (global as any).crypto = {
        subtle: {
            digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
        }
    };
} else if (!global.crypto.subtle) {
    (global.crypto as any).subtle = {
        digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
    }
}

const createMockVaultItem = (overrides: Partial<any> = {}): any => ({
    id: 'test-id',
    title: 'Test Title',
    url: 'https://example.com',
    favicon: 'https://example.com/favicon.ico',
    active: false,
    discarded: false,
    windowId: 1,
    index: 0,
    groupId: -1,
    savedAt: Date.now(),
    originalId: 'original-id',
    ...overrides
});

describe('vaultService - Core Storage', () => {
    let vaultService: typeof import('../vaultService').vaultService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.resetModules();

        vaultService = (await import('../vaultService')).vaultService;

        // Reset stores without changing reference
        Object.keys(syncStore).forEach(k => delete syncStore[k]);
        Object.keys(localStore).forEach(k => delete localStore[k]);

        // Reset all mocks to default states
        mockStorageSyncGet.mockClear();
        mockStorageSyncSet.mockClear();
        mockStorageSyncRemove.mockClear();
        mockStorageSyncGetBytesInUse.mockReset().mockResolvedValue(0);

        mockStorageLocalGet.mockClear();
        mockStorageLocalSet.mockClear();
        mockStorageLocalRemove.mockClear();

        const quotaService = (await import('../quotaService')).quotaService;
        (quotaService.getVaultQuota as any).mockReset().mockResolvedValue({
            used: 0,
            total: 102400,
            available: 102400,
            percentage: 0,
            warningLevel: 'none'
        });
    });

    describe('loadVault', () => {
        it('loads from local storage when sync is disabled', async () => {
            const mockVault = [createMockVaultItem({ title: 'Local Tab' })];
            localStore['vault'] = mockVault;

            const result = await vaultService.loadVault({ syncEnabled: false });

            expect(result.vault).toEqual(mockVault);
        });

        it('loads from sync storage when sync is enabled', async () => {
            const mockVault = [createMockVaultItem({ title: 'Sync Tab' })];
            const compressed = LZString.compressToUTF16(JSON.stringify(mockVault));

            const mockDigest = new Uint8Array(32).fill(0);
            const expectedHash = Array.from(mockDigest).map(b => b.toString(16).padStart(2, '0')).join('');

            syncStore['vault_meta'] = {
                version: 3,
                chunkCount: 1,
                chunkKeys: ['vault_chunk_0'],
                checksum: expectedHash,
                timestamp: 123456789,
                minified: false
            };
            syncStore['vault_chunk_0'] = compressed;

            vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(mockDigest.buffer);

            const result = await vaultService.loadVault({ syncEnabled: true });

            expect(result.vault).toEqual(mockVault);
            expect(result.timestamp).toBe(123456789);
        });

        it('falls back to local backup if meta is missing', async () => {
            const mockBackup = [createMockVaultItem({ id: 'backup-1' })];
            localStore['vault_backup'] = mockBackup;

            const result = await vaultService.loadVault({ syncEnabled: true });

            expect(result.vault).toEqual(mockBackup);
        });
    });

    describe('saveVault', () => {
        it('saves to local storage when sync is disabled', async () => {
            const vault = [createMockVaultItem()];
            await vaultService.saveVault(vault, { syncEnabled: false });

            expect(localStore['vault']).toEqual(vault);
            expect(localStore['vault_backup']).toEqual(vault);
        });

        it('saves to sync storage when sync is enabled and fits', async () => {
            const vault = [createMockVaultItem()];
            const result = await vaultService.saveVault(vault, { syncEnabled: true });

            expect(result.success).toBe(true);
            expect(syncStore['vault_meta']).toBeDefined();
            expect(syncStore['vault_chunk_0']).toBeDefined();
        });

        it('handles quota error by falling back to local', async () => {
            const vault = [createMockVaultItem()];
            mockStorageSyncSet.mockRejectedValue(new Error('QUOTA_BYTES_EXCEEDED'));

            const result = await vaultService.saveVault(vault, { syncEnabled: true });

            expect(result.fallbackToLocal).toBe(true);
            expect(localStore['vault_backup']).toEqual(vault);
        });
    });

    describe('recoverVaultSync', () => {
        it('clears chunks and resaves', async () => {
            const vault = [createMockVaultItem()];
            syncStore['vault_meta'] = { chunkKeys: ['vault_chunk_0'] };
            syncStore['vault_chunk_0'] = 'data';

            await vaultService.recoverVaultSync(vault);

            expect(mockStorageSyncRemove).toHaveBeenCalled();
            expect(mockStorageSyncSet).toHaveBeenCalled();
        });
    });
});
