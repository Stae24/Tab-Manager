import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LZString from 'lz-string';

const VAULT_META_KEY = 'vault_meta';
const VAULT_CHUNK_PREFIX = 'vault_chunk_';
const LEGACY_VAULT_KEY = 'vault';

const mockSyncStorage: Record<string, unknown> = {};
const mockLocalStorage: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: vi.fn(async (keys: string[] | null) => {
        if (keys === null) return { ...mockSyncStorage };
        const result: Record<string, unknown> = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => {
          if (mockSyncStorage[k] !== undefined) result[k] = mockSyncStorage[k];
        });
        return result;
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(mockSyncStorage, data);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => delete mockSyncStorage[k]);
      }),
      getBytesInUse: vi.fn(async (keys: string[] | null) => {
        if (keys === null) {
          return JSON.stringify(mockSyncStorage).length;
        }
        let total = 0;
        keys.forEach(k => {
          if (mockSyncStorage[k] !== undefined) {
            total += JSON.stringify(mockSyncStorage[k]).length + k.length;
          }
        });
        return total;
      }),
    },
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        keys.forEach(k => {
          if (mockLocalStorage[k] !== undefined) result[k] = mockLocalStorage[k];
        });
        return result;
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(mockLocalStorage, data);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => delete mockLocalStorage[k]);
      }),
      getBytesInUse: vi.fn(async () => JSON.stringify(mockLocalStorage).length),
    },
  },
});

import {
  saveVault,
  loadVault,
  getVaultQuota,
  toggleSyncMode,
  migrateFromLegacy,
  getStorageStats,
} from '../vaultStorage';
import type { VaultItem } from '../../types/index';

const clearMockStorage = () => {
  Object.keys(mockSyncStorage).forEach(k => delete mockSyncStorage[k]);
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
};

beforeEach(() => {
  vi.clearAllMocks();
  clearMockStorage();
});

const createMockVaultItem = (id: number, title: string): VaultItem => ({
  id: `vault-tab-${id}-${Date.now()}`,
  title,
  url: `https://example${id}.com`,
  favicon: '',
  active: false,
  discarded: false,
  windowId: 1,
  index: id,
  groupId: -1,
  muted: false,
  pinned: false,
  audible: false,
  savedAt: Date.now(),
  originalId: id,
} as VaultItem);

describe('vaultStorage - saveVault', () => {
  it('saves to local storage when sync is disabled', async () => {
    const vault = [createMockVaultItem(1, 'Tab 1')];
    
    const result = await saveVault(vault, { syncEnabled: false });
    
    expect(result.success).toBe(true);
    expect(mockLocalStorage[LEGACY_VAULT_KEY]).toEqual(vault);
    expect(mockLocalStorage['vault_backup']).toEqual(vault);
  });

  it('saves compressed chunks to sync storage when enabled', async () => {
    const vault = [createMockVaultItem(1, 'Tab 1'), createMockVaultItem(2, 'Tab 2')];
    
    const result = await saveVault(vault, { syncEnabled: true });
    
    expect(result.success).toBe(true);
    expect(mockSyncStorage[VAULT_META_KEY]).toBeDefined();
    
    const meta = mockSyncStorage[VAULT_META_KEY] as any;
    expect(meta.version).toBe(2);
    expect(meta.chunkCount).toBeGreaterThan(0);
    expect(meta.checksum).toBeDefined();
    expect(meta.compressed).toBe(true);
  });

  it('creates backup in local storage even when sync is enabled', async () => {
    const vault = [createMockVaultItem(1, 'Tab 1')];
    
    await saveVault(vault, { syncEnabled: true });
    
    expect(mockLocalStorage['vault_backup']).toEqual(vault);
  });
});

describe('vaultStorage - loadVault', () => {
  it('loads from local storage when sync is disabled', async () => {
    const vault = [createMockVaultItem(1, 'Test Tab')];
    mockLocalStorage[LEGACY_VAULT_KEY] = vault;
    
    const { vault: loaded } = await loadVault({ syncEnabled: false });
    
    expect(loaded).toEqual(vault);
  });

  it('loads and decompresses from sync storage when enabled', async () => {
    const vault = [createMockVaultItem(1, 'Synced Tab'), createMockVaultItem(2, 'Another Tab')];
    
    await saveVault(vault, { syncEnabled: true });
    
    const { vault: loaded } = await loadVault({ syncEnabled: true });
    
    expect(loaded).toHaveLength(2);
    expect(loaded[0].title).toBe('Synced Tab');
    expect(loaded[1].title).toBe('Another Tab');
  });

  it('returns empty array when no data exists', async () => {
    const { vault: loaded } = await loadVault({ syncEnabled: true });
    
    expect(loaded).toEqual([]);
  });

  it('falls back to backup when sync data is corrupted', async () => {
    const backup = [createMockVaultItem(1, 'Backup Tab')];
    mockLocalStorage['vault_backup'] = backup;
    
    mockSyncStorage[VAULT_META_KEY] = {
      version: 2,
      chunkCount: 1,
      checksum: 'invalid',
      timestamp: Date.now(),
      compressed: true,
    };
    mockSyncStorage[`${VAULT_CHUNK_PREFIX}0`] = 'corrupted_data';
    
    const { vault: loaded } = await loadVault({ syncEnabled: true });
    
    expect(loaded).toEqual(backup);
  });
});

describe('vaultStorage - getVaultQuota', () => {
  it('returns quota info with correct structure', async () => {
    const quota = await getVaultQuota();
    
    expect(quota).toHaveProperty('used');
    expect(quota).toHaveProperty('available');
    expect(quota).toHaveProperty('total');
    expect(quota).toHaveProperty('percentage');
    expect(quota).toHaveProperty('warningLevel');
    expect(quota).toHaveProperty('orphanedChunks');
    expect(typeof quota.used).toBe('number');
    expect(typeof quota.percentage).toBe('number');
  });

  it('returns "none" warning level when usage is low', async () => {
    const quota = await getVaultQuota();
    
    expect(quota.warningLevel).toBe('none');
  });
});

describe('vaultStorage - toggleSyncMode', () => {
  it('moves data from local to sync when enabling', async () => {
    const vault = [createMockVaultItem(1, 'Local Tab')];
    
    const result = await toggleSyncMode(vault, true);
    
    expect(result.success).toBe(true);
    expect(mockSyncStorage[VAULT_META_KEY]).toBeDefined();
  });

  it('moves data from sync to local when disabling', async () => {
    const vault = [createMockVaultItem(1, 'Synced Tab')];
    await saveVault(vault, { syncEnabled: true });
    
    const result = await toggleSyncMode(vault, false);
    
    expect(result.success).toBe(true);
    expect(mockLocalStorage[LEGACY_VAULT_KEY]).toEqual(vault);
    expect(mockSyncStorage[VAULT_META_KEY]).toBeUndefined();
  });
});

describe('vaultStorage - migrateFromLegacy', () => {
  it('returns no migration needed when already on v2', async () => {
    mockSyncStorage[VAULT_META_KEY] = { version: 2 };
    
    const result = await migrateFromLegacy({ syncEnabled: true });
    
    expect(result.migrated).toBe(false);
    expect(result.from).toBe('none');
  });

  it('migrates sync legacy vault to new format', async () => {
    const legacyVault = [createMockVaultItem(1, 'Legacy Tab')];
    mockSyncStorage[LEGACY_VAULT_KEY] = legacyVault;
    
    const result = await migrateFromLegacy({ syncEnabled: true });
    
    expect(result.migrated).toBe(true);
    expect(result.itemCount).toBe(1);
    expect(result.from).toBe('sync_legacy');
    expect(mockSyncStorage[LEGACY_VAULT_KEY]).toBeUndefined();
    expect(mockSyncStorage[VAULT_META_KEY]).toBeDefined();
  });

  it('migrates local legacy vault when sync disabled', async () => {
    const legacyVault = [createMockVaultItem(1, 'Local Legacy')];
    mockLocalStorage[LEGACY_VAULT_KEY] = legacyVault;
    
    const result = await migrateFromLegacy({ syncEnabled: false });
    
    expect(result.migrated).toBe(false);
    expect(result.from).toBe('local_legacy');
  });
});

describe('vaultStorage - getStorageStats', () => {
  it('returns storage statistics', async () => {
    const vault = [createMockVaultItem(1, 'Test')];
    mockLocalStorage[LEGACY_VAULT_KEY] = vault;
    
    const stats = await getStorageStats();
    
    expect(stats).toHaveProperty('syncUsed');
    expect(stats).toHaveProperty('syncTotal');
    expect(stats).toHaveProperty('localUsed');
    expect(stats).toHaveProperty('vaultItemCount');
    expect(stats.vaultItemCount).toBe(1);
  });
});

describe('vaultStorage - compression', () => {
  it('compresses data significantly for larger vaults', async () => {
    const largeVault: VaultItem[] = [];
    for (let i = 0; i < 20; i++) {
      largeVault.push(createMockVaultItem(i, `Tab with a longer title ${i} to ensure compression works well`));
    }
    
    const jsonSize = JSON.stringify(largeVault).length;
    
    await saveVault(largeVault, { syncEnabled: true });
    
    const meta = mockSyncStorage[VAULT_META_KEY] as any;
    let compressedSize = 0;
    for (let i = 0; i < meta.chunkCount; i++) {
      compressedSize += (mockSyncStorage[`${VAULT_CHUNK_PREFIX}${i}`] as string).length * 2;
    }
    
    expect(compressedSize).toBeLessThan(jsonSize);
  });

  it('round-trips data correctly through compression', async () => {
    const vault = [
      createMockVaultItem(1, 'Special chars: 日本語 émojis 🎉'),
      createMockVaultItem(2, 'Long URL with params'),
    ];
    (vault[1] as any).url = 'https://example.com/path?query=value&foo=bar#anchor';
    
    await saveVault(vault, { syncEnabled: true });
    const { vault: loaded } = await loadVault({ syncEnabled: true });
    
    expect(loaded[0].title).toBe('Special chars: 日本語 émojis 🎉');
    expect((loaded[1] as any).url).toBe('https://example.com/path?query=value&foo=bar#anchor');
  });
});

describe('vaultStorage - chunking', () => {
  it('creates at least one chunk for any vault', async () => {
    const vault: VaultItem[] = [];
    for (let i = 0; i < 50; i++) {
      vault.push(createMockVaultItem(i, `Tab ${i} with enough content to require chunking`));
    }
    
    await saveVault(vault, { syncEnabled: true });
    
    const meta = mockSyncStorage[VAULT_META_KEY] as any;
    expect(meta.chunkCount).toBeGreaterThanOrEqual(1);
    
    for (let i = 0; i < meta.chunkCount; i++) {
      expect(mockSyncStorage[`${VAULT_CHUNK_PREFIX}${i}`]).toBeDefined();
    }
  });

  it('reassembles chunks correctly on load', async () => {
    const largeVault: VaultItem[] = [];
    for (let i = 0; i < 50; i++) {
      largeVault.push(createMockVaultItem(i, `Chunked Tab ${i}`));
    }
    
    await saveVault(largeVault, { syncEnabled: true });
    const { vault: loaded } = await loadVault({ syncEnabled: true });
    
    expect(loaded).toHaveLength(50);
    expect(loaded[0].title).toBe('Chunked Tab 0');
    expect(loaded[49].title).toBe('Chunked Tab 49');
  });
});

describe('vaultStorage - quota fallback', () => {
  let originalChrome: typeof chrome;
  
  beforeEach(() => {
    originalChrome = globalThis.chrome;
  });
  
  afterEach(() => {
    globalThis.chrome = originalChrome;
    vi.restoreAllMocks();
  });
  
  it('falls back to local storage when sync write fails with quota error', async () => {
    const vault = [createMockVaultItem(1, 'Test Tab')];

    const mockSyncStorageLocal: Record<string, unknown> = {};
    const mockLocalStorageLocal: Record<string, unknown> = {};

    globalThis.chrome = {
      storage: {
        sync: {
          get: vi.fn(async (keys: string[] | null) => {
            if (keys === null) return { ...mockSyncStorageLocal };
            const result: Record<string, unknown> = {};
            (Array.isArray(keys) ? keys : [keys]).forEach(k => {
              if (mockSyncStorageLocal[k] !== undefined) result[k] = mockSyncStorageLocal[k];
            });
            return result;
          }) as unknown as chrome.storage.StorageArea['get'],
          set: vi.fn(async (data: Record<string, unknown>) => {
            throw new Error('QUOTA_BYTES quota exceeded');
          }) as unknown as chrome.storage.StorageArea['set'],
          remove: vi.fn(async () => {}) as unknown as chrome.storage.StorageArea['remove'],
          getBytesInUse: vi.fn(async (keys: string[] | null) => {
            let total = 0;
            if (keys === null) {
              total = JSON.stringify(mockSyncStorageLocal).length;
            } else {
              keys.forEach(k => {
                if (mockSyncStorageLocal[k] !== undefined) {
                  total += JSON.stringify(mockSyncStorageLocal[k]).length + k.length;
                }
              });
            }
            return total;
          }) as unknown as chrome.storage.StorageArea['getBytesInUse'],
        },
        local: {
          get: vi.fn(async () => ({})) as unknown as chrome.storage.StorageArea['get'],
          set: vi.fn(async (data: Record<string, unknown>) => {
            Object.assign(mockLocalStorageLocal, data);
          }) as unknown as chrome.storage.StorageArea['set'],
          remove: vi.fn(async () => {}) as unknown as chrome.storage.StorageArea['remove'],
          getBytesInUse: vi.fn(async () => 0) as unknown as chrome.storage.StorageArea['getBytesInUse'],
        },
      },
    } as typeof chrome;

    const { saveVault: testSaveVault } = await import('../vaultStorage');

    const result = await testSaveVault(vault, { syncEnabled: true });

    expect(result.success).toBe(true);
    expect(result.fallbackToLocal).toBe(true);
    expect(result.warningLevel).toBe('critical');
    expect(mockLocalStorageLocal[LEGACY_VAULT_KEY]).toEqual(vault);
  });
  
  it('falls back to local storage when sync write fails with generic error', async () => {
    const vault = [createMockVaultItem(1, 'Test Tab')];
    
    const mockSyncStorageLocal: Record<string, unknown> = {};
    const mockLocalStorageLocal: Record<string, unknown> = {};
    
    globalThis.chrome = {
      storage: {
        sync: {
          get: vi.fn(async () => mockSyncStorageLocal) as unknown as chrome.storage.StorageArea['get'],
          set: vi.fn(async () => {
            throw new Error('Storage write failed');
          }) as unknown as chrome.storage.StorageArea['set'],
          remove: vi.fn(async () => {}) as unknown as chrome.storage.StorageArea['remove'],
          getBytesInUse: vi.fn(async () => 0) as unknown as chrome.storage.StorageArea['getBytesInUse'],
        },
        local: {
          get: vi.fn(async () => ({})) as unknown as chrome.storage.StorageArea['get'],
          set: vi.fn(async (data: Record<string, unknown>) => {
            Object.assign(mockLocalStorageLocal, data);
          }) as unknown as chrome.storage.StorageArea['set'],
          remove: vi.fn(async () => {}) as unknown as chrome.storage.StorageArea['remove'],
          getBytesInUse: vi.fn(async () => 0) as unknown as chrome.storage.StorageArea['getBytesInUse'],
        },
      },
    } as typeof chrome;
    
    const { saveVault: testSaveVault } = await import('../vaultStorage');
    
    const result = await testSaveVault(vault, { syncEnabled: true });
    
    expect(result.success).toBe(true);
    expect(result.fallbackToLocal).toBe(true);
    expect(mockLocalStorageLocal[LEGACY_VAULT_KEY]).toEqual(vault);
  });
});
