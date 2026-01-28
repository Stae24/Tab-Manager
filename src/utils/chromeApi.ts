const withRetry = async <T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> => {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const msg = error.message || '';
      const isRetryable = msg.includes('Tab cannot be modified') || 
                         msg.includes('dragging') || 
                         msg.includes('moving') ||
                         msg.includes('tabs cannot be edited') ||
                         msg.includes('editable');
      
      if (isRetryable && attempt < maxAttempts) {
        const delay = 100 * Math.pow(2, attempt - 1);
        console.warn(`[${label}] Attempt ${attempt} failed. Retrying in ${delay}ms...`, msg);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const moveIsland = async (groupId: number, index: number, windowId?: number) => {
  try {
    return await withRetry(
      () => chrome.tabGroups.move(groupId, { index, windowId }),
      'moveIsland'
    );
  } catch (error) {
    console.error(`[moveIsland] Failed to move group ${groupId} to index ${index} (window ${windowId}):`, error);
    throw error;
  }
};

export const moveTab = async (tabId: number, index: number, windowId?: number) => {
  try {
    return await withRetry(
      () => chrome.tabs.move(tabId, { index, windowId }),
      'moveTab'
    );
  } catch (error) {
    console.error(`[moveTab] Failed to move tab ${tabId} to index ${index} (window ${windowId}):`, error);
    throw error;
  }
};

export const createIsland = async (tabIds: number[], title?: string, color?: chrome.tabGroups.Color, windowId?: number): Promise<number | null> => {
  try {
    // 1. Fetch tab objects to verify existence and window affinity
    const tabs = await Promise.all(
      tabIds.map(id => chrome.tabs.get(id).catch(() => null))
    );
    const validTabs = tabs.filter((t): t is chrome.tabs.Tab => t !== null && t.id !== undefined);
    
    if (validTabs.length === 0) return null;

    // 2. Determine target window (majority rule or forced)
    let targetWindowId: number | undefined = windowId;

    if (targetWindowId === chrome.windows.WINDOW_ID_CURRENT) {
        const currentWindow = await chrome.windows.getCurrent();
        targetWindowId = currentWindow.id;
    }

    if (!targetWindowId) {
      // Find window with most tabs
      const windowCounts = new Map<number, number>();
      validTabs.forEach(t => {
        const wid = t.windowId;
        windowCounts.set(wid, (windowCounts.get(wid) || 0) + 1);
      });
      
      let maxCount = -1;
      // Initialize with first valid tab's window as fallback
      targetWindowId = validTabs[0].windowId; 

      for (const [wid, count] of windowCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          targetWindowId = wid;
        }
      }
    }

    // 3. Filter tabs to ensure they belong to the target window
    const sameWindowTabs = validTabs.filter(t => t.windowId === targetWindowId);
    const finalTabIds = sameWindowTabs.map(t => t.id as number);

    if (finalTabIds.length === 0) {
        console.warn(`[createIsland] No tabs found for target window ${targetWindowId}`);
        return null;
    }
    
    // 4. Opera GX specific: If only one tab, create a companion tab in the SAME window
    if (finalTabIds.length === 1) {
      try {
        const sourceTab = sameWindowTabs[0];
        const newTab = await chrome.tabs.create({ 
          windowId: targetWindowId, 
          active: false,
          index: sourceTab.index + 1
        });
        if (newTab.id) {
          finalTabIds.push(newTab.id);
        }
      } catch (e) {
        console.warn('[createIsland] Could not create companion tab:', e);
      }
    }

    // 5. Create the group
    const groupId = await chrome.tabs.group({ 
      tabIds: finalTabIds as [number, ...number[]], 
      createProperties: { windowId: targetWindowId }
    });
    
    if (groupId && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      // Update properties (title, color)
      await updateTabGroup(groupId, { 
        title: title || '', 
        color: color || 'cyan'
      });
    }
    
    return groupId;
  } catch (error) {
    console.error('[createIsland] Grouping failed:', error);
    return null;
  }
};

export const ungroupTab = async (tabIds: number | number[]) => {
  try {
    return await withRetry(
      () => chrome.tabs.ungroup(tabIds as number | [number, ...number[]]),
      'ungroupTab'
    );
  } catch (error) {
    console.error(`[ungroupTab] Failed to ungroup tabs:`, error);
    throw error;
  }
};


export const updateTabGroup = async (groupId: number, properties: chrome.tabGroups.UpdateProperties): Promise<boolean> => {
  if (!Number.isInteger(groupId) || groupId <= 0) return false;
  
  try {
    return await withRetry(async () => {
      return new Promise((resolve, reject) => {
        chrome.tabGroups.update(groupId, properties, () => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || '';
            if (msg.includes('saved') || msg.includes('editable')) {
              reject(new Error(msg));
            } else {
              console.error(`[updateTabGroup] Error updating group ${groupId}:`, msg);
              resolve(false);
            }
          } else {
            resolve(true);
          }
        });
      });
    }, 'updateTabGroup');
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.includes('saved') || msg.includes('editable')) {
      console.warn(`[updateTabGroup] Group ${groupId} is not editable (likely saved):`, msg);
    } else {
      console.error(`[updateTabGroup] Fatal error updating group ${groupId}:`, error);
    }
    return false;
  }
};


export const updateTabGroupCollapse = async (groupId: number, collapsed: boolean): Promise<boolean> => {
  return updateTabGroup(groupId, { collapsed: !!collapsed });
};

export const discardTab = async (tabId: number) => {
  return chrome.tabs.discard(tabId);
};

export const discardTabs = async (tabIds: number[]) => {
  return Promise.all(tabIds.map(id => chrome.tabs.discard(id)));
};

export const closeTab = async (tabId: number) => {
  return chrome.tabs.remove(tabId);
};

export const copyTabUrl = async (tabId: number) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) {
    await navigator.clipboard.writeText(tab.url);
  }
};

export const muteTab = async (tabId: number) => {
  return chrome.tabs.update(tabId, { muted: true });
};

export const unmuteTab = async (tabId: number) => {
  return chrome.tabs.update(tabId, { muted: false });
};

export const pinTab = async (tabId: number) => {
  return chrome.tabs.update(tabId, { pinned: true });
};

export const unpinTab = async (tabId: number) => {
  return chrome.tabs.update(tabId, { pinned: false });
};

export const duplicateTab = async (tabId: number) => {
  return chrome.tabs.duplicate(tabId);
};

export const duplicateIsland = async (tabIds: number[], windowId?: number) => {
  // Get all tab URLs first
  const tabs = await Promise.all(tabIds.map(id => chrome.tabs.get(id).catch(() => null)));
  const validTabs = tabs.filter((t): t is chrome.tabs.Tab => t !== null && t.url !== undefined);

  // Create new tabs in the current window
  const newTabPromises = validTabs.map(tab =>
    chrome.tabs.create({
      windowId: tab.windowId,
      url: tab.url,
      active: tab.active,
      index: tab.index + 1
    })
  );

  const newTabs = await Promise.all(newTabPromises);
  const newTabIds = newTabs.map(t => t.id).filter((id): id is number => id !== undefined);

  // Group the new tabs
  if (newTabIds.length > 0) {
    const groupId = await chrome.tabs.group({ tabIds: newTabIds as [number, ...number[]] });
    // Update the group with a copy indicator
    await updateTabGroup(groupId, { title: 'Copy' });
  }

  return newTabIds;
};
