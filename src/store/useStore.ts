import { create } from 'zustand';
import { vaultService } from '../services/vaultService';
import { quotaService } from '../services/quotaService';
import { settingsService } from '../services/settingsService';
import { logger } from '../utils/logger';
import { isAppearanceSettings, isVaultItems, defaultAppearanceSettings } from './utils';

import { createTabSlice } from './slices/useTabSlice';
import { createVaultSlice } from './slices/useVaultSlice';
import { createUISlice } from './slices/useUISlice';
import { createAppearanceSlice } from './slices/useAppearanceSlice';
import { createCommandSlice } from './slices/useCommandSlice';
import { StoreState } from './types';

// Re-export types for public API consistency
export type { 
  ThemeMode, 
  AnimationIntensity, 
  AudioIndicatorMode, 
  BorderRadius, 
  ButtonSize, 
  IconPack, 
  MenuPosition, 
  FaviconSource, 
  FaviconFallback, 
  FaviconSize,
  AppearanceSettings
} from '../types/index';

// Re-export constants and helpers for public API consistency
export { defaultAppearanceSettings } from './utils';
export { parseNumericId, isTab, isIsland, isVaultItem, isVaultItems, isAppearanceSettings, findItemInList, cloneWithDeepGroups } from './utils';

export const useStore = create<StoreState>()((...a) => ({
  ...createTabSlice(...a),
  ...createVaultSlice(...a),
  ...createUISlice(...a),
  ...createAppearanceSlice(...a),
  ...createCommandSlice(...a),
}));

// Cross-Window Sync Initialization
const init = async () => {
  const sync = await settingsService.loadSettings();

  const state = useStore.getState();

  if (sync.appearanceSettings && isAppearanceSettings(sync.appearanceSettings)) {
    state.setAppearanceSettings(sync.appearanceSettings);
  }
  if (sync.dividerPosition) state.setDividerPosition(Number(sync.dividerPosition));
  if (sync.showVault !== undefined) state.setShowVault(Boolean(sync.showVault));
  if (sync.settingsPanelWidth !== undefined) state.setSettingsPanelWidth(Number(sync.settingsPanelWidth));

  const syncEnabled = (sync.appearanceSettings && isAppearanceSettings(sync.appearanceSettings))
    ? sync.appearanceSettings.vaultSyncEnabled
    : defaultAppearanceSettings.vaultSyncEnabled;

  const migrationResult = await vaultService.migrateFromLegacy({ syncEnabled });
  if (migrationResult.migrated) {
    logger.info('[VaultStorage] Migration complete:', migrationResult);
  }

  const effectiveSyncEnabled = migrationResult.fallbackToLocal ? false : undefined;
  const loadSyncEnabled = effectiveSyncEnabled !== undefined ? effectiveSyncEnabled : syncEnabled;

  logger.info(`[Store Init] Loading vault with syncEnabled=${loadSyncEnabled} (fallbackToLocal=${migrationResult.fallbackToLocal})`);
  const { vault, timestamp } = await vaultService.loadVault({ syncEnabled: loadSyncEnabled });
  logger.info(`[Store Init] Vault loaded: ${vault.length} items, timestamp=${timestamp}`);
  useStore.setState({ vault, lastVaultTimestamp: timestamp, effectiveSyncEnabled });

  const quota = await quotaService.getVaultQuota();
  logger.info(`[Store Init] Quota: ${quota.used}/${quota.total} bytes (${Math.round(quota.percentage * 100)}%)`);
  useStore.setState({ vaultQuota: quota });

   if (quota.percentage >= 1.0) {
     logger.warn(`[Store Init] Quota critical at ${Math.round(quota.percentage * 100)}%, auto-disabling sync`);
     await vaultService.disableVaultSync(vault);
     const currentSettings = sync.appearanceSettings && isAppearanceSettings(sync.appearanceSettings) ? sync.appearanceSettings : defaultAppearanceSettings;
     const updatedSettings = { ...currentSettings, vaultSyncEnabled: false };
     useStore.setState({ 
       effectiveSyncEnabled: false,
       vaultQuota: { ...quota, warningLevel: 'none' as const }
     });
     await settingsService.saveSettings({ appearanceSettings: updatedSettings });
   }

  settingsService.watchSettings(async (changes, area) => {
    if (area === 'sync') {
      if (changes.appearanceSettings && isAppearanceSettings(changes.appearanceSettings.newValue)) {
        state.setAppearanceSettings(changes.appearanceSettings.newValue);
      }
      if (changes.showVault) state.setShowVault(Boolean(changes.showVault.newValue));
      if (changes.dividerPosition) state.setDividerPosition(Number(changes.dividerPosition.newValue));
      if (changes.settingsPanelWidth) state.setSettingsPanelWidth(Number(changes.settingsPanelWidth.newValue));

      if (changes.vault_meta) {
        const incomingTimestamp = (changes.vault_meta.newValue as { timestamp?: number })?.timestamp ?? 0;
        const currentTimestamp = useStore.getState().lastVaultTimestamp;
        // Only reload if incoming version is newer (timestamp-based conflict resolution)
        if (incomingTimestamp > currentTimestamp && !useStore.getState().isUpdating) {
          const { appearanceSettings: currentSettings, effectiveSyncEnabled: persistedSyncEnabled } = useStore.getState();
          const syncEnabled = persistedSyncEnabled !== undefined ? persistedSyncEnabled : currentSettings.vaultSyncEnabled;
          const { vault: reloadedVault } = await vaultService.loadVault({ syncEnabled });
          useStore.setState({ vault: reloadedVault, lastVaultTimestamp: incomingTimestamp });
          const quota = await quotaService.getVaultQuota();
          useStore.setState({ vaultQuota: quota });
        }
      }
    }

    if (area === 'local') {
      // For local storage, vault_meta is not written - only the vault key is updated
      // Use direct comparison since there's no timestamp metadata in local storage
      if (changes.vault && isVaultItems(changes.vault.newValue) && !useStore.getState().appearanceSettings.vaultSyncEnabled) {
        if (!useStore.getState().isUpdating) {
          useStore.setState({ vault: changes.vault.newValue });
          const quota = await quotaService.getVaultQuota();
          useStore.setState({ vaultQuota: quota });
        }
      }
    }
  });
};

init();
export type { StoreState };
