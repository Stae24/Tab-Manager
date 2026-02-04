import { StateCreator } from 'zustand';
import { UniqueIdentifier } from '@dnd-kit/core';
import { Island, Tab, LiveItem, UniversalId } from '../../types/index';
import { createIsland, updateTabGroup, updateTabGroupCollapse, moveIsland, moveTab, consolidateAndGroupTabs } from '../../utils/chromeApi';
import { parseNumericId, findItemInList, isIsland } from '../utils';

import type { StoreState } from '../types';

export interface TabSlice {
  islands: LiveItem[];
  isUpdating: boolean;
  pendingRefresh: boolean;
  isRefreshing: boolean;
  
  syncLiveTabs: () => Promise<void>;
  setIsUpdating: (val: boolean) => void;
  renameGroup: (id: UniversalId, newTitle: string) => Promise<void>;
  toggleLiveGroupCollapse: (id: UniversalId) => Promise<void>;
  moveItemOptimistically: (activeId: UniqueIdentifier, overId: UniqueIdentifier) => void;
  deleteDuplicateTabs: () => Promise<void>;
  sortGroupsToTop: () => Promise<void>;
  groupSearchResults: (tabs: Tab[]) => Promise<void>;
  groupUngroupedTabs: () => Promise<void>;
}

export const createTabSlice: StateCreator<StoreState, [], [], TabSlice> = (set, get) => ({
  islands: [],
  isUpdating: false,
  pendingRefresh: false,
  isRefreshing: false,

  setIsUpdating: (isUpdating) => set({ isUpdating }),

  syncLiveTabs: async () => {
    if (get().isUpdating) return;

    let acquiredLock = false;
    set((state: StoreState) => {
      if (state.isRefreshing) return state;
      acquiredLock = true;
      return { isRefreshing: true };
    });
    if (!acquiredLock) return;

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

  renameGroup: async (id, newTitle) => {
    const { vault, isUpdating, persistVault, appearanceSettings } = get();
    const idStr = String(id);

    if (idStr.startsWith('vault-')) {
      const newVault = vault.map((item: any) => {
        if (String(item.id) === idStr && 'tabs' in item) {
          return { ...item, title: newTitle };
        }
        return item;
      });
      set({ vault: newVault });
      if (!isUpdating) await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
    } else {
      const numericId = parseNumericId(id);
      if (numericId !== null) {
        await updateTabGroup(numericId, { title: newTitle });
      }
    }
  },

  toggleLiveGroupCollapse: async (id) => {
    const { islands, setIsUpdating } = get();
    const idStr = String(id);
    const numericId = parseNumericId(id);

    if (idStr.startsWith('vault-') || numericId === null) return;

    const targetIsland = islands.find((i: any) => String(i.id) === idStr && 'tabs' in i);
    if (!targetIsland) return;

    const newCollapsedState = !(targetIsland as Island).collapsed;

    const newIslands = islands.map((item: LiveItem) => {
      if (String(item.id) === idStr && 'tabs' in item) {
        return { ...item, collapsed: newCollapsedState };
      }
      return item;
    });
    set({ islands: newIslands });

    setIsUpdating(true);
    const success = await updateTabGroupCollapse(numericId, newCollapsedState);
    setIsUpdating(false);

    if (!success) {
      const revertIslands = islands.map((item: LiveItem) => {
        if (String(item.id) === idStr && 'tabs' in item) {
          return { ...item, collapsed: !newCollapsedState };
        }
        return item;
      });
      set({ islands: revertIslands });
    }
  },

  moveItemOptimistically: (() => {
    let pendingId: UniqueIdentifier | null = null;
    let pendingOverId: UniqueIdentifier | null = null;
    let updateScheduled = false;

    return (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
      pendingId = activeId;
      pendingOverId = overId;

      if (updateScheduled) return;
      updateScheduled = true;

      requestAnimationFrame(() => {
        if (pendingId === null || pendingOverId === null) {
          updateScheduled = false;
          return;
        }

        const { islands, vault } = get();
        const activeIdVal = pendingId;
        const overIdVal = pendingOverId;

        updateScheduled = false;
        pendingId = null;
        pendingOverId = null;

        if (activeIdVal === overIdVal) return;

        const active = findItemInList(islands, activeIdVal) || findItemInList(vault, activeIdVal);
        const over = findItemInList(islands, overIdVal) || findItemInList(vault, overIdVal);

        if (!active) return;

        const activeInLive = islands.some((i: LiveItem) => i && (i.id == activeIdVal || (i as any).tabs?.some((t: any) => t && t.id == activeIdVal)));

        let targetIsLive = activeInLive;

        if (overIdVal === 'live-panel-dropzone' || overIdVal === 'live-bottom') targetIsLive = true;
        else if (overIdVal === 'vault-dropzone' || overIdVal === 'vault-bottom') targetIsLive = false;
        else if (over) {
          const overInIslands = islands.some((i: LiveItem) => i && (i.id == overIdVal || (i as any).tabs?.some((t: any) => t && t.id == overIdVal)));
          const overInVault = vault.some((v: any) => v && (v.id == overIdVal || (v as any).tabs?.some((t: any) => t && t.id == overIdVal)));

          if (overInIslands) targetIsLive = true;
          else if (overInVault) targetIsLive = false;
        }

        if (activeInLive !== targetIsLive) return;

        let targetContainerId: UniqueIdentifier = 'root';
        let targetIndex = -1;

        const isActiveGroup = active.item && 'tabs' in active.item;

        if (['live-panel-dropzone', 'live-bottom', 'vault-dropzone', 'vault-bottom'].includes(String(overIdVal))) {
          targetIndex = activeInLive ? islands.length : vault.length;
        }
        else if (String(overIdVal).startsWith('live-gap-') || String(overIdVal).startsWith('vault-gap-')) {
          const gapIndex = parseInt(String(overIdVal).split('-')[2], 10);
          targetIndex = isNaN(gapIndex) ? (activeInLive ? islands.length : vault.length) : gapIndex;
          targetContainerId = 'root';
        }
        else if (over) {
          targetContainerId = over.containerId;
          targetIndex = over.index;

          if (over.item && 'tabs' in over.item && !isActiveGroup) {
            if (active.containerId === over.item.id) {
              targetContainerId = 'root';
              targetIndex = over.index;
            } else if (over.item.collapsed) {
              targetContainerId = 'root';
              targetIndex = over.index;
            } else {
              targetContainerId = over.item.id;
              targetIndex = 0;
            }
          }

          if (isActiveGroup && targetContainerId !== 'root') {
            const currentRoot = activeInLive ? islands : vault;
            const parentGroupIndex = currentRoot.findIndex((i: LiveItem) => String(i.id) === String(targetContainerId));

            if (parentGroupIndex !== -1) {
              targetContainerId = 'root';
              targetIndex = parentGroupIndex;
            } else {
              return;
            }
          }

          if (active.containerId !== targetContainerId && over.item && !('tabs' in over.item)) {
            const targetGroup = (activeInLive ? islands : vault).find((i: LiveItem) => String(i.id) === String(targetContainerId));
            if (targetGroup && 'tabs' in targetGroup && targetGroup.tabs && targetIndex === targetGroup.tabs.length - 1) {
              targetIndex = targetIndex + 1;
            }
          }
        }

        if (targetIndex === -1) return;
        if (active.containerId === targetContainerId && active.index === targetIndex) return;

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

        if (!sourceArr || !targetArr) return;

        const sourceItem = sourceArr[active.index];

        if (!sourceItem || String(sourceItem.id) !== String(activeIdVal)) {
          const correctIndex = sourceArr.findIndex((item: any) => String(item.id) === String(activeIdVal));
          if (correctIndex === -1) return;
          active.index = correctIndex;
        }

        const [movedItem] = sourceArr.splice(active.index, 1);
        if (!movedItem) return;

        const safeTargetIndex = Math.max(0, Math.min(Number(targetIndex), targetArr.length));
        targetArr.splice(safeTargetIndex, 0, movedItem);

        if (activeInLive) {
          set({ islands: newIslands });
        } else {
          set({ vault: newVault });
        }
      });
    };
  })(),

  deleteDuplicateTabs: async () => {
    try {
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const urlMap = new Map<string, chrome.tabs.Tab[]>();
      currentTabs.forEach(tab => {
        const urlString = tab.url || tab.pendingUrl;
        if (urlString) {
          try {
            const url = new URL(urlString);
            const normalized = `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '').toLowerCase()}${url.search}`;
            const existing = urlMap.get(normalized) || [];
            urlMap.set(normalized, [...existing, tab]);
          } catch (e) {
            const normalized = urlString.split('#')[0].trim().replace(/\/+$/, '');
            const existing = urlMap.get(normalized) || [];
            urlMap.set(normalized, [...existing, tab]);
          }
        }
      });

      const toCloseIds = new Set<number>();
      urlMap.forEach((group: chrome.tabs.Tab[]) => {
        if (group.length > 1) {
          group.sort((a, b) => (a.index || 0) - (b.index || 0));
          const activeTab = group.find(t => t.active);
          const keepTab = activeTab || group[0];
          group.forEach(tab => {
            if (tab.id !== keepTab.id && typeof tab.id === 'number') {
              toCloseIds.add(tab.id);
            }
          });
        }
      });

      if (toCloseIds.size === 0) return;

      const idsArray = Array.from(toCloseIds);
      for (const id of idsArray) {
        try {
          if (typeof id === 'number' && !isNaN(id)) {
            await chrome.tabs.remove(id);
          }
        } catch (e) {
          console.warn(`[Deduplicator] Failed to close tab ${id}:`, e);
        }
      }
      await get().syncLiveTabs();
    } catch (error) {
      console.error("[Deduplicator] Fatal error during deduplication:", error);
    }
  },

  sortGroupsToTop: async () => {
    if (get().isUpdating) return;

    const { islands, appearanceSettings, setIsUpdating, syncLiveTabs } = get();

    const pinned = islands.filter((i: any) => !isIsland(i) && (i as Tab).pinned);
    let groups = islands.filter(isIsland) as Island[];
    const loose = islands.filter((i: any) => !isIsland(i) && !(i as Tab).pinned);

    if (appearanceSettings.sortGroupsByCount) {
      groups = [...groups].sort((a, b) => b.tabs.length - a.tabs.length);
    }

    const sorted = [...pinned, ...groups, ...loose];
    if (sorted.every((item: LiveItem, idx: number) => item.id === islands[idx]?.id)) return;

    setIsUpdating(true);
    try {
      let currentIdx = 0;
      for (const item of sorted) {
        const numericId = parseNumericId(item.id);
        if (numericId === null) {
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
          console.warn(`[Sorter] Failed to move item ${item.id}:`, itemError);
          currentIdx += isIsland(item) ? item.tabs.length : 1;
        }
      }
      await syncLiveTabs();
    } finally {
      setIsUpdating(false);
    }
  },

  groupSearchResults: async (tabs: Tab[]) => {
    const { setIsUpdating, syncLiveTabs } = get();
    setIsUpdating(true);
    try {
      const numericIds = tabs.map(t => parseNumericId(t.id)).filter((id): id is number => id !== null);
      await consolidateAndGroupTabs(numericIds, { color: 'random' });
      await syncLiveTabs();
    } finally {
      setIsUpdating(false);
    }
  },

  groupUngroupedTabs: async () => {
    const { setIsUpdating, syncLiveTabs, islands } = get();
    setIsUpdating(true);
    try {
      const ungroupedTabIds = islands
        .filter((item: LiveItem): item is Tab => !('tabs' in item))
        .filter((tab: Tab) => !tab.pinned)
        .map((tab: Tab) => parseNumericId(tab.id))
        .filter((id: any): id is number => id !== null);
      
      if (ungroupedTabIds.length >= 2) {
        await consolidateAndGroupTabs(ungroupedTabIds, { color: 'random' });
        await syncLiveTabs();
      }
    } finally {
      setIsUpdating(false);
    }
  }
});
