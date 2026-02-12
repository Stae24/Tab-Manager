import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set up Chrome API mock BEFORE importing anything that might access chrome
const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
    },
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
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

import { vaultService } from '../../services/vaultService';
import { tabService } from '../../services/tabService';
import { quotaService } from '../../services/quotaService';
import { settingsService } from '../../services/settingsService';
import type { Tab, Island } from '../../types/index';

// Use var to allow hoisting and access within vi.mock factory
var capturedWatcher: any;

vi.mock('../../services/vaultService', () => ({
  vaultService: {
    loadVault: vi.fn().mockResolvedValue({ vault: [], timestamp: 0 }),
    saveVault: vi.fn().mockResolvedValue({ success: true, bytesUsed: 0, bytesAvailable: 1000, warningLevel: 'none' }),
    migrateFromLegacy: vi.fn().mockResolvedValue({ migrated: false, itemCount: 0, from: 'none' }),
    toggleSyncMode: vi.fn().mockResolvedValue({ success: true }),
    disableVaultSync: vi.fn().mockResolvedValue({ success: true, bytesUsed: 0, bytesAvailable: 1000, warningLevel: 'none' }),
  }
}));

vi.mock('../../services/tabService', () => ({
  tabService: {
    getLiveTabsAndGroups: vi.fn().mockResolvedValue([]),
    moveIsland: vi.fn().mockResolvedValue(true),
    moveTab: vi.fn().mockResolvedValue(true),
    closeTabs: vi.fn().mockResolvedValue(true),
    closeTab: vi.fn().mockResolvedValue(true),
    updateTabGroup: vi.fn().mockResolvedValue(true),
    updateTabGroupCollapse: vi.fn().mockResolvedValue(true),
    consolidateAndGroupTabs: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('../../services/quotaService', () => ({
  quotaService: {
    getVaultQuota: vi.fn().mockResolvedValue({ used: 0, total: 100000, percentage: 0, available: 90000, warningLevel: 'none', orphanedChunks: 0 }),
    logQuotaDetails: vi.fn().mockResolvedValue({ used: 0, total: 100000, percentage: 0, available: 90000, warningLevel: 'none', orphanedChunks: 0 }),
  }
}));

vi.mock('../../services/settingsService', () => ({
  settingsService: {
    loadSettings: vi.fn().mockResolvedValue({
      appearanceSettings: {
        vaultSyncEnabled: true,
        sortGroupsByCount: false,
        sortVaultGroupsByCount: false,
      },
      showVault: true,
      dividerPosition: 50,
      settingsPanelWidth: 300
    }),
    watchSettings: vi.fn((cb) => {
      capturedWatcher = cb;
    }),
    saveSettings: vi.fn(),
  }
}));

import { useStore } from '../useStore';

// Mock requestAnimationFrame
const mockRAF = vi.fn((cb: FrameRequestCallback) => {
});

describe('Race Conditions & Concurrency', () => {

  beforeEach(async () => {
    // Override requestAnimationFrame for each test
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      value: mockRAF,
      writable: true,
      configurable: true,
    });
    
    useStore.setState({
      islands: [],
      vault: [],
      isUpdating: false,
      isRefreshing: false,
      pendingRefresh: false,
      lastVaultTimestamp: 0,
      appearanceSettings: {
        vaultSyncEnabled: true,
        sortGroupsByCount: false,
        sortVaultGroupsByCount: false,
      } as any,
    });

    if (!capturedWatcher) {
      for(let i=0; i<10; i++) {
        await new Promise(r => setTimeout(r, 10));
        if (capturedWatcher) break;
      }
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('moveItemOptimistically', () => {
    it('only processes the latest move request within a single animation frame', () => {
      const tabA: Tab = { id: 'live-tab-1', title: 'A' } as any;
      const tabB: Tab = { id: 'live-tab-2', title: 'B' } as any;
      const tabC: Tab = { id: 'live-tab-3', title: 'C' } as any;
      
      useStore.setState({ islands: [tabA, tabB, tabC] });

      const store = useStore.getState();
      
      store.moveItemOptimistically('live-tab-3', 'live-gap-0'); 
      store.moveItemOptimistically('live-tab-2', 'live-gap-0'); 

      expect(mockRAF).toHaveBeenCalledTimes(1);

      const rafCallback = mockRAF.mock.calls[0][0];
      rafCallback(0);

      const { islands } = useStore.getState();
      expect(islands[0].id).toBe('live-tab-2');
      expect(islands[1].id).toBe('live-tab-1');
      expect(islands[2].id).toBe('live-tab-3');
    });
  });

  describe('syncLiveTabs', () => {
    it('prevents concurrent sync operations using isRefreshing lock', async () => {
      let resolveSync: (val: any) => void = () => {};
      const syncPromise = new Promise((resolve) => {
        resolveSync = resolve;
      }) as Promise<Island[]>;

      vi.mocked(tabService.getLiveTabsAndGroups).mockReturnValue(syncPromise);

      const store = useStore.getState();
      
      const firstSync = store.syncLiveTabs();
      expect(useStore.getState().isRefreshing).toBe(true);

      await store.syncLiveTabs();

      expect(tabService.getLiveTabsAndGroups).toHaveBeenCalledTimes(1);

      resolveSync([]);
      await firstSync;

      expect(useStore.getState().isRefreshing).toBe(false);
    });

    it('ignores sync requests if isUpdating lock is active', async () => {
      useStore.setState({ isUpdating: true });
      
      await useStore.getState().syncLiveTabs();
      
      expect(tabService.getLiveTabsAndGroups).not.toHaveBeenCalled();
      expect(useStore.getState().isRefreshing).toBe(false);
    });
  });

  describe('Storage Watcher & isUpdating lock', () => {
    it('ignores incoming storage changes while the store is locally updating', async () => {
      expect(capturedWatcher).toBeDefined();

      useStore.setState({ 
        isUpdating: true, 
        lastVaultTimestamp: 100,
        appearanceSettings: { vaultSyncEnabled: true } as any
      });

      await capturedWatcher({
        vault_meta: {
          newValue: { timestamp: 200 }
        }
      }, 'sync');

      expect(vaultService.loadVault).not.toHaveBeenCalled();
    });

    it('reloads vault when incoming timestamp is newer and NOT updating', async () => {
      expect(capturedWatcher).toBeDefined();

      const reloadedVault = [{ id: 'vault-new', title: 'New' }] as any;
      vi.mocked(vaultService.loadVault).mockResolvedValue({ vault: reloadedVault, timestamp: 200 });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue({ used: 0, total: 100000, percentage: 0, available: 90000, warningLevel: 'none', orphanedChunks: 0 });

      useStore.setState({ 
        isUpdating: false, 
        lastVaultTimestamp: 100,
        appearanceSettings: { vaultSyncEnabled: true } as any
      });

      await capturedWatcher({
        vault_meta: {
          newValue: { timestamp: 200 }
        }
      }, 'sync');

      expect(vaultService.loadVault).toHaveBeenCalled();
      expect(useStore.getState().vault).toEqual(reloadedVault);
      expect(useStore.getState().lastVaultTimestamp).toBe(200);
    });
  });

  describe('Concurrent Vault Operations', () => {
    it('processes vault operations sequentially to avoid race conditions', async () => {
      const { quotaService } = await import('../../services/quotaService');
      vi.spyOn(quotaService, 'getVaultQuota').mockResolvedValue({ used: 0, total: 100000, percentage: 0, available: 90000, warningLevel: 'none', orphanedChunks: 0 });
      
      const tab1: Tab = { id: 'live-tab-1', title: 'T1' } as any;
      const tab2: Tab = { id: 'live-tab-2', title: 'T2' } as any;
      
      useStore.setState({ islands: [tab1, tab2] });

      await useStore.getState().moveToVault('live-tab-1');
      await useStore.getState().moveToVault('live-tab-2');

      const { islands, vault } = useStore.getState();
      expect(islands).toHaveLength(0);
      expect(vault).toHaveLength(2);
      expect(vaultService.saveVault).toHaveBeenCalledTimes(2);
      
      expect(vault[0].id).not.toBe(vault[1].id);
      
      vi.spyOn(quotaService, 'getVaultQuota').mockRestore();
    });

    it('correctly updates lastVaultTimestamp after async save', async () => {
      vi.mocked(vaultService.saveVault).mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 50));
        return { success: true, bytesUsed: 10, bytesAvailable: 90, warningLevel: 'none' };
      });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue({ used: 10, total: 100000, percentage: 0.1, available: 90000, warningLevel: 'none', orphanedChunks: 0 });

      const store = useStore.getState();
      const initialTimestamp = store.lastVaultTimestamp;

      const savePromise = store.persistVault([], true);
      
      expect(store.lastVaultTimestamp).toBe(initialTimestamp);

      await savePromise;

      expect(useStore.getState().lastVaultTimestamp).toBeGreaterThan(initialTimestamp);
    });
  });

  describe('isUpdating semaphore blocking', () => {
    it('prevents sortGroupsToTop from running if already updating', async () => {
      useStore.setState({ isUpdating: true });
      
      await useStore.getState().sortGroupsToTop();
      
      expect(tabService.moveIsland).not.toHaveBeenCalled();
      expect(tabService.moveTab).not.toHaveBeenCalled();
    });
  });
});
