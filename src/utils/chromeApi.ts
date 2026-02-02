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

export const consolidateAndGroupTabs = async (tabIds: number[], options: { color?: string }) => {
  try {
    const targetWindow = await withRetry(
      () => chrome.windows.getLastFocused({ windowTypes: ['normal'] }),
      'getLastFocused'
    );
    
    if (!targetWindow.id) {
      console.error('[GroupSearchResults] No target window found');
      return;
    }

    const windowId = targetWindow.id;
    console.log(`[GroupSearchResults] Target window: ${windowId}`);

    
    const tabs = await Promise.all(
      tabIds.map(id => chrome.tabs.get(id).catch(() => null))
    );
    
    const restrictedUrlPatterns = ['chrome://', 'edge://', 'about:', 'opera:', 'chrome-extension:'];
    
    const validTabs = tabs.filter((t): t is chrome.tabs.Tab => {
      if (!t || t.id === undefined) return false;
      
      if (t.pinned) {
        console.log(`[GroupSearchResults] Skipping pinned tab ${t.id}: ${t.url}`);
        return false;
      }
      
      const isRestricted = restrictedUrlPatterns.some(pattern => t.url?.startsWith(pattern));
      
      if (isRestricted) {
        console.log(`[GroupSearchResults] Skipping restricted tab ${t.id}: ${t.url}`);
        return false;
      }
      
      return true;
    });

    if (validTabs.length === 0) {
      console.log('[GroupSearchResults] No valid tabs to process');
      return;
    }

    const tabsToGroup: number[] = [];
    
    for (const tab of validTabs) {
      if (tab.windowId !== windowId) {
        try {
          await withRetry(
            () => chrome.tabs.move(tab.id as number, { windowId, index: -1 }),
            `moveTab-${tab.id}`
          );
          console.log(`[GroupSearchResults] Moved tab ${tab.id} to window ${windowId} at end`);
          tabsToGroup.push(tab.id as number);
        } catch (error) {
          console.error(`[GroupSearchResults] Failed to move tab ${tab.id}:`, error);
        }
      } else {
        console.log(`[GroupSearchResults] Tab ${tab.id} already in target window ${windowId}`);
        tabsToGroup.push(tab.id as number);
      }
    }

    
    if (tabsToGroup.length >= 2) {
      try {
        const groupId = await withRetry(
          () => chrome.tabs.group({ tabIds: tabsToGroup as [number, ...number[]] }),
          'groupTabs'
        );
        
        console.log(`[GroupSearchResults] Created group ${groupId}`);

        
        // 1. Get all tabs in the target window (the single source of truth for indices)
        const allTabs = await withRetry(() => chrome.tabs.query({ windowId }), 'queryAllTabs');
        
        // 2. Find the highest index occupied by any group OTHER than our new one
        let targetIndex = 0;
        let lastGroupedTabId = -1;
        
        let newGroupStartIndex = -1;
        let newGroupSize = 0;

        for (const tab of allTabs) {
          // Track the new group's current position and size to correct index shift later
          if (String(tab.groupId) === String(groupId)) {
            if (newGroupStartIndex === -1) newGroupStartIndex = tab.index;
            newGroupSize++;
          }

          const isOtherGroup = tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && 
                               String(tab.groupId) !== String(groupId);
                               
          if (isOtherGroup) {
            if (tab.index + 1 > targetIndex) {
              targetIndex = tab.index + 1;
              lastGroupedTabId = tab.id || -1;
            }
          }
        }
        
        // CORRECTION: If moving the group from left to right, we must account for the indices shifting.
        // When the group (currently at low index) is picked up, all subsequent indices shift down by groupSize.
        if (newGroupStartIndex !== -1 && newGroupStartIndex < targetIndex) {
            console.log(`[GroupSearchResults] Adjusting target index ${targetIndex} by -${newGroupSize} (Left-to-Right Move)`);
            targetIndex = Math.max(0, targetIndex - newGroupSize);
        }
        
        console.log(`[GroupSearchResults] Calculated target position: ${targetIndex} (found after tab ${lastGroupedTabId})`);
        if (targetIndex === 0) {
          console.log('[GroupSearchResults] No other groups found, targeting index 0');
        }
        
        // 3. Move the entire group to that slot
        await withRetry(
          () => chrome.tabGroups.move(groupId, { index: targetIndex }),
          'moveGroup'
        );
        
        console.log(`[GroupSearchResults] Moved group ${groupId} to index ${targetIndex}`);

        
        if (options.color && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
          let groupColor = options.color;
          
          if (options.color === 'random') {
            const availableColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
            groupColor = availableColors[Math.floor(Math.random() * availableColors.length)];
          }
          
          await updateTabGroup(groupId, { color: groupColor as chrome.tabGroups.Color });
          console.log(`[GroupSearchResults] Applied color ${groupColor} to group ${groupId}`);
        }
      } catch (error) {
        console.error('[GroupSearchResults] Failed to group tabs:', error);
      }
    } else {
      console.log(`[GroupSearchResults] Only ${tabsToGroup.length} tab(s) in target window, not grouping`);
    }
    
  } catch (error) {
    console.error('[GroupSearchResults] Consolidation failed:', error);
  }
};
