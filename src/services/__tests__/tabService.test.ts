import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockTabsQuery = vi.fn();
const mockTabsGet = vi.fn();
const mockTabsMove = vi.fn();
const mockTabsGroup = vi.fn();
const mockTabsUngroup = vi.fn();
const mockTabsCreate = vi.fn();
const mockTabsDiscard = vi.fn();
const mockTabsRemove = vi.fn();
const mockTabsUpdate = vi.fn();
const mockTabsDuplicate = vi.fn();
const mockTabGroupsQuery = vi.fn();
const mockTabGroupsMove = vi.fn();
const mockTabGroupsUpdate = vi.fn();
const mockWindowsGetCurrent = vi.fn();
const mockWindowsGetLastFocused = vi.fn();

let mockRuntimeLastError: chrome.runtime.LastError | null = null;

vi.stubGlobal('chrome', {
  tabs: {
    query: mockTabsQuery,
    get: mockTabsGet,
    move: mockTabsMove,
    group: mockTabsGroup,
    ungroup: mockTabsUngroup,
    create: mockTabsCreate,
    discard: mockTabsDiscard,
    remove: mockTabsRemove,
    update: mockTabsUpdate,
    duplicate: mockTabsDuplicate,
  },
  tabGroups: {
    query: mockTabGroupsQuery,
    move: mockTabGroupsMove,
    update: mockTabGroupsUpdate,
    TAB_GROUP_ID_NONE: -1,
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
    getCurrent: mockWindowsGetCurrent,
    getLastFocused: mockWindowsGetLastFocused,
  },
  runtime: {
    get lastError() { return mockRuntimeLastError; },
  },
});

vi.stubGlobal('navigator', {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

const mockNeedsCompanionTab = vi.fn(() => false);
const mockGetBrowserCapabilities = vi.fn(() => Promise.resolve({
  vendor: 'chrome' as const,
  supportsGroupCollapse: null,
  supportsSingleTabGroups: true,
}));

vi.mock('../../utils/browser', () => ({
  setGroupCollapseSupport: vi.fn(),
  getCachedCapabilities: vi.fn(() => null),
  needsCompanionTabForSingleTabGroup: () => mockNeedsCompanionTab(),
  getBrowserCapabilities: () => mockGetBrowserCapabilities(),
}));

describe('tabService', () => {
  let tabService: typeof import('../tabService').tabService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRuntimeLastError = null;
    mockNeedsCompanionTab.mockReturnValue(false);
    vi.resetModules();
    tabService = (await import('../tabService')).tabService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLiveTabsAndGroups', () => {
    it('returns empty array when no tabs or groups', async () => {
      mockTabsQuery.mockResolvedValue([]);
      mockTabGroupsQuery.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toEqual([]);
    });

    it('returns tabs sorted by index', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 3, title: 'Tab C', url: 'c.com', index: 2, groupId: -1, windowId: 1, active: false, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
        { id: 1, title: 'Tab A', url: 'a.com', index: 0, groupId: -1, windowId: 1, active: true, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
        { id: 2, title: 'Tab B', url: 'b.com', index: 1, groupId: -1, windowId: 1, active: false, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
      ]);
      mockTabGroupsQuery.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('id', 'live-tab-1');
      expect(result[1]).toHaveProperty('id', 'live-tab-2');
      expect(result[2]).toHaveProperty('id', 'live-tab-3');
    });

    it('groups tabs inside islands', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'a.com', index: 0, groupId: 100, windowId: 1, active: true, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
        { id: 2, title: 'Tab 2', url: 'b.com', index: 1, groupId: 100, windowId: 1, active: false, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
      ]);
      mockTabGroupsQuery.mockResolvedValue([
        { id: 100, title: 'My Group', color: 'cyan', collapsed: false, windowId: 1 },
      ]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'live-group-100');
      expect(result[0]).toHaveProperty('title', 'My Group');
      expect((result[0] as any).tabs).toHaveLength(2);
    });

    it('handles mixed grouped and ungrouped tabs', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, title: 'Tab 1', url: 'a.com', index: 0, groupId: -1, windowId: 1, active: false, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
        { id: 2, title: 'Tab 2', url: 'b.com', index: 1, groupId: 100, windowId: 1, active: true, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
        { id: 3, title: 'Tab 3', url: 'c.com', index: 2, groupId: -1, windowId: 1, active: false, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
      ]);
      mockTabGroupsQuery.mockResolvedValue([
        { id: 100, title: 'Group', color: 'blue', collapsed: false, windowId: 1 },
      ]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('id', 'live-tab-1');
      expect(result[1]).toHaveProperty('id', 'live-group-100');
      expect(result[2]).toHaveProperty('id', 'live-tab-3');
    });

    it('handles tabs with no group (-1)', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, title: 'Ungrouped', url: 'a.com', index: 0, groupId: -1, windowId: 1, active: true, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
      ]);
      mockTabGroupsQuery.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'live-tab-1');
    });

    it('handles pinned tabs correctly', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, title: 'Pinned', url: 'a.com', index: 0, groupId: -1, windowId: 1, active: false, discarded: false, mutedInfo: { muted: false }, pinned: true, audible: false },
        { id: 2, title: 'Normal', url: 'b.com', index: 1, groupId: -1, windowId: 1, active: true, discarded: false, mutedInfo: { muted: false }, pinned: false, audible: false },
      ]);
      mockTabGroupsQuery.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toHaveLength(2);
      expect((result[0] as any).pinned).toBe(true);
      expect((result[1] as any).pinned).toBe(false);
    });

    it('maps all tab properties correctly', async () => {
      mockTabsQuery.mockResolvedValue([
        {
          id: 1,
          title: 'Test Tab',
          url: 'https://example.com',
          favIconUrl: 'https://example.com/favicon.ico',
          index: 0,
          groupId: -1,
          windowId: 1,
          active: true,
          discarded: true,
          mutedInfo: { muted: true },
          pinned: true,
          audible: true,
        },
      ]);
      mockTabGroupsQuery.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();
      const tab = result[0] as any;

      expect(tab.id).toBe('live-tab-1');
      expect(tab.title).toBe('Test Tab');
      expect(tab.url).toBe('https://example.com');
      expect(tab.favicon).toBe('https://example.com/favicon.ico');
      expect(tab.active).toBe(true);
      expect(tab.discarded).toBe(true);
      expect(tab.muted).toBe(true);
      expect(tab.pinned).toBe(true);
      expect(tab.audible).toBe(true);
    });
  });

  describe('moveIsland', () => {
    it('moves group to specified index', async () => {
      mockTabGroupsMove.mockResolvedValue({ id: 100 });

      await tabService.moveIsland(100, 5);

      expect(mockTabGroupsMove).toHaveBeenCalledWith(100, { index: 5, windowId: undefined });
    });

    it('moves group to different window', async () => {
      mockTabGroupsMove.mockResolvedValue({ id: 100 });

      await tabService.moveIsland(100, 0, 2);

      expect(mockTabGroupsMove).toHaveBeenCalledWith(100, { index: 0, windowId: 2 });
    });

    it('retries on transient errors (dragging)', async () => {
      mockTabGroupsMove
        .mockRejectedValueOnce(new Error('Tab cannot be modified while dragging'))
        .mockResolvedValueOnce({ id: 100 });

      await tabService.moveIsland(100, 5);

      expect(mockTabGroupsMove).toHaveBeenCalledTimes(2);
    }, 10000);

    it('throws after max retries', async () => {
      mockTabGroupsMove.mockRejectedValue(new Error('Tab cannot be modified while dragging'));

      await expect(tabService.moveIsland(100, 5)).rejects.toThrow('Tab cannot be modified while dragging');
      expect(mockTabGroupsMove).toHaveBeenCalledTimes(3);
    }, 10000);

    it('logs error on failure', async () => {
      mockTabGroupsMove.mockRejectedValue(new Error('Network error'));

      await expect(tabService.moveIsland(100, 5)).rejects.toThrow();
    }, 10000);
  });

  describe('moveTab', () => {
    it('moves tab to specified index', async () => {
      mockTabsMove.mockResolvedValue({ id: 1 });

      await tabService.moveTab(1, 5);

      expect(mockTabsMove).toHaveBeenCalledWith(1, { index: 5, windowId: undefined });
    });

    it('moves tab to different window', async () => {
      mockTabsMove.mockResolvedValue({ id: 1 });

      await tabService.moveTab(1, 0, 2);

      expect(mockTabsMove).toHaveBeenCalledWith(1, { index: 0, windowId: 2 });
    });

    it('retries on transient errors', async () => {
      mockTabsMove
        .mockRejectedValueOnce(new Error('tabs cannot be edited right now'))
        .mockResolvedValueOnce({ id: 1 });

      await tabService.moveTab(1, 5);

      expect(mockTabsMove).toHaveBeenCalledTimes(2);
    }, 10000);
  });

  describe('createIsland', () => {
    it('creates group from multiple tabs', async () => {
      mockTabsGet
        .mockResolvedValueOnce({ id: 1, windowId: 1, index: 0, pinned: false })
        .mockResolvedValueOnce({ id: 2, windowId: 1, index: 1, pinned: false });
      mockTabsGroup.mockResolvedValue(100);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.createIsland([1, 2], 'My Group', 'cyan' as chrome.tabGroups.Color);

      expect(result).toBe(100);
      expect(mockTabsGroup).toHaveBeenCalled();
    });

    it('creates companion tab for single tab group (Opera GX hack)', async () => {
      mockNeedsCompanionTab.mockReturnValue(true);
      
      mockTabsGet.mockResolvedValue({ id: 1, windowId: 1, index: 0, pinned: false });
      mockTabsCreate.mockResolvedValue({ id: 2 });
      mockTabsGroup.mockResolvedValue(100);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.createIsland([1]);

      expect(mockTabsCreate).toHaveBeenCalled();
      expect(mockTabsGroup).toHaveBeenCalledWith(expect.objectContaining({
        tabIds: expect.arrayContaining([1, 2]),
      }));
    });

    it('creates single tab group without companion on Brave/Chrome', async () => {
      mockNeedsCompanionTab.mockReturnValue(false);
      
      mockTabsGet.mockResolvedValue({ id: 1, windowId: 1, index: 0, pinned: false });
      mockTabsGroup.mockResolvedValue(100);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.createIsland([1]);

      expect(mockTabsCreate).not.toHaveBeenCalled();
      expect(mockTabsGroup).toHaveBeenCalledWith(expect.objectContaining({
        tabIds: [1],
      }));
    });

    it('returns null for no valid tabs', async () => {
      mockTabsGet.mockRejectedValue(new Error('Tab not found'));

      const result = await tabService.createIsland([999]);

      expect(result).toBeNull();
    });

    it('handles pinned tabs - attempts to group (Chrome restricts)', async () => {
      mockTabsGet.mockResolvedValue({ id: 1, windowId: 1, index: 0, pinned: true });
      mockTabsCreate.mockResolvedValue({ id: 2 });
      mockTabsGroup.mockResolvedValue(100);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.createIsland([1]);

      expect(mockTabsGroup).toHaveBeenCalled();
    });

    it('sets correct title and color', async () => {
      mockTabsGet
        .mockResolvedValueOnce({ id: 1, windowId: 1, index: 0, pinned: false })
        .mockResolvedValueOnce({ id: 2, windowId: 1, index: 1, pinned: false });
      mockTabsGroup.mockResolvedValue(100);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      await tabService.createIsland([1, 2], 'Custom Title', 'red' as chrome.tabGroups.Color);

      expect(mockTabGroupsUpdate).toHaveBeenCalledWith(100, { title: 'Custom Title', color: 'red' as chrome.tabGroups.Color }, expect.any(Function));
    });
  });

  describe('ungroupTab', () => {
    it('ungroups single tab', async () => {
      mockTabsUngroup.mockResolvedValue(undefined);

      await tabService.ungroupTab(1);

      expect(mockTabsUngroup).toHaveBeenCalledWith(1);
    });

    it('ungroups multiple tabs', async () => {
      mockTabsUngroup.mockResolvedValue(undefined);

      await tabService.ungroupTab([1, 2, 3]);

      expect(mockTabsUngroup).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('handles errors gracefully', async () => {
      mockTabsUngroup.mockRejectedValue(new Error('Failed'));

      await expect(tabService.ungroupTab(1)).rejects.toThrow();
    });
  });

  describe('updateTabGroup', () => {
    it('returns false for invalid group id (-1)', async () => {
      const result = await tabService.updateTabGroup(-1, { title: 'Test' });

      expect(result).toBe(false);
      expect(mockTabGroupsUpdate).not.toHaveBeenCalled();
    });

    it('returns false for zero group id', async () => {
      const result = await tabService.updateTabGroup(0, { title: 'Test' });

      expect(result).toBe(false);
    });

    it('updates group properties', async () => {
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callback();
        return Promise.resolve({ id: 100 });
      });

      const result = await tabService.updateTabGroup(100, { title: 'New Title', color: 'red', collapsed: true });

      expect(result).toBe(true);
      expect(mockTabGroupsUpdate).toHaveBeenCalled();
    });

    it('returns false on chrome.runtime.lastError', async () => {
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        mockRuntimeLastError = { message: 'Group not found' };
        callback();
        return Promise.resolve({ id: 100 });
      });

      const result = await tabService.updateTabGroup(100, { title: 'Test' });

      expect(result).toBe(false);
    });

    it('retries on editable error', async () => {
      let callCount = 0;
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callCount++;
        if (callCount < 2) {
          mockRuntimeLastError = { message: 'Group is not editable' };
        } else {
          mockRuntimeLastError = null;
        }
        callback();
        return Promise.resolve({ id: 100 });
      });

      const result = await tabService.updateTabGroup(100, { title: 'Test' });

      expect(result).toBe(true);
    }, 10000);
  });

  describe('updateTabGroupCollapse', () => {
    it('updates collapsed state', async () => {
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callback();
        return Promise.resolve({ id: 100 });
      });

      await tabService.updateTabGroupCollapse(100, true);

      expect(mockTabGroupsUpdate).toHaveBeenCalledWith(100, { collapsed: true }, expect.any(Function));
    });
  });

  describe('discardTab', () => {
    it('discards a single tab', async () => {
      mockTabsDiscard.mockResolvedValue({ id: 1 });

      await tabService.discardTab(1);

      expect(mockTabsDiscard).toHaveBeenCalledWith(1);
    });
  });

  describe('discardTabs', () => {
    it('discards multiple tabs', async () => {
      mockTabsDiscard.mockResolvedValue({ id: 1 });

      await tabService.discardTabs([1, 2, 3]);

      expect(mockTabsDiscard).toHaveBeenCalledTimes(3);
    });
  });

  describe('closeTab', () => {
    it('closes a single tab', async () => {
      mockTabsRemove.mockResolvedValue(undefined);

      await tabService.closeTab(1);

      expect(mockTabsRemove).toHaveBeenCalledWith(1);
    });
  });

  describe('closeTabs', () => {
    it('closes multiple tabs', async () => {
      mockTabsRemove.mockResolvedValue(undefined);

      await tabService.closeTabs([1, 2, 3]);

      expect(mockTabsRemove).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('handles empty array', async () => {
      mockTabsRemove.mockResolvedValue(undefined);

      await tabService.closeTabs([]);

      expect(mockTabsRemove).toHaveBeenCalledWith([]);
    });
  });

  describe('getCurrentWindowTabs', () => {
    it('returns tabs in current window', async () => {
      mockTabsQuery.mockResolvedValue([{ id: 1 }]);

      const result = await tabService.getCurrentWindowTabs();

      expect(mockTabsQuery).toHaveBeenCalledWith({ currentWindow: true });
      expect(result).toHaveLength(1);
    });
  });

  describe('getCurrentWindowGroups', () => {
    it('returns groups in current window', async () => {
      mockTabGroupsQuery.mockResolvedValue([{ id: 100 }]);

      const result = await tabService.getCurrentWindowGroups();

      expect(mockTabGroupsQuery).toHaveBeenCalledWith({ windowId: -2 });
      expect(result).toHaveLength(1);
    });
  });

  describe('createTab', () => {
    it('creates a tab with options', async () => {
      mockTabsCreate.mockResolvedValue({ id: 1 });

      const result = await tabService.createTab({ url: 'https://example.com', active: true });

      expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://example.com', active: true });
      expect(result).toHaveProperty('id', 1);
    });
  });

  describe('pinTab', () => {
    it('pins a tab', async () => {
      mockTabsUpdate.mockResolvedValue({ id: 1, pinned: true });

      await tabService.pinTab(1);

      expect(mockTabsUpdate).toHaveBeenCalledWith(1, { pinned: true });
    });
  });

  describe('unpinTab', () => {
    it('unpins a tab', async () => {
      mockTabsUpdate.mockResolvedValue({ id: 1, pinned: false });

      await tabService.unpinTab(1);

      expect(mockTabsUpdate).toHaveBeenCalledWith(1, { pinned: false });
    });
  });

  describe('muteTab', () => {
    it('mutes a tab', async () => {
      mockTabsUpdate.mockResolvedValue({ id: 1 });

      await tabService.muteTab(1);

      expect(mockTabsUpdate).toHaveBeenCalledWith(1, { muted: true });
    });
  });

  describe('unmuteTab', () => {
    it('unmutes a tab', async () => {
      mockTabsUpdate.mockResolvedValue({ id: 1 });

      await tabService.unmuteTab(1);

      expect(mockTabsUpdate).toHaveBeenCalledWith(1, { muted: false });
    });
  });

  describe('duplicateTab', () => {
    it('duplicates a tab', async () => {
      mockTabsDuplicate.mockResolvedValue({ id: 2 });

      const result = await tabService.duplicateTab(1);

      expect(mockTabsDuplicate).toHaveBeenCalledWith(1);
      expect(result).toHaveProperty('id', 2);
    });
  });

  describe('copyTabUrl', () => {
    it('copies tab url to clipboard', async () => {
      mockTabsGet.mockResolvedValue({ id: 1, url: 'https://example.com' });

      await tabService.copyTabUrl(1);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('consolidateAndGroupTabs', () => {
    it('groups tabs from different windows', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet.mockResolvedValue({ id: 1, windowId: 2, pinned: false, url: 'https://example.com' });
      mockTabsMove.mockResolvedValue({ id: 1, windowId: 1 });
      mockTabsGroup.mockResolvedValue(100);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });
      mockTabsQuery.mockResolvedValue([]);
      mockTabGroupsMove.mockResolvedValue({ id: 100 });

      await tabService.consolidateAndGroupTabs([1], { color: 'cyan' as any });

      expect(mockTabsMove).toHaveBeenCalled();
    }, 10000);

    it('filters pinned tabs', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet.mockResolvedValue({ id: 1, windowId: 1, pinned: true, url: 'https://example.com' });

      await tabService.consolidateAndGroupTabs([1], { color: 'cyan' as any });

      expect(mockTabsGroup).not.toHaveBeenCalled();
    });

    it('filters restricted URLs', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet.mockResolvedValue({ id: 1, windowId: 1, pinned: false, url: 'chrome://settings' });

      await tabService.consolidateAndGroupTabs([1], { color: 'cyan' as any });

      expect(mockTabsGroup).not.toHaveBeenCalled();
    });

    it('uses random color when specified', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet
        .mockResolvedValueOnce({ id: 1, windowId: 1, pinned: false, url: 'https://a.com' })
        .mockResolvedValueOnce({ id: 2, windowId: 1, pinned: false, url: 'https://b.com' });
      mockTabsGroup.mockResolvedValue(100);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });
      mockTabsQuery.mockResolvedValue([
        { id: 1, groupId: 100, index: 0 },
        { id: 2, groupId: 100, index: 1 },
      ]);
      mockTabGroupsMove.mockResolvedValue({ id: 100 });

      await tabService.consolidateAndGroupTabs([1, 2], { color: 'random' as any });

      expect(mockTabGroupsUpdate).toHaveBeenCalled();
    }, 10000);
  });
});
