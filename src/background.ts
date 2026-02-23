import { ISLAND_CREATION_REFRESH_DELAY_MS, REFRESH_UI_DELAY_MS } from './constants';
import { quotaService } from './services/quotaService';
import { isAppearanceSettings, defaultAppearanceSettings } from './store/utils';
import { backgroundLogger, syncDebugMode } from './utils/backgroundLogger';

chrome.action.onClicked.addListener(async () => {
  const tab = await chrome.tabs.create({ url: 'index.html' });
  backgroundLogger.debug('Background', 'Created tab:', { id: tab.id, url: tab.url, pendingUrl: tab.pendingUrl });

  let settings = defaultAppearanceSettings;
  try {
    const result = await chrome.storage.sync.get(['appearanceSettings']);
    settings = result.appearanceSettings && isAppearanceSettings(result.appearanceSettings)
      ? result.appearanceSettings
      : defaultAppearanceSettings;

    // Sync debug mode with settings
    syncDebugMode(settings.debugMode ?? false);
  } catch (error) {
    backgroundLogger.error('Background', 'Failed to load appearance settings:', error);
  }

  backgroundLogger.debug('Background', 'Auto-pin setting:', settings.autoPinTabManager);

  if (settings.autoPinTabManager && tab.id) {
    try {
      backgroundLogger.debug('Background', 'Attempting to pin tab:', tab.id);
      const updatedTab = await chrome.tabs.update(tab.id, { pinned: true });
      backgroundLogger.debug('Background', 'Pin result:', { id: updatedTab?.id, pinned: updatedTab?.pinned });
    } catch (error) {
      backgroundLogger.error('Background', 'Failed to pin tab:', error);
    }
  }
});

(async () => {
  try {
    const orphanedCount = await quotaService.cleanupOrphanedChunks();
    if (orphanedCount > 0) {
      backgroundLogger.info('Background', `Cleaned up ${orphanedCount} orphaned vault chunks`);
    }
  } catch (error) {
    backgroundLogger.error('Background', 'Cleanup failed:', error);
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

export function messageListener(
  message: { type: string; tabId?: number },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: { success: boolean }) => void
) {
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
}

chrome.runtime.onMessage.addListener(messageListener);

chrome.runtime.onSuspend.addListener(() => {
  chrome.runtime.onMessage.removeListener(messageListener);
});
