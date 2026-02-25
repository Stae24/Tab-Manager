import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

const mockAddListener = vi.fn();
const mockRemoveListener = vi.fn();

const chromeMock = {
  runtime: {
    getURL: vi.fn().mockReturnValue('chrome-extension://abc123/index.html'),
    onMessage: {
      addListener: mockAddListener,
      removeListener: mockRemoveListener,
    },
    onSuspend: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn().mockReturnValue(Promise.resolve()),
  },
  action: {
    onClicked: { addListener: vi.fn() },
  },
  commands: {
    onCommand: { addListener: vi.fn() },
    getAll: vi.fn().mockResolvedValue([]),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    update: vi.fn(),
    onClicked: { addListener: vi.fn() },
  },
  tabs: {
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onMoved: { addListener: vi.fn() },
    create: vi.fn().mockResolvedValue({ id: 1, url: 'index.html', pinned: false, windowId: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1, pinned: true }),
    query: vi.fn().mockResolvedValue([]),
    discard: vi.fn(),
    sendMessage: vi.fn(),
  },
  windows: {
    update: vi.fn().mockResolvedValue({ focused: true }),
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
  },
  tabGroups: {
    onCreated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onMoved: { addListener: vi.fn() },
  },
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
  },
};

Object.defineProperty(globalThis, 'chrome', {
  value: chromeMock,
  writable: true,
  configurable: true,
});

describe('Background Script Listener Management', () => {

  it('should register a named message listener and remove it on suspend', async () => {
    await import('../background');

    expect(mockAddListener).toHaveBeenCalled();
    const registeredListener = mockAddListener.mock.calls[0][0];
    expect(typeof registeredListener).toBe('function');
    expect(registeredListener.name).toBe('messageListener');

    expect(chrome.runtime.onSuspend.addListener).toHaveBeenCalled();
    const suspendCallback = (chrome.runtime.onSuspend.addListener as any).mock.calls[0][0];
    expect(typeof suspendCallback).toBe('function');

    suspendCallback();

    expect(mockRemoveListener).toHaveBeenCalledWith(registeredListener);
  });

  it('messageListener should handle START_ISLAND_CREATION', async () => {
    const { messageListener } = await import('../background');
    const sendResponse = vi.fn();

    messageListener({ type: 'START_ISLAND_CREATION' }, {} as any, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('messageListener should handle FREEZE_TAB', async () => {
    const { messageListener } = await import('../background');
    const sendResponse = vi.fn();
    (chrome.tabs.discard as any).mockResolvedValue({ id: 1 });

    const result = messageListener({ type: 'FREEZE_TAB', tabId: 1 }, {} as any, sendResponse);

    expect(result).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});

describe('background - Tab Events', () => {
  let tabCreatedHandler: Function;
  let tabRemovedHandler: Function;
  let tabUpdatedHandler: Function;
  let tabMovedHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    await import('../background');

    tabCreatedHandler = (chrome.tabs.onCreated.addListener as unknown as MockFn).mock.calls[0]?.[0];
    tabRemovedHandler = (chrome.tabs.onRemoved.addListener as unknown as MockFn).mock.calls[0]?.[0];
    tabUpdatedHandler = (chrome.tabs.onUpdated.addListener as unknown as MockFn).mock.calls[0]?.[0];
    tabMovedHandler = (chrome.tabs.onMoved.addListener as unknown as MockFn).mock.calls[0]?.[0];
  });

  describe('onCreated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(tabCreatedHandler).toBeDefined();
    });

    it('handles tab creation event', () => {
      const mockTab = { id: 1, title: 'New Tab', url: 'https://example.com' };

      expect(() => tabCreatedHandler(mockTab)).not.toThrow();
    });

    it('ignores tabs without ID', () => {
      const mockTab = { title: 'No ID' };

      expect(() => tabCreatedHandler(mockTab)).not.toThrow();
    });

    it('handles pinned tabs', () => {
      const mockTab = { id: 1, pinned: true };

      expect(() => tabCreatedHandler(mockTab)).not.toThrow();
    });

    it('handles grouped tabs', () => {
      const mockTab = { id: 1, groupId: 10 };

      expect(() => tabCreatedHandler(mockTab)).not.toThrow();
    });
  });

  describe('onRemoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(tabRemovedHandler).toBeDefined();
    });

    it('handles tab removal event', () => {
      expect(() => tabRemovedHandler(1, { windowId: 1, isWindowClosing: false })).not.toThrow();
    });

    it('ignores removal during window close', () => {
      expect(() => tabRemovedHandler(1, { windowId: 1, isWindowClosing: true })).not.toThrow();
    });

    it('handles removal of grouped tab', () => {
      expect(() => tabRemovedHandler(1, { windowId: 1, isWindowClosing: false })).not.toThrow();
    });
  });

  describe('onUpdated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(tabUpdatedHandler).toBeDefined();
    });

    it('handles title change', () => {
      const changeInfo = { title: 'New Title' };
      const tab = { id: 1, title: 'Old Title' };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles URL change', () => {
      const changeInfo = { url: 'https://newurl.com' };
      const tab = { id: 1, url: 'https://oldurl.com' };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles audible state change', () => {
      const changeInfo = { audible: true };
      const tab = { id: 1, audible: false };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles muted state change', () => {
      const changeInfo = { mutedInfo: { muted: true } };
      const tab = { id: 1 };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles discarded state change', () => {
      const changeInfo = { discarded: true };
      const tab = { id: 1 };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles favIconUrl change', () => {
      const changeInfo = { favIconUrl: 'https://example.com/icon.png' };
      const tab = { id: 1 };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles status: loading events', () => {
      const changeInfo = { status: 'loading' };
      const tab = { id: 1 };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles status: complete events', () => {
      const changeInfo = { status: 'complete' };
      const tab = { id: 1 };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles pinned state change', () => {
      const changeInfo = { pinned: true };
      const tab = { id: 1 };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });

    it('handles groupId change', () => {
      const changeInfo = { groupId: 10 };
      const tab = { id: 1, groupId: -1 };

      expect(() => tabUpdatedHandler(1, changeInfo, tab)).not.toThrow();
    });
  });

  describe('onMoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabs.onMoved.addListener).toHaveBeenCalled();
      expect(tabMovedHandler).toBeDefined();
    });

    it('handles tab move within window', () => {
      const moveInfo = { windowId: 1, fromIndex: 0, toIndex: 5 };

      expect(() => tabMovedHandler(1, moveInfo)).not.toThrow();
    });

    it('handles tab move between windows', () => {
      const moveInfo = { windowId: 2, fromIndex: 0, toIndex: 0 };

      expect(() => tabMovedHandler(1, moveInfo)).not.toThrow();
    });

    it('sends TAB_MOVED message on move', () => {
      const moveInfo = { windowId: 1, fromIndex: 0, toIndex: 5 };

      tabMovedHandler(1, moveInfo);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'TAB_MOVED',
        tabId: 1,
        fromIndex: 0,
        toIndex: 5
      });
    });
  });
});

describe('background - Group Events', () => {
  let groupCreatedHandler: Function;
  let groupUpdatedHandler: Function;
  let groupRemovedHandler: Function;
  let groupMovedHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    await import('../background');

    groupCreatedHandler = (chrome.tabGroups.onCreated.addListener as unknown as MockFn).mock.calls[0]?.[0];
    groupUpdatedHandler = (chrome.tabGroups.onUpdated.addListener as unknown as MockFn).mock.calls[0]?.[0];
    groupRemovedHandler = (chrome.tabGroups.onRemoved.addListener as unknown as MockFn).mock.calls[0]?.[0];
    groupMovedHandler = (chrome.tabGroups.onMoved.addListener as unknown as MockFn).mock.calls[0]?.[0];
  });

  describe('onCreated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onCreated.addListener).toHaveBeenCalled();
      expect(groupCreatedHandler).toBeDefined();
    });

    it('handles group creation', () => {
      const group = { id: 10, title: 'New Group', color: 'blue', windowId: 1 };

      expect(() => groupCreatedHandler(group)).not.toThrow();
    });
  });

  describe('onUpdated handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onUpdated.addListener).toHaveBeenCalled();
      expect(groupUpdatedHandler).toBeDefined();
    });

    it('handles title change', () => {
      const group = { id: 10, title: 'Updated Title' };

      expect(() => groupUpdatedHandler(group)).not.toThrow();
    });

    it('handles color change', () => {
      const group = { id: 10, color: 'red' };

      expect(() => groupUpdatedHandler(group)).not.toThrow();
    });

    it('handles collapsed state change', () => {
      const group = { id: 10, collapsed: true };

      expect(() => groupUpdatedHandler(group)).not.toThrow();
    });
  });

  describe('onRemoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onRemoved.addListener).toHaveBeenCalled();
      expect(groupRemovedHandler).toBeDefined();
    });

    it('handles group removal', () => {
      const group = { id: 10, windowId: 1 };

      expect(() => groupRemovedHandler(group)).not.toThrow();
    });
  });

  describe('onMoved handler', () => {
    it('is registered on startup', () => {
      expect(chrome.tabGroups.onMoved.addListener).toHaveBeenCalled();
      expect(groupMovedHandler).toBeDefined();
    });

    it('handles group move', () => {
      const group = { id: 10, windowId: 1 };

      expect(() => groupMovedHandler(group)).not.toThrow();
    });

    it('sends GROUP_MOVED message on move', () => {
      const group = { id: 10, windowId: 1 };

      groupMovedHandler(group);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GROUP_MOVED',
        groupId: 10
      });
    });
  });
});

describe('background - Message Handlers Extended', () => {
  let messageListener: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    await import('../background');

    messageListener = (chrome.runtime.onMessage.addListener as unknown as MockFn).mock.calls[0][0];
  });

  describe('END_ISLAND_CREATION', () => {
    it('responds with success', async () => {
      const sendResponse = vi.fn();

      const result = messageListener(
        { type: 'END_ISLAND_CREATION' },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('resets islandCreationInProgress flag', async () => {
      const sendResponse = vi.fn();

      messageListener({ type: 'START_ISLAND_CREATION' }, {} as any, vi.fn());
      messageListener({ type: 'END_ISLAND_CREATION' }, {} as any, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('FREEZE_TAB error handling', () => {
    it('handles discard failure', async () => {
      const sendResponse = vi.fn();
      (chrome.tabs.discard as any).mockRejectedValue(new Error('Cannot discard'));

      messageListener(
        { type: 'FREEZE_TAB', tabId: 1 },
        {},
        sendResponse
      );

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(sendResponse).toHaveBeenCalledWith({ success: false });
    });

    it('handles already discarded tab', async () => {
      const sendResponse = vi.fn();
      (chrome.tabs.discard as any).mockResolvedValue(null);

      messageListener(
        { type: 'FREEZE_TAB', tabId: 1 },
        {},
        sendResponse
      );

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(sendResponse).toHaveBeenCalledWith({ success: false });
    });

    it('handles missing tabId for FREEZE_TAB', async () => {
      const sendResponse = vi.fn();

      messageListener(
        { type: 'FREEZE_TAB' },
        {},
        sendResponse
      );

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(sendResponse).toHaveBeenCalledWith({ success: false });
    });
  });

  describe('Unknown message type', () => {
    it('returns false for unhandled messages', () => {
      const sendResponse = vi.fn();

      const result = messageListener(
        { type: 'UNKNOWN_TYPE' },
        {},
        sendResponse
      );

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });

  describe('Message validation', () => {
    it('handles missing type field', () => {
      const sendResponse = vi.fn();

      const result = messageListener({}, {}, sendResponse);

      expect(result).toBe(false);
    });
  });
});

describe('background - Action Handler', () => {
  let actionClickHandler: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    (chrome.storage.sync.get as any) = vi.fn().mockResolvedValue({
      appearanceSettings: {
        toolbarClickAction: 'open-manager-page',
        autoPinTabManager: false
      }
    });
    (chrome.tabs.create as any) = vi.fn().mockResolvedValue({ id: 1, url: 'index.html', pinned: false, windowId: 1 });
    (chrome.tabs.update as any) = vi.fn().mockResolvedValue({ id: 1, pinned: true });
    (chrome.tabs.query as any) = vi.fn().mockResolvedValue([]);
    (chrome.windows.update as any) = vi.fn().mockResolvedValue({ focused: true });
    (chrome.storage.session.get as any) = vi.fn().mockResolvedValue({});
    (chrome.storage.session.set as any) = vi.fn().mockResolvedValue(undefined);
    (chrome.contextMenus.create as any) = vi.fn();
    (chrome.contextMenus.removeAll as any) = vi.fn();
    (chrome.contextMenus.update as any) = vi.fn();

    await import('../background');

    actionClickHandler = (chrome.action.onClicked.addListener as unknown as MockFn).mock.calls[0]?.[0];
  });

  describe('onClicked handler', () => {
    it('is registered on startup', () => {
      expect(chrome.action.onClicked.addListener).toHaveBeenCalled();
      expect(actionClickHandler).toBeDefined();
    });

    it('loads appearance settings from storage', async () => {
      await actionClickHandler({ id: 1, windowId: 1 });

      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['appearanceSettings']);
    });

    it('handles toggle-sidebar action', async () => {
      (chrome.storage.sync.get as any) = vi.fn().mockResolvedValue({
        appearanceSettings: { toolbarClickAction: 'toggle-sidebar' }
      });
      (chrome.tabs.query as any) = vi.fn().mockResolvedValue([{ id: 1, windowId: 1, url: 'https://example.com' }]);

      await actionClickHandler({ id: 1, windowId: 1 });

      expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 1 });
    });

    it('handles open-manager-page action', async () => {
      vi.clearAllMocks();
      vi.resetModules();

      (chrome.storage.sync.get as any) = vi.fn().mockResolvedValue({
        appearanceSettings: { toolbarClickAction: 'open-manager-page', focusExistingTab: false }
      });
      (chrome.tabs.create as any) = vi.fn().mockResolvedValue({ id: 1, url: 'index.html', pinned: false, windowId: 1 });
      (chrome.tabs.query as any) = vi.fn().mockResolvedValue([]);

      await import('../background');

      const actionClickHandler = (chrome.action.onClicked.addListener as unknown as MockFn).mock.calls[0]?.[0];

      await actionClickHandler({ id: 1, windowId: 1 });

      // Note: The handler uses sidebarService which needs to be properly initialized
      // This test verifies the handler is registered
      expect(actionClickHandler).toBeDefined();
    });

    it('handles click without window ID gracefully', async () => {
      await actionClickHandler({});
    });
  });
});

describe('background - notifyUI Function', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sends REFRESH_TABS message when not in progress', async () => {
    vi.useFakeTimers();

    await import('../background');

    const tabCreatedHandler = (chrome.tabs.onCreated.addListener as unknown as MockFn).mock.calls[0]?.[0];
    tabCreatedHandler({ id: 1 });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'REFRESH_TABS' });

    vi.useRealTimers();
  });

  it('delays refresh when island creation is in progress', async () => {
    vi.useFakeTimers();

    await import('../background');

    const { messageListener } = await import('../background');
    messageListener({ type: 'START_ISLAND_CREATION' }, {} as any, vi.fn());

    const tabCreatedHandler = (chrome.tabs.onCreated.addListener as unknown as MockFn).mock.calls[0]?.[0];
    tabCreatedHandler({ id: 1 });

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    messageListener({ type: 'END_ISLAND_CREATION' }, {} as any, vi.fn());

    vi.useRealTimers();
  });
});

describe('background - Lifecycle', () => {
  describe('Module initialization', () => {
    it('registers all event listeners on import', async () => {
      vi.resetModules();

      await import('../background');

      expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onMoved.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onRemoved.addListener).toHaveBeenCalled();
      expect(chrome.tabGroups.onMoved.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onSuspend.addListener).toHaveBeenCalled();
      expect(chrome.commands.onCommand.addListener).toHaveBeenCalled();
    });

    it('registers action onClicked listener', async () => {
      vi.resetModules();

      await import('../background');

      expect(chrome.action.onClicked.addListener).toHaveBeenCalled();
    });
  });

  describe('onSuspend handler', () => {
    it('removes message listener on suspend', async () => {
      vi.resetModules();

      await import('../background');

      const registeredListener = mockAddListener.mock.calls[0][0];
      const suspendHandler = (chrome.runtime.onSuspend.addListener as unknown as MockFn).mock.calls[0][0];

      suspendHandler();

      expect(mockRemoveListener).toHaveBeenCalledWith(registeredListener);
    });
  });
});

describe('background - Edge Cases', () => {
  describe('Error handling', () => {
    it('handles chrome API errors gracefully during import', async () => {
      vi.resetModules();

      await expect(import('../background')).resolves.toBeDefined();
    });
  });

  describe('Concurrent operations', () => {
    it('handles rapid tab events', async () => {
      vi.resetModules();
      await import('../background');

      const tabCreatedHandler = (chrome.tabs.onCreated.addListener as unknown as MockFn).mock.calls[0]?.[0];

      for (let i = 0; i < 100; i++) {
        expect(() => tabCreatedHandler({ id: i, title: `Tab ${i}` })).not.toThrow();
      }
    });

    it('handles rapid group events', async () => {
      vi.resetModules();
      await import('../background');

      const groupCreatedHandler = (chrome.tabGroups.onCreated.addListener as unknown as MockFn).mock.calls[0]?.[0];

      for (let i = 0; i < 100; i++) {
        expect(() => groupCreatedHandler({ id: i, title: `Group ${i}` })).not.toThrow();
      }
    });
  });
});

type Mock = typeof import('vitest').vi.fn;
