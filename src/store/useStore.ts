import { create } from 'zustand';
import { Island, Tab, VaultItem, UniversalId, LiveItem, VaultQuotaInfo, VaultStorageResult } from '../types/index';
import { UniqueIdentifier } from '@dnd-kit/core';
import { createIsland, updateTabGroup, updateTabGroupCollapse, closeTab, discardTabs, moveIsland, moveTab } from '../utils/chromeApi';
import { saveVault, loadVault, migrateFromLegacy, getVaultQuota, toggleSyncMode } from '../utils/vaultStorage';

// Appearance settings types - exported for components
export type ThemeMode = 'dark' | 'light' | 'system';
export type AnimationIntensity = 'full' | 'subtle' | 'off';
export type AudioIndicatorMode = 'off' | 'playing' | 'muted' | 'both';
export type BorderRadius = 'none' | 'small' | 'medium' | 'large' | 'full';
export type ButtonSize = 'small' | 'medium' | 'large';
export type IconPack = 'gx' | 'default' | 'minimal';
export type MenuPosition = 'left' | 'center' | 'right';

interface AppearanceSettings {
  // v1 - Essential
  theme: ThemeMode;
  uiScale: number;
  settingsScale: number;
  tabDensity: 'minified' | 'compact' | 'normal' | 'spacious';
  animationIntensity: AnimationIntensity;

  // v1.1 - High Value
  showFavicons: boolean;
  showAudioIndicators: AudioIndicatorMode;
  showFrozenIndicators: boolean;
  showActiveIndicator: boolean;

  // v1.2 - Polish
  accentColor: string;
  borderRadius: BorderRadius;
  compactGroupHeaders: boolean;
  buttonSize: ButtonSize;
  iconPack: IconPack;

  // v2 - Nice to Have
  customFontFamily?: string;
  dragOpacity: number;
  loadingSpinnerStyle: 'pulse' | 'dots' | 'bars' | 'ring';
  menuPosition: MenuPosition;
  
  // v2.1 - Storage
  vaultSyncEnabled: boolean;
}

// Export default appearance settings for reset functionality
export const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'system',
  uiScale: 1,
  settingsScale: 1,
  tabDensity: 'normal',
  animationIntensity: 'full',
  showFavicons: true,
  showAudioIndicators: 'both',
  showFrozenIndicators: true,
  showActiveIndicator: true,
  accentColor: 'gx-accent',
  borderRadius: 'medium',
  compactGroupHeaders: false,
  buttonSize: 'medium',
  iconPack: 'gx',
  customFontFamily: undefined,
  dragOpacity: 0.5,
  loadingSpinnerStyle: 'pulse',
  menuPosition: 'left',
  vaultSyncEnabled: true,
};

interface TabState {
  // Core State
  islands: LiveItem[];
  vault: VaultItem[];
  
  // UI State
  appearanceSettings: AppearanceSettings;
  isDarkMode: boolean;
  dividerPosition: number;
  isUpdating: boolean;
  showVault: boolean;
  pendingRefresh: boolean;
  isRenaming: boolean;
  isRefreshing: boolean;
  
  // Quota State
  vaultQuota: VaultQuotaInfo | null;
  quotaExceededPending: VaultStorageResult | null;

  // Actions
  syncLiveTabs: () => Promise<void>;
  setIsUpdating: (val: boolean) => void;
  setIsRenaming: (val: boolean) => void;
  setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
  toggleTheme: () => void;
  setDividerPosition: (pos: number) => void;
  setShowVault: (show: boolean) => void;
  
  // Vault Actions
  moveToVault: (id: UniversalId) => Promise<void>;
  saveToVault: (item: LiveItem) => Promise<void>;
  restoreFromVault: (id: UniversalId) => Promise<void>;
  removeFromVault: (id: UniversalId) => Promise<void>;
  createVaultGroup: () => Promise<void>;
  reorderVault: (newVault: VaultItem[]) => Promise<void>;
  toggleVaultGroupCollapse: (id: UniversalId) => Promise<void>;
  sortVaultGroupsToTop: () => Promise<void>;
  
  // Quota Actions
  refreshVaultQuota: () => Promise<void>;
  clearQuotaExceeded: () => void;
  setVaultSyncEnabled: (enabled: boolean) => Promise<VaultStorageResult>;
  
  // Live Actions
  renameGroup: (id: UniversalId, newTitle: string) => Promise<void>;
  toggleLiveGroupCollapse: (id: UniversalId) => Promise<void>;
  moveItemOptimistically: (activeId: UniqueIdentifier, overId: UniqueIdentifier) => void;
  deleteDuplicateTabs: () => Promise<void>;
  sortGroupsToTop: () => Promise<void>;
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

const persistVault = async (vault: VaultItem[], syncEnabled: boolean): Promise<VaultStorageResult> => {
  const result = await saveVault(vault, { syncEnabled });
  
  // Always refresh quota information after a save to keep UI reactive
  const quota = await getVaultQuota();
  useStore.setState({ vaultQuota: quota });

  if (!result.success && result.error === 'QUOTA_EXCEEDED') {
    useStore.setState({ quotaExceededPending: result });
  }
  return result;
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

const isIsland = (item: any): item is Island => {
  return item && typeof item === 'object' && 'tabs' in item && Array.isArray(item.tabs);
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
  islands: [],
  vault: [],
  appearanceSettings: { ...defaultAppearanceSettings },
  isDarkMode: true,
  dividerPosition: 50,
  isUpdating: false,
  showVault: true,
  pendingRefresh: false,
  isRenaming: false,
  isRefreshing: false,
  vaultQuota: null,
  quotaExceededPending: null,

  setIsUpdating: (isUpdating) => set({ isUpdating }),
  setIsRenaming: (isRenaming) => set({ isRenaming }),
  
  refreshVaultQuota: async () => {
    const quota = await getVaultQuota();
    set({ vaultQuota: quota });
  },
  
  clearQuotaExceeded: () => set({ quotaExceededPending: null }),
  
  setVaultSyncEnabled: async (enabled: boolean) => {
    const { vault, appearanceSettings } = get();
    const result = await toggleSyncMode(vault, enabled);
    
    if (result.success) {
      const updated = { ...appearanceSettings, vaultSyncEnabled: enabled };
      set({ appearanceSettings: updated });
      // Consolidate sync to a single appearanceSettings key to avoid redundant onChanged events
      syncSettings({ appearanceSettings: updated });
      
      const quota = await getVaultQuota();
      set({ vaultQuota: quota });
    }
    
    return result;
  },
  
  setAppearanceSettings: (newSettings) => {
    const current = get().appearanceSettings;
    const updated = { ...current, ...newSettings };
    set({ appearanceSettings: updated });

    // Apply theme changes immediately
    if (newSettings.theme) {
      const { theme } = updated;
      const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      set({ isDarkMode });
      document.documentElement.classList.toggle('dark', isDarkMode);
    }

    // Apply accent color immediately
    if (newSettings.accentColor) {
      document.documentElement.style.setProperty('--gx-accent', newSettings.accentColor);
    }

    syncSettings({ appearanceSettings: updated });
  },

  moveItemOptimistically: (() => {
    let pendingId: UniqueIdentifier | null = null;
    let pendingOverId: UniqueIdentifier | null = null;
    let updateScheduled = false;

    return (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
      // Debounce rapid drag-over events to prevent excessive state updates
      // which can cause React error #185 (too many re-renders)
      pendingId = activeId;
      pendingOverId = overId;

      if (updateScheduled) return;
      updateScheduled = true;

      // Use requestAnimationFrame for smooth updates aligned with browser paint cycle
      requestAnimationFrame(() => {
        // Skip if pending IDs were cleared
        if (pendingId === null || pendingOverId === null) {
          updateScheduled = false;
          return;
        }

        const { islands, vault } = get();
        // Safe cast since we already checked for null above
        const activeId = pendingId as UniqueIdentifier;
        const overId = pendingOverId as UniqueIdentifier;

        // Reset scheduled flag for next update
        updateScheduled = false;
        pendingId = null;
        pendingOverId = null;

        if (activeId === overId) return;

        const active = findItemInList(islands, activeId) || findItemInList(vault, activeId);
        const over = findItemInList(islands, overId) || findItemInList(vault, overId);

        // If active item not found, we can't proceed.
        // This usually means the item was deleted or the ID doesn't match.
        if (!active) {
            return;
        }

        // Detect Source and Target Panels
        // Source check: Is the active item inside the Live panel?
        const activeInLive = islands.some(i => i && (i.id == activeId || (i as any).tabs?.some((t: any) => t && t.id == activeId)));

        // Target check: Initialize to source location, then refine based on overId
        let targetIsLive = activeInLive;

        if (overId === 'live-panel-dropzone' || overId === 'live-bottom') targetIsLive = true;
        else if (overId === 'vault-dropzone' || overId === 'vault-bottom') targetIsLive = false;
        else if (over) {
          // Check where the 'over' item actually resides
          const overInIslands = islands.some(i => i && (i.id == overId || (i as any).tabs?.some((t: any) => t && t.id == overId)));
          const overInVault = vault.some(v => v && (v.id == overId || (v as any).tabs?.some((t: any) => t && t.id == overId)));

          if (overInIslands) targetIsLive = true;
          else if (overInVault) targetIsLive = false;
        }

        // BLOCK cross-panel optimistic movement to prevent state corruption during drag
        // If source panel != target panel, do not update UI state
        if (activeInLive !== targetIsLive) return;

        // Determine target index and container
        let targetContainerId: UniqueIdentifier = 'root';
        let targetIndex = -1;

        // Check if we are dragging a Group (Island)
        const isActiveGroup = active.item && 'tabs' in active.item;

        // If dropped on the panel dropzone
        if (['live-panel-dropzone', 'live-bottom', 'vault-dropzone', 'vault-bottom'].includes(String(overId))) {
          targetIndex = activeInLive ? islands.length : vault.length;
        }
        // If dropped on a gap between items
        else if (String(overId).startsWith('live-gap-') || String(overId).startsWith('vault-gap-')) {
          const gapIndex = parseInt(String(overId).split('-')[2], 10);
          targetIndex = isNaN(gapIndex) ? (activeInLive ? islands.length : vault.length) : gapIndex;
          targetContainerId = 'root';
        }
        // If dropped on an item
        else if (over) {
          targetContainerId = over.containerId;
          targetIndex = over.index;

          // Handle nesting: Dragging a tab over a group header
          if (over.item && 'tabs' in over.item && !isActiveGroup) {
            if (active.containerId === over.item.id) {
              // Dragging within the same group - stay in group
              targetContainerId = 'root';
              targetIndex = over.index;
            } else if (over.item.collapsed) {
              // Dropping on a collapsed group header from outside
              // Treat as dropping ABOVE the group (root container), not inside
              targetContainerId = 'root';
              targetIndex = over.index;
            } else {
              // Dropping on an expanded group header - insert at beginning
              targetContainerId = over.item.id;
              targetIndex = 0;
            }
          }

          // Prevent Groups from being nested inside other groups
          if (isActiveGroup && targetContainerId !== 'root') {
              const currentRoot = activeInLive ? islands : vault;
              const parentGroupIndex = currentRoot.findIndex(i => String(i.id) === String(targetContainerId));

              if (parentGroupIndex !== -1) {
                  targetContainerId = 'root';
                  targetIndex = parentGroupIndex;
              } else {
                  return;
              }
          }

          // When moving from OUTSIDE a group TO INSIDE a group and dropping on the LAST tab
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
          const group = root.find(i => i && String(i.id) === cIdStr);
          if (group && Array.isArray(group.tabs)) return group.tabs;
          return null;
        };

        let sourceArr = getTargetList(rootList, active.containerId);
        let targetArr = getTargetList(rootList, targetContainerId);

        if (!sourceArr && active.item) {
            return;
        }
        if (!sourceArr || !targetArr) return;

        const sourceItem = sourceArr[active.index];

        if (!sourceItem || String(sourceItem.id) !== String(activeId)) {
            const correctIndex = sourceArr.findIndex((item: any) => String(item.id) === String(activeId));
            if (correctIndex === -1) {
                return;
            }
            active.index = correctIndex;
        }

        const [movedItem] = sourceArr.splice(active.index, 1);

        if (!movedItem) return;

        const safeTargetIndex = Math.max(0, Math.min(Number(targetIndex), targetArr.length));

        targetArr.splice(safeTargetIndex, 0, movedItem);

        if (activeInLive) {
            set({ islands: newIslands });
        } else {
            const finalVault = [...newVault];
            set({ vault: finalVault });
        }
      });
    };
  })(),

  syncLiveTabs: async () => {
    // Guard against overlapping refreshes during drag operations
    if (get().isUpdating) return;

    // Guard against recursive refresh calls from useTabSync
    if (get().isRefreshing) return;
    set({ isRefreshing: true });

    try {
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

      set({ islands: entities, isRefreshing: false });
    } catch (error) {
      console.error('Failed to sync live tabs:', error);
      set({ isRefreshing: false });
    }
  },

  setDividerPosition: (dividerPosition) => {
    set({ dividerPosition });
    syncSettings({ dividerPosition });
  },

  toggleTheme: () => {
    const { appearanceSettings } = get();
    const newTheme: ThemeMode = appearanceSettings.theme === 'dark' ? 'light' : appearanceSettings.theme === 'light' ? 'dark' : 'system';
    get().setAppearanceSettings({ theme: newTheme });
  },

  setShowVault: (showVault) => {
    set({ showVault });
    syncSettings({ showVault });
  },

  moveToVault: async (id) => {
    const { islands, vault } = get();
    // Find item in Live state
    const found = findItemInList(islands, id);
    if (!found || !found.item) return;
    const item = found.item;
    // Remove from islands state
    let newIslands = islands;
    if (found.containerId === 'root') {
      newIslands = islands.filter(i => String(i.id) !== String(item.id));
    } else {
      newIslands = islands.map(i => {
        if (String(i.id) === String(found.containerId) && 'tabs' in i) {
          const group = i as Island;
          const newTabs = group.tabs.filter(t => String(t.id) !== String(item.id));
          return { ...group, tabs: newTabs };
        }
        return i;
      });
    }
    set({ islands: newIslands });
    // 1. Save to Vault (Deep Copy + ID Transform)
    const timestamp = Date.now();
    const itemClone = JSON.parse(JSON.stringify(item));
    
    const transformId = (i: any) => {
      // If it already has an original ID, keep it, otherwise use the numeric part of current ID
      const numericId = parseNumericId(i.id);
      // Ensure originalId is preserved or generated from current state
      i.originalId = i.originalId ?? (numericId > 0 ? numericId : i.id);
      i.id = `vault-${i.id}-${timestamp}`;
      
      if (isIsland(i)) {
        i.tabs.forEach(transformId);
      }
    };
    
    transformId(itemClone);
    (itemClone as VaultItem).savedAt = timestamp;
    
    const newVault = [...vault, itemClone as VaultItem];
    set({ vault: newVault });
    await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
    
    // 2. Close in Chrome
    if (isIsland(item)) {
         // It's a group - close all tabs in it
         const tabIds = item.tabs.map((t: Tab) => parseNumericId(t.id)).filter((id: number) => id > 0);
         if (tabIds.length > 0) {
             await chrome.tabs.remove(tabIds);
         }
    } else {
        // Single tab
        const numericId = parseNumericId(item.id);
        if (numericId > 0) {
            await closeTab(numericId);
        }
    }
  },

  saveToVault: async (item) => {
    const { vault } = get();
    let newItem = JSON.parse(JSON.stringify(item));
    const timestamp = Date.now();

    const transformId = (i: any) => {
      const numericId = parseNumericId(i.id);
      i.originalId = i.originalId ?? (numericId > 0 ? numericId : i.id);
      i.id = `vault-${i.id}-${timestamp}`;
      if (isIsland(i)) {
        i.tabs.forEach(transformId);
      }
    };

    transformId(newItem);
    newItem.savedAt = timestamp;

    const newVault = [...vault, newItem];
    set({ vault: newVault });
    await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
  },

  restoreFromVault: async (id) => {
    const { vault } = get();
    const itemIndex = vault.findIndex(v => String(v.id) === String(id));
    if (itemIndex === -1) return;

    const item = vault[itemIndex];

    // Calculate insertion index: after the last existing group in the current window
    let insertionIndex = 0;
    const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
    const currentWindowGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    if (currentWindowGroups.length > 0) {
      // Find the group with the highest index (last group in the window)
      const groupsWithIndices = currentWindowGroups.map(g => {
        const groupTabs = currentWindowTabs.filter(t => t.groupId === g.id);
        const maxIndex = groupTabs.length > 0 ? Math.max(...groupTabs.map(t => t.index)) : -1;
        return { ...g, maxIndex };
      }).filter(g => g.maxIndex !== -1);

      if (groupsWithIndices.length > 0) {
        const lastGroup = groupsWithIndices.reduce((prev, current) => (current.maxIndex > prev.maxIndex) ? current : prev);
        insertionIndex = lastGroup.maxIndex + 1;
      }
    } else if (currentWindowTabs.length > 0) {
        insertionIndex = currentWindowTabs.length;
    }

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
    
    // Remove from Vault after restore
    const newVault = vault.filter(v => String(v.id) !== String(id));
    set({ vault: newVault });
    await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
  },

  createVaultGroup: async () => {
    const { vault } = get();
    const timestamp = Date.now();
    const newGroup: VaultItem = {
      id: `vault-group-new-${timestamp}`,
      title: '',
      color: 'grey',
      collapsed: false,
      tabs: [],
      savedAt: timestamp,
      originalId: -1 // New group in vault has no original Chrome ID
    };
    // Add to top
    const newVault = [newGroup, ...vault];
    set({ vault: newVault });
    await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
  },

  reorderVault: async (newVault) => {
    set({ vault: newVault });
    // Vault reorders must be persisted to ensure cloud sync and consistency across reloads
    await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
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
      if (!isUpdating) await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
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
    if (!isUpdating) await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
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
    await persistVault(newVault, get().appearanceSettings.vaultSyncEnabled);
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
      await get().syncLiveTabs();

    } catch (error) {
      console.error("[Deduplicator] Fatal error during deduplication:", error);
    }
  },

  sortGroupsToTop: async () => {
    if (get().isUpdating) {
      console.debug('[Sorter] Sort already in progress, skipping re-entrant call.');
      return;
    }

    const { islands, setIsUpdating, syncLiveTabs } = get();
    
    const pinned = islands.filter(i => !isIsland(i) && (i as Tab).pinned);
    const groups = islands.filter(isIsland);
    const loose = islands.filter(i => !isIsland(i) && !(i as Tab).pinned);
    
    const sorted = [...pinned, ...groups, ...loose];
    if (sorted.every((item, idx) => item.id === islands[idx]?.id)) return;

    setIsUpdating(true);
    try {
      let currentIdx = 0;
      for (const item of sorted) {
        const numericId = parseNumericId(item.id);
        if (numericId === -1) {
          currentIdx += isIsland(item) ? item.tabs.length : 1;
          continue;
        }

        try {
          if (isIsland(item)) {
            await moveIsland(numericId, currentIdx);
            currentIdx += item.tabs.length;
          } else {
            await moveTab(numericId, currentIdx);
            currentIdx += 1;
          }
        } catch (itemError) {
          console.warn(`[Sorter] Failed to move item ${item.id} to index ${currentIdx}:`, itemError);
          currentIdx += isIsland(item) ? item.tabs.length : 1;
        }
      }
      await syncLiveTabs();
    } catch (error) {
      console.error('[Sorter] Fatal error during sorting:', error);
    } finally {
      setIsUpdating(false);
    }
  },

  sortVaultGroupsToTop: async () => {
    const { vault } = get();
    const pinned = vault.filter(i => !isIsland(i) && (i as any).pinned);
    const groups = vault.filter(isIsland);
    const loose = vault.filter(i => !isIsland(i) && !(i as any).pinned);
    
    const sorted = [...pinned, ...groups, ...loose];
    if (sorted.every((item, idx) => item.id === vault[idx]?.id)) return;

    // Use reorderVault to ensure persistence and quota refresh
    await get().reorderVault(sorted);
  }
}));

// Cross-Window Sync Initialization
const init = async () => {
  const sync = await chrome.storage.sync.get(['appearanceSettings', 'dividerPosition', 'showVault']);

  const state = useStore.getState();
  
  if (sync.appearanceSettings) {
    state.setAppearanceSettings(sync.appearanceSettings as AppearanceSettings);
  }
  if (sync.dividerPosition) state.setDividerPosition(Number(sync.dividerPosition));
  if (sync.showVault !== undefined) state.setShowVault(Boolean(sync.showVault));
  
  const syncEnabled = (sync.appearanceSettings as AppearanceSettings)?.vaultSyncEnabled ?? defaultAppearanceSettings.vaultSyncEnabled;
  
  const migrationResult = await migrateFromLegacy({ syncEnabled });
  if (migrationResult.migrated) {
    console.log('[VaultStorage] Migration complete:', migrationResult);
  }
  
  const vault = await loadVault({ syncEnabled });
  useStore.setState({ vault });
  
  const quota = await getVaultQuota();
  useStore.setState({ vaultQuota: quota });

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync') {
       if (changes.appearanceSettings) {
         state.setAppearanceSettings(changes.appearanceSettings.newValue as AppearanceSettings);
       }
       if (changes.showVault) state.setShowVault(Boolean(changes.showVault.newValue));
       if (changes.dividerPosition) state.setDividerPosition(Number(changes.dividerPosition.newValue));
       
       if (changes.vault_meta) {
         if (!useStore.getState().isUpdating) {
           const currentSettings = useStore.getState().appearanceSettings;
           const reloadedVault = await loadVault({ syncEnabled: currentSettings.vaultSyncEnabled });
           useStore.setState({ vault: reloadedVault });
           const quota = await getVaultQuota();
           useStore.setState({ vaultQuota: quota });
         }
       }
    }
    
    if (area === 'local') {
      if (changes.vault && !useStore.getState().appearanceSettings.vaultSyncEnabled) {
        if (!useStore.getState().isUpdating) {
          useStore.setState({ vault: changes.vault.newValue as VaultItem[] });
          const quota = await getVaultQuota();
          useStore.setState({ vaultQuota: quota });
        }
      }
    }
  });
};

init();
