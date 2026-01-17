// Open full-page dashboard when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
});

// Listen for tab and group changes to broadcast to the UI
chrome.tabs.onCreated.addListener(() => notifyUI());
chrome.tabs.onRemoved.addListener(() => notifyUI());
chrome.tabs.onUpdated.addListener(() => notifyUI());
chrome.tabs.onMoved.addListener(() => notifyUI());

chrome.tabGroups.onCreated.addListener(() => notifyUI());
chrome.tabGroups.onUpdated.addListener(() => notifyUI());
chrome.tabGroups.onRemoved.addListener(() => notifyUI());
chrome.tabGroups.onMoved.addListener(() => notifyUI());

// Add a flag to track island creation operations to prevent refresh race conditions
let islandCreationInProgress = false;

function notifyUI() {
  if (islandCreationInProgress) {
    // Queue the refresh instead of broadcasting immediately
    setTimeout(() => {
      if (!islandCreationInProgress) {
        chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {});
      }
    }, 400);
    return;
  }
  chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {
    // Expected error if UI is not open
  });
}

// Memory optimization and island creation management
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_ISLAND_CREATION') {
    islandCreationInProgress = true;
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'END_ISLAND_CREATION') {
    islandCreationInProgress = false;
    // Trigger immediate refresh after island is created
    setTimeout(() => notifyUI(), 100);
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'FREEZE_TAB') {
    chrome.tabs.discard(message.tabId, (discardedTab) => {
      sendResponse({ success: !!discardedTab });
    });
    return true; // Keep channel open for async response
  }
});
