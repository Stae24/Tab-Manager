import { StateCreator } from 'zustand';
import { VaultItem, UniversalId, LiveItem, VaultQuotaInfo, VaultStorageResult, Island, Tab } from '../../types/index';
import { saveVault, getVaultQuota, toggleSyncMode } from '../../utils/vaultStorage';
import { isIsland, parseNumericId, syncSettings, findItemInList } from '../utils';

import type { StoreState } from '../types';

export interface VaultSlice {
  vault: VaultItem[];
  vaultQuota: VaultQuotaInfo | null;
  quotaExceededPending: VaultStorageResult | null;
  lastVaultTimestamp: number;
  
  moveToVault: (id: UniversalId) => Promise<void>;
  saveToVault: (item: LiveItem) => Promise<void>;
  restoreFromVault: (id: UniversalId) => Promise<void>;
  removeFromVault: (id: UniversalId) => Promise<void>;
  createVaultGroup: () => Promise<void>;
  reorderVault: (newVault: VaultItem[]) => Promise<void>;
  toggleVaultGroupCollapse: (id: UniversalId) => Promise<void>;
  sortVaultGroupsToTop: () => Promise<void>;
  refreshVaultQuota: () => Promise<void>;
  clearQuotaExceeded: () => void;
  setVaultSyncEnabled: (enabled: boolean) => Promise<VaultStorageResult>;
  
  persistVault: (vault: VaultItem[], syncEnabled: boolean) => Promise<VaultStorageResult>;
}

export const createVaultSlice: StateCreator<StoreState, [], [], VaultSlice> = (set, get) => ({
  vault: [],
  vaultQuota: null,
  quotaExceededPending: null,
  lastVaultTimestamp: 0,

  persistVault: async (vault: VaultItem[], syncEnabled: boolean): Promise<VaultStorageResult> => {
    const result = await saveVault(vault, { syncEnabled });

    const quota = await getVaultQuota();
    set({ vaultQuota: quota, lastVaultTimestamp: Date.now() });

    if (!result.success && result.error === 'QUOTA_EXCEEDED') {
      set({ quotaExceededPending: result });
    }
    return result;
  },

  refreshVaultQuota: async () => {
    const quota = await getVaultQuota();
    set({ vaultQuota: quota });
  },

  clearQuotaExceeded: () => set({ quotaExceededPending: null }),

  setVaultSyncEnabled: async (enabled: boolean) => {
    const { vault, appearanceSettings, persistVault } = get();
    const result = await toggleSyncMode(vault, enabled);

    if (result.success) {
      const updated = { ...appearanceSettings, vaultSyncEnabled: enabled };
      set({ appearanceSettings: updated });
      syncSettings({ appearanceSettings: updated });

      const quota = await getVaultQuota();
      set({ vaultQuota: quota });
    }

    return result;
  },

  moveToVault: async (id) => {
    const { islands, vault, appearanceSettings, persistVault } = get();
    
    const found = findItemInList(islands, id);
    if (!found || !found.item) return;
    const item = found.item;

    let newIslands = islands;
    if (found.containerId === 'root') {
      newIslands = islands.filter((i: LiveItem) => String(i.id) !== String(item.id));
    } else {
      newIslands = islands.map((i: LiveItem) => {
        if (String(i.id) === String(found.containerId) && 'tabs' in i) {
          const group = i as Island;
          const newTabs = group.tabs.filter((t: Tab) => String(t.id) !== String(item.id));
          return { ...group, tabs: newTabs };
        }
        return i;
      });
    }
    set({ islands: newIslands });

    const timestamp = Date.now();
    const itemClone = JSON.parse(JSON.stringify(item));

    const transformId = (i: any) => {
      const numericId = parseNumericId(i.id);
      i.originalId = i.originalId ?? (numericId !== null ? numericId : i.id);
      i.id = `vault-${i.id}-${timestamp}`;

      if (isIsland(i)) {
        i.tabs.forEach(transformId);
      }
    };

    transformId(itemClone);
    (itemClone as VaultItem).savedAt = timestamp;

    const newVault = [...vault, itemClone as VaultItem];
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);

    const { closeTab } = await import('../../utils/chromeApi');
    if (isIsland(item)) {
      const tabIds = item.tabs.map((t: Tab) => parseNumericId(t.id)).filter((id): id is number => id !== null);
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
    } else {
      const numericId = parseNumericId(item.id);
      if (numericId !== null) {
        await closeTab(numericId);
      }
    }
  },

  saveToVault: async (item) => {
    const { vault, appearanceSettings, persistVault } = get();
    let newItem = JSON.parse(JSON.stringify(item));
    const timestamp = Date.now();

    const transformId = (i: any) => {
      const numericId = parseNumericId(i.id);
      i.originalId = i.originalId ?? (numericId !== null ? numericId : i.id);
      i.id = `vault-${i.id}-${timestamp}`;
      if (isIsland(i)) {
        i.tabs.forEach(transformId);
      }
    };

    transformId(newItem);
    newItem.savedAt = timestamp;

    const newVault = [...vault, newItem];
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },

  restoreFromVault: async (id) => {
    const { vault, appearanceSettings, persistVault } = get();
    const itemIndex = vault.findIndex((v: VaultItem) => String(v.id) === String(id));
    if (itemIndex === -1) return;

    const item = vault[itemIndex];

    let insertionIndex = 0;
    const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
    const currentWindowGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    if (currentWindowGroups.length > 0) {
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

    const { createIsland } = await import('../../utils/chromeApi');
    if (isIsland(item)) {
      const newIds: number[] = [];
      for (const t of item.tabs) {
        const nt = await chrome.tabs.create({ url: t.url, active: false, index: insertionIndex + newIds.length });
        if (nt.id) newIds.push(nt.id);
      }
      if (newIds.length > 0) {
        await createIsland(newIds, item.title, item.color as any);
      }
    } else {
      await chrome.tabs.create({ url: item.url, active: false, index: insertionIndex });
    }

    const newVault = vault.filter((v: VaultItem) => String(v.id) !== String(id));
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },

  createVaultGroup: async () => {
    const { vault, appearanceSettings, persistVault } = get();
    const timestamp = Date.now();
    const newGroup: VaultItem = {
      id: `vault-group-new-${timestamp}`,
      title: '',
      color: 'grey',
      collapsed: false,
      tabs: [],
      savedAt: timestamp,
      originalId: -1
    };
    const newVault = [newGroup, ...vault];
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },

  reorderVault: async (newVault) => {
    const { appearanceSettings, persistVault } = get();
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },

  toggleVaultGroupCollapse: async (id) => {
    const { vault, isUpdating, appearanceSettings, persistVault } = get();
    const idStr = String(id);
    if (!idStr.startsWith('vault-')) return;

    const newVault = vault.map((item: VaultItem) => {
      if (String(item.id) === idStr && 'tabs' in item) {
        return { ...item, collapsed: !item.collapsed };
      }
      return item;
    });
    set({ vault: newVault });
    if (!isUpdating) await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },

  sortVaultGroupsToTop: async () => {
    const { vault, appearanceSettings, reorderVault } = get();
    const pinned = vault.filter((i: any) => !isIsland(i) && (i as any).pinned);
    const vaultGroups = vault.filter(isIsland) as (Island & { savedAt: number; originalId: UniversalId; })[];
    let groups = [...vaultGroups];
    const loose = vault.filter((i: any) => !isIsland(i) && !(i as any).pinned);

    if (appearanceSettings.sortVaultGroupsByCount) {
      groups = groups.sort((a, b) => b.tabs.length - a.tabs.length);
    }

    const sorted = [...pinned, ...groups, ...loose];
    if (sorted.every((item, idx) => item.id === vault[idx]?.id)) return;

    await reorderVault(sorted);
  },

  removeFromVault: async (id) => {
    const { vault, appearanceSettings, persistVault } = get();
    const newVault = vault.filter((v: any) => v && v.id != id);
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },
});
