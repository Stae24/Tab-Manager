import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ALL services BEFORE importing useStore
vi.mock('../../services/vaultService', () => ({
  vaultService: {
    loadVault: vi.fn().mockResolvedValue({ vault: [], timestamp: 0 }),
    saveVault: vi.fn().mockResolvedValue({ success: true, bytesUsed: 0, bytesAvailable: 1000, warningLevel: 'none' }),
    migrateFromLegacy: vi.fn().mockResolvedValue({ migrated: false, itemCount: 0, from: 'none' }),
    toggleSyncMode: vi.fn().mockResolvedValue({ success: true }),
  }
}));

vi.mock('../../services/quotaService', () => ({
  quotaService: {
    getVaultQuota: vi.fn().mockResolvedValue({ used: 0, total: 1000, percentage: 0, available: 1000, warningLevel: 'none' }),
  }
}));

vi.mock('../../services/settingsService', () => ({
  settingsService: {
    loadSettings: vi.fn().mockResolvedValue({
      appearanceSettings: {
        vaultSyncEnabled: true,
        sortGroupsByCount: false,
        sortVaultGroupsByCount: false,
        theme: 'system',
        accentColor: 'purple',
        density: 'comfortable',
        uiScale: 1,
        animationIntensity: 'normal',
        audioIndicator: 'icon',
        borderRadius: 'md',
        iconPack: 'default',
        menuPosition: 'bottom',
        faviconSource: 'google',
        faviconFallback: 'letter',
        showCounts: true,
        compactTabs: false,
      },
      showVault: true,
      dividerPosition: 50,
      settingsPanelWidth: 300
    }),
    watchSettings: vi.fn(() => vi.fn()),
    saveSettings: vi.fn(),
  }
}));

// Reset modules to ensure mocks are applied
vi.resetModules();

// Mock requestAnimationFrame for synchronous execution in tests
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  },
  writable: true,
  configurable: true,
});

import { useStore } from '../useStore';
import type { Island, Tab, VaultItem } from '../../types/index';

// Helper to reset store state before each test
const resetStore = () => {
  const initialState = {
    islands: [],
    vault: [],
    isUpdating: false,
    isRefreshing: false,
    pendingRefresh: false,
    showVault: true,
    dividerPosition: 50,
    isDarkMode: true,
    isRenaming: false,
  };
  useStore.setState(initialState);
};

beforeEach(() => {
  // Clear all mock calls and reset store
  vi.clearAllMocks();
  resetStore();
});

describe('useStore - syncLiveTabs', () => {
  it('populates islands with tabs and groups from chrome API', async () => {
    const mockTabs: any[] = [
      { id: 1, title: 'Tab 1', url: 'https://example.com', index: 0, windowId: 1, active: false, pinned: false, discarded: false, mutedInfo: { muted: false }, groupId: -1 },
      { id: 2, title: 'Tab 2', url: 'https://example.org', index: 1, windowId: 1, active: false, pinned: false, discarded: false, mutedInfo: { muted: false }, groupId: 10 },
    ];
    const mockGroups: any[] = [
      { id: 10, title: 'Group A', color: 'grey', collapsed: false },
    ];
    
    // @ts-ignore
    chrome.tabs.query.mockResolvedValue(mockTabs);
    // @ts-ignore
    chrome.tabGroups.query.mockResolvedValue(mockGroups);

    await useStore.getState().syncLiveTabs();
    const { islands } = useStore.getState();
    
    // Expect one group and one standalone tab
    expect(islands).toHaveLength(2);
    const group = islands.find(i => (i as Island).tabs) as Island;
    expect(group.title).toBe('Group A');
    expect(group.tabs).toHaveLength(1);
    const solo = islands.find(i => !(i as Island).tabs) as Tab;
    expect(solo.title).toBe('Tab 1');
  });
});

describe('useStore - moveToVault', () => {
  it('moves a live tab to vault and calls chrome.tabs.remove', async () => {
    const { quotaService } = await import('../../services/quotaService');
    vi.mocked(quotaService.getVaultQuota).mockResolvedValue({ used: 0, total: 100000, percentage: 0, available: 100000, warningLevel: 'none' });
    
    const liveTab: Tab = {
      id: 'live-tab-1',
      title: 'Test Tab',
      url: 'https://example.com',
      favicon: '',
      active: false,
      discarded: false,
      windowId: 1,
      index: 0,
      groupId: -1,
      muted: false,
      pinned: false,
      audible: false,
    };
    
    useStore.setState({ islands: [liveTab] });
    // @ts-ignore
    chrome.tabs.remove.mockResolvedValue(undefined);
    
    await useStore.getState().moveToVault(liveTab.id);
    
    const { islands, vault } = useStore.getState();
    expect(islands).toHaveLength(0);
    expect(vault).toHaveLength(1);
    const vaultItem = vault[0] as VaultItem;
    expect(String(vaultItem.id)).toMatch(/^vault-live-tab-1-/);
    expect(vaultItem.savedAt).toBeDefined();
    expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
  });
});

describe('useStore - restoreFromVault', () => {
  it('restores a vault tab back to live and removes it from vault', async () => {
    const vaultItem: VaultItem = {
      id: 'vault-live-tab-1-123456',
      title: 'Test Tab',
      url: 'https://example.com',
      favicon: '',
      active: false,
      discarded: false,
      windowId: 1,
      index: 0,
      groupId: -1,
      muted: false,
      pinned: false,
      audible: false,
      savedAt: 123456,
      originalId: 1,
    } as any;
    
    useStore.setState({ vault: [vaultItem] });
    // @ts-ignore
    chrome.tabs.create.mockResolvedValue({ id: 1 });
    // @ts-ignore
    chrome.tabs.query.mockResolvedValue([]);
    // @ts-ignore
    chrome.tabGroups.query.mockResolvedValue([]);
    
    await useStore.getState().restoreFromVault(vaultItem.id);
    
    const { vault } = useStore.getState();
    expect(vault).toHaveLength(0);
    expect(chrome.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: (vaultItem as Tab).url }));
  });
});

describe('useStore - moveItemOptimistically', () => {
  it('blocks cross-panel moves (live -> vault)', () => {
    const liveTab: Tab = { id: 'live-tab-1', title: 'A', url: '', favicon: '', active: false, discarded: false, windowId: 1, index: 0, groupId: -1, muted: false, pinned: false, audible: false };
    const vaultItem: VaultItem = { id: 'vault-tab-2-0', title: 'B', url: '', favicon: '', active: false, discarded: false, windowId: 1, index: 0, groupId: -1, muted: false, pinned: false, audible: false, savedAt: 0, originalId: 2 } as any;
    
    useStore.setState({ islands: [liveTab], vault: [vaultItem] });
    
    // attempt to move live tab onto vault dropzone
    useStore.getState().moveItemOptimistically('live-tab-1', 'vault-dropzone');
    
    const { islands, vault } = useStore.getState();
    // state should remain unchanged
    expect(islands).toEqual([liveTab]);
    expect(vault).toEqual([vaultItem]);
  });

  it('reorders items within the same panel', () => {
    const tabA: Tab = { id: 'live-tab-1', title: 'A', url: '', favicon: '', active: false, discarded: false, windowId: 1, index: 0, groupId: -1, muted: false, pinned: false, audible: false };
    const tabB: Tab = { id: 'live-tab-2', title: 'B', url: '', favicon: '', active: false, discarded: false, windowId: 1, index: 1, groupId: -1, muted: false, pinned: false, audible: false };
    
    useStore.setState({ islands: [tabA, tabB] });
    
    // Move tabB before tabA using a gap identifier (live-gap-0)
    useStore.getState().moveItemOptimistically('live-tab-2', 'live-gap-0');
    
    const { islands } = useStore.getState();
    expect(islands[0].id).toBe('live-tab-2');
    expect(islands[1].id).toBe('live-tab-1');
  });
});
