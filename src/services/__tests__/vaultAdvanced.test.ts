import { describe, it, expect, vi, beforeEach } from 'vitest';
import LZString from 'lz-string';
import type { Tab } from '../../types/index';

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
        getVaultQuota: vi.fn(),
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

describe('vaultService - Advanced Logic', () => {
    let vaultService: typeof import('../vaultService').vaultService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.resetModules();

        vaultService = (await import('../vaultService')).vaultService;

        // Reset stores without changing reference
        Object.keys(syncStore).forEach(k => delete syncStore[k]);
        Object.keys(localStore).forEach(k => delete localStore[k]);

        const quotaService = (await import('../quotaService')).quotaService;
        (quotaService.getVaultQuota as any).mockResolvedValue({
            used: 0,
            total: 102400,
            available: 102400,
            percentage: 0,
            warningLevel: 'none'
        });
    });

    describe('Migration', () => {
        const LEGACY_VAULT_KEY = 'vault';
        it('migrates from legacy local storage', async () => {
            const legacyVault = [createMockVaultItem({ title: 'Legacy' })];
            localStore[LEGACY_VAULT_KEY] = legacyVault;

            const result = await vaultService.migrateFromLegacy({ syncEnabled: true });

            expect(result.migrated).toBe(true);
            expect(result.itemCount).toBe(1);
            expect(result.from).toBe('local_legacy');
        });

        it('migrates from legacy sync storage', async () => {
            const legacyVault = [createMockVaultItem({ title: 'Sync Legacy' })];
            syncStore[LEGACY_VAULT_KEY] = legacyVault;

            const result = await vaultService.migrateFromLegacy({ syncEnabled: true });

            expect(result.migrated).toBe(true);
            expect(result.itemCount).toBe(1);
            expect(result.from).toBe('sync_legacy');
        });
    });

    describe('Minification and Domain Deduplication', () => {
        it('minifies and expands vault data correctly', async () => {
            const vault = [
                createMockVaultItem({ id: '1', title: 'T1', url: 'https://a.com' }),
                createMockVaultItem({ id: '2', title: 'T2', url: 'https://b.com' }),
                createMockVaultItem({ id: '3', title: 'T3', url: 'https://a.com/page2' })
            ];

            await vaultService.saveVault(vault, { syncEnabled: true });

            const loaded = await vaultService.loadVault({ syncEnabled: true });
            expect(loaded.vault).toHaveLength(3);
            expect((loaded.vault[0] as Tab).url).toBe('https://a.com');
        });
    });

    describe('Incremental Diffs', () => {
        it('uses diff mode for small changes', async () => {
            const initialVault = Array.from({ length: 10 }, (_, i) => createMockVaultItem({ id: String(i) }));
            const updatedVault = [
                ...initialVault,
                createMockVaultItem({ id: 'added-1', title: 'Added' })
            ];

            await vaultService.saveVault(initialVault, { syncEnabled: true });
            const result = await vaultService.saveVault(updatedVault, { syncEnabled: true });

            expect(result.success).toBe(true);
            expect(syncStore['vault_diff']).toBeDefined();
        });
    });

    describe('Compression Tiers', () => {
        it('falls back to lower compression tiers if vault is too large', async () => {
            const largeVault = Array.from({ length: 15 }, (_, i) => createMockVaultItem({
                id: `v-${i}`,
                favicon: 'data:image/png;base64,' + 'a'.repeat(400)
            }));

            const quotaService = (await import('../quotaService')).quotaService;
            (quotaService.getVaultQuota as any).mockResolvedValue({
                used: 0,
                available: 5000,
                total: 102400,
                warningLevel: 'none'
            });

            const result = await vaultService.saveVault(largeVault, { syncEnabled: true });

            expect(result.success).toBe(true);
            expect(result.fallbackToLocal).toBeFalsy();
        });
    });

    describe('Sync Mode and Management', () => {
        it('toggles sync mode on', async () => {
            const vault = [createMockVaultItem()];
            const result = await vaultService.toggleSyncMode(vault, true);

            expect(result.success).toBe(true);
            expect(syncStore['vault_meta']).toBeDefined();
        });

        it('toggles sync mode off', async () => {
            const vault = [createMockVaultItem()];
            syncStore['vault_meta'] = { chunkKeys: ['v1'] };
            syncStore['v1'] = 'data';

            const result = await vaultService.toggleSyncMode(vault, false);

            expect(result.success).toBe(true);
            expect(localStore['vault']).toEqual(vault);
            expect(syncStore['v1']).toBeUndefined();
        });

        it('handles disableVaultSync failures', async () => {
            const vault = [createMockVaultItem()];
            mockStorageLocalSet.mockRejectedValue(new Error('LOCAL_FAIL'));

            const result = await vaultService.disableVaultSync(vault);

            expect(result.success).toBe(false);
            expect(result.error).toBe('SYNC_FAILED');
        });
    });

    describe('Recovery Failures', () => {
        it("logs failure if recovery doesn't result in sync success", async () => {
            const vault = [createMockVaultItem()];
        // Mock saveVault to return a "success" but with fallbackToLocal (e.g. quota exceeded)
        vi.spyOn(vaultService, 'saveVault').mockResolvedValue({
            success: true,
            fallbackToLocal: true,
            bytesUsed: 100,
            bytesAvailable: 0
        });

        const result = await vaultService.recoverVaultSync(vault);
        expect(result.fallbackToLocal).toBe(true);
    });
});
});
