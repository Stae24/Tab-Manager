import { create } from 'zustand';
import { Island, Tab, VaultItem } from '../types/index';
import { UniqueIdentifier } from '@dnd-kit/core';
import { createIsland, updateTabGroup, updateTabGroupCollapse } from '../utils/chromeApi';

// Universal ID for cross-panel compatibility
type UniversalId = number | string;

interface TabState {
  tabs: Tab[];
  groups: chrome.tabGroups.TabGroup[];
  islands: (Island | Tab)[]; 
  vault: VaultItem[];
  uiScale: number;
  theme: 'dark' | 'light';
  isDarkMode: boolean;
  dividerPosition: number;
  isUpdating: boolean;
  showVault: boolean;
  pendingRefresh: boolean;
  isRenaming: boolean;

  refreshTabs: () => Promise<void>;
  setIsUpdating: (val: boolean) => void;
  setIsRenaming: (val: boolean) => void;
  setUiScale: (scale: number) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setDividerPosition: (pos: number) => void;
  setShowVault: (show: boolean) => void;
  addToVault: (item: Island | Tab) => Promise<void>;
  saveToVault: (item: Island | Tab) => Promise<void>;
  restoreToLive: (item: VaultItem) => Promise<void>;
  removeFromVault: (id: UniversalId) => Promise<void>;
  renameGroup: (id: UniversalId, newTitle: string) => Promise<void>;
  createVaultGroup: () => Promise<void>;
  toggleVaultGroupCollapse: (id: UniversalId) => Promise<void>;
  toggleLiveGroupCollapse: (id: UniversalId) => Promise<void>;
  moveItemOptimistically: (activeId: UniqueIdentifier, overId: UniqueIdentifier) => void;
  deleteDuplicateTabs: () => Promise<void>;
}

const debounce = (fn: Function, ms = 500) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

const syncSettings = debounce((settings: any) => {
  chrome.storage.sync.set(settings);
}, 1000);

const persistVault = async (vault: VaultItem[]) => {
  await chrome.storage.local.set({ vault });
};

// Helper to extract numeric ID from prefixed strings
export const parseNumericId = (id: UniqueIdentifier): number => {
  const idStr = String(id);
  // Match the last sequence of digits in the string
  const match = idStr.match(/(\d+)$/);
  if (!match) return -1;
  const num = Number(match[1]);
  // Chrome tab group IDs must be positive integers (1 or greater)
  // We also check for safe integer and 32-bit limit to avoid Chrome API errors
  if (isNaN(num) || num <= 0 || !Number.isSafeInteger(num) || num > 2147483647) return -1;
  return num;
};

// Tactical Item Discovery
const findItemInList = (list: any[], id: UniqueIdentifier) => {
  const idStr = String(id);
  
  // Check root level first
  const rootIndex = list.findIndex(i => i && String(i.id) == idStr);
  if (rootIndex !== -1) {
    return { item: list[rootIndex], containerId: 'root', index: rootIndex };
  }
  
  // Check nested levels (tabs inside groups)
  for (const entry of list) {
    if (entry && (entry as any).tabs && Array.isArray((entry as any).tabs)) {
      const tabs = (entry as any).tabs;
      const tabIndex = tabs.findIndex((t: any) => String(t.id) == idStr);
      if (tabIndex !== -1) {
        return { item: tabs[tabIndex], containerId: entry.id, index: tabIndex };
      }
    }
  }
  return null;
};

export const useStore = create<TabState>((set, get) => ({
  tabs: [],
  groups: [],
  islands: [],
  vault: [],
  uiScale: 1,
  theme: 'dark',
  isDarkMode: true,
  dividerPosition: 50,
  isUpdating: false,
  showVault: true,
  pendingRefresh: false,
  isRenaming: false,

  setIsUpdating: (isUpdating) => set({ isUpdating }),
  setIsRenaming: (isRenaming) => set({ isRenaming }),

  moveItemOptimistically: (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
    const { islands, vault } = get();
    if (activeId === overId) return;

    const active = findItemInList(islands, activeId) || findItemInList(vault, activeId);
    const over = findItemInList(islands, overId) || findItemInList(vault, overId);

    // If active item not found, we can't proceed.
    // This usually means the item was deleted or the ID doesn't match.
    if (!active) {
        // Safety fallback: If we are in the middle of a drag, maybe the store updated?
        // We can't recover easily here. Returning prevents corruption.
        return;
    }

    // Detect Source and Target Panels
    // Source check: Is the active item inside the Live panel?
    const activeInLive = islands.some(i => i && (i.id == activeId || (i as any).tabs?.some((t: any) => t && t.id == activeId)));
    
    // Target check: Initialize to source location, then refine based on overId
    let targetIsLive = activeInLive;

    if (overId === 'live-panel-dropzone' || overId === 'live-panel-bottom') targetIsLive = true;
    else if (overId === 'vault-dropzone' || overId === 'vault-bottom') targetIsLive = false;
    else if (over) {
      // Check where the 'over' item actually resides
      const overInIslands = islands.some(i => i && (i.id == overId || (i as any).tabs?.some((t: any) => t && t.id == overId)));
      const overInVault = vault.some(v => v && (v.id == overId || (v as any).tabs?.some((t: any) => t && t.id == overId)));

      if (overInIslands) targetIsLive = true;
      else if (overInVault) targetIsLive = false;
      // If 'over' item is not found in either list (shouldn't happen), keep current panel
    }

    // BLOCK cross-panel optimistic movement to prevent state corruption during drag
    // If source panel != target panel, do not update UI state
    // This ensures internal moves (Vault->Vault, Live->Live) are always processed
    if (activeInLive !== targetIsLive) return;

    // Determine target index and container
    let targetContainerId: UniqueIdentifier = 'root';
    let targetIndex = -1;
    
    // Check if we are dragging a Group (Island)
    // Islands in Vault always have a 'tabs' array.
    const isActiveGroup = active.item && 'tabs' in active.item;

    // If dropped on the panel dropzone
    if (['live-panel-dropzone', 'vault-dropzone', 'live-panel-bottom', 'vault-bottom'].includes(String(overId))) {
      targetIndex = activeInLive ? islands.length : vault.length;
    }
    // If dropped on a gap between items (live-gap-X or vault-gap-X)
    else if (String(overId).startsWith('live-gap-') || String(overId).startsWith('vault-gap-')) {
      const isLiveGap = String(overId).startsWith('live-gap-');
      const gapIndex = parseInt(String(overId).split('-')[2], 10);
      targetIndex = isNaN(gapIndex) ? (activeInLive ? islands.length : vault.length) : gapIndex;
      targetContainerId = 'root';
    }
    // If dropped on an item
    else if (over) {
      targetContainerId = over.containerId;
      targetIndex = over.index;

      // Handle nesting: Dragging a tab over a group header
      // If dropped on group header, target the group itself
      if (over.item && 'tabs' in over.item && !isActiveGroup) {
        if (active.containerId === over.item.id) {
            // ALREADY INSIDE this group. Dropping on header means move OUT to root.
            targetContainerId = 'root';
            targetIndex = over.index;
        } else {
            // OUTSIDE this group. Dropping on header means move INSIDE.
            targetContainerId = over.item.id;
            // If collapsed, target the end of the group
            // If expanded, target the beginning (index 0)
            targetIndex = over.item.collapsed ? (over.item.tabs as any[]).length : 0;
        }
      }
      
      // CRITICAL FIX: Prevent Groups from being nested inside other groups.
      // If we are dragging a Group (Island) and targeting a nested container (not root),
      // we must redirect the drop to the Root level, adjacent to the parent group.
      if (isActiveGroup && targetContainerId !== 'root') {
          const currentRoot = activeInLive ? islands : vault;
          // Find the parent group of the item we are hovering over
          const parentGroupIndex = currentRoot.findIndex(i => String(i.id) === String(targetContainerId));
          
          if (parentGroupIndex !== -1) {
              targetContainerId = 'root';
              targetIndex = parentGroupIndex;
          } else {
              // Safety fallback: if we can't find the parent, abort to prevent corruption
              return;
          }
      }
      
      // FIX: When moving from OUTSIDE a group TO INSIDE a group and dropping on the LAST tab,
      // dnd-kit gives us the index of that tab. To insert at the end, we need index + 1.
      // Otherwise the new tab goes into the 2nd to last position instead of the last.
      if (active.containerId !== targetContainerId && over.item && !('tabs' in over.item)) {
          const targetGroup = (activeInLive ? islands : vault).find(i => String(i.id) === String(targetContainerId));
          if (targetGroup && 'tabs' in targetGroup && targetGroup.tabs && targetIndex === targetGroup.tabs.length - 1) {
              targetIndex = targetIndex + 1;
          }
      }
    }

    // Validation
    if (targetIndex === -1) return;
    if (active.containerId === targetContainerId && active.index === targetIndex) return;

    // Deep clone affected groups for immutable state updates
    const cloneWithDeepGroups = (list: any[]) => list.map(item => 
      item && 'tabs' in item ? { ...item, tabs: [...item.tabs] } : item
    );
    
    const newIslands = activeInLive ? cloneWithDeepGroups(islands) : [...islands];
    const newVault = activeInLive ? [...vault] : cloneWithDeepGroups(vault);
    const rootList = activeInLive ? newIslands : newVault;

    const getTargetList = (root: any[], cId: UniqueIdentifier) => {
      if (cId === 'root') return root;
      const cIdStr = String(cId);
      // Strict equality check
      const group = root.find(i => i && String(i.id) === cIdStr);
      if (group && Array.isArray(group.tabs)) return group.tabs;
      // Fallback: maybe the item was flattened?
      return null;
    };

    let sourceArr = getTargetList(rootList, active.containerId);
    let targetArr = getTargetList(rootList, targetContainerId);

    // Fallback safety: If sourceArr is null but we have valid active info, try to recover context
    if (!sourceArr && active.item) {
        // If we can't find the specific list, assume it's the root list if we are dragging a group
        // or if we can't find the parent, we can't proceed safely.
        return; 
    }
    if (!sourceArr || !targetArr) return;

    // CRITICAL: Verify item exists at active.index in sourceArr
    const sourceItem = sourceArr[active.index];
    
    // If index is wrong or item ID doesn't match, find the correct index
    if (!sourceItem || String(sourceItem.id) !== String(activeId)) {
        const correctIndex = sourceArr.findIndex((item: any) => String(item.id) === String(activeId));
        if (correctIndex === -1) {
            // Item completely missing from source array.
            // This causes the ghost to disappear. Return early to prevent corruption.
            return; 
        }
        active.index = correctIndex;
    }

    // Perform the move: Remove from source, Insert into target
    const [movedItem] = sourceArr.splice(active.index, 1);
    
    if (!movedItem) return; // Extraction failed

    // Clamp target index to valid bounds (ensure it's a number)
    const safeTargetIndex = Math.max(0, Math.min(Number(targetIndex), targetArr.length));
    
    // Insert at target position
    targetArr.splice(safeTargetIndex, 0, movedItem);

    if (activeInLive) {
        set({ islands: newIslands });
    } else {
        // Force new array reference to ensure update
        const finalVault = [...newVault];
        set({ vault: finalVault });
    }
  },

  refreshTabs: async () => {
    const state = get();
    
    // Instead of returning, queue the refresh if we are currently updating (e.g. dragging)
    if (state.isUpdating) {
      if (!state.pendingRefresh) {
        set({ pendingRefresh: true });
        // Poll for completion of the update lock
        const checkInterval = setInterval(() => {
          const currentState = get();
          if (!currentState.isUpdating && currentState.pendingRefresh) {
            clearInterval(checkInterval);
            set({ pendingRefresh: false });
            currentState.refreshTabs();
          }
        }, 100);
        
        // Safety timeout to prevent permanent lock
        setTimeout(() => {
          const currentState = get();
          if (currentState.pendingRefresh) {
            clearInterval(checkInterval);
            set({ pendingRefresh: false });
          }
        }, 5000);
      }
      return;
    }
    
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
      groupId: t.groupId
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

    const entities: (Island | Tab)[] = [];
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
    
    set({ tabs, groups: chromeGroups, islands: entities });
  },

  setUiScale: (uiScale) => {
    set({ uiScale });
    document.documentElement.style.setProperty('--ui-scale', uiScale.toString());
    syncSettings({ uiScale });
  },

  setTheme: (theme) => {
    const isDarkMode = theme === 'dark';
    set({ theme, isDarkMode });
    document.documentElement.classList.toggle('dark', isDarkMode);
    syncSettings({ theme });
  },

  toggleTheme: () => {
    const { theme } = get();
    get().setTheme(theme === 'dark' ? 'light' : 'dark');
  },

  setDividerPosition: (dividerPosition) => {
    set({ dividerPosition });
    syncSettings({ dividerPosition });
  },

  setShowVault: (showVault) => {
    set({ showVault });
    syncSettings({ showVault });
  },

  addToVault: async (item) => {
    const { vault } = get();
    let newItem = JSON.parse(JSON.stringify(item));
    const timestamp = Date.now();

    const transformId = (i: any) => {
      i.id = `vault-${i.id}-${timestamp}`;
      if (i.tabs) i.tabs.forEach(transformId);
    };
    
    transformId(newItem);
    newItem.savedAt = timestamp;

    // Previously wrapped single tabs in groups here. 
    // Now allowing direct tab additions to vault.

    const newVault = [...vault, newItem];
    set({ vault: newVault });
    await persistVault(newVault);
  },

  saveToVault: async (item) => {
    const { vault } = get();
    let newItem = JSON.parse(JSON.stringify(item));
    const timestamp = Date.now();

    const transformId = (i: any) => {
      i.id = `vault-${i.id}-${timestamp}`;
      if (i.tabs) i.tabs.forEach(transformId);
    };
    
    transformId(newItem);
    newItem.savedAt = timestamp;

    // Non-destructive save - just add to vault without closing tabs

    const newVault = [...vault, newItem];
    set({ vault: newVault });
    await persistVault(newVault);
  },

  restoreToLive: async (item) => {
    const { vault } = get();

    // Calculate insertion index: after the last existing group in the current window
    let insertionIndex = 0;
    const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
    const currentWindowGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    if (currentWindowGroups.length > 0) {
      // Find the group with the highest index (last group in the window)
      // We sort groups by the index of their first tab
      const groupsWithIndices = currentWindowGroups.map(g => {
        const groupTabs = currentWindowTabs.filter(t => t.groupId === g.id);
        const minIndex = groupTabs.length > 0 ? Math.min(...groupTabs.map(t => t.index)) : -1;
        const maxIndex = groupTabs.length > 0 ? Math.max(...groupTabs.map(t => t.index)) : -1;
        return { ...g, minIndex, maxIndex };
      }).filter(g => g.minIndex !== -1);

      if (groupsWithIndices.length > 0) {
        const lastGroup = groupsWithIndices.reduce((prev, current) => (current.maxIndex > prev.maxIndex) ? current : prev);
        insertionIndex = lastGroup.maxIndex + 1;
      }
    }

    // Type guard to check if item is an Island
    const isIsland = (item: VaultItem): item is Island & { savedAt: number; id: string | number; } => {
      return 'tabs' in item && Array.isArray(item.tabs);
    };

    if (isIsland(item)) {
      // Restore as a group
      const newIds: number[] = [];
      for (const t of item.tabs) {
        const nt = await chrome.tabs.create({ url: t.url, active: false, index: insertionIndex + newIds.length });
        if (nt.id) newIds.push(nt.id);
      }
      if (newIds.length > 0) {
        await createIsland(newIds, item.title, item.color as any);
      }
    } else {
      // Restore as a single tab
      await chrome.tabs.create({ url: item.url, active: false, index: insertionIndex });
    }
  },

  createVaultGroup: async () => {
    const { vault } = get();
    const timestamp = Date.now();
    const newGroup = {
      id: `vault-group-new-${timestamp}`,
      title: '',
      color: 'grey',
      collapsed: false,
      tabs: [],
      savedAt: timestamp
    };
    // Add to top
    const newVault = [newGroup, ...vault];
    set({ vault: newVault });
    await persistVault(newVault);
  },

  renameGroup: async (id, newTitle) => {
    const { vault, isUpdating } = get();
    const idStr = String(id);
    
    if (idStr.startsWith('vault-')) {
      const newVault = vault.map(item => {
        if (String(item.id) === idStr && 'tabs' in item) {
          return { ...item, title: newTitle };
        }
        return item;
      });
      set({ vault: newVault });
      if (!isUpdating) await persistVault(newVault);
    } else {
      // Live panel group rename
      const numericId = parseNumericId(id);
      if (numericId > 0) {
        await updateTabGroup(numericId, { title: newTitle });
      }
    }
  },

  toggleVaultGroupCollapse: async (id) => {
    const { vault, isUpdating } = get();
    const idStr = String(id);
    if (!idStr.startsWith('vault-')) return;

    const newVault = vault.map(item => {
      if (String(item.id) === idStr && 'tabs' in item) {
        return { ...item, collapsed: !item.collapsed };
      }
      return item;
    });
    set({ vault: newVault });
    if (!isUpdating) await persistVault(newVault);
  },

  toggleLiveGroupCollapse: async (id) => {
    const { islands, setIsUpdating } = get();
    const idStr = String(id);
    const numericId = parseNumericId(id);

    // Only process Live groups (not Vault items)
    if (idStr.startsWith('vault-') || numericId <= 0) return;

    // Find the island and get its current collapsed state
    const targetIsland = islands.find(i => String(i.id) === idStr && 'tabs' in i);
    if (!targetIsland) return;

    const newCollapsedState = !(targetIsland as Island).collapsed;

    // Optimistically update UI state
    const newIslands = islands.map(item => {
      if (String(item.id) === idStr && 'tabs' in item) {
        return { ...item, collapsed: newCollapsedState };
      }
      return item;
    });
    set({ islands: newIslands });

    // Set lock to prevent snap-back during API call
    setIsUpdating(true);

    // Try to update Chrome tab group using robust wrapper
    const success = await updateTabGroupCollapse(numericId, newCollapsedState);
    
    setIsUpdating(false);

    if (!success) {
      // Revert optimistic update on failure
      const revertIslands = islands.map(item => {
        if (String(item.id) === idStr && 'tabs' in item) {
          return { ...item, collapsed: !newCollapsedState };
        }
        return item;
      });
      set({ islands: revertIslands });
    }
  },

  removeFromVault: async (id) => {
    const { vault } = get();
    const newVault = vault.filter(v => v && v.id != id);
    set({ vault: newVault });
    await persistVault(newVault);
  },

  deleteDuplicateTabs: async () => {
    try {
      console.log('[Deduplicator] Starting deduplication process...');
      
      // Query all tabs in the current window
      // We use currentWindow: true as it's the most common and reliable way to target the active workspace
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      console.log(`[Deduplicator] Found ${currentTabs.length} tabs to analyze`);

      // Group tabs by normalized URL
      const urlMap = new Map<string, chrome.tabs.Tab[]>();
      currentTabs.forEach(tab => {
        const urlString = tab.url || tab.pendingUrl;
        if (urlString) {
          try {
            const url = new URL(urlString);
            // Robust normalization for comparison:
            // - Protocol and host: lowercase
            // - Path: lowercase, remove trailing slash
            // - Search: PRESERVE CASE (YouTube IDs are case-sensitive)
            // - Hash: Ignore
            const normalized = `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '').toLowerCase()}${url.search}`;
            const existing = urlMap.get(normalized) || [];
            urlMap.set(normalized, [...existing, tab]);
          } catch (e) {
            // Fallback for non-standard URLs
            const normalized = urlString.split('#')[0].trim().replace(/\/+$/, '');
            const existing = urlMap.get(normalized) || [];
            urlMap.set(normalized, [...existing, tab]);
          }
        }
      });

      const toCloseIds = new Set<number>();
      urlMap.forEach((group, url) => {
        if (group.length > 1) {
          console.log(`[Deduplicator] Found ${group.length} occurrences for URL: ${url}`);
          
          // Sort by index to keep the leftmost tab
          group.sort((a, b) => (a.index || 0) - (b.index || 0));

          // Strategy: Keep the active tab if it's in this group, otherwise keep the first one
          const activeTab = group.find(t => t.active);
          const keepTab = activeTab || group[0];
          
          console.log(`[Deduplicator] Keeping tab ID: ${keepTab.id} (index: ${keepTab.index}, active: ${keepTab.active})`);

          group.forEach(tab => {
            if (tab.id !== keepTab.id && typeof tab.id === 'number') {
              toCloseIds.add(tab.id);
            }
          });
        }
      });

      if (toCloseIds.size === 0) {
        console.log('[Deduplicator] No duplicates found in current window.');
        return;
      }

      const idsArray = Array.from(toCloseIds);
      console.log(`[Deduplicator] Identified ${idsArray.length} tabs to close:`, idsArray);

      // Robust Removal Process
      // We use individual removal with try-catch as it's the most reliable across different browsers/versions
      // especially in Opera GX which has custom tab management layers.
      let closedCount = 0;
      for (const id of idsArray) {
        try {
          // Double check the tab still exists and is a valid number
          if (typeof id === 'number' && !isNaN(id)) {
            await chrome.tabs.remove(id);
            closedCount++;
            console.log(`[Deduplicator] Closed tab: ${id}`);
          }
        } catch (e) {
          console.warn(`[Deduplicator] Failed to close tab ${id} (it may have been closed already):`, e);
        }
      }

      console.log(`[Deduplicator] Successfully closed ${closedCount} tabs.`);
      
      // Force a UI refresh
      await get().refreshTabs();
      
    } catch (error) {
      console.error("[Deduplicator] Fatal error during deduplication:", error);
    }
  }
}));

// Cross-Window Sync Initialization
const init = async () => {
  const [sync, local] = await Promise.all([
    chrome.storage.sync.get(['uiScale', 'theme', 'dividerPosition', 'showVault']),
    chrome.storage.local.get(['vault'])
  ]);

  const state = useStore.getState();
  if (sync.uiScale) state.setUiScale(Number(sync.uiScale));
  if (sync.theme) state.setTheme(sync.theme as 'dark' | 'light');
  if (sync.dividerPosition) state.setDividerPosition(Number(sync.dividerPosition));
  if (sync.showVault !== undefined) state.setShowVault(Boolean(sync.showVault));
  if (local.vault) useStore.setState({ vault: local.vault as VaultItem[] });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.vault) {
      // Don't overwrite vault during optimistic updates or drag operations
      // This prevents vault state from being corrupted when user is actively reordering items
      if (!useStore.getState().isUpdating) {
        useStore.setState({ vault: changes.vault.newValue as VaultItem[] });
      }
    }
    if (area === 'sync') {
       if (changes.uiScale) state.setUiScale(Number(changes.uiScale.newValue));
       if (changes.theme) state.setTheme(changes.theme.newValue as 'dark' | 'light');
       if (changes.showVault) state.setShowVault(Boolean(changes.showVault.newValue));
    }
  });
};

init();
