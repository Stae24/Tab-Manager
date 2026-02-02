chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
});

chrome.tabs.onCreated.addListener(() => notifyUI());
chrome.tabs.onRemoved.addListener(() => notifyUI());
chrome.tabs.onUpdated.addListener(() => notifyUI());
chrome.tabs.onMoved.addListener(() => notifyUI());

chrome.tabGroups.onCreated.addListener(() => notifyUI());
chrome.tabGroups.onUpdated.addListener(() => notifyUI());
chrome.tabGroups.onRemoved.addListener(() => notifyUI());
chrome.tabGroups.onMoved.addListener(() => notifyUI());

let islandCreationInProgress = false;

function notifyUI() {
  if (islandCreationInProgress) {
    setTimeout(() => {
      if (!islandCreationInProgress) {
        chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {});
      }
    }, 400);
    return;
  }
  chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_ISLAND_CREATION') {
    islandCreationInProgress = true;
    sendResponse({ success: true });
    return false;
  } 
  
  if (message.type === 'END_ISLAND_CREATION') {
    islandCreationInProgress = false;
    setTimeout(() => notifyUI(), 100);
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

  if (message.type === 'FETCH_FAVICON') {
    (async () => {
      try {
        const url = message.url;
        
        const restrictedProtocols = [
          'chrome://',
          'about:',
          'file:',
          'data:',
          'edge:',
          'opera:',
          'chrome-extension:',
          'view-source:'
        ];
        
        if (restrictedProtocols.some(protocol => url.startsWith(protocol))) {
          sendResponse({ success: false, error: 'RESTRICTED_PROTOCOL' });
          return;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const dataUrl = `data:${blob.type};base64,${base64}`;
        
        sendResponse({ success: true, dataUrl });
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        sendResponse({ success: false, error: errorMessage });
      }
    })();
    return true;
  }
});
