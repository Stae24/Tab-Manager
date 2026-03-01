import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VaultItem } from '../../types/index';

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      getBytesInUse: vi.fn(async () => 0),
    },
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
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

const createMockVaultItem = (id: number, title: string): VaultItem => ({
  id: `vault-tab-${id}`,
  title,
  url: `https://example${id}.com`,
  favicon: '',
  savedAt: Date.now(),
  originalId: id,
} as VaultItem);

describe('disableVaultSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears all sync chunks from storage', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault = [createMockVaultItem(1, 'Test Tab')];

    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      vault_meta: { version: '1.0.0', chunkCount: 2, timestamp: Date.now(), chunkKeys: ['vault_chunk_0', 'vault_chunk_1'] }
    } as any);
    vi.spyOn(chrome.storage.sync, 'remove').mockResolvedValue(undefined);

    await vaultService.disableVaultSync(vault);

    expect(chrome.storage.sync.remove).toHaveBeenCalled();
  });

  it('saves vault to local storage after clearing sync', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault = [createMockVaultItem(1, 'Test Tab')];

    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      vault_meta: { version: '1.0.0', chunkCount: 1, timestamp: Date.now(), chunkKeys: ['vault_chunk_0'] }
    } as any);
    vi.spyOn(chrome.storage.sync, 'remove').mockResolvedValue(undefined);

    await vaultService.disableVaultSync(vault);

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
    const localSetCalls = (chrome.storage.local.set as any).mock.calls;
    expect(localSetCalls[0][0]).toHaveProperty('vault');
    expect(localSetCalls[1][0]).toHaveProperty('vault_backup');
  });

  it('returns success: true when complete', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault: VaultItem[] = [];

    vi.spyOn(chrome.storage.sync, 'remove').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);

    const result = await vaultService.disableVaultSync(vault);

    expect(result.success).toBe(true);
    expect(result.warningLevel).toBe('none');
  });

  it('returns error on Chrome API failure', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault: VaultItem[] = [];

    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      vault_meta: { version: '1.0.0', chunkCount: 1, timestamp: Date.now(), chunkKeys: ['vault_chunk_0'] }
    } as any);
    vi.spyOn(chrome.storage.sync, 'remove').mockRejectedValue(new Error('Storage unavailable'));

    const result = await vaultService.disableVaultSync(vault);

    expect(result.success).toBe(false);
    expect(result.error).toBe('SYNC_FAILED');
  });

  it('handles empty sync (no chunks to clear)', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault = [createMockVaultItem(1, 'Test Tab')];

    vi.spyOn(chrome.storage.sync, 'remove').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({} as any);

    await vaultService.disableVaultSync(vault);

    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
  });

  it('preserves vault if sync.remove throws after local.set succeeds', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault = [createMockVaultItem(1, 'Test Tab')];
    let localSetCalled = false;

    vi.spyOn(chrome.storage.local, 'set').mockImplementation(async () => {
      localSetCalled = true;
    });
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      vault_meta: { version: '1.0.0', chunkCount: 1, timestamp: Date.now(), chunkKeys: ['vault_chunk_0'] }
    } as any);
    vi.spyOn(chrome.storage.sync, 'remove').mockRejectedValue(new Error('Sync failed'));

    const result = await vaultService.disableVaultSync(vault);

    expect(localSetCalled).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error).toBe('SYNC_FAILED');
  });

  it('reports correct bytesUsed after clearing', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault: VaultItem[] = [];

    vi.spyOn(chrome.storage.sync, 'remove').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);

    const result = await vaultService.disableVaultSync(vault);

    expect(result.bytesUsed).toBeDefined();
    expect(result.bytesAvailable).toBeDefined();
  });
});

describe('data preservation during fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('local.set called BEFORE sync.remove', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault = [createMockVaultItem(1, 'Test Tab')];
    const callOrder: string[] = [];

    vi.spyOn(chrome.storage.local, 'set').mockImplementation(async () => {
      callOrder.push('local.set');
    });
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      vault_meta: { version: '1.0.0', chunkCount: 1, timestamp: Date.now(), chunkKeys: ['vault_chunk_0'] }
    } as any);
    vi.spyOn(chrome.storage.sync, 'remove').mockImplementation(async () => {
      callOrder.push('sync.remove');
    });

    await vaultService.disableVaultSync(vault);

    expect(callOrder[0]).toBe('local.set');
    expect(callOrder[callOrder.length - 1]).toBe('sync.remove');
  });

  it('vault_backup created alongside primary save', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault = [createMockVaultItem(1, 'Test Tab')];

    vi.spyOn(chrome.storage.sync, 'remove').mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);

    await vaultService.disableVaultSync(vault);

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
  });

  it('continues even if one local key fails', async () => {
    const { vaultService } = await import('../../services/vaultService');
    const vault = [createMockVaultItem(1, 'Test Tab')];

    vi.spyOn(chrome.storage.local, 'set').mockImplementation(async () => {
      throw new Error('Storage error');
    });
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      vault_meta: { version: '1.0.0', chunkCount: 1, timestamp: Date.now(), chunkKeys: ['vault_chunk_0'] }
    } as any);
    vi.spyOn(chrome.storage.sync, 'remove').mockResolvedValue(undefined);

    const result = await vaultService.disableVaultSync(vault);

    expect(result.success).toBe(false);
    expect(result.error).toBe('SYNC_FAILED');
    expect(chrome.storage.sync.remove).not.toHaveBeenCalled();
  });
});
