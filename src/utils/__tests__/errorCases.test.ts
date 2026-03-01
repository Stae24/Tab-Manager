import { describe, it, expect, vi, beforeEach } from 'vitest';
import LZString from 'lz-string';
import { vaultService } from '../../services/vaultService';
import { tabService } from '../../services/tabService';
import { quotaService } from '../../services/quotaService';
import { VAULT_CHUNK_SIZE, STORAGE_VERSION } from '../../constants';
import type { VaultItem } from '../../types/index';

const VAULT_META_KEY = 'vault_meta';
const VAULT_CHUNK_PREFIX = 'vault_chunk_';

const mockSyncStorage: Record<string, unknown> = {};
const mockLocalStorage: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(async (keys: string[] | string | null) => {
        if (keys === null) return { ...mockSyncStorage };
        const result: Record<string, unknown> = {};
        const keyArray = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : [];
        keyArray.forEach(k => {
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
      getBytesInUse: vi.fn(async (keys: string[] | string | null) => {
        if (keys === null) {
          return JSON.stringify(mockSyncStorage).length;
        }
        let total = 0;
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach(k => {
          if (mockSyncStorage[k] !== undefined) {
            total += JSON.stringify(mockSyncStorage[k]).length + String(k).length;
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
    },
  },
  tabs: {
    move: vi.fn(),
    get: vi.fn(),
    query: vi.fn(),
    create: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
    discard: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    duplicate: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
    move: vi.fn(),
    update: vi.fn(),
  },
  windows: {
    getCurrent: vi.fn(),
    getLastFocused: vi.fn(),
    WINDOW_ID_CURRENT: -2,
  },
  runtime: {
    lastError: null,
  },
};

Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
  configurable: true,
});

const clearMockStorage = () => {
  Object.keys(mockSyncStorage).forEach(k => delete mockSyncStorage[k]);
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  clearMockStorage();
  (chrome.runtime as any).lastError = null;
});

const createMockVaultItem = (id: number, title: string): VaultItem => ({
  id: `vault-tab-${id}`,
  title,
  url: `https://example${id}.com`,
  favicon: '',
  savedAt: Date.now(),
  originalId: id,
} as VaultItem);

describe('Error Cases - vaultService.saveVault', () => {
  it('returns QUOTA_EXCEEDED when quota is insufficient', async () => {
    const vault = [createMockVaultItem(1, 'Tab 1')];
    
    vi.spyOn(quotaService, 'getVaultQuota').mockResolvedValue({
      used: 5000,
      available: 10,
      total: 5010,
      percentage: 0.99,
      warningLevel: 'critical'
    });

    const result = await vaultService.saveVault(vault, { syncEnabled: true });
    
    expect(result.success).toBe(true);
    expect(result.fallbackToLocal).toBe(true);
  });

  it('falls back to local storage when chrome.storage.sync.set throws', async () => {
    const vault = [createMockVaultItem(1, 'Tab 1')];
    
    vi.spyOn(chrome.storage.sync, 'set').mockRejectedValue(new Error('Sync failed unexpectedly'));

    const result = await vaultService.saveVault(vault, { syncEnabled: true });
    
    expect(result.success).toBe(true);
    expect(result.fallbackToLocal).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe('Error Cases - tabService', () => {
  it('throws error when chrome.tabs.move fails after retries', async () => {
    const error = new Error('Tab cannot be modified');
    vi.spyOn(chrome.tabs, 'move').mockRejectedValue(error);

    await expect(tabService.moveTab(1, 0)).rejects.toThrow('Tab cannot be modified');
    expect(chrome.tabs.move).toHaveBeenCalledTimes(3);
  });

  it('succeeds after a retryable failure', async () => {
    let callCount = 0;
    vi.spyOn(chrome.tabs, 'move').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Tab is dragging');
      }
      return {} as any;
    });

    const result = await tabService.moveTab(1, 0);
    expect(callCount).toBe(2);
    expect(result).toBeDefined();
  });
});

describe('Error Cases - vaultService.loadVault', () => {
  it('falls back to backup when decompression fails', async () => {
    const backup = [createMockVaultItem(1, 'Backup Tab')];
    mockLocalStorage['vault_backup'] = backup;
    
    mockSyncStorage[VAULT_META_KEY] = {
      version: STORAGE_VERSION,
      chunkCount: 1,
      chunkKeys: [`${VAULT_CHUNK_PREFIX}0`],
      checksum: 'some-checksum',
      timestamp: Date.now(),
      compressed: true,
    };
    mockSyncStorage[`${VAULT_CHUNK_PREFIX}0`] = 'not-compressed-data';

    vi.spyOn(LZString, 'decompressFromUTF16').mockReturnValue(null as unknown as string);

    const result = await vaultService.loadVault({ syncEnabled: true });
    
    expect(result.vault).toEqual(backup);
    expect(LZString.decompressFromUTF16).toHaveBeenCalled();
  });

  it('falls back to backup when checksum mismatches', async () => {
    const backup = [createMockVaultItem(1, 'Backup Tab')];
    mockLocalStorage['vault_backup'] = backup;
    
    const vault = [createMockVaultItem(2, 'Original Tab')];
    const jsonData = JSON.stringify(vault);
    const compressed = LZString.compressToUTF16(jsonData);

    mockSyncStorage[VAULT_META_KEY] = {
      version: STORAGE_VERSION,
      chunkCount: 1,
      chunkKeys: [`${VAULT_CHUNK_PREFIX}0`],
      checksum: 'wrong-checksum',
      timestamp: Date.now(),
      compressed: true,
    };
    mockSyncStorage[`${VAULT_CHUNK_PREFIX}0`] = compressed;

    const result = await vaultService.loadVault({ syncEnabled: true });
    
    expect(result.vault).toEqual(backup);
  });

  it('falls back to backup when a chunk is missing', async () => {
    const backup = [createMockVaultItem(1, 'Backup Tab')];
    mockLocalStorage['vault_backup'] = backup;
    
    mockSyncStorage[VAULT_META_KEY] = {
      version: STORAGE_VERSION,
      chunkCount: 2,
      chunkKeys: [`${VAULT_CHUNK_PREFIX}0`, `${VAULT_CHUNK_PREFIX}1`],
      checksum: 'some-checksum',
      timestamp: Date.now(),
      compressed: true,
    };
    mockSyncStorage[`${VAULT_CHUNK_PREFIX}0`] = 'chunk0';

    const result = await vaultService.loadVault({ syncEnabled: true });
    
    expect(result.vault).toEqual(backup);
  });
});
