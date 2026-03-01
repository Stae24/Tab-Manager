import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tab, Island, LiveItem, VaultItem, AppearanceSettings, VaultQuotaInfo, VaultStorageResult, CompressionTier, QuotaWarningLevel } from '../../../types/index';
import type { StoreState } from '../../types';

vi.mock('../../../services/tabService', () => ({
  tabService: {
    getLiveTabsAndGroups: vi.fn(),
    getCurrentWindowTabs: vi.fn(),
    getCurrentWindowGroups: vi.fn(),
    moveTab: vi.fn(),
    moveIsland: vi.fn(),
    updateTabGroup: vi.fn(),
    updateTabGroupCollapse: vi.fn(),
    closeTabs: vi.fn(),
    closeTab: vi.fn(),
    consolidateAndGroupTabs: vi.fn(),
  }
}));

vi.mock('../../../utils/browser', () => ({
  initBrowserCapabilities: vi.fn(),
  getBrowserCapabilities: vi.fn(),
  getCachedCapabilities: vi.fn(),
  resetCapabilitiesCache: vi.fn(),
  needsCompanionTabForSingleTabGroup: vi.fn(),
  detectBrowser: vi.fn(),
}));

vi.mock('../../../services/vaultService', () => ({
  vaultService: {
    saveVault: vi.fn(),
    loadVault: vi.fn(),
    toggleSyncMode: vi.fn(),
    disableVaultSync: vi.fn(),
  }
}));

vi.mock('../../../services/quotaService', () => ({
  quotaService: {
    getVaultQuota: vi.fn(),
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
import { tabService } from '../../../services/tabService';
import { initBrowserCapabilities } from '../../../utils/browser';
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

describe('useTabSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    store = createTestStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('syncLiveTabs', () => {
    it('returns early when isUpdating is true', async () => {
      store = createTestStore({ isUpdating: true });
      await store.getState().syncLiveTabs();
      expect(tabService.getLiveTabsAndGroups).not.toHaveBeenCalled();
    });

    it('returns early when hasPendingOperations', async () => {
      store = createTestStore();
      store.getState().addPendingOperation(1);
      await store.getState().syncLiveTabs();
      expect(tabService.getLiveTabsAndGroups).not.toHaveBeenCalled();
    });

    it('handles concurrent calls gracefully', async () => {
      const mockTabs: LiveItem[] = [createMockTab()];
      vi.mocked(tabService.getLiveTabsAndGroups).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockTabs), 50))
      );

      const promise1 = store.getState().syncLiveTabs();
      const promise2 = store.getState().syncLiveTabs();

      await Promise.all([promise1, promise2]);

      expect(tabService.getLiveTabsAndGroups).toHaveBeenCalledTimes(1);
    });

    it('sets isRefreshing lock during sync', async () => {
      const mockTabs: LiveItem[] = [createMockTab()];
      let isRefreshingDuringCall = false;
      
      vi.mocked(tabService.getLiveTabsAndGroups).mockImplementation(async () => {
        isRefreshingDuringCall = store.getState().isRefreshing;
        return mockTabs;
      });

      await store.getState().syncLiveTabs();

      expect(isRefreshingDuringCall).toBe(true);
      expect(store.getState().isRefreshing).toBe(false);
    });

    it('handles service errors gracefully', async () => {
      const error = new Error('Service error');
      vi.mocked(tabService.getLiveTabsAndGroups).mockRejectedValue(error);

      await store.getState().syncLiveTabs();

      expect(store.getState().isRefreshing).toBe(false);
    });

    it('populates islands with normalized data', async () => {
      const mockTabs: LiveItem[] = [
        createMockTab({ id: 'live-tab-1' }),
        createMockIsland({ id: 'live-group-2' }),
      ];
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue(mockTabs);

      await store.getState().syncLiveTabs();

      expect(store.getState().islands).toEqual(mockTabs);
    });
  });

  describe('renameGroup', () => {
    it('renames vault group (optimistic update)', async () => {
      const vaultItem: VaultItem = {
        id: 'vault-group-1',
        title: 'Test Group',
        color: 'blue',
        collapsed: false,
        tabs: [],
        savedAt: Date.now(),
        originalId: 1,
      };
      const persistVault = vi.fn().mockResolvedValue({ success: true });
      store = createTestStore({ 
        vault: [vaultItem],
        appearanceSettings: { ...defaultAppearanceSettings },
        persistVault,
      });

      await store.getState().renameGroup('vault-group-1', 'New Title');

      expect(store.getState().vault[0].title).toBe('New Title');
      expect(persistVault).toHaveBeenCalled();
    });

    it('renames live group via Chrome API', async () => {
      vi.mocked(tabService.updateTabGroup).mockResolvedValue(true);
      store = createTestStore();

      await store.getState().renameGroup('live-group-123', 'New Title');

      expect(tabService.updateTabGroup).toHaveBeenCalledWith(123, { title: 'New Title' });
    });

    it('handles missing numeric ID', async () => {
      store = createTestStore();

      await store.getState().renameGroup('invalid-id', 'New Title');

      expect(tabService.updateTabGroup).not.toHaveBeenCalled();
    });

    it('persists vault changes when not updating', async () => {
      const vaultItem: VaultItem = {
        id: 'vault-group-1',
        title: 'Test Group',
        color: 'blue',
        collapsed: false,
        tabs: [],
        savedAt: Date.now(),
        originalId: 1,
      };
      const persistVault = vi.fn().mockResolvedValue({ success: true });
      store = createTestStore({ 
        vault: [vaultItem],
        isUpdating: false,
        appearanceSettings: { ...defaultAppearanceSettings },
        persistVault,
      });

      await store.getState().renameGroup('vault-group-1', 'New Title');

      expect(persistVault).toHaveBeenCalled();
    });

    it('skips persist when isUpdating is true', async () => {
      const vaultItem: VaultItem = {
        id: 'vault-group-1',
        title: 'Test Group',
        color: 'blue',
        collapsed: false,
        tabs: [],
        savedAt: Date.now(),
        originalId: 1,
      };
      const persistVault = vi.fn().mockResolvedValue({ success: true });
      store = createTestStore({ 
        vault: [vaultItem],
        isUpdating: true,
        appearanceSettings: { ...defaultAppearanceSettings },
        persistVault,
      });

      await store.getState().renameGroup('vault-group-1', 'New Title');

      expect(persistVault).not.toHaveBeenCalled();
    });
  });

  describe('toggleLiveGroupCollapse', () => {
    it('returns early for vault items', async () => {
      store = createTestStore();

      await store.getState().toggleLiveGroupCollapse('vault-group-1');

      expect(tabService.updateTabGroupCollapse).not.toHaveBeenCalled();
    });

    it('returns early when numeric ID is null', async () => {
      store = createTestStore();

      await store.getState().toggleLiveGroupCollapse('invalid-id');

      expect(tabService.updateTabGroupCollapse).not.toHaveBeenCalled();
    });

    it('returns early when supportsGroupCollapse is false', async () => {
      store = createTestStore({ 
        supportsGroupCollapse: false,
        islands: [createMockIsland({ id: 'live-group-1' })],
      });

      await store.getState().toggleLiveGroupCollapse('live-group-1');

      expect(tabService.updateTabGroupCollapse).not.toHaveBeenCalled();
    });

    it('optimistically updates collapsed state', async () => {
      const island = createMockIsland({ id: 'live-group-1', collapsed: false });
      store = createTestStore({ 
        supportsGroupCollapse: true,
        islands: [island],
      });
      vi.mocked(tabService.updateTabGroupCollapse).mockResolvedValue(true);

      await store.getState().toggleLiveGroupCollapse('live-group-1');

      const updatedIsland = store.getState().islands[0] as Island;
      expect(updatedIsland.collapsed).toBe(true);
    });

    it('reverts on API failure', async () => {
      const island = createMockIsland({ id: 'live-group-1', collapsed: false });
      store = createTestStore({ 
        supportsGroupCollapse: true,
        islands: [island],
      });
      vi.mocked(tabService.updateTabGroupCollapse).mockResolvedValue(false);

      await store.getState().toggleLiveGroupCollapse('live-group-1');

      const revertedIsland = store.getState().islands[0] as Island;
      expect(revertedIsland.collapsed).toBe(false);
    });

    it('finds correct island by ID', async () => {
      const island1 = createMockIsland({ id: 'live-group-1', collapsed: false });
      const island2 = createMockIsland({ id: 'live-group-2', collapsed: false });
      store = createTestStore({ 
        supportsGroupCollapse: true,
        islands: [island1, island2],
      });
      vi.mocked(tabService.updateTabGroupCollapse).mockResolvedValue(true);

      await store.getState().toggleLiveGroupCollapse('live-group-2');

      const updatedIslands = store.getState().islands;
      expect((updatedIslands[0] as Island).collapsed).toBe(false);
      expect((updatedIslands[1] as Island).collapsed).toBe(true);
    });
  });

  describe('initBrowserCapabilities', () => {
    it('skips if already initialized', async () => {
      store = createTestStore({ supportsGroupCollapse: true });

      await store.getState().initBrowserCapabilities();

      expect(initBrowserCapabilities).not.toHaveBeenCalled();
    });

    it('sets supportsGroupCollapse to true', async () => {
      vi.mocked(initBrowserCapabilities).mockResolvedValue(true);
      store = createTestStore({ supportsGroupCollapse: null });

      await store.getState().initBrowserCapabilities();

      expect(store.getState().supportsGroupCollapse).toBe(true);
    });

    it('sets supportsGroupCollapse to false on error', async () => {
      vi.mocked(initBrowserCapabilities).mockRejectedValue(new Error('Failed'));
      store = createTestStore({ supportsGroupCollapse: null });

      await store.getState().initBrowserCapabilities();

      expect(store.getState().supportsGroupCollapse).toBe(false);
    });
  });

  describe('moveItemOptimistically', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const advanceTime = (ms: number) => {
      vi.advanceTimersByTime(ms);
    };

    it('cross-panel blocking: move live item to vault dropzone', () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab], vault: [] });

      store.getState().moveItemOptimistically('live-tab-1', 'vault-dropzone');
      advanceTime(150);

      expect(store.getState().islands).toHaveLength(1);
      expect(store.getState().vault).toHaveLength(0);
    });

    it('cross-panel blocking: move vault item to live dropzone', () => {
      const vaultItem: VaultItem = {
        ...createMockTab({ id: 'vault-tab-1' }),
        savedAt: Date.now(),
        originalId: 1,
      };
      store = createTestStore({ islands: [], vault: [vaultItem] });

      store.getState().moveItemOptimistically('vault-tab-1', 'live-panel-dropzone');
      advanceTime(150);

      expect(store.getState().vault).toHaveLength(1);
      expect(store.getState().islands).toHaveLength(0);
    });

    it('same ID check: move item onto itself', () => {
      const tab = createMockTab({ id: 'live-tab-1' });
      store = createTestStore({ islands: [tab] });

      store.getState().moveItemOptimistically('live-tab-1', 'live-tab-1');
      advanceTime(150);

      expect(store.getState().islands[0]).toEqual(tab);
    });

    it('gap targeting: move to live-gap-2', () => {
      const tab1 = createMockTab({ id: 'live-tab-1', index: 0 });
      const tab2 = createMockTab({ id: 'live-tab-2', index: 1 });
      const tab3 = createMockTab({ id: 'live-tab-3', index: 2 });
      store = createTestStore({ islands: [tab1, tab2, tab3] });

      store.getState().moveItemOptimistically('live-tab-1', 'live-gap-2');
      advanceTime(150);

      const islands = store.getState().islands;
      expect(islands).toHaveLength(3);
    });

    it('bottom targeting: move to live-bottom', () => {
      const tab1 = createMockTab({ id: 'live-tab-1', index: 0 });
      const tab2 = createMockTab({ id: 'live-tab-2', index: 1 });
      store = createTestStore({ islands: [tab1, tab2] });

      store.getState().moveItemOptimistically('live-tab-1', 'live-bottom');
      advanceTime(150);

      const islands = store.getState().islands;
      expect(islands).toHaveLength(2);
    });

    it('reorder within root: move tab from index 0 to later position', () => {
      const tab1 = createMockTab({ id: 'live-tab-1', index: 0 });
      const tab2 = createMockTab({ id: 'live-tab-2', index: 1 });
      const tab3 = createMockTab({ id: 'live-tab-3', index: 2 });
      const tab4 = createMockTab({ id: 'live-tab-4', index: 3 });
      store = createTestStore({ islands: [tab1, tab2, tab3, tab4] });

      store.getState().moveItemOptimistically('live-tab-1', 'live-gap-3');
      advanceTime(150);

      const islands = store.getState().islands;
      expect(islands).toHaveLength(4);
    });

    it('move into collapsed group places tab at root index', () => {
      const tab1 = createMockTab({ id: 'live-tab-1', index: 0 });
      const island = createMockIsland({ id: 'live-group-2', collapsed: true, tabs: [] });
      store = createTestStore({ islands: [tab1, island] });

      store.getState().moveItemOptimistically('live-tab-1', 'live-group-2');
      advanceTime(150);

      const islands = store.getState().islands;
      expect(islands).toHaveLength(2);
    });

    it('move into expanded group adds to group tabs', () => {
      const tab1 = createMockTab({ id: 'live-tab-1', index: 0 });
      const existingTab = createMockTab({ id: 'live-tab-99', groupId: 2 });
      const island = createMockIsland({ id: 'live-group-2', collapsed: false, tabs: [existingTab] });
      store = createTestStore({ islands: [tab1, island] });

      store.getState().moveItemOptimistically('live-tab-1', 'live-tab-99');
      advanceTime(150);

      const islands = store.getState().islands;
      const updatedIsland = islands.find(i => String(i.id) === 'live-group-2') as Island;
      expect(updatedIsland?.tabs).toHaveLength(2);
    });

    it('move out of group: move tab from group to root', () => {
      const groupTab = createMockTab({ id: 'live-tab-99', groupId: 1 });
      const island = createMockIsland({ id: 'live-group-1', tabs: [groupTab] });
      const otherTab = createMockTab({ id: 'live-tab-2', index: 1 });
      store = createTestStore({ islands: [island, otherTab] });

      store.getState().moveItemOptimistically('live-tab-99', 'live-gap-2');
      advanceTime(150);

      const islands = store.getState().islands;
      const updatedIsland = islands[0] as Island;
      expect(updatedIsland.tabs).toHaveLength(0);
    });

    it('group reordering: move island changes position', () => {
      const tab1 = createMockTab({ id: 'live-tab-1' });
      const island1 = createMockIsland({ id: 'live-group-1' });
      const island2 = createMockIsland({ id: 'live-group-2' });
      const island3 = createMockIsland({ id: 'live-group-3' });
      const tab2 = createMockTab({ id: 'live-tab-2' });
      store = createTestStore({ islands: [tab1, island1, island2, island3, tab2] });

      store.getState().moveItemOptimistically('live-group-1', 'live-gap-4');
      advanceTime(150);

      const islands = store.getState().islands;
      expect(islands).toHaveLength(5);
    });

    it('group cannot nest: move island into another group resets to root', () => {
      const island1 = createMockIsland({ id: 'live-group-1' });
      const island2 = createMockIsland({ id: 'live-group-2', tabs: [createMockTab({ id: 'live-tab-99', groupId: 2 })] });
      store = createTestStore({ islands: [island1, island2] });

      store.getState().moveItemOptimistically('live-group-1', 'live-tab-99');
      advanceTime(150);

      expect(store.getState().islands).toHaveLength(2);
    });

    it('item not found: move non-existent ID', () => {
      store = createTestStore({ islands: [createMockTab({ id: 'live-tab-1' })] });

      store.getState().moveItemOptimistically('live-tab-999', 'live-gap-0');
      advanceTime(150);

      expect(store.getState().islands).toHaveLength(1);
    });
  });

  describe('deleteDuplicateTabs', () => {
    it('finds URL duplicates', async () => {
      const chromeTab1 = { id: 1, url: 'https://example.com', title: 'Tab 1', index: 0, active: false };
      const chromeTab2 = { id: 2, url: 'https://example.com', title: 'Tab 2', index: 1, active: false };
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([chromeTab1, chromeTab2] as chrome.tabs.Tab[]);
      vi.mocked(tabService.closeTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().deleteDuplicateTabs();

      expect(tabService.closeTabs).toHaveBeenCalledWith([2]);
    });

    it('normalizes URLs correctly', async () => {
      const chromeTab1 = { id: 1, url: 'https://Example.com/', title: 'Tab 1', index: 0, active: false };
      const chromeTab2 = { id: 2, url: 'https://example.com', title: 'Tab 2', index: 1, active: false };
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([chromeTab1, chromeTab2] as chrome.tabs.Tab[]);
      vi.mocked(tabService.closeTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().deleteDuplicateTabs();

      expect(tabService.closeTabs).toHaveBeenCalled();
    });

    it('handles malformed URLs', async () => {
      const chromeTab1 = { id: 1, url: 'chrome://extensions', title: 'Extensions', index: 0, active: false };
      const chromeTab2 = { id: 2, url: 'about:blank', title: 'Blank', index: 1, active: false };
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([chromeTab1, chromeTab2] as chrome.tabs.Tab[]);

      await store.getState().deleteDuplicateTabs();

      expect(tabService.closeTabs).not.toHaveBeenCalled();
    });

    it('keeps active tab', async () => {
      const chromeTab1 = { id: 1, url: 'https://example.com', title: 'Tab 1', index: 0, active: false };
      const chromeTab2 = { id: 2, url: 'https://example.com', title: 'Tab 2', index: 1, active: true };
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([chromeTab1, chromeTab2] as chrome.tabs.Tab[]);
      vi.mocked(tabService.closeTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().deleteDuplicateTabs();

      expect(tabService.closeTabs).toHaveBeenCalledWith([1]);
    });

    it('keeps first tab when none active', async () => {
      const chromeTab1 = { id: 1, url: 'https://example.com', title: 'Tab 1', index: 0, active: false };
      const chromeTab2 = { id: 2, url: 'https://example.com', title: 'Tab 2', index: 1, active: false };
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([chromeTab1, chromeTab2] as chrome.tabs.Tab[]);
      vi.mocked(tabService.closeTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().deleteDuplicateTabs();

      expect(tabService.closeTabs).toHaveBeenCalledWith([2]);
    });

    it('syncs after deletion', async () => {
      const chromeTab1 = { id: 1, url: 'https://example.com', title: 'Tab 1', index: 0, active: false };
      const chromeTab2 = { id: 2, url: 'https://example.com', title: 'Tab 2', index: 1, active: false };
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([chromeTab1, chromeTab2] as chrome.tabs.Tab[]);
      vi.mocked(tabService.closeTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().deleteDuplicateTabs();

      expect(tabService.getLiveTabsAndGroups).toHaveBeenCalled();
    });

    it('handles empty result', async () => {
      vi.mocked(tabService.getCurrentWindowTabs).mockResolvedValue([]);

      await store.getState().deleteDuplicateTabs();

      expect(tabService.closeTabs).not.toHaveBeenCalled();
    });
  });

  describe('sortGroupsToTop', () => {
    it('returns early when isUpdating', async () => {
      store = createTestStore({ isUpdating: true });

      await store.getState().sortGroupsToTop();

      expect(tabService.moveTab).not.toHaveBeenCalled();
      expect(tabService.moveIsland).not.toHaveBeenCalled();
    });

    it('separates pinned/groups/loose', async () => {
      const pinnedTab = createMockTab({ id: 'live-tab-1', pinned: true, index: 0 });
      const looseTab = createMockTab({ id: 'live-tab-2', pinned: false, index: 1 });
      const island = createMockIsland({ id: 'live-group-3' });
      store = createTestStore({ islands: [looseTab, island, pinnedTab] });
      vi.mocked(tabService.moveTab).mockResolvedValue({} as chrome.tabs.Tab);
      vi.mocked(tabService.moveIsland).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().sortGroupsToTop();

      expect(tabService.moveTab).toHaveBeenCalled();
    });

    it('sorts groups by count when enabled', async () => {
      const smallIsland = createMockIsland({ id: 'live-group-1', tabs: [createMockTab({ id: 't1' })] });
      const largeIsland = createMockIsland({ id: 'live-group-2', tabs: [createMockTab({ id: 't2' }), createMockTab({ id: 't3' })] });
      store = createTestStore({ 
        islands: [smallIsland, largeIsland],
        appearanceSettings: { ...defaultAppearanceSettings, sortGroupsByCount: true },
      });
      vi.mocked(tabService.moveIsland).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().sortGroupsToTop();

      expect(tabService.moveIsland).toHaveBeenCalled();
    });

    it('preserves order when sort disabled', async () => {
      const island1 = createMockIsland({ id: 'live-group-1', tabs: [createMockTab({ id: 't1' }), createMockTab({ id: 't2' })] });
      const island2 = createMockIsland({ id: 'live-group-2', tabs: [createMockTab({ id: 't3' })] });
      store = createTestStore({ 
        islands: [island1, island2],
        appearanceSettings: { ...defaultAppearanceSettings, sortGroupsByCount: false },
      });

      await store.getState().sortGroupsToTop();

      const islands = store.getState().islands;
      expect(String(islands[0].id)).toBe('live-group-1');
    });

    it('moves islands via service', async () => {
      const island = createMockIsland({ id: 'live-group-1' });
      const tab = createMockTab({ id: 'live-tab-2' });
      store = createTestStore({ islands: [tab, island] });
      vi.mocked(tabService.moveIsland).mockResolvedValue(undefined);
      vi.mocked(tabService.moveTab).mockResolvedValue({} as chrome.tabs.Tab);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().sortGroupsToTop();

      expect(tabService.moveIsland).toHaveBeenCalled();
    });

    it('moves tabs via service', async () => {
      const island = createMockIsland({ id: 'live-group-1' });
      const tab = createMockTab({ id: 'live-tab-2' });
      store = createTestStore({ islands: [tab, island] });
      vi.mocked(tabService.moveIsland).mockResolvedValue(undefined);
      vi.mocked(tabService.moveTab).mockResolvedValue({} as chrome.tabs.Tab);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().sortGroupsToTop();

      expect(tabService.moveTab).toHaveBeenCalled();
    });

    it('sets updating lock', async () => {
      store = createTestStore({ islands: [] });
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      let isUpdatingDuringCall = false;
      const originalSetIsUpdating = store.getState().setIsUpdating;
      store.setState({ 
        setIsUpdating: (val: boolean) => {
          if (val) isUpdatingDuringCall = true;
          originalSetIsUpdating(val);
        }
      } as any);

      await store.getState().sortGroupsToTop();

      expect(store.getState().isUpdating).toBe(false);
    });
  });

  describe('groupSearchResults', () => {
    it('extracts numeric IDs', async () => {
      const tabs: Tab[] = [
        createMockTab({ id: 'live-tab-123' }),
        createMockTab({ id: 'live-tab-456' }),
      ];
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupSearchResults(tabs);

      expect(tabService.consolidateAndGroupTabs).toHaveBeenCalledWith([123, 456], expect.any(Object));
    });

    it('calls consolidateAndGroupTabs', async () => {
      const tabs: Tab[] = [createMockTab({ id: 'live-tab-1' })];
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupSearchResults(tabs);

      expect(tabService.consolidateAndGroupTabs).toHaveBeenCalled();
    });

    it('sets updating lock', async () => {
      const tabs: Tab[] = [createMockTab({ id: 'live-tab-1' })];
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupSearchResults(tabs);

      expect(store.getState().isUpdating).toBe(false);
    });

    it('syncs after grouping', async () => {
      const tabs: Tab[] = [createMockTab({ id: 'live-tab-1' })];
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupSearchResults(tabs);

      expect(store.getState().isUpdating).toBe(false);
    });

    it('handles empty array', async () => {
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);

      await store.getState().groupSearchResults([]);

      expect(tabService.consolidateAndGroupTabs).toHaveBeenCalledWith([], expect.any(Object));
    });
  });

  describe('groupUngroupedTabs', () => {
    it('filters to ungrouped tabs', async () => {
      const ungroupedTab = createMockTab({ id: 'live-tab-1', groupId: -1 });
      const groupedTab = createMockTab({ id: 'live-tab-2', groupId: 1 });
      const island = createMockIsland({ id: 'live-group-1', tabs: [groupedTab] });
      store = createTestStore({ islands: [ungroupedTab, island] });
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupUngroupedTabs();

      expect(store.getState().isUpdating).toBe(false);
    });

    it('excludes pinned tabs', async () => {
      const pinnedTab = createMockTab({ id: 'live-tab-1', pinned: true, groupId: -1 });
      const normalTab = createMockTab({ id: 'live-tab-2', pinned: false, groupId: -1 });
      store = createTestStore({ islands: [pinnedTab, normalTab] });
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupUngroupedTabs();

      expect(store.getState().isUpdating).toBe(false);
    });

    it('requires at least 2 tabs', async () => {
      const singleTab = createMockTab({ id: 'live-tab-1', groupId: -1 });
      store = createTestStore({ islands: [singleTab] });
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);

      await store.getState().groupUngroupedTabs();

      expect(tabService.consolidateAndGroupTabs).not.toHaveBeenCalled();
    });

    it('groups 2+ tabs', async () => {
      const tab1 = createMockTab({ id: 'live-tab-1', groupId: -1 });
      const tab2 = createMockTab({ id: 'live-tab-2', groupId: -1 });
      store = createTestStore({ islands: [tab1, tab2] });
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupUngroupedTabs();

      expect(tabService.consolidateAndGroupTabs).toHaveBeenCalled();
    });

    it('sets updating lock', async () => {
      const tab1 = createMockTab({ id: 'live-tab-1', groupId: -1 });
      const tab2 = createMockTab({ id: 'live-tab-2', groupId: -1 });
      store = createTestStore({ islands: [tab1, tab2] });
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupUngroupedTabs();

      expect(store.getState().isUpdating).toBe(false);
    });

    it('syncs after grouping', async () => {
      const tab1 = createMockTab({ id: 'live-tab-1', groupId: -1 });
      const tab2 = createMockTab({ id: 'live-tab-2', groupId: -1 });
      store = createTestStore({ islands: [tab1, tab2] });
      vi.mocked(tabService.consolidateAndGroupTabs).mockResolvedValue(undefined);
      vi.mocked(tabService.getLiveTabsAndGroups).mockResolvedValue([]);

      await store.getState().groupUngroupedTabs();

      expect(store.getState().isUpdating).toBe(false);
    });
  });
});
