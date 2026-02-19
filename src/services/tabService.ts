import { Tab, Island, LiveItem } from '../types/index';
import { MAX_SYNC_RETRIES, TAB_ACTION_RETRY_DELAY_BASE } from '../constants';
import { logger } from '../utils/logger';
import { getCachedCapabilities, needsCompanionTabForSingleTabGroup, getBrowserCapabilities } from '../utils/browser';

const withRetry = async <T>(fn: () => Promise<T>, label: string, maxAttempts = MAX_SYNC_RETRIES): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isRetryable = msg.includes('Tab cannot be modified') || 
                         msg.includes('dragging') || 
                         msg.includes('moving') ||
                         msg.includes('tabs cannot be edited') ||
                         msg.includes('editable');
      
      if (isRetryable && attempt < maxAttempts) {
        const delay = TAB_ACTION_RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        logger.warn(`[${label}] Attempt ${attempt} failed. Retrying in ${delay}ms...`, msg);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const tabService = {
  getLiveTabsAndGroups: async (): Promise<LiveItem[]> => {
    const [chromeTabs, chromeGroups] = await Promise.all([
      chrome.tabs.query({ currentWindow: true }),
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
    ]);

    const tabs: Tab[] = chromeTabs.map(t => ({
      id: `live-tab-${t.id}`,
      title: t.title || 'Untitled',
      url: t.url || '',
      favicon: t.favIconUrl || '',
      active: t.active,
      discarded: t.discarded,
      windowId: t.windowId,
      index: t.index,
      groupId: t.groupId,
      muted: t.mutedInfo?.muted ?? false,
      pinned: t.pinned,
      audible: t.audible ?? false
    }));

    const groupMap = new Map<number, Island>();
    chromeGroups.forEach(g => {
      groupMap.set(g.id, {
        id: `live-group-${g.id}`,
        title: g.title || '',
        color: g.color,
        collapsed: g.collapsed,
        tabs: []
      });
    });

    tabs.forEach(t => {
      if (t.groupId !== -1 && groupMap.has(t.groupId)) {
        groupMap.get(t.groupId)!.tabs.push(t);
      }
    });

    const entities: LiveItem[] = [];
    const processedGroupIds = new Set<number>();

    tabs.sort((a, b) => a.index - b.index).forEach(t => {
      if (t.groupId === -1) {
        entities.push(t);
      } else if (!processedGroupIds.has(t.groupId)) {
        const group = groupMap.get(t.groupId);
        if (group) {
          entities.push(group);
          processedGroupIds.add(t.groupId);
        }
      }
    });

    return entities;
  },

  moveIsland: async (groupId: number, index: number, windowId?: number) => {
    try {
      let targetWindowId = windowId;
      if (targetWindowId === chrome.windows.WINDOW_ID_CURRENT || targetWindowId === -1) {
        const currentWindow = await chrome.windows.getCurrent();
        targetWindowId = currentWindow.id;
      }
      return await withRetry(
        () => chrome.tabGroups.move(groupId, { index, windowId: targetWindowId }),
        'moveIsland'
      );
    } catch (error) {
      logger.error(`[moveIsland] Failed to move group ${groupId} to index ${index} (window ${windowId}):`, error);
      throw error;
    }
  },

  moveTab: async (tabId: number, index: number, windowId?: number) => {
    try {
      return await withRetry(
        () => chrome.tabs.move(tabId, { index, windowId }),
        'moveTab'
      );
    } catch (error) {
      logger.error(`[moveTab] Failed to move tab ${tabId} to index ${index} (window ${windowId}):`, error);
      throw error;
    }
  },

  createIsland: async (tabIds: number[], title?: string, color?: chrome.tabGroups.Color, windowId?: number): Promise<number | null> => {
    try {
      const tabs = await Promise.all(
        tabIds.map(id => chrome.tabs.get(id).catch(() => null))
      );
      const validTabs = tabs.filter((t): t is chrome.tabs.Tab => t !== null && t.id !== undefined);
      
      if (validTabs.length === 0) return null;

      let targetWindowId: number | undefined = windowId;

      if (targetWindowId === chrome.windows.WINDOW_ID_CURRENT) {
          const currentWindow = await chrome.windows.getCurrent();
          targetWindowId = currentWindow.id;
      }

      if (!targetWindowId) {
        const windowCounts = new Map<number, number>();
        validTabs.forEach(t => {
          const wid = t.windowId;
          windowCounts.set(wid, (windowCounts.get(wid) || 0) + 1);
        });
        
        let maxCount = -1;
        targetWindowId = validTabs[0].windowId; 

        for (const [wid, count] of windowCounts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            targetWindowId = wid;
          }
        }
      }

      const sameWindowTabs = validTabs.filter(t => t.windowId === targetWindowId);
      const finalTabIds = sameWindowTabs.map(t => t.id as number);

      if (finalTabIds.length === 0) {
          logger.warn(`[createIsland] No tabs found for target window ${targetWindowId}`);
          return null;
      }
      
      await getBrowserCapabilities();
      
      if (finalTabIds.length === 1 && needsCompanionTabForSingleTabGroup()) {
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
          logger.warn('[createIsland] Could not create companion tab:', e);
        }
      }

      const groupId = await chrome.tabs.group({ 
        tabIds: finalTabIds as [number, ...number[]], 
        createProperties: { windowId: targetWindowId }
      });
      
      if (groupId && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        await tabService.updateTabGroup(groupId, { 
          title: title || '', 
          color: color || 'cyan'
        });
      }
      
      return groupId;
    } catch (error) {
      logger.error('[createIsland] Grouping failed:', error);
      return null;
    }
  },

  ungroupTab: async (tabIds: number | number[]) => {
    try {
      return await withRetry(
        () => chrome.tabs.ungroup(tabIds as number | [number, ...number[]]),
        'ungroupTab'
      );
    } catch (error) {
      logger.error(`[ungroupTab] Failed to ungroup tabs:`, error);
      throw error;
    }
  },

  updateTabGroup: async (groupId: number, properties: chrome.tabGroups.UpdateProperties): Promise<boolean> => {
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
                logger.error(`[updateTabGroup] Error updating group ${groupId}:`, msg);
                resolve(false);
              }
            } else {
              resolve(true);
            }
          });
        });
      }, 'updateTabGroup');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('saved') || msg.includes('editable')) {
        logger.warn(`[updateTabGroup] Group ${groupId} is not editable (likely saved):`, msg);
      } else {
        logger.error(`[updateTabGroup] Fatal error updating group ${groupId}:`, error);
      }
      return false;
    }
  },

  updateTabGroupCollapse: async (groupId: number, collapsed: boolean): Promise<boolean> => {
    const success = await tabService.updateTabGroup(groupId, { collapsed: !!collapsed });
    
    if (success) {
      try {
        const group = await chrome.tabGroups.get(groupId);
        const changeApplied = group.collapsed === collapsed;
        
        if (changeApplied) {
          const cached = getCachedCapabilities();
          if (cached?.vendor === 'brave') {
            const tabs = await chrome.tabs.query({ groupId });
            if (tabs.length > 0 && tabs[0].id !== undefined) {
              const dummyTab = await chrome.tabs.create({ url: 'about:blank', windowId: tabs[0].windowId, active: false });
              if (dummyTab.id !== undefined) {
                try {
                  await chrome.tabs.group({ groupId, tabIds: dummyTab.id });
                  await chrome.tabs.ungroup(dummyTab.id);
                } finally {
                  try {
                    await chrome.tabs.remove(dummyTab.id);
                  } catch {
                    // Tab may already be removed; ignore errors
                  }
                }
              }
            }
          }
        }
        
        if (!changeApplied) {
          return false;
        }
      } catch (error) {
        logger.warn('[updateTabGroupCollapse] Could not verify collapse state:', error);
      }
    }
    
    return success;
  },

  discardTab: async (tabId: number) => {
    return chrome.tabs.discard(tabId);
  },

  discardTabs: async (tabIds: number[]) => {
    return Promise.all(tabIds.map(id => chrome.tabs.discard(id)));
  },

  closeTab: async (tabId: number) => {
    return chrome.tabs.remove(tabId);
  },

  closeTabs: async (tabIds: number | number[]) => {
    if (Array.isArray(tabIds)) {
      return chrome.tabs.remove(tabIds);
    }
    return chrome.tabs.remove(tabIds);
  },

  copyTabUrl: async (tabId: number) => {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      await navigator.clipboard.writeText(tab.url);
    }
  },

  muteTab: async (tabId: number) => {
    return chrome.tabs.update(tabId, { muted: true });
  },

  unmuteTab: async (tabId: number) => {
    return chrome.tabs.update(tabId, { muted: false });
  },

  pinTab: async (tabId: number) => {
    return chrome.tabs.update(tabId, { pinned: true });
  },

  unpinTab: async (tabId: number) => {
    return chrome.tabs.update(tabId, { pinned: false });
  },

  duplicateTab: async (tabId: number) => {
    return chrome.tabs.duplicate(tabId);
  },

  duplicateIsland: async (tabIds: number[], windowId?: number) => {
    const tabs = await Promise.all(tabIds.map(id => chrome.tabs.get(id).catch(() => null)));
    const validTabs = tabs.filter((t): t is chrome.tabs.Tab => t !== null && t.url !== undefined);

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

    if (newTabIds.length > 0) {
      const groupId = await chrome.tabs.group({ tabIds: newTabIds as [number, ...number[]] });
      await tabService.updateTabGroup(groupId, { title: 'Copy' });
    }

    return newTabIds;
  },

  getCurrentWindowTabs: async (): Promise<chrome.tabs.Tab[]> => {
    return chrome.tabs.query({ currentWindow: true });
  },

  getCurrentWindowGroups: async (): Promise<chrome.tabGroups.TabGroup[]> => {
    return chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  },

  createTab: async (options: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> => {
    return chrome.tabs.create(options);
  },

  consolidateAndGroupTabs: async (tabIds: number[], options: { color?: string }) => {
    try {
      const targetWindow = await withRetry(
        () => chrome.windows.getLastFocused({ windowTypes: ['normal'] }),
        'getLastFocused'
      );
      
      if (!targetWindow.id) {
        logger.error('[GroupSearchResults] No target window found');
        return;
      }

      const windowId = targetWindow.id;
      
      const tabs = await Promise.all(
        tabIds.map(id => chrome.tabs.get(id).catch(() => null))
      );
      
      const restrictedUrlPatterns = ['about:', 'chrome:', 'edge:', 'opera:', 'brave:', 'chrome-extension:'];
      
      const validTabs = tabs.filter((t): t is chrome.tabs.Tab => {
        if (!t || t.id === undefined) return false;
        if (t.pinned) return false;
        const isRestricted = restrictedUrlPatterns.some(pattern => t.url?.startsWith(pattern));
        if (isRestricted) return false;
        return true;
      });

      if (validTabs.length === 0) return;

      const tabsToGroup: number[] = [];
      
      for (const tab of validTabs) {
        if (tab.windowId !== windowId) {
          try {
            await withRetry(
              () => chrome.tabs.move(tab.id as number, { windowId, index: -1 }),
              `moveTab-${tab.id}`
            );
            tabsToGroup.push(tab.id as number);
          } catch (error) {
            logger.error(`[GroupSearchResults] Failed to move tab ${tab.id}:`, error);
          }
        } else {
          tabsToGroup.push(tab.id as number);
        }
      }

      if (tabsToGroup.length >= 2) {
        try {
          const groupId = await withRetry(
            () => chrome.tabs.group({ tabIds: tabsToGroup as [number, ...number[]] }),
            'groupTabs'
          );
          
          const allTabs = await withRetry(() => chrome.tabs.query({ windowId }), 'queryAllTabs');
          
          let targetIndex = 0;
          let newGroupStartIndex = -1;
          let newGroupSize = 0;

          for (const tab of allTabs) {
            if (String(tab.groupId) === String(groupId)) {
              if (newGroupStartIndex === -1) newGroupStartIndex = tab.index;
              newGroupSize++;
            }

            const isOtherGroup = tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && 
                                 String(tab.groupId) !== String(groupId);
                                 
            if (isOtherGroup) {
              if (tab.index + 1 > targetIndex) {
                targetIndex = tab.index + 1;
              }
            }
          }
          
          if (newGroupStartIndex !== -1 && newGroupStartIndex < targetIndex) {
              targetIndex = Math.max(0, targetIndex - newGroupSize);
          }
          
          await withRetry(
            () => chrome.tabGroups.move(groupId, { index: targetIndex }),
            'moveGroup'
          );
          
          if (options.color && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
            let groupColor = options.color;
            
            if (options.color === 'random') {
              const availableColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
              groupColor = availableColors[Math.floor(Math.random() * availableColors.length)];
            }
            
            await tabService.updateTabGroup(groupId, { color: groupColor as chrome.tabGroups.Color });
          }
        } catch (error) {
          logger.error('[GroupSearchResults] Failed to group tabs:', error);
        }
      }
    } catch (error) {
      logger.error('[GroupSearchResults] Consolidation failed:', error);
    }
  }
};
