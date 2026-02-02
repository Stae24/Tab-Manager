import { describe, it, expect, vi, beforeEach } from 'vitest';
import { consolidateAndGroupTabs } from '../chromeApi';

vi.stubGlobal('chrome', {
  windows: {
    getLastFocused: vi.fn(),
  },
  tabs: {
    get: vi.fn(),
    move: vi.fn(),
    group: vi.fn(),
  },
  tabGroups: {
    TAB_GROUP_ID_NONE: -1,
    update: vi.fn((groupId: number, properties: chrome.tabGroups.UpdateProperties, callback?: () => void) => {
      if (callback) callback();
    }),
  },
  runtime: {
    lastError: null,
  },
});

const createMockTab = (id: number, url: string, windowId: number = 1, pinned: boolean = false): chrome.tabs.Tab => ({
  id,
  url,
  windowId,
  pinned,
  active: false,
  discarded: false,
  index: 0,
  groupId: -1,
  highlighted: false,
  frozen: false,
  incognito: false,
  selected: false,
  autoDiscardable: true,
});

const setupMocks = () => {
  const mockGetLastFocused = chrome.windows.getLastFocused as ReturnType<typeof vi.fn>;
  const mockGet = chrome.tabs.get as ReturnType<typeof vi.fn>;
  const mockMove = chrome.tabs.move as ReturnType<typeof vi.fn>;
  const mockGroup = chrome.tabs.group as ReturnType<typeof vi.fn>;
  const mockTabGroupsUpdate = chrome.tabGroups.update as ReturnType<typeof vi.fn>;

  mockGetLastFocused.mockResolvedValue({ id: 1 } as chrome.windows.Window);
  mockMove.mockResolvedValue([{ id: 1 }] as chrome.tabs.Tab[]);
  mockGroup.mockResolvedValue(123);
  mockTabGroupsUpdate.mockImplementation((groupId: number, properties: chrome.tabGroups.UpdateProperties, callback?: () => void) => {
    if (callback) callback();
  });

  return { mockGetLastFocused, mockGet, mockMove, mockGroup, mockTabGroupsUpdate };
};

describe('chromeApi - consolidateAndGroupTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe('Happy Path', () => {
    it('should correctly resolve window, filter tabs, move cross-window tabs, and group them', async () => {
      const { mockGetLastFocused, mockGet, mockMove, mockGroup } = setupMocks();

      const tabIds = [1, 2, 3];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 2),
        createMockTab(3, 'https://example3.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGetLastFocused).toHaveBeenCalledWith({ windowTypes: ['normal'] });
      expect(mockGet).toHaveBeenCalledTimes(3);
      expect(mockGet).toHaveBeenCalledWith(1);
      expect(mockGet).toHaveBeenCalledWith(2);
      expect(mockGet).toHaveBeenCalledWith(3);

      expect(mockMove).toHaveBeenCalledWith(2, { windowId: 1, index: -1 });
      expect(mockGroup).toHaveBeenCalledWith({ tabIds: [1, 2, 3] as [number, ...number[]] });
    });
  });

  describe('Pinned Filter', () => {
    it('should skip pinned tabs', async () => {
      const { mockGet, mockMove, mockGroup } = setupMocks();

      const tabIds = [1, 2, 3];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1, false),
        createMockTab(2, 'https://example2.com', 1, true),
        createMockTab(3, 'https://example3.com', 1, false),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).toHaveBeenCalledWith({ tabIds: [1, 3] as [number, ...number[]] });
      expect(mockMove).not.toHaveBeenCalled();
    });

    it('should not group if only pinned tabs remain', async () => {
      const { mockGet, mockGroup } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1, true),
        createMockTab(2, 'https://example2.com', 1, true),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).not.toHaveBeenCalled();
    });
  });

  describe('Restricted URL Filter', () => {
    it('should skip tabs with restricted URLs', async () => {
      const { mockGet, mockGroup } = setupMocks();

      const tabIds = [1, 2, 3, 4, 5];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'chrome://settings', 1),
        createMockTab(3, 'edge://settings', 1),
        createMockTab(4, 'about:blank', 1),
        createMockTab(5, 'opera://settings', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).not.toHaveBeenCalled();
    });

    it('should skip chrome-extension URLs', async () => {
      const { mockGet, mockGroup } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example.com', 1),
        createMockTab(2, 'chrome-extension://abc123/popup.html', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Window Move', () => {
    it('should move tabs from other windows to target window', async () => {
      const { mockGet, mockMove, mockGroup } = setupMocks();

      const tabIds = [1, 2, 3];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 2),
        createMockTab(3, 'https://example3.com', 3),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockMove).toHaveBeenCalledWith(2, { windowId: 1, index: -1 });
      expect(mockMove).toHaveBeenCalledWith(3, { windowId: 1, index: -1 });
      expect(mockGroup).toHaveBeenCalledWith({ tabIds: [1, 2, 3] as [number, ...number[]] });
    });

    it('should not move tabs already in target window', async () => {
      const { mockGet, mockMove, mockGroup } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockMove).not.toHaveBeenCalled();
      expect(mockGroup).toHaveBeenCalledWith({ tabIds: [1, 2] as [number, ...number[]] });
    });
  });

  describe('Grouping Threshold', () => {
    it('should group tabs only if >= 2 valid tabs remain', async () => {
      const { mockGet, mockGroup } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).toHaveBeenCalledWith({ tabIds: [1, 2] as [number, ...number[]] });
    });

    it('should not group if only 1 valid tab remains', async () => {
      const { mockGet, mockGroup } = setupMocks();

      const tabIds = [1];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).not.toHaveBeenCalled();
    });

    it('should not group if no valid tabs remain', async () => {
      const { mockGet, mockGroup } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'chrome://settings', 1),
        createMockTab(2, 'https://example2.com', 1, true),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).not.toHaveBeenCalled();
    });
  });

  describe('Random Color', () => {
    it('should update tab group with specific color when provided', async () => {
      const { mockGet, mockGroup, mockTabGroupsUpdate } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, { color: 'blue' });

      expect(mockGroup).toHaveBeenCalled();
      expect(mockTabGroupsUpdate).toHaveBeenCalledWith(123, { color: 'blue' as chrome.tabGroups.Color }, expect.any(Function));
    });

    it('should update tab group with random color when color is "random"', async () => {
      const { mockGet, mockGroup, mockTabGroupsUpdate } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, { color: 'random' });

      expect(mockGroup).toHaveBeenCalled();
      expect(mockTabGroupsUpdate).toHaveBeenCalledWith(
        123, 
        expect.objectContaining({
          color: expect.stringMatching(/^(grey|blue|red|yellow|green|pink|purple|cyan|orange)$/)
        }),
        expect.any(Function)
      );
    });

    it('should not update color when no color option provided', async () => {
      const { mockGet, mockGroup, mockTabGroupsUpdate } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).toHaveBeenCalled();
      expect(mockTabGroupsUpdate).not.toHaveBeenCalled();
    });

    it('should not update color when group creation fails', async () => {
      const { mockGet, mockGroup, mockTabGroupsUpdate } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      mockGroup.mockRejectedValue(new Error('Group creation failed'));

      await consolidateAndGroupTabs(tabIds, { color: 'blue' });

      expect(mockGroup).toHaveBeenCalled();
      expect(mockTabGroupsUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle failure to get target window', async () => {
      const mockGetLastFocused = chrome.windows.getLastFocused as ReturnType<typeof vi.fn>;
      const mockGet = chrome.tabs.get as ReturnType<typeof vi.fn>;
      const mockGroup = chrome.tabs.group as ReturnType<typeof vi.fn>;

      mockGetLastFocused.mockResolvedValue({ id: undefined } as chrome.windows.Window);
      mockGroup.mockResolvedValue(123);

      const tabIds = [1];
      const tabs = [createMockTab(1, 'https://example1.com', 1)];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await expect(consolidateAndGroupTabs(tabIds, {})).resolves.toBeUndefined();
      expect(mockGroup).not.toHaveBeenCalled();
    });

    it('should handle tab move failures gracefully', async () => {
      const { mockGet, mockMove, mockGroup } = setupMocks();

      const tabIds = [1, 2];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(2, 'https://example2.com', 2),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      mockMove.mockRejectedValue(new Error('Move failed'));

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).not.toHaveBeenCalled();
    });

    it('should handle missing tabs gracefully', async () => {
      const { mockGet, mockGroup } = setupMocks();

      const tabIds = [1, 2, 3];
      const tabs = [
        createMockTab(1, 'https://example1.com', 1),
        createMockTab(3, 'https://example3.com', 1),
      ];

      mockGet.mockImplementation((id: number) => {
        const tab = tabs.find(t => t.id === id);
        return Promise.resolve(tab || null);
      });

      await consolidateAndGroupTabs(tabIds, {});

      expect(mockGroup).toHaveBeenCalledWith({ tabIds: [1, 3] as [number, ...number[]] });
    });
  });
});