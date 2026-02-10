import { ISLAND_CREATION_REFRESH_DELAY_MS, REFRESH_UI_DELAY_MS } from './constants';
import { quotaService } from './services/quotaService';

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
});

(async () => {
  const orphanedCount = await quotaService.cleanupOrphanedChunks();
  if (orphanedCount > 0) {
    console.log(`[Background] Cleaned up ${orphanedCount} orphaned vault chunks`);
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
  }).catch(() => {});
  notifyUI();
});

chrome.tabGroups.onCreated.addListener(() => notifyUI());
chrome.tabGroups.onUpdated.addListener(() => notifyUI());
chrome.tabGroups.onRemoved.addListener(() => notifyUI());
chrome.tabGroups.onMoved.addListener((group) => {
  chrome.runtime.sendMessage({
    type: 'GROUP_MOVED',
    groupId: group.id
  }).catch(() => {});
  notifyUI();
});

let islandCreationInProgress = false;

function notifyUI() {
  if (islandCreationInProgress) {
    setTimeout(() => {
      if (!islandCreationInProgress) {
        chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {});
      }
    }, ISLAND_CREATION_REFRESH_DELAY_MS);
    return;
  }
  chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {});
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
