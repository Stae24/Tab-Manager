import { StateCreator } from 'zustand';
import { VaultItem, UniversalId, LiveItem, VaultQuotaInfo, VaultStorageResult, Island, Tab } from '../../types/index';
import { vaultService } from '../../services/vaultService';
import { quotaService } from '../../services/quotaService';
import { tabService } from '../../services/tabService';
import { settingsService } from '../../services/settingsService';
import { isIsland, parseNumericId, findItemInList } from '../utils';
import { logger } from '../../utils/logger';
import { VAULT_QUOTA_SAFETY_MARGIN_BYTES } from '../../constants';

import type { StoreState } from '../types';

function estimateItemSize(item: LiveItem): number {
  const json = JSON.stringify(item);
  return new TextEncoder().encode(json).length * 2;
}

async function checkQuotaBeforeSave(
  item: LiveItem,
  currentVault: VaultItem[]
): Promise<{ allowed: boolean; shouldSwitchToLocal: boolean }> {
  if (!currentVault.length) {
    const quota = await quotaService.getVaultQuota();
    const estimatedItemSize = estimateItemSize(item);
    const safetyMargin = VAULT_QUOTA_SAFETY_MARGIN_BYTES * 2;
    return {
      allowed: quota.available - estimatedItemSize >= safetyMargin,
      shouldSwitchToLocal: false
    };
  }

  const testVault = [...currentVault, { ...item, savedAt: Date.now(), originalId: item.id } as VaultItem];
  const testJson = JSON.stringify(testVault);
  const estimatedCompressedSize = Math.ceil(testJson.length * 0.7);
  const quota = await quotaService.getVaultQuota();
  const safetyMargin = VAULT_QUOTA_SAFETY_MARGIN_BYTES * 2;

  if (quota.available - estimatedCompressedSize < safetyMargin) {
    return { allowed: false, shouldSwitchToLocal: true };
  }

  return { allowed: true, shouldSwitchToLocal: false };
}

export interface VaultSlice {
  vault: VaultItem[];
  vaultQuota: VaultQuotaInfo | null;
  quotaExceededPending: VaultStorageResult | null;
  lastVaultTimestamp: number;
  effectiveSyncEnabled?: boolean;
  
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
  effectiveSyncEnabled: undefined,

  persistVault: async (vault: VaultItem[], syncEnabled: boolean): Promise<VaultStorageResult> => {
    const previousVault = get().vault;
    
    const quota = await quotaService.getVaultQuota();
    if (quota.percentage >= 1.0) {
      logger.warn(`[VaultSlice] Already at ${Math.round(quota.percentage * 100)}%, forcing local fallback`);
      await vaultService.disableVaultSync(vault);
      
      const { appearanceSettings } = get();
      const updated = { ...appearanceSettings, vaultSyncEnabled: false };
      set({ appearanceSettings: updated });
      settingsService.saveSettings({ appearanceSettings: updated });
      
      const newQuota = await quotaService.getVaultQuota();
      set({ vaultQuota: { ...newQuota, warningLevel: 'none' as const }, lastVaultTimestamp: Date.now() });
      
      return { success: true, warningLevel: 'none' };
    }
    
    const result = await vaultService.saveVault(vault, { syncEnabled });

    if (!result.success) {
      set({ vault: previousVault });
      logger.error('[VaultSlice] Persistence failed:', result.error);
    }

    if (result.fallbackToLocal) {
      const { appearanceSettings } = get();
      logger.warn('[VaultSlice] Auto-disabling vault sync due to size limits');

      await vaultService.disableVaultSync(vault);

      const updated = { ...appearanceSettings, vaultSyncEnabled: false };
      set({ appearanceSettings: updated });
      settingsService.saveSettings({ appearanceSettings: updated });

      const newQuota = await quotaService.getVaultQuota();
      set({ vaultQuota: { ...newQuota, warningLevel: 'none' as const }, lastVaultTimestamp: Date.now() });
      return result;
    }

    const newQuota = await quotaService.getVaultQuota();
    set({ vaultQuota: newQuota, lastVaultTimestamp: Date.now() });

    if (!result.success && result.error === 'QUOTA_EXCEEDED') {
      set({ quotaExceededPending: result });
    }
    return result;
  },

  refreshVaultQuota: async () => {
    const quota = await quotaService.getVaultQuota();
    set({ vaultQuota: quota });
  },

  clearQuotaExceeded: () => set({ quotaExceededPending: null }),

  setVaultSyncEnabled: async (enabled: boolean) => {
    const { vault, appearanceSettings } = get();
    const result = await vaultService.toggleSyncMode(vault, enabled);

    if (result.success) {
      const updated = { ...appearanceSettings, vaultSyncEnabled: enabled };
      set({ appearanceSettings: updated });
      settingsService.saveSettings({ appearanceSettings: updated });

      const quota = await quotaService.getVaultQuota();
      set({ vaultQuota: quota });
    }

    return result;
  },

  moveToVault: async (id) => {
    const { islands, vault, appearanceSettings, persistVault } = get();
    
    const found = findItemInList(islands, id);
    if (!found || !found.item) {
      logger.warn(`[VaultSlice] moveToVault: Item ${id} not found in islands`);
      return;
    }
    const item = found.item;
    const isGroup = isIsland(item);
    const tabCount = isGroup ? (item.tabs?.length || 0) : 1;
    
    logger.info(`[VaultSlice] moveToVault: Moving ${isGroup ? 'group' : 'tab'} (${tabCount} tabs) to vault. ID: ${item.id}`);
    logger.info(`[VaultSlice] moveToVault: Current vault has ${vault.length} items, syncEnabled=${appearanceSettings.vaultSyncEnabled}`);

    const quotaCheck = await checkQuotaBeforeSave(item, vault);
    if (!quotaCheck.allowed) {
      if (quotaCheck.shouldSwitchToLocal && appearanceSettings.vaultSyncEnabled) {
        logger.info('[VaultSlice] moveToVault: Auto-switching to local storage due to quota');
        const updated = { ...appearanceSettings, vaultSyncEnabled: false };
        set({ appearanceSettings: updated });
        settingsService.saveSettings({ appearanceSettings: updated });
        set({ vaultQuota: { ...(await quotaService.getVaultQuota()), warningLevel: 'none' as const } });
      } else {
        logger.warn('[VaultSlice] moveToVault: Quota exceeded, cannot move to vault');
        return;
      }
    }

    let newIslands = islands;
    if (found.containerId === 'root') {
      newIslands = islands.filter((i: LiveItem) => String(i.id) !== String(item.id));
    } else {
      newIslands = islands.map((i: LiveItem) => {
        if (String(i.id) === String(found.containerId) && 'tabs' in i) {
          const group = i as Island;
          const newTabs = (group.tabs || []).filter((t: Tab) => String(t.id) !== String(item.id));
          return { ...group, tabs: newTabs };
        }
        return i;
      });
    }
    set({ islands: newIslands });
    logger.info('[VaultSlice] moveToVault: Updated islands state');

    const timestamp = Date.now();
    const itemClone = JSON.parse(JSON.stringify(item));

    const transformId = (i: (Island | Tab) & { originalId?: UniversalId }) => {
      const numericId = parseNumericId(i.id);
      i.originalId = i.originalId ?? (numericId !== null ? numericId : i.id);
      i.id = `vault-${i.id}-${timestamp}`;

      if (isIsland(i)) {
        i.tabs?.forEach((t) => transformId(t as Tab & { originalId?: UniversalId }));
      }
    };

    transformId(itemClone);
    (itemClone as VaultItem).savedAt = timestamp;

    const newVault = [...vault, itemClone as VaultItem];
    set({ vault: newVault });
    logger.info(`[VaultSlice] moveToVault: Updated vault state, now has ${newVault.length} items`);
    
    logger.info('[VaultSlice] moveToVault: Calling persistVault...');
    const result = await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
    
    if (result.success) {
      logger.info('[VaultSlice] moveToVault: Persistence successful, closing tabs');
      if (isIsland(item)) {
        const tabIds = (item.tabs || []).map((t: Tab) => parseNumericId(t.id)).filter((id): id is number => id !== null);
        if (tabIds.length > 0) {
          await tabService.closeTabs(tabIds);
        }
      } else {
        const numericId = parseNumericId(item.id);
        if (numericId !== null) {
          await tabService.closeTab(numericId);
        }
      }
      logger.info('[VaultSlice] moveToVault: Complete');
    } else {
      logger.error(`[VaultSlice] moveToVault: Persistence FAILED with error ${result.error}. Vault was rolled back.`);
    }
  },

  saveToVault: async (item) => {
    const { vault, appearanceSettings, persistVault } = get();
    
    const quotaCheck = await checkQuotaBeforeSave(item, vault);
    if (!quotaCheck.allowed) {
      if (quotaCheck.shouldSwitchToLocal && appearanceSettings.vaultSyncEnabled) {
        logger.info('[VaultSlice] saveToVault: Auto-switching to local storage due to quota');
        const updated = { ...appearanceSettings, vaultSyncEnabled: false };
        set({ appearanceSettings: updated });
        settingsService.saveSettings({ appearanceSettings: updated });
        set({ vaultQuota: { ...(await quotaService.getVaultQuota()), warningLevel: 'none' as const } });
      } else {
        logger.warn('[VaultSlice] saveToVault: Quota exceeded, cannot save to vault');
        return;
      }
    }

    let newItem = JSON.parse(JSON.stringify(item));
    const timestamp = Date.now();

    const transformId = (i: (Island | Tab) & { originalId?: UniversalId }) => {
      const numericId = parseNumericId(i.id);
      i.originalId = i.originalId ?? (numericId !== null ? numericId : i.id);
      i.id = `vault-${i.id}-${timestamp}`;
      if (isIsland(i)) {
        i.tabs?.forEach((t) => transformId(t as Tab & { originalId?: UniversalId }));
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

    if (isIsland(item)) {
      const newIds: number[] = [];
      for (const t of (item.tabs || [])) {
        const nt = await chrome.tabs.create({ url: t.url, active: false, index: insertionIndex + newIds.length });
        if (nt.id) newIds.push(nt.id);
      }
      if (newIds.length > 0) {
        await tabService.createIsland(newIds, item.title, item.color as chrome.tabGroups.Color);
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
    const pinned = vault.filter((i: VaultItem): i is Tab & { savedAt: number; originalId: UniversalId } => !isIsland(i) && !!(i as Tab).pinned);
    const vaultGroups = vault.filter(isIsland) as (Island & { savedAt: number; originalId: UniversalId; })[];
    let groups = [...vaultGroups];
    const loose = vault.filter((i: VaultItem): i is Tab & { savedAt: number; originalId: UniversalId } => !isIsland(i) && !(i as Tab).pinned);

    if (appearanceSettings.sortVaultGroupsByCount) {
      groups = groups.sort((a, b) => (b.tabs?.length || 0) - (a.tabs?.length || 0));
    }

    const sorted = [...pinned, ...groups, ...loose];
    if (sorted.every((item, idx) => item.id === vault[idx]?.id)) return;

    await reorderVault(sorted);
  },

  removeFromVault: async (id) => {
    const { vault, appearanceSettings, persistVault } = get();
    const newVault = vault.filter((v: VaultItem) => v && String(v.id) !== String(id));
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },
});
