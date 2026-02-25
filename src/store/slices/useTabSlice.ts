import { StateCreator } from 'zustand';
import { UniqueIdentifier } from '@dnd-kit/core';
import { Island, Tab, LiveItem, UniversalId, VaultItem } from '../../types/index';
import { tabService } from '../../services/tabService';
import { logger } from '../../utils/logger';
import { parseNumericId, findItemInList, isIsland, cloneWithDeepGroups } from '../utils';
import { initBrowserCapabilities } from '../../utils/browser';
import { prepareOptimisticMove } from '../operations/moveItem';

import type { StoreState } from '../types';

export interface TabSlice {
  islands: LiveItem[];
  isUpdating: boolean;
  pendingRefresh: boolean;
  isRefreshing: boolean;
  pendingOperations: Set<number>;
  supportsGroupCollapse: boolean | null;

  syncLiveTabs: () => Promise<void>;
  setIsUpdating: (val: boolean) => void;
  addPendingOperation: (id: number) => void;
  removePendingOperation: (id: number) => void;
  clearPendingOperations: () => void;
  hasPendingOperations: () => boolean;
  renameGroup: (id: UniversalId, newTitle: string) => Promise<void>;
  toggleLiveGroupCollapse: (id: UniversalId) => Promise<void>;
  initBrowserCapabilities: () => Promise<void>;
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
  pendingOperations: new Set<number>(),
  supportsGroupCollapse: null,

  setIsUpdating: (isUpdating) => set({ isUpdating }),

  addPendingOperation: (id: number) => {
    const { pendingOperations } = get();
    const newOps = new Set(pendingOperations);
    newOps.add(id);
    set({ pendingOperations: newOps, isUpdating: true });
  },

  removePendingOperation: (id: number) => {
    const { pendingOperations } = get();
    const newOps = new Set(pendingOperations);
    newOps.delete(id);
    const hasPending = newOps.size > 0;
    set({ pendingOperations: newOps, isUpdating: hasPending });
  },

  clearPendingOperations: () => {
    set({ pendingOperations: new Set<number>(), isUpdating: false });
  },

  hasPendingOperations: () => {
    return get().pendingOperations.size > 0;
  },

  syncLiveTabs: async () => {
    if (get().isUpdating || get().hasPendingOperations()) return;

    let acquiredLock = false;
    set((state: StoreState) => {
      if (state.isRefreshing) return state;
      acquiredLock = true;
      return { isRefreshing: true };
    });
    if (!acquiredLock) return;

    try {
      const entities = await tabService.getLiveTabsAndGroups();
      set({ islands: entities, isRefreshing: false });
    } catch (error) {
      logger.error('Failed to sync live tabs:', error);
      set({ isRefreshing: false });
    }
  },

  renameGroup: async (id, newTitle) => {
    const { vault, isUpdating, persistVault, appearanceSettings } = get();
    const idStr = String(id);

    if (idStr.startsWith('vault-')) {
      const newVault = vault.map((item: VaultItem) => {
        if (String(item.id) === idStr && 'tabs' in item) {
          return { ...item, title: newTitle } as VaultItem;
        }
        return item;
      });
      set({ vault: newVault });
      if (!isUpdating) await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
    } else {
      const numericId = parseNumericId(id);
      if (numericId !== null) {
        await tabService.updateTabGroup(numericId, { title: newTitle });
      }
    }
  },

  toggleLiveGroupCollapse: async (id) => {
    const { islands, setIsUpdating, supportsGroupCollapse } = get();
    const idStr = String(id);
    const numericId = parseNumericId(id);

    if (idStr.startsWith('vault-') || numericId === null) return;

    if (supportsGroupCollapse === false) {
      return;
    }

    const targetIsland = islands.find((i: LiveItem) => String(i.id) === idStr && 'tabs' in i);
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
    const success = await tabService.updateTabGroupCollapse(numericId, newCollapsedState);
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

  initBrowserCapabilities: async () => {
    const { supportsGroupCollapse } = get();
    if (supportsGroupCollapse !== null) return;

    try {
      const supported = await initBrowserCapabilities();
      set({ supportsGroupCollapse: supported });
      
      if (supported) {
        logger.info('[initBrowserCapabilities] Browser supports group collapse');
      } else {
        logger.info('[initBrowserCapabilities] Browser does NOT support group collapse');
      }
    } catch (error) {
      logger.error('[initBrowserCapabilities] error:', error);
      set({ supportsGroupCollapse: false });
    }
  },

  moveItemOptimistically: (() => {
    const pendingId = { current: null as UniqueIdentifier | null };
    const pendingOverId = { current: null as UniqueIdentifier | null };
    const rafId = { current: null as number | null };

    return (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
      if (rafId.current !== null) {
        pendingId.current = activeId;
        pendingOverId.current = overId;
        return;
      }

      pendingId.current = activeId;
      pendingOverId.current = overId;

      rafId.current = requestAnimationFrame(() => {
        const activeIdVal = pendingId.current;
        const overIdVal = pendingOverId.current;

        pendingId.current = null;
        pendingOverId.current = null;
        rafId.current = null;

        if (activeIdVal === null || overIdVal === null) {
          return;
        }

        const { islands, vault } = get();

        const moveData = prepareOptimisticMove(islands, vault, activeIdVal, overIdVal);
        
        if (!moveData) return;

        const { result } = moveData;

        if (result.isLive) {
          set({ islands: result.newIslands });
        } else {
          set({ vault: result.newVault });
        }
      });
    };
  })(),

  deleteDuplicateTabs: async () => {
    try {
      const currentTabs = await tabService.getCurrentWindowTabs();
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
      await tabService.closeTabs(idsArray);
      await get().syncLiveTabs();
    } catch (error) {
      logger.error("[Deduplicator] Fatal error during deduplication:", error);
    }
  },

  sortGroupsToTop: async () => {
    if (get().isUpdating) return;

    const { islands, appearanceSettings, setIsUpdating, syncLiveTabs } = get();

    const pinned = islands.filter((i: LiveItem): i is Tab => !isIsland(i) && !!(i as Tab).pinned);
    let groups = islands.filter(isIsland) as Island[];
    const loose = islands.filter((i: LiveItem): i is Tab => !isIsland(i) && !(i as Tab).pinned);

    if (appearanceSettings.sortGroupsByCount) {
      groups = [...groups].sort((a, b) => (b.tabs?.length || 0) - (a.tabs?.length || 0));
    }

    const sorted = [...pinned, ...groups, ...loose];
    if (sorted.every((item: LiveItem, idx: number) => item.id === islands[idx]?.id)) return;

    setIsUpdating(true);
    try {
      let currentIdx = 0;
      for (const item of sorted) {
        const numericId = parseNumericId(item.id);
        if (numericId === null) {
          currentIdx += isIsland(item) ? (item.tabs?.length || 0) : 1;
          continue;
        }

        try {
          if (isIsland(item)) {
            await tabService.moveIsland(numericId, currentIdx);
            currentIdx += item.tabs?.length || 0;
          } else {
            await tabService.moveTab(numericId, currentIdx);
            currentIdx += 1;
          }
        } catch (itemError) {
          logger.warn(`[Sorter] Failed to move item ${item.id}:`, itemError);
          currentIdx += isIsland(item) ? (item.tabs?.length || 0) : 1;
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
      await tabService.consolidateAndGroupTabs(numericIds, { color: 'random' });
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
        .filter((id: number | null): id is number => id !== null);
      
      if (ungroupedTabIds.length >= 2) {
        await tabService.consolidateAndGroupTabs(ungroupedTabIds, { color: 'random' });
        await syncLiveTabs();
      }
    } finally {
      setIsUpdating(false);
    }
  }
});
