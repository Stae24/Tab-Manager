import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tab, Island, VaultItem, AppearanceSettings, VaultQuotaInfo, VaultStorageResult } from '../../../types/index';

vi.mock('../../../services/vaultService', () => ({
  vaultService: {
    loadVault: vi.fn(),
    saveVault: vi.fn(),
    toggleSyncMode: vi.fn(),
    disableVaultSync: vi.fn(),
  }
}));

vi.mock('../../../services/quotaService', () => ({
  quotaService: {
    getVaultQuota: vi.fn(),
  }
}));

vi.mock('../../../services/tabService', () => ({
  tabService: {
    closeTabs: vi.fn(),
    closeTab: vi.fn(),
    createTab: vi.fn(),
    createIsland: vi.fn(),
    getCurrentWindowTabs: vi.fn(),
    getCurrentWindowGroups: vi.fn(),
    getLiveTabsAndGroups: vi.fn(),
  }
}));

vi.mock('../../../services/settingsService', () => ({
  settingsService: {
    saveSettings: vi.fn(),
    loadSettings: vi.fn().mockResolvedValue({ appearanceSettings: null }),
  }
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

import { StateCreator } from 'zustand';
import { create } from 'zustand';
import { vaultService } from '../../../services/vaultService';
import { quotaService } from '../../../services/quotaService';
import { tabService } from '../../../services/tabService';
import { createTabSlice, TabSlice } from '../useTabSlice';
import { createVaultSlice, VaultSlice } from '../useVaultSlice';
import { createUISlice, UISlice } from '../useUISlice';
import { createAppearanceSlice, AppearanceSlice } from '../useAppearanceSlice';
import { createCommandSlice, CommandSlice } from '../useCommandSlice';
import { defaultAppearanceSettings } from '../../utils';

type TestStore = TabSlice & VaultSlice & UISlice & AppearanceSlice & CommandSlice;

const createTestStore = (initialState: Partial<TestStore> = {}) => {
  const slice: StateCreator<TestStore, [], [], TestStore> = (set, get, api) => ({
    ...createTabSlice(set, get, api),
    ...createVaultSlice(set, get, api),
    ...createUISlice(set, get, api),
    ...createAppearanceSlice(set, get, api),
    ...createCommandSlice(set, get, api),
    ...initialState,
  });
  return create<TestStore>()(slice);
};

const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'live-tab-1',
  title: 'Test Tab',
  url: 'https://example.com',
  favicon: 'https://example.com/favicon.ico',
  active: false,
  discarded: false,
  windowId: 1,
  index: 0,
  groupId: -1,
  ...overrides,
});

const createMockIsland = (overrides: Partial<Island> = {}): Island => ({
  id: 'live-group-1',
  title: 'Test Group',
  color: 'blue',
  collapsed: false,
  tabs: [createMockTab({ id: 'live-tab-2', groupId: 1 })],
  ...overrides,
});

const createMockVaultItem = (overrides: Partial<VaultItem> = {}): VaultItem => ({
  ...createMockTab({ id: 'vault-tab-1' }),
  savedAt: Date.now(),
  originalId: 1,
  ...overrides,
});

const createMockQuota = (overrides: Partial<VaultQuotaInfo> = {}): VaultQuotaInfo => ({
  used: 1000,
  available: 50000,
  total: 102400,
  percentage: 0.01,
  warningLevel: 'none',
  ...overrides,
});

describe('useVaultSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('persistVault', () => {
    it('checks quota at 100%', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota({ percentage: 1.0 }));
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(vaultService.disableVaultSync).mockResolvedValue({ success: true });

      await store.getState().persistVault(vault, true);

      expect(vaultService.disableVaultSync).toHaveBeenCalled();
    });

    it('calls vaultService.saveVault', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().persistVault(vault, true);

      expect(vaultService.saveVault).toHaveBeenCalledWith(vault, { syncEnabled: true });
    });

    it('reverts on failure', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      const previousVault: VaultItem[] = [];
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: false, error: 'SYNC_FAILED' });

      await store.getState().persistVault(vault, true, previousVault);

      expect(store.getState().vault).toEqual(previousVault);
    });

    it('sets compression tier', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ 
        success: true, 
        compressionTier: 'no_favicons' 
      });

      await store.getState().persistVault(vault, true);

      expect(store.getState().compressionTier).toBe('no_favicons');
    });

    it('shows compression warning when tier is not full', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ 
        success: true, 
        compressionTier: 'minimal' 
      });

      await store.getState().persistVault(vault, true);

      expect(store.getState().showCompressionWarning).toBe(true);
    });

    it('handles fallbackToLocal', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ 
        success: true, 
        fallbackToLocal: true 
      });
      vi.mocked(vaultService.disableVaultSync).mockResolvedValue({ success: true });

      await store.getState().persistVault(vault, true);

      expect(store.getState().effectiveSyncEnabled).toBe(false);
    });

    it('updates quota after save', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      const mockQuota = createMockQuota();
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(mockQuota);
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().persistVault(vault, true);

      expect(store.getState().vaultQuota).toEqual(mockQuota);
    });

    it('sets quotaExceededPending on QUOTA_EXCEEDED error', async () => {
      const vault: VaultItem[] = [createMockVaultItem()];
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ 
        success: false, 
        error: 'QUOTA_EXCEEDED' 
      });

      await store.getState().persistVault(vault, true);

      expect(store.getState().quotaExceededPending).not.toBeNull();
    });
  });

  describe('refreshVaultQuota', () => {
    it('fetches and sets quota', async () => {
      const mockQuota = createMockQuota();
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(mockQuota);

      await store.getState().refreshVaultQuota();

      expect(store.getState().vaultQuota).toEqual(mockQuota);
    });
  });

  describe('setVaultSyncEnabled', () => {
    it('enables sync successfully', async () => {
      vi.mocked(vaultService.toggleSyncMode).mockResolvedValue({ success: true });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());

      const result = await store.getState().setVaultSyncEnabled(true);

      expect(result.success).toBe(true);
      expect(store.getState().effectiveSyncEnabled).toBe(true);
    });

    it('disables sync successfully', async () => {
      vi.mocked(vaultService.toggleSyncMode).mockResolvedValue({ success: true });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());

      const result = await store.getState().setVaultSyncEnabled(false);

      expect(result.success).toBe(true);
      expect(store.getState().effectiveSyncEnabled).toBe(false);
    });

    it('handles fallbackToLocal', async () => {
      vi.mocked(vaultService.toggleSyncMode).mockResolvedValue({ 
        success: true, 
        fallbackToLocal: true 
      });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());

      const result = await store.getState().setVaultSyncEnabled(true);

      expect(result.fallbackToLocal).toBe(true);
    });

    it('saves settings after toggle', async () => {
      vi.mocked(vaultService.toggleSyncMode).mockResolvedValue({ success: true });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());

      await store.getState().setVaultSyncEnabled(true);

      expect(store.getState().appearanceSettings.vaultSyncEnabled).toBe(true);
    });

    it('refreshes quota after toggle', async () => {
      const mockQuota = createMockQuota();
      vi.mocked(vaultService.toggleSyncMode).mockResolvedValue({ success: true });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(mockQuota);

      await store.getState().setVaultSyncEnabled(true);

      expect(store.getState().vaultQuota).toEqual(mockQuota);
    });
  });

  describe('moveToVault', () => {
    it('returns early when item not found', async () => {
      store = createTestStore({ islands: [] });

      await store.getState().moveToVault('live-tab-999');

      expect(store.getState().vault).toHaveLength(0);
    });

    it('quota check blocks move when not allowed', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota({ available: 0, percentage: 1.0 }));

      await store.getState().moveToVault('live-tab-1');

      expect(store.getState().vault).toHaveLength(0);
    });

    it('removes item from islands', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTab).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-tab-1');

      expect(store.getState().islands).toHaveLength(0);
    });

    it('removes from nested group', async () => {
      const groupTab = createMockTab({ id: 'live-tab-99', groupId: 1 });
      const island = createMockIsland({ id: 'live-group-1', tabs: [groupTab] });
      store = createTestStore({ islands: [island] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTab).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-tab-99');

      const updatedIsland = store.getState().islands[0] as Island;
      expect(updatedIsland.tabs).toHaveLength(0);
    });

    it('generates vault ID with timestamp', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTab).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-tab-1');

      const vaultItem = store.getState().vault[0];
      expect(String(vaultItem.id)).toMatch(/^vault-/);
    });

    it('preserves originalId', async () => {
      const tab = createMockTab({ id: 'live-tab-123' });
      store = createTestStore({ islands: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTab).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-tab-123');

      const vaultItem = store.getState().vault[0];
      expect(vaultItem.originalId).toBe(123);
    });

    it('adds to vault array', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab], vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTab).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-tab-1');

      expect(store.getState().vault).toHaveLength(1);
    });

    it('persists vault after move', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTab).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-tab-1');

      expect(vaultService.saveVault).toHaveBeenCalled();
    });

    it('closes tabs on success for island', async () => {
      const island = createMockIsland({ id: 'live-group-1', tabs: [createMockTab({ id: 'live-tab-1' }), createMockTab({ id: 'live-tab-2' })] });
      store = createTestStore({ islands: [island] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTabs).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-group-1');

      expect(tabService.closeTabs).toHaveBeenCalled();
    });

    it('closes single tab on success', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });
      vi.mocked(tabService.closeTab).mockResolvedValue(undefined);

      await store.getState().moveToVault('live-tab-1');

      expect(tabService.closeTab).toHaveBeenCalledWith(1);
    });

    it('reverts islands on persist failure', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: false, error: 'SYNC_FAILED' });

      await store.getState().moveToVault('live-tab-1');

      expect(store.getState().islands).toHaveLength(1);
    });
  });

  describe('saveToVault', () => {
    it('quota check blocks save when not allowed', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota({ available: 0, percentage: 1.0 }));

      await store.getState().saveToVault(tab);

      expect(store.getState().vault).toHaveLength(0);
    });

    it('transforms item ID', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().saveToVault(tab);

      expect(String(store.getState().vault[0].id)).toMatch(/^vault-/);
    });

    it('preserves originalId', async () => {
      const tab = createMockTab({ id: 'live-tab-123' });
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().saveToVault(tab);

      expect(store.getState().vault[0].originalId).toBe(123);
    });

    it('adds savedAt timestamp', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().saveToVault(tab);

      expect(store.getState().vault[0].savedAt).toBeDefined();
    });

    it('persists new vault', async () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().saveToVault(tab);

      expect(vaultService.saveVault).toHaveBeenCalled();
    });
  });

  describe('restoreFromVault', () => {
    it('returns early when item not found', async () => {
      store = createTestStore({ vault: [] });

      await store.getState().restoreFromVault('vault-tab-999');

      expect(tabService.createTab).not.toHaveBeenCalled();
    });

    it('restores island (multiple tabs)', async () => {
      const vaultIsland: VaultItem = {
        ...createMockIsland({ id: 'vault-group-1', tabs: [createMockTab({ url: 'https://example.com' })] }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ vault: [vaultIsland] });
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([]);
      vi.mocked(tabService.getCurrentWindowGroups).mockResolvedValue([]);
      vi.mocked(tabService.createTab).mockResolvedValue({ id: 1 } as chrome.tabs.Tab);
      vi.mocked(tabService.createIsland).mockResolvedValue(1);

      await store.getState().restoreFromVault('vault-group-1');

      expect(tabService.createTab).toHaveBeenCalled();
    });

    it('restores single tab', async () => {
      const vaultTab: VaultItem = {
        ...createMockTab({ id: 'vault-tab-1', url: 'https://example.com' }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ vault: [vaultTab] });
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([]);
      vi.mocked(tabService.getCurrentWindowGroups).mockResolvedValue([]);
      vi.mocked(tabService.createTab).mockResolvedValue({ id: 1 } as chrome.tabs.Tab);

      await store.getState().restoreFromVault('vault-tab-1');

      expect(tabService.createTab).toHaveBeenCalled();
    });

    it('calculates insertion index with groups', async () => {
      const vaultTab: VaultItem = {
        ...createMockTab({ id: 'vault-tab-1', url: 'https://example.com' }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ vault: [vaultTab] });
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([
        { id: 1, index: 0, groupId: 1 } as chrome.tabs.Tab,
      ]);
      vi.mocked(tabService.getCurrentWindowGroups).mockResolvedValue([
        { id: 1 } as chrome.tabGroups.TabGroup,
      ]);
      vi.mocked(tabService.createTab).mockResolvedValue({ id: 2 } as chrome.tabs.Tab);

      await store.getState().restoreFromVault('vault-tab-1');

      expect(tabService.createTab).toHaveBeenCalledWith(expect.objectContaining({ index: expect.any(Number) }));
    });

    it('preserves group color/title when restoring island', async () => {
      const vaultIsland: VaultItem = {
        ...createMockIsland({ 
          id: 'vault-group-1', 
          title: 'My Group',
          color: 'red',
          tabs: [createMockTab({ url: 'https://example.com' })] 
        }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ vault: [vaultIsland] });
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([]);
      vi.mocked(tabService.getCurrentWindowGroups).mockResolvedValue([]);
      vi.mocked(tabService.createTab).mockResolvedValue({ id: 1 } as chrome.tabs.Tab);
      vi.mocked(tabService.createIsland).mockResolvedValue(1);

      await store.getState().restoreFromVault('vault-group-1');

      expect(tabService.createIsland).toHaveBeenCalledWith(
        expect.any(Array),
        'My Group',
        'red'
      );
    });
  });

  describe('createVaultGroup', () => {
    it('creates empty group', async () => {
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().createVaultGroup();

      const vaultItem = store.getState().vault[0];
      expect('tabs' in vaultItem && vaultItem.tabs).toEqual([]);
    });

    it('generates unique ID', async () => {
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().createVaultGroup();

      const vaultItem = store.getState().vault[0];
      expect(String(vaultItem.id)).toMatch(/^vault-group-new-/);
    });

    it('sets default properties', async () => {
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().createVaultGroup();

      const vaultItem = store.getState().vault[0] as Island;
      expect(vaultItem.title).toBe('');
      expect(vaultItem.color).toBe('grey');
    });

    it('persists vault', async () => {
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().createVaultGroup();

      expect(vaultService.saveVault).toHaveBeenCalled();
    });
  });

  describe('reorderVault', () => {
    it('sets vault state', async () => {
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      const newVault: VaultItem[] = [createMockVaultItem({ id: 'vault-tab-1' })];
      await store.getState().reorderVault(newVault);

      expect(store.getState().vault).toEqual(newVault);
    });

    it('persists new order', async () => {
      store = createTestStore({ vault: [] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      const newVault: VaultItem[] = [createMockVaultItem({ id: 'vault-tab-1' })];
      await store.getState().reorderVault(newVault);

      expect(vaultService.saveVault).toHaveBeenCalled();
    });
  });

  describe('toggleVaultGroupCollapse', () => {
    it('ignores non-vault IDs', async () => {
      const island = createMockIsland({ id: 'live-group-1' });
      store = createTestStore({ vault: [{ ...island, savedAt: Date.now(), originalId: 1 }] });

      await store.getState().toggleVaultGroupCollapse('live-group-1');

      const vaultItem = store.getState().vault[0];
      expect('collapsed' in vaultItem ? vaultItem.collapsed : 'not-an-island').toBe(false);
    });

    it('toggles collapsed state', async () => {
      const vaultIsland: VaultItem = {
        ...createMockIsland({ id: 'vault-group-1', collapsed: false }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ vault: [vaultIsland] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().toggleVaultGroupCollapse('vault-group-1');

      const vaultItem = store.getState().vault[0];
      expect('collapsed' in vaultItem && vaultItem.collapsed).toBe(true);
    });

    it('persists when not updating', async () => {
      const vaultIsland: VaultItem = {
        ...createMockIsland({ id: 'vault-group-1' }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ vault: [vaultIsland], isUpdating: false });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().toggleVaultGroupCollapse('vault-group-1');

      expect(vaultService.saveVault).toHaveBeenCalled();
    });

    it('skips persist when updating', async () => {
      const vaultIsland: VaultItem = {
        ...createMockIsland({ id: 'vault-group-1' }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ vault: [vaultIsland], isUpdating: true });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().toggleVaultGroupCollapse('vault-group-1');

      expect(vaultService.saveVault).not.toHaveBeenCalled();
    });
  });

  describe('sortVaultGroupsToTop', () => {
    it('categorizes items', async () => {
      const pinnedTab: VaultItem = { ...createMockTab({ id: 'vault-tab-1', pinned: true }), savedAt: Date.now(), originalId: 1 };
      const looseTab: VaultItem = { ...createMockTab({ id: 'vault-tab-2', pinned: false }), savedAt: Date.now(), originalId: 2 };
      const group: VaultItem = { ...createMockIsland({ id: 'vault-group-3' }), savedAt: Date.now(), originalId: 3 };
      store = createTestStore({ vault: [looseTab, group, pinnedTab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().sortVaultGroupsToTop();

      expect(vaultService.saveVault).toHaveBeenCalled();
    });

    it('sorts groups by count when enabled', async () => {
      const smallGroup: VaultItem = { 
        ...createMockIsland({ id: 'vault-group-1', tabs: [createMockTab()] }), 
        savedAt: Date.now(), 
        originalId: 1 
      };
      const largeGroup: VaultItem = { 
        ...createMockIsland({ id: 'vault-group-2', tabs: [createMockTab(), createMockTab()] }), 
        savedAt: Date.now(), 
        originalId: 2 
      };
      store = createTestStore({ 
        vault: [smallGroup, largeGroup],
        appearanceSettings: { ...defaultAppearanceSettings, sortVaultGroupsByCount: true },
      });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().sortVaultGroupsToTop();

      expect(vaultService.saveVault).toHaveBeenCalled();
    });

    it('skips if already sorted', async () => {
      const tab: VaultItem = { ...createMockTab(), savedAt: Date.now(), originalId: 1 };
      store = createTestStore({ vault: [tab] });

      await store.getState().sortVaultGroupsToTop();

      expect(vaultService.saveVault).not.toHaveBeenCalled();
    });

    it('calls reorderVault when needs sorting', async () => {
      const pinnedTab: VaultItem = { ...createMockTab({ id: 'vault-tab-1', pinned: true }), savedAt: Date.now(), originalId: 1 };
      const looseTab: VaultItem = { ...createMockTab({ id: 'vault-tab-2', pinned: false }), savedAt: Date.now(), originalId: 2 };
      store = createTestStore({ vault: [looseTab, pinnedTab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().sortVaultGroupsToTop();

      expect(vaultService.saveVault).toHaveBeenCalled();
    });
  });

  describe('deleteVaultDuplicates', () => {
    it('finds duplicates in groups', async () => {
      const group1: VaultItem = { 
        ...createMockIsland({ id: 'vault-group-1', tabs: [createMockTab({ id: 't1', url: 'https://example.com' })] }), 
        savedAt: Date.now(), 
        originalId: 1 
      };
      const group2: VaultItem = { 
        ...createMockIsland({ id: 'vault-group-2', tabs: [createMockTab({ id: 't2', url: 'https://example.com' })] }), 
        savedAt: Date.now(), 
        originalId: 2 
      };
      store = createTestStore({ vault: [group1, group2] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().deleteVaultDuplicates();

      expect(store.getState().vault).toHaveLength(1);
    });

    it('finds duplicates in loose items', async () => {
      const tab1: VaultItem = { ...createMockTab({ id: 'vault-tab-1', url: 'https://example.com' }), savedAt: Date.now(), originalId: 1 };
      const tab2: VaultItem = { ...createMockTab({ id: 'vault-tab-2', url: 'https://example.com' }), savedAt: Date.now(), originalId: 2 };
      store = createTestStore({ vault: [tab1, tab2] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().deleteVaultDuplicates();

      expect(store.getState().vault).toHaveLength(1);
    });

    it('normalizes URLs', async () => {
      const tab1: VaultItem = { ...createMockTab({ id: 'vault-tab-1', url: 'https://Example.com/' }), savedAt: Date.now(), originalId: 1 };
      const tab2: VaultItem = { ...createMockTab({ id: 'vault-tab-2', url: 'https://example.com' }), savedAt: Date.now(), originalId: 2 };
      store = createTestStore({ vault: [tab1, tab2] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().deleteVaultDuplicates();

      expect(store.getState().vault).toHaveLength(1);
    });

    it('keeps first occurrence', async () => {
      const tab1: VaultItem = { ...createMockTab({ id: 'vault-tab-1', url: 'https://example.com' }), savedAt: Date.now(), originalId: 1 };
      const tab2: VaultItem = { ...createMockTab({ id: 'vault-tab-2', url: 'https://example.com' }), savedAt: Date.now(), originalId: 2 };
      store = createTestStore({ vault: [tab1, tab2] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().deleteVaultDuplicates();

      expect(String(store.getState().vault[0].id)).toBe('vault-tab-1');
    });

    it('handles no duplicates', async () => {
      const tab1: VaultItem = { ...createMockTab({ url: 'https://example.com' }), savedAt: Date.now(), originalId: 1 };
      const tab2: VaultItem = { ...createMockTab({ url: 'https://other.com' }), savedAt: Date.now(), originalId: 2 };
      store = createTestStore({ vault: [tab1, tab2] });

      await store.getState().deleteVaultDuplicates();

      expect(store.getState().vault).toHaveLength(2);
    });

    it('persists cleaned vault', async () => {
      const tab1: VaultItem = { ...createMockTab({ id: 'vault-tab-1', url: 'https://example.com' }), savedAt: Date.now(), originalId: 1 };
      const tab2: VaultItem = { ...createMockTab({ id: 'vault-tab-2', url: 'https://example.com' }), savedAt: Date.now(), originalId: 2 };
      store = createTestStore({ vault: [tab1, tab2] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().deleteVaultDuplicates();

      expect(vaultService.saveVault).toHaveBeenCalled();
    });
  });

  describe('removeFromVault', () => {
    it('removes item by ID', async () => {
      const tab: VaultItem = { ...createMockTab({ id: 'vault-tab-1' }), savedAt: Date.now(), originalId: 1 };
      store = createTestStore({ vault: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().removeFromVault('vault-tab-1');

      expect(store.getState().vault).toHaveLength(0);
    });

    it('persists after removal', async () => {
      const tab: VaultItem = { ...createMockTab({ id: 'vault-tab-1' }), savedAt: Date.now(), originalId: 1 };
      store = createTestStore({ vault: [tab] });
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue(createMockQuota());
      vi.mocked(vaultService.saveVault).mockResolvedValue({ success: true });

      await store.getState().removeFromVault('vault-tab-1');

      expect(vaultService.saveVault).toHaveBeenCalled();
    });
  });
});
