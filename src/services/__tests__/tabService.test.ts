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
  initBrowserCapabilities: vi.fn(() => Promise.resolve(true)),
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

    it('does not retry on editable error (permanent failure)', async () => {
      let callCount = 0;
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callCount++;
        mockRuntimeLastError = { message: 'Group is not editable' };
        callback();
        return Promise.resolve({ id: 100 });
      });

      const result = await tabService.updateTabGroup(100, { title: 'Test' });

      expect(result).toBe(false);
      expect(callCount).toBe(1);
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

    it('handles empty results from query', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet.mockRejectedValue(new Error('Not found'));

      await tabService.consolidateAndGroupTabs([999], { color: 'cyan' as any });

      expect(mockTabsGroup).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles tabs without URLs in getLiveTabsAndGroups', async () => {
      mockTabsQuery.mockResolvedValue([
        { id: 1, title: 'No URL', index: 0, groupId: -1, windowId: 1, active: true, discarded: false, pinned: false }
      ]);
      mockTabGroupsQuery.mockResolvedValue([]);

      const result = await tabService.getLiveTabsAndGroups();

      expect(result).toHaveLength(1);
      expect((result[0] as any).url).toBe('');
    });

    it('handles current window tabs query error', async () => {
      mockTabsQuery.mockRejectedValue(new Error('Query failed'));

      await expect(tabService.getCurrentWindowTabs()).rejects.toThrow('Query failed');
    });

    it('returns false when updateTabGroupCollapse verification fails', async () => {
      // Mock update to succeed
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callback();
        return Promise.resolve({ id: 100 });
      });
      // Mock get to return inconsistent state
      vi.stubGlobal('chrome', {
        ...chrome,
        tabGroups: {
          ...chrome.tabGroups,
          get: vi.fn().mockResolvedValue({ id: 100, collapsed: false }) // Should be true
        }
      });

      const result = await tabService.updateTabGroupCollapse(100, true);
      expect(result).toBe(false);
    });
  });

  describe('Consolidate and Group Tabs - Advanced Branches', () => {
    it('adjusts target index when new group starts before target', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet.mockImplementation(id => Promise.resolve({ id, windowId: 1, url: 'https://a.com' }));

      mockTabsQuery.mockResolvedValue([
        { id: 1, index: 0, url: 'a', groupId: 101, windowId: 1 } as any,
        { id: 2, index: 1, url: 'b', groupId: 101, windowId: 1 } as any,
        { id: 3, index: 5, url: 'c', groupId: 100, windowId: 1 } as any
      ]);
      mockTabGroupsQuery.mockResolvedValue([{ id: 100, title: 'Other' } as any]);
      mockTabsGroup.mockResolvedValue(101);

      await tabService.consolidateAndGroupTabs([1, 2], {});

      expect(mockTabsGroup).toHaveBeenCalled();
      // targetIndex should have been (5+1) - 2 = 4
      expect(mockTabGroupsMove).toHaveBeenCalledWith(101, { index: 4 });
    });

    it('handles errors during group move', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet.mockImplementation(id => Promise.resolve({ id, windowId: 1, url: 'https://a.com' }));
      // Use 2 tabs to trigger grouping
      mockTabsQuery.mockResolvedValue([
        { id: 1, index: 0, url: 'a', groupId: 101, windowId: 1 } as any,
        { id: 2, index: 1, url: 'b', groupId: 101, windowId: 1 } as any
      ]);
      mockTabsGroup.mockResolvedValue(101);
      mockTabGroupsMove.mockRejectedValue(new Error('Move failed'));

      await tabService.consolidateAndGroupTabs([1, 2], {});

      expect(mockTabsGroup).toHaveBeenCalled();
      expect(mockTabGroupsMove).toHaveBeenCalled();
    });

    it('handles group creation failure for coverage', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({ id: 1, type: 'normal' });
      mockTabsGet.mockImplementation(id => Promise.resolve({ id, windowId: 1, url: 'https://a.com' }));
      mockTabsGroup.mockRejectedValue(new Error('Grouping failed'));

      await tabService.consolidateAndGroupTabs([1, 2], {});

      expect(mockTabsGroup).toHaveBeenCalled();
    });
  });

  describe('updateTabGroupCollapse - Brave Browser Workaround', () => {
    it('should apply Brave visual refresh workaround', async () => {
      // Mock Brave browser
      const { getCachedCapabilities } = await import('../../utils/browser');
      vi.mocked(getCachedCapabilities).mockReturnValue({
        vendor: 'brave',
        supportsGroupCollapse: true,
        supportsSingleTabGroups: true,
      } as any);

      // Mock update to succeed
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callback();
        return Promise.resolve({ id: 100, collapsed: true });
      });

      // Mock get to return correct state
      const mockTabGroupsGet = vi.fn().mockResolvedValue({ id: 100, collapsed: true });
      vi.stubGlobal('chrome', {
        ...chrome,
        tabGroups: {
          ...chrome.tabGroups,
          get: mockTabGroupsGet
        }
      });

      mockTabsQuery.mockResolvedValue([{ id: 10, windowId: 1 }]);
      mockTabsCreate.mockResolvedValue({ id: 99 } as any);
      mockTabsGroup.mockResolvedValue(100);
      mockTabsUngroup.mockResolvedValue({});
      mockTabsRemove.mockResolvedValue(undefined);

      const result = await tabService.updateTabGroupCollapse(100, true);

      expect(result).toBe(true);
      expect(mockTabsCreate).toHaveBeenCalledWith({
        url: 'about:blank',
        windowId: 1,
        active: false,
      });
      expect(mockTabsRemove).toHaveBeenCalledWith(99);
    });

    it('should handle Brave workaround errors gracefully', async () => {
      const { getCachedCapabilities } = await import('../../utils/browser');
      vi.mocked(getCachedCapabilities).mockReturnValue({
        vendor: 'brave',
        supportsGroupCollapse: true,
        supportsSingleTabGroups: true,
      } as any);

      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callback();
        return Promise.resolve({ id: 100, collapsed: true });
      });

      const mockTabGroupsGet = vi.fn().mockResolvedValue({ id: 100, collapsed: true });
      vi.stubGlobal('chrome', {
        ...chrome,
        tabGroups: {
          ...chrome.tabGroups,
          get: mockTabGroupsGet
        }
      });

      mockTabsQuery.mockResolvedValue([{ id: 10, windowId: 1 }]);
      mockTabsCreate.mockResolvedValue({ id: 99 } as any);
      mockTabsGroup.mockRejectedValue(new Error('Group failed'));
      mockTabsRemove.mockResolvedValue(undefined);

      // Should not throw - handles error gracefully
      await expect(tabService.updateTabGroupCollapse(100, true)).resolves.toBe(true);
    });

    it('should handle get group error gracefully', async () => {
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        callback();
        return Promise.resolve({ id: 100 });
      });

      const mockTabGroupsGet = vi.fn().mockRejectedValue(new Error('Not found'));
      vi.stubGlobal('chrome', {
        ...chrome,
        tabGroups: {
          ...chrome.tabGroups,
          get: mockTabGroupsGet
        }
      });

      const result = await tabService.updateTabGroupCollapse(100, true);

      // Should still return success since update succeeded
      expect(result).toBe(true);
    });
  });

  describe('closeTabs', () => {
    it('should close single tab with number', async () => {
      mockTabsRemove.mockResolvedValue(undefined);

      // Reset to clear previous test mock behavior
      vi.clearAllMocks();
      mockTabsRemove.mockClear();

      await tabService.closeTabs(123);

      expect(mockTabsRemove).toHaveBeenCalledWith(123);
    });

    it('should close multiple tabs with array', async () => {
      mockTabsRemove.mockResolvedValue(undefined);

      await tabService.closeTabs([1, 2, 3]);

      expect(mockTabsRemove).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe('duplicateIsland', () => {
    it('should duplicate all tabs in island', async () => {
      const mockTabs = [
        { id: 1, windowId: 1, url: 'https://example.com', active: false, index: 0 },
        { id: 2, windowId: 1, url: 'https://test.com', active: true, index: 1 },
      ];

      mockTabsGet
        .mockResolvedValueOnce(mockTabs[0] as any)
        .mockResolvedValueOnce(mockTabs[1] as any);

      mockTabsCreate
        .mockResolvedValueOnce({ id: 101 } as any)
        .mockResolvedValueOnce({ id: 102 } as any);

      mockTabsGroup.mockResolvedValue(500);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.duplicateIsland([1, 2]);

      expect(result).toEqual([101, 102]);
      expect(mockTabsGroup).toHaveBeenCalledWith({ tabIds: [101, 102] });
    });

    it('should handle missing tabs gracefully', async () => {
      mockTabsGet
        .mockResolvedValueOnce({ id: 1, windowId: 1, url: 'https://example.com' } as any)
        .mockRejectedValueOnce(new Error('Tab not found'));

      mockTabsCreate.mockResolvedValue({ id: 101 } as any);
      mockTabsGroup.mockResolvedValue(500);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.duplicateIsland([1, 2]);

      expect(result).toEqual([101]);
    });

    it('should skip tabs without URLs', async () => {
      mockTabsGet
        .mockResolvedValueOnce({ id: 1, windowId: 1, url: undefined } as any)
        .mockResolvedValueOnce({ id: 2, windowId: 1, url: 'https://example.com' } as any);

      mockTabsCreate.mockResolvedValue({ id: 101 } as any);
      mockTabsGroup.mockResolvedValue(500);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.duplicateIsland([1, 2]);

      expect(result).toEqual([101]);
    });

    it('should create group even for single tab', async () => {
      mockTabsGet.mockResolvedValue({ id: 1, windowId: 1, url: 'https://example.com' } as any);
      mockTabsCreate.mockResolvedValue({ id: 101 } as any);
      mockTabsGroup.mockResolvedValue(500);
      mockTabGroupsUpdate.mockImplementation((id, props, callback) => {
        if (callback) callback();
        return Promise.resolve({ id });
      });

      const result = await tabService.duplicateIsland([1]);

      expect(result).toEqual([101]);
      // Implementation creates a group even for single tab
      expect(mockTabsGroup).toHaveBeenCalled();
    });

    it('should handle all tabs failing to load', async () => {
      mockTabsGet
        .mockRejectedValueOnce(new Error('Tab not found'))
        .mockRejectedValueOnce(new Error('Tab not found'));

      const result = await tabService.duplicateIsland([1, 2]);

      expect(result).toEqual([]);
      expect(mockTabsCreate).not.toHaveBeenCalled();
      expect(mockTabsGroup).not.toHaveBeenCalled();
    });

    it('should set correct properties on duplicated tabs', async () => {
      mockTabsGet.mockResolvedValue({
        id: 1,
        windowId: 1,
        url: 'https://example.com',
        active: true,
        index: 5
      } as any);

      mockTabsCreate.mockResolvedValue({ id: 101 } as any);

      await tabService.duplicateIsland([1]);

      expect(mockTabsCreate).toHaveBeenCalledWith({
        windowId: 1,
        url: 'https://example.com',
        active: true,
        index: 6 // index + 1
      });
    });
  });

  describe('consolidateAndGroupTabs error handling', () => {
    it('should handle no target window gracefully', async () => {
      mockWindowsGetLastFocused.mockResolvedValue({} as any);

      // Should not throw
      await tabService.consolidateAndGroupTabs([10], { color: 'blue' });

      expect(mockTabsMove).not.toHaveBeenCalled();
    });

    it('should handle consolidation error in outer catch', async () => {
      mockWindowsGetLastFocused.mockRejectedValue(new Error('No window'));

      // Should handle error gracefully without throwing
      await tabService.consolidateAndGroupTabs([10], { color: 'blue' });

      // Test passes if no exception is thrown
    });
  });
});
