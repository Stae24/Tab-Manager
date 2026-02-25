import { logger } from '../utils/logger';
import { mergeAppearanceSettings, defaultAppearanceSettings } from '../store/utils';
import { ToolbarClickAction } from '../types/index';

const SIDEBAR_STICKY_STATE_KEY = 'sidebarStickyState';

const getStickyStateStorage = async (): Promise<Record<number, boolean>> => {
  try {
    const result = await chrome.storage.session.get([SIDEBAR_STICKY_STATE_KEY]);
    return (result[SIDEBAR_STICKY_STATE_KEY] as Record<number, boolean>) || {};
  } catch {
    return {} as Record<number, boolean>;
  }
};

const setStickyStateStorage = async (state: Record<number, boolean>): Promise<void> => {
  try {
    await chrome.storage.session.set({ [SIDEBAR_STICKY_STATE_KEY]: state });
  } catch (error) {
    logger.error('SidebarService', 'Failed to persist sticky state:', error);
  }
};

export const sidebarService = {
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['appearanceSettings']);
      return result.appearanceSettings
        ? mergeAppearanceSettings(result.appearanceSettings)
        : defaultAppearanceSettings;
    } catch (error) {
      logger.error('SidebarService', 'Failed to load settings:', error);
      return defaultAppearanceSettings;
    }
  },

  async getWindowStickyState(windowId: number): Promise<boolean> {
    const state = await getStickyStateStorage();
    return state[windowId] ?? false;
  },

  async setWindowStickyState(windowId: number, isOpen: boolean): Promise<void> {
    const state = await getStickyStateStorage();
    state[windowId] = isOpen;
    await setStickyStateStorage(state);
    logger.debug('SidebarService', `Window ${windowId} sticky state:`, isOpen);
  },

  async toggleWindowStickyState(windowId: number): Promise<boolean> {
    const currentState = await this.getWindowStickyState(windowId);
    const newState = !currentState;
    await this.setWindowStickyState(windowId, newState);
    return newState;
  },

  async getToolbarClickAction(): Promise<ToolbarClickAction> {
    const settings = await this.loadSettings();
    return settings.toolbarClickAction;
  },

  async handleToolbarClick(windowId: number): Promise<void> {
    const action = await this.getToolbarClickAction();
    logger.debug('SidebarService', 'Toolbar click action:', action);

    const tabs = await chrome.tabs.query({ active: true, windowId });
    const currentTab = tabs[0];
    const isRestricted = this.isRestrictedUrl(currentTab?.url);

    if (isRestricted) {
      await this.openManagerPage();
      return;
    }

    if (action === 'toggle-sidebar') {
      // Use the native Side Panel API to open
      await chrome.sidePanel.open({ windowId });
    } else if (action === 'open-manager-page') {
      await this.openManagerPage();
    }
  },

  async openManagerPage(): Promise<void> {
    const settings = await this.loadSettings();
    const extensionUrl = chrome.runtime.getURL('index.html');

    if (settings.focusExistingTab) {
      const tabs = await chrome.tabs.query({ url: extensionUrl });
      if (tabs.length > 0 && tabs[0].id !== undefined) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId !== undefined) {
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        }
        return;
      }
    }

    await chrome.tabs.create({ url: extensionUrl });
  },

  async broadcastSidebarState(_windowId: number): Promise<void> {
    // Deprecated for Side Panel: It manages its own state
  },

  isManagerPage(url: string | undefined): boolean {
    if (!url) return false;
    const managerUrl = chrome.runtime.getURL('index.html');
    return url === managerUrl || url.startsWith(managerUrl + '?') || url.startsWith(managerUrl + '#');
  },

  isRestrictedUrl(url: string | undefined): boolean {
    if (!url) return true;
    const managerUrl = chrome.runtime.getURL('index.html');
    return url.startsWith('chrome://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-extension://') ||
      url === managerUrl;
  },

  async setupWindowListeners(): Promise<void> {
    chrome.windows.onRemoved.addListener(async (windowId) => {
      const state = await getStickyStateStorage();
      delete state[windowId];
      await setStickyStateStorage(state);
    });

    logger.info('SidebarService', 'Window listeners initialized');
  },

  async setupContextMenus(): Promise<void> {
    try {
      await chrome.contextMenus.removeAll();

      chrome.contextMenus.create({
        id: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        contexts: ['action']
      });

      chrome.contextMenus.create({
        id: 'open-manager-page',
        title: 'Open Manager Page',
        contexts: ['action']
      });

      chrome.contextMenus.create({
        id: 'toolbar-click-default',
        title: 'Default Click Action',
        contexts: ['action'],
        parentId: undefined
      });

      chrome.contextMenus.create({
        id: 'toolbar-click-toggle-sidebar',
        title: 'Toggle Sidebar',
        contexts: ['action'],
        parentId: 'toolbar-click-default',
        type: 'radio'
      });

      chrome.contextMenus.create({
        id: 'toolbar-click-open-manager',
        title: 'Open Manager Page',
        contexts: ['action'],
        parentId: 'toolbar-click-default',
        type: 'radio'
      });

      const settings = await this.loadSettings();
      const action = settings.toolbarClickAction;
      chrome.contextMenus.update(
        action === 'toggle-sidebar' ? 'toolbar-click-toggle-sidebar' : 'toolbar-click-open-manager',
        { checked: true }
      );

      logger.info('SidebarService', 'Context menus created');
    } catch (error) {
      logger.error('SidebarService', 'Failed to create context menus:', error);
    }
  },

  async handleContextMenuClick(
    info: { menuItemId: string | number },
    tab: chrome.tabs.Tab | undefined
  ): Promise<void> {
    const windowId = tab?.windowId;
    if (windowId === undefined) return;

    switch (info.menuItemId) {
      case 'toggle-sidebar':
        await chrome.sidePanel.open({ windowId });
        break;

      case 'open-manager-page':
        await this.openManagerPage();
        break;

      case 'toolbar-click-toggle-sidebar':
        await this.updateToolbarClickAction('toggle-sidebar');
        break;

      case 'toolbar-click-open-manager':
        await this.updateToolbarClickAction('open-manager-page');
        break;
    }
  },

  async updateToolbarClickAction(action: ToolbarClickAction): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['appearanceSettings']);
      const currentSettings = result.appearanceSettings
        ? mergeAppearanceSettings(result.appearanceSettings)
        : defaultAppearanceSettings;

      const newSettings = { ...currentSettings, toolbarClickAction: action };
      await chrome.storage.sync.set({ appearanceSettings: newSettings });

      await this.setupContextMenus();

      logger.info('SidebarService', 'Toolbar click action updated:', action);
    } catch (error) {
      logger.error('SidebarService', 'Failed to update toolbar click action:', error);
    }
  },

  async initialize(): Promise<void> {
    await this.setupWindowListeners();
    await this.setupContextMenus();
    logger.info('SidebarService', 'Initialized');
  }
};

export const setupSidebarMessageListener = (
  message: { type: string; windowId?: number },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: { success: boolean; isOpen?: boolean; isSticky?: boolean }) => void
): boolean => {
  if (message.type === 'SIDEBAR_TOGGLE_WINDOW') {
    if (message.windowId !== undefined) {
      chrome.sidePanel.open({ windowId: message.windowId }).then(() => {
        sendResponse({ success: true, isOpen: true });
      });
      return true;
    }
  }

  if (message.type === 'SIDEBAR_SET_WINDOW_OPEN') {
    if (message.windowId !== undefined) {
      sidebarService.setWindowStickyState(message.windowId, true).then(() => {
        sendResponse({ success: true, isOpen: true });
      });
      return true;
    }
  }

  if (message.type === 'SIDEBAR_SYNC_REQUEST') {
    if (message.windowId !== undefined) {
      sidebarService.getWindowStickyState(message.windowId).then((isOpen) => {
        sendResponse({ success: true, isOpen });
      });
      return true;
    }
  }

  if (message.type === 'OPEN_MANAGER_PAGE') {
    sidebarService.openManagerPage().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SIDEBAR_GET_STICKY_STATE') {
    if (message.windowId !== undefined) {
      sidebarService.getWindowStickyState(message.windowId).then((isSticky) => {
        sendResponse({ success: true, isSticky });
      });
      return true;
    }
    sidebarService.getWindowStickyState(chrome.windows.WINDOW_ID_CURRENT).then((isSticky) => {
      sendResponse({ success: true, isSticky });
    });
    return true;
  }

  return false;
};
