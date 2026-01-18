export const moveIsland = async (groupId: number, index: number, windowId?: number) => {
  return chrome.tabGroups.move(groupId, { index, windowId });
};

export const moveTab = async (tabId: number, index: number, windowId?: number) => {
  return chrome.tabs.move(tabId, { index, windowId });
};

export const createIsland = async (tabIds: number[], title?: string, color?: chrome.tabGroups.Color, windowId?: number): Promise<number | null> => {
  try {
    const validIds = [...tabIds.filter(id => typeof id === 'number' && id > 0)];
    if (validIds.length === 0) return null;
    
    // Opera GX specific: If only one tab, create a secondary new tab to prevent the group from auto-disbanding.
    if (validIds.length === 1) {
      try {
        const sourceTab = await chrome.tabs.get(validIds[0]);
        const newTab = await chrome.tabs.create({ 
          windowId: sourceTab.windowId, 
          active: false,
          index: sourceTab.index + 1
        });
        if (newTab.id) {
          validIds.push(newTab.id);
        }
      } catch (e) {
        console.warn('[createIsland] Could not create companion tab:', e);
      }
    }

    // Create the group with all identified tabs
    const groupId = await chrome.tabs.group({ 
      tabIds: validIds as [number, ...number[]], 
      createProperties: windowId ? { windowId } : undefined
    });
    
    if (groupId && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      console.log(`[createIsland] Group ${groupId} created. Syncing...`);
      
      const maxWaitTime = 2000;
      const pollInterval = 100;
      let synced = false;
      
      for (let i = 0; i < maxWaitTime / pollInterval; i++) {
        try {
          const tab = await chrome.tabs.get(validIds[0]);
          if (tab.groupId === groupId) {
            synced = true;
            break;
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, pollInterval));
      }
      
      if (synced) {
        // Only update properties if title or color is EXPLICITLY provided.
        // If title is empty/missing, we leave the group as "Untitled" (no name).
        if (title || color) {
          for (let i = 0; i < 3; i++) {
            const success = await updateTabGroup(groupId, { 
              title: title || '', // Empty string for no name
              color: color || ('cyan' as any)
            });
            if (success) break;
            await new Promise(r => setTimeout(r, 100));
          }
        } else {
            // Default behavior for manual creation: ensure no title is set
            await updateTabGroup(groupId, { title: '', color: 'cyan' as any });
        }
      }
    }
    
    return groupId;
  } catch (error) {
    console.error('[createIsland] Grouping failed:', error);
    return null;
  }
};

export const ungroupTab = async (tabIds: number | number[]) => {
  return chrome.tabs.ungroup(tabIds as number | [number, ...number[]]);
};

export const updateTabGroup = async (groupId: number, properties: chrome.tabGroups.UpdateProperties): Promise<boolean> => {
  if (!Number.isInteger(groupId) || groupId <= 0) return false;
  
  return new Promise((resolve) => {
    try {
      chrome.tabGroups.update(groupId, properties, () => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || '';
          if (msg.includes('saved') || msg.includes('editable')) {
            console.warn(`[updateTabGroup] Group ${groupId} is not editable (likely saved):`, msg);
          } else {
            console.error(`[updateTabGroup] Error updating group ${groupId}:`, msg);
          }
          resolve(false);
        } else {
          resolve(true);
        }
      });
    } catch (e) {
      console.error(`[updateTabGroup] Fatal error updating group ${groupId}:`, e);
      resolve(false);
    }
  });
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
