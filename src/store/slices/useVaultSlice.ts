import { StateCreator } from 'zustand';
import LZString from 'lz-string';
import { VaultItem, VaultTab, VaultIsland, UniversalId, LiveItem, VaultQuotaInfo, VaultStorageResult, Island, Tab, CompressionTier, AppearanceSettings } from '../../types/index';
import { vaultService } from '../../services/vaultService';
import { quotaService } from '../../services/quotaService';
import { tabService } from '../../services/tabService';
import { settingsService } from '../../services/settingsService';
import { isIsland, parseNumericId, findItemInList, isAppearanceSettings } from '../utils';
import { logger } from '../../utils/logger';
import { VAULT_QUOTA_SAFETY_MARGIN_BYTES } from '../../constants';

import type { StoreState } from '../types';

async function applyRestorationHints(tabId: number, vaultTab: VaultTab, settings: AppearanceSettings): Promise<void> {
  try {
    if (settings.restorePinnedState && vaultTab.wasPinned) {
      await tabService.pinTab(tabId);
    }
    if (settings.restoreMutedState && vaultTab.wasMuted) {
      await tabService.muteTab(tabId);
    }
    if (settings.restoreFrozenState && vaultTab.wasFrozen) {
      await tabService.discardTab(tabId);
    }
  } catch (error) {
    logger.warn('VaultSlice', `Failed to apply restoration hints for tab ${tabId}:`, error);
  }
}

function estimateItemSize(item: LiveItem): number {
  const json = JSON.stringify(item);
  return new TextEncoder().encode(json).length * 2;
}

async function checkQuotaBeforeSave(
  item: LiveItem,
  currentVault: VaultItem[],
  syncEnabled: boolean
): Promise<{ allowed: boolean; shouldSwitchToLocal: boolean }> {
  if (!syncEnabled) {
    return { allowed: true, shouldSwitchToLocal: false };
  }

  const quota = await quotaService.getVaultQuota();
  const safetyMargin = VAULT_QUOTA_SAFETY_MARGIN_BYTES;

  if (!currentVault.length) {
    const estimatedItemSize = estimateItemSize(item);
    return {
      allowed: quota.available - estimatedItemSize >= safetyMargin,
      shouldSwitchToLocal: false
    };
  }

  const testVault = [...currentVault, { ...item, savedAt: Date.now(), originalId: item.id } as VaultItem];
  const testJson = JSON.stringify(testVault);
  const compressed = LZString.compressToUTF16(testJson);
  const estimatedCompressedSize = compressed.length * 2;

  const netNewBytes = estimatedCompressedSize - quota.used;
  const estimatedRequiredBytes = netNewBytes + safetyMargin;

  if (estimatedRequiredBytes > quota.available) {
    return { allowed: false, shouldSwitchToLocal: true };
  }

  return { allowed: true, shouldSwitchToLocal: false };
}

export interface VaultSlice {
  vault: VaultItem[];
  vaultQuota: VaultQuotaInfo | null;
  quotaExceededPending: VaultStorageResult | null;
  lastVaultTimestamp: number;
  effectiveSyncEnabled: boolean;
  syncRecovered: boolean;
  compressionTier: CompressionTier;
  showCompressionWarning: boolean;

  moveToVault: (id: UniversalId) => Promise<void>;
  saveToVault: (item: LiveItem) => Promise<void>;
  restoreFromVault: (id: UniversalId) => Promise<void>;
  removeFromVault: (id: UniversalId) => Promise<void>;
  createVaultGroup: () => Promise<void>;
  reorderVault: (newVault: VaultItem[]) => Promise<void>;
  toggleVaultGroupCollapse: (id: UniversalId) => Promise<void>;
  sortVaultGroupsToTop: () => Promise<void>;
  deleteVaultDuplicates: () => Promise<void>;
  refreshVaultQuota: () => Promise<void>;
  clearQuotaExceeded: () => void;
  setVaultSyncEnabled: (enabled: boolean) => Promise<VaultStorageResult>;
  clearSyncRecovered: () => void;
  dismissCompressionWarning: () => void;
  toggleVaultTabHint: (id: UniversalId, hint: 'wasPinned' | 'wasMuted' | 'wasFrozen') => Promise<void>;

  persistVault: (vault: VaultItem[], syncEnabled: boolean, previousVault?: VaultItem[]) => Promise<VaultStorageResult>;
}

export const createVaultSlice: StateCreator<StoreState, [], [], VaultSlice> = (set, get) => ({
  vault: [],
  vaultQuota: null,
  quotaExceededPending: null,
  lastVaultTimestamp: 0,
  effectiveSyncEnabled: true,
  syncRecovered: false,
  compressionTier: 'full',
  showCompressionWarning: false,

  clearSyncRecovered: () => set({ syncRecovered: false }),

  dismissCompressionWarning: () => set({ showCompressionWarning: false }),

  persistVault: async (vault: VaultItem[], syncEnabled: boolean, previousVault?: VaultItem[]): Promise<VaultStorageResult> => {
    const capturedPreviousVault = previousVault ?? get().vault;
    const { effectiveSyncEnabled } = get();

    logger.info('VaultSlice', 'persistVault called:', {
      syncEnabledParam: syncEnabled,
      effectiveSyncEnabled,
      vaultItemCount: vault.length
    });

    if (effectiveSyncEnabled) {
      const quota = await quotaService.getVaultQuota();
      if (quota.percentage >= 1.0) {
        logger.warn('VaultSlice', `Already at ${Math.round(quota.percentage * 100)}%, forcing local fallback`);

        const { appearanceSettings } = get();
        const updated = { ...appearanceSettings, vaultSyncEnabled: false };
        set({ appearanceSettings: updated, effectiveSyncEnabled: false });
        try {
          await settingsService.saveSettings({ appearanceSettings: updated });
        } catch (error) {
          logger.error('VaultSlice', 'Failed to save settings before disabling sync chunks:', error);
        }

        const disableResult = await vaultService.disableVaultSync(vault);
        if (!disableResult.success) {
          return { success: false, error: disableResult.error || 'SYNC_FAILED' };
        }

        const newQuota = await quotaService.getVaultQuota();
        set({ vaultQuota: newQuota, lastVaultTimestamp: Date.now() });

        return { success: true, warningLevel: 'none' };
      }
    }

    const result = await vaultService.saveVault(vault, { syncEnabled: effectiveSyncEnabled });

    if (!result.success) {
      set({ vault: capturedPreviousVault });
      logger.error('VaultSlice', 'Persistence failed:', result.error);
    }

    if (result.success) {
      if (result.compressionTier && result.compressionTier !== 'full') {
        logger.info('VaultSlice', `Compression tier used: ${result.compressionTier}`);
        set({
          compressionTier: result.compressionTier,
          showCompressionWarning: true
        });
      } else {
        set({ compressionTier: 'full', showCompressionWarning: false });
      }
    }

    if (result.fallbackToLocal) {
      const { appearanceSettings } = get();
      logger.warn('VaultSlice', 'Auto-disabling vault sync due to size limits');

      const updated = { ...appearanceSettings, vaultSyncEnabled: false };
      set({ appearanceSettings: updated, effectiveSyncEnabled: false });
      try {
        await settingsService.saveSettings({ appearanceSettings: updated });
      } catch (error) {
        logger.error('VaultSlice', 'Failed to save settings after fallback to local:', error);
        const freshSettings = await settingsService.loadSettings();
        if (freshSettings.appearanceSettings && isAppearanceSettings(freshSettings.appearanceSettings)) {
          set({ appearanceSettings: freshSettings.appearanceSettings });
        }
      }

      const disableResult = await vaultService.disableVaultSync(vault);
      if (!disableResult.success) {
        return { success: false, error: disableResult.error || 'SYNC_FAILED' };
      }

      const newQuota = await quotaService.getVaultQuota();
      set({ vaultQuota: newQuota, lastVaultTimestamp: Date.now() });
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
      set({ appearanceSettings: updated, effectiveSyncEnabled: enabled });
      try {
        await settingsService.saveSettings({ appearanceSettings: updated });
      } catch (error) {
        logger.error('VaultSlice', 'Failed to save settings after toggling sync:', error);
        const freshSettings = await settingsService.loadSettings();
        if (freshSettings.appearanceSettings && isAppearanceSettings(freshSettings.appearanceSettings)) {
          set({ appearanceSettings: freshSettings.appearanceSettings });
        }
      }
      const quota = await quotaService.getVaultQuota();
      set({ vaultQuota: quota });
    } else if (result.fallbackToLocal) {
      const updated = { ...appearanceSettings, vaultSyncEnabled: false };
      set({ appearanceSettings: updated, effectiveSyncEnabled: false });
      try {
        await settingsService.saveSettings({ appearanceSettings: updated });
      } catch (error) {
        logger.error('VaultSlice', 'Failed to save settings after fallback to local:', error);
        const freshSettings = await settingsService.loadSettings();
        if (freshSettings.appearanceSettings && isAppearanceSettings(freshSettings.appearanceSettings)) {
          set({ appearanceSettings: freshSettings.appearanceSettings });
        }
      }
      const quota = await quotaService.getVaultQuota();
      set({ vaultQuota: { ...quota, warningLevel: 'none' as const } });
    }

    return result;
  },

  moveToVault: async (id) => {
    const { islands, vault, appearanceSettings, persistVault } = get();

    const originalIslands = islands;

    const found = findItemInList(islands, id);
    if (!found || !found.item) {
      logger.warn('VaultSlice', `moveToVault: Item ${id} not found in islands`);
      return;
    }
    const item = found.item;
    const isGroup = isIsland(item);
    const tabCount = isGroup ? (item.tabs?.length || 0) : 1;

    logger.info('VaultSlice', `moveToVault: Moving ${isGroup ? 'group' : 'tab'} (${tabCount} tabs) to vault. ID: ${item.id}`);
    logger.info('VaultSlice', `moveToVault: Current vault has ${vault.length} items, syncEnabled=${appearanceSettings.vaultSyncEnabled}`);

    const { effectiveSyncEnabled } = get();
    const quotaCheck = await checkQuotaBeforeSave(item, vault, effectiveSyncEnabled);
    if (!quotaCheck.allowed) {
      if (quotaCheck.shouldSwitchToLocal && appearanceSettings.vaultSyncEnabled) {
        logger.info('VaultSlice', 'moveToVault: Auto-switching to local storage due to quota');
        const updated = { ...appearanceSettings, vaultSyncEnabled: false };
        set({ appearanceSettings: updated, effectiveSyncEnabled: false });
        try {
          await settingsService.saveSettings({ appearanceSettings: updated });
        } catch (error) {
          logger.error('VaultSlice', 'Failed to save settings after auto-switch to local:', error);
          const freshSettings = await settingsService.loadSettings();
          if (freshSettings.appearanceSettings && isAppearanceSettings(freshSettings.appearanceSettings)) {
            set({ appearanceSettings: freshSettings.appearanceSettings });
          }
        }
        set({ vaultQuota: { ...(await quotaService.getVaultQuota()), warningLevel: 'none' as const } });
      } else {
        logger.warn('VaultSlice', 'moveToVault: Quota exceeded, cannot move to vault');
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
    logger.info('VaultSlice', 'moveToVault: Updated islands state');

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
    logger.info('VaultSlice', `moveToVault: Updated vault state, now has ${newVault.length} items`);

    const { appearanceSettings: freshSettings, effectiveSyncEnabled: freshEffective } = get();
    logger.info('VaultSlice', `moveToVault: Calling persistVault with syncEnabled=${freshSettings.vaultSyncEnabled} effectiveSyncEnabled=${freshEffective}`);

    const result = await persistVault(newVault, freshSettings.vaultSyncEnabled, vault);

    if (result.success) {
      logger.info('VaultSlice', 'moveToVault: Persistence successful, closing tabs');
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
      logger.info('VaultSlice', 'moveToVault: Complete');
    } else {
      logger.error('VaultSlice', `moveToVault: Persistence FAILED with error ${result.error}. Vault was rolled back.`);
      set({ islands: originalIslands });
    }
  },

  saveToVault: async (item) => {
    const { vault, appearanceSettings, persistVault, effectiveSyncEnabled } = get();
    const previousVault = vault;

    const quotaCheck = await checkQuotaBeforeSave(item, vault, effectiveSyncEnabled);
    if (!quotaCheck.allowed) {
      if (quotaCheck.shouldSwitchToLocal && appearanceSettings.vaultSyncEnabled) {
        logger.info('VaultSlice', 'saveToVault: Auto-switching to local storage due to quota');
        const updated = { ...appearanceSettings, vaultSyncEnabled: false };
        set({ appearanceSettings: updated, effectiveSyncEnabled: false });
        try {
          await settingsService.saveSettings({ appearanceSettings: updated });
        } catch (error) {
          logger.error('VaultSlice', 'Failed to save settings after auto-switch to local:', error);
          const freshSettings = await settingsService.loadSettings();
          if (freshSettings.appearanceSettings && isAppearanceSettings(freshSettings.appearanceSettings)) {
            set({ appearanceSettings: freshSettings.appearanceSettings });
          }
        }
        set({ vaultQuota: { ...(await quotaService.getVaultQuota()), warningLevel: 'none' as const } });
      } else {
        logger.warn('VaultSlice', 'saveToVault: Quota exceeded, cannot save to vault');
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

    const { appearanceSettings: freshSettings, effectiveSyncEnabled: freshEffective } = get();
    logger.info('VaultSlice', `saveToVault: Calling persistVault with syncEnabled=${freshSettings.vaultSyncEnabled} effectiveSyncEnabled=${freshEffective}`);
    const result = await persistVault(newVault, freshSettings.vaultSyncEnabled, previousVault);
    if (!result.success) {
      logger.error('VaultSlice', `saveToVault: persistVault failed with error ${result.error}. Rolling back.`);
      set({ vault: previousVault });
    }
  },

  restoreFromVault: async (id) => {
    const { vault, appearanceSettings } = get();
    const itemIndex = vault.findIndex((v: VaultItem) => String(v.id) === String(id));
    if (itemIndex === -1) return;

    const item = vault[itemIndex];

    let insertionIndex = 0;
    const currentWindowTabs = await tabService.getCurrentWindowTabs();
    const currentWindowGroups = await tabService.getCurrentWindowGroups();

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

    if ('tabs' in item && Array.isArray(item.tabs)) {
      const vaultIsland = item as VaultIsland;
      const newIds: number[] = [];
      for (const t of vaultIsland.tabs) {
        const nt = await tabService.createTab({ url: t.url, active: false, index: insertionIndex + newIds.length });
        if (nt.id) {
          newIds.push(nt.id);
          await applyRestorationHints(nt.id, t, appearanceSettings);
        }
      }
      if (newIds.length > 0) {
        await tabService.createIsland(newIds, vaultIsland.title, vaultIsland.color as chrome.tabGroups.Color);
      }
    } else {
      const vaultTab = item as VaultTab;
      const nt = await tabService.createTab({ url: vaultTab.url, active: false, index: insertionIndex });
      if (nt.id) {
        await applyRestorationHints(nt.id, vaultTab, appearanceSettings);
      }
    }
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
    const vaultTabs: VaultTab[] = [];
    const vaultGroups: VaultIsland[] = [];

    for (const item of vault) {
      if ('tabs' in item && Array.isArray(item.tabs)) {
        vaultGroups.push(item as VaultIsland);
      } else {
        vaultTabs.push(item as VaultTab);
      }
    }

    const pinned = vaultTabs.filter(t => t.wasPinned);
    const loose = vaultTabs.filter(t => !t.wasPinned);
    let groups = [...vaultGroups];

    if (appearanceSettings.sortVaultGroupsByCount) {
      groups = groups.sort((a, b) => (b.tabs?.length || 0) - (a.tabs?.length || 0));
    }

    const sorted: VaultItem[] = [...pinned, ...groups, ...loose];
    if (sorted.every((item, idx) => item.id === vault[idx]?.id)) return;

    await reorderVault(sorted);
  },

  deleteVaultDuplicates: async () => {
    const { vault, appearanceSettings, persistVault } = get();

    const urlMap = new Map<string, VaultItem[]>();

    const collectUrls = (item: VaultItem) => {
      if ('tabs' in item && Array.isArray(item.tabs)) {
        const island = item as VaultIsland;
        for (const tab of island.tabs) {
          if (tab.url) {
            try {
              const url = new URL(tab.url);
              const normalized = `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '').toLowerCase()}${url.search}`;
              const existing = urlMap.get(normalized) || [];
              existing.push(item);
              urlMap.set(normalized, existing);
            } catch {
              const normalized = tab.url.split('#')[0].trim().replace(/\/+$/, '');
              const existing = urlMap.get(normalized) || [];
              existing.push(item);
              urlMap.set(normalized, existing);
            }
          }
        }
      } else {
        const tab = item as VaultTab;
        if (tab.url) {
          try {
            const url = new URL(tab.url);
            const normalized = `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '').toLowerCase()}${url.search}`;
            const existing = urlMap.get(normalized) || [];
            existing.push(item);
            urlMap.set(normalized, existing);
          } catch {
            const normalized = tab.url.split('#')[0].trim().replace(/\/+$/, '');
            const existing = urlMap.get(normalized) || [];
            existing.push(item);
            urlMap.set(normalized, existing);
          }
        }
      }
    };

    vault.forEach(collectUrls);

    const duplicateIds = new Set<string>();
    urlMap.forEach((items) => {
      if (items.length > 1) {
        items.slice(1).forEach(item => {
          duplicateIds.add(String(item.id));
        });
      }
    });

    if (duplicateIds.size === 0) return;

    const newVault = vault.filter((v: VaultItem) => !duplicateIds.has(String(v.id)));
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);

    logger.info('VaultSlice', `Deleted ${duplicateIds.size} duplicate items from vault`);
  },

  removeFromVault: async (id) => {
    const { vault, appearanceSettings, persistVault } = get();
    const newVault = vault.filter((v: VaultItem) => v && String(v.id) !== String(id));
    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },

  toggleVaultTabHint: async (id, hint) => {
    const { vault, appearanceSettings, persistVault } = get();
    const idStr = String(id);

    const newVault = vault.map((item: VaultItem) => {
      if (String(item.id) === idStr && !('tabs' in item)) {
        const vaultTab = item as VaultTab;
        return { ...vaultTab, [hint]: !vaultTab[hint] };
      }
      if ('tabs' in item && Array.isArray(item.tabs)) {
        const vaultIsland = item as VaultIsland;
        const newTabs = vaultIsland.tabs.map((tab: VaultTab) => {
          if (String(tab.id) === idStr) {
            return { ...tab, [hint]: !tab[hint] };
          }
          return tab;
        });
        return { ...vaultIsland, tabs: newTabs };
      }
      return item;
    });

    set({ vault: newVault });
    await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
  },
});
