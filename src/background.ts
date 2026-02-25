import { ISLAND_CREATION_REFRESH_DELAY_MS, REFRESH_UI_DELAY_MS } from './constants';
import { quotaService } from './services/quotaService';
import { sidebarService, setupSidebarMessageListener } from './services/sidebarService';
import { mergeAppearanceSettings, defaultAppearanceSettings } from './store/utils';
import { logger, setDebugMode } from './utils/logger';

async function loadSettings() {
  let settings = defaultAppearanceSettings;
  try {
    const result = await chrome.storage.sync.get(['appearanceSettings']);
    settings = result.appearanceSettings
      ? mergeAppearanceSettings(result.appearanceSettings)
      : defaultAppearanceSettings;

    setDebugMode(settings.debugMode ?? false);
  } catch (error) {
    logger.error('Background', 'Failed to load appearance settings:', error);
  }
  return settings;
}

async function openExtensionTab(): Promise<chrome.tabs.Tab | undefined> {
  const settings = await loadSettings();

  logger.debug('Background', 'Focus existing tab setting:', settings.focusExistingTab);

  if (settings.focusExistingTab) {
    const extensionUrl = chrome.runtime.getURL('index.html');
    const tabs = await chrome.tabs.query({ url: extensionUrl });

    if (tabs.length > 0) {
      const existingTab = tabs[0];
      if (typeof existingTab.id === 'number') {
        logger.debug('Background', 'Found existing tab, focusing:', existingTab.id);
        const updatedTab = await chrome.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId !== undefined) {
          await chrome.windows.update(existingTab.windowId, { focused: true });
        }
        return updatedTab ?? existingTab;
      } else {
        logger.debug('Background', 'Existing tab has no valid ID, creating new tab');
      }
    }
  }

  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  logger.debug('Background', 'Created tab:', { id: tab.id, url: tab.url, pendingUrl: tab.pendingUrl });

  logger.debug('Background', 'Auto-pin setting:', settings.autoPinTabManager);

  if (settings.autoPinTabManager && tab.id) {
    try {
      logger.debug('Background', 'Attempting to pin tab:', tab.id);
      const updatedTab = await chrome.tabs.update(tab.id, { pinned: true });
      logger.debug('Background', 'Pin result:', { id: updatedTab?.id, pinned: updatedTab?.pinned });
    } catch (error) {
      logger.error('Background', 'Failed to pin tab:', error);
    }
  }

  return tab;
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const windowId = tab.windowId;
    const settings = await sidebarService.loadSettings();

    if (settings.toolbarClickAction === 'toggle-sidebar') {
      await sidebarService.handleToolbarClick(windowId);
    } else {
      await sidebarService.openManagerPage();
    }
  } catch (error) {
    logger.error('Background', 'Error in action.onClicked listener:', error);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-island-manager') {
    logger.debug('Background', 'Keyboard shortcut triggered');
    try {
      const settings = await sidebarService.loadSettings();
      const windows = await chrome.windows.getCurrent();
      if (windows.id !== undefined) {
        await sidebarService.handleToolbarClick(windows.id);
      }
    } catch (error) {
      logger.error('Background', 'Error in commands.onCommand listener:', error);
    }
  }
});

(async () => {
  try {
    const orphanedCount = await quotaService.cleanupOrphanedChunks();
    if (orphanedCount > 0) {
      logger.info('Background', `Cleaned up ${orphanedCount} orphaned vault chunks`);
    }

    await sidebarService.initialize();
  } catch (error) {
    logger.error('Background', 'Cleanup failed:', error);
  }
})();

chrome.tabs.onCreated.addListener(() => notifyUI());
chrome.tabs.onRemoved.addListener(() => notifyUI());
chrome.tabs.onUpdated.addListener(() => notifyUI());
chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  chrome.runtime.sendMessage({
    type: 'TAB_MOVED',
    tabId: tabId,
    fromIndex: moveInfo.fromIndex,
    toIndex: moveInfo.toIndex
  }).catch(() => { });
  notifyUI();
});

chrome.tabGroups.onCreated.addListener(() => notifyUI());
chrome.tabGroups.onUpdated.addListener(() => notifyUI());
chrome.tabGroups.onRemoved.addListener(() => notifyUI());
chrome.tabGroups.onMoved.addListener((group) => {
  chrome.runtime.sendMessage({
    type: 'GROUP_MOVED',
    groupId: group.id
  }).catch(() => { });
  notifyUI();
});

let islandCreationInProgress = false;

function notifyUI() {
  if (islandCreationInProgress) {
    setTimeout(() => {
      if (!islandCreationInProgress) {
        chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => { });
      }
    }, ISLAND_CREATION_REFRESH_DELAY_MS);
    return;
  }
  chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => { });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await sidebarService.handleContextMenuClick(info, tab);
});

export function messageListener(
  message: { type: string; tabId?: number; windowId?: number; settings?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: { success: boolean; isOpen?: boolean }) => void
) {
  const sidebarResponse = setupSidebarMessageListener(message, sender, sendResponse);
  if (sidebarResponse) {
    return true;
  }

  if (message.type === 'START_ISLAND_CREATION') {
    islandCreationInProgress = true;
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'END_ISLAND_CREATION') {
    islandCreationInProgress = false;
    setTimeout(() => notifyUI(), REFRESH_UI_DELAY_MS);
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'FREEZE_TAB') {
    chrome.tabs.discard(message.tabId).then((discardedTab) => {
      sendResponse({ success: !!discardedTab });
    }).catch(() => {
      sendResponse({ success: false });
    });
    return true;
  }

  if (message.type === 'SIDEBAR_TOGGLE_WINDOW') {
    const windowId = message.windowId || sender.tab?.windowId;
    if (windowId !== undefined) {
      chrome.sidePanel.open({ windowId }).then(() => {
        sendResponse({ success: true, isOpen: true });
      }).catch((err) => {
        logger.error('Background', 'Failed to open sidePanel:', err);
        sendResponse({ success: false });
      });
      return true;
    }
    sendResponse({ success: false });
    return false;
  }

  if (message.type === 'SIDEBAR_SETTINGS_UPDATE' && message.settings) {
    (async () => {
      try {
        const result = await chrome.storage.sync.get(['appearanceSettings']);
        const currentSettings = result.appearanceSettings
          ? mergeAppearanceSettings(result.appearanceSettings)
          : defaultAppearanceSettings;

        const newSettings = {
          ...currentSettings,
          ...(message.settings as Partial<typeof currentSettings>)
        };
        await chrome.storage.sync.set({ appearanceSettings: newSettings });
        sendResponse({ success: true });
      } catch {
        sendResponse({ success: false });
      }
    })();
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener(messageListener);

chrome.runtime.onSuspend.addListener(() => {
  chrome.runtime.onMessage.removeListener(messageListener);
});
