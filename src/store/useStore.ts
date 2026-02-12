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

  logger.info('[Store Init] Settings loaded:', {
    hasAppearanceSettings: !!sync.appearanceSettings,
    isValidSettings: sync.appearanceSettings ? isAppearanceSettings(sync.appearanceSettings) : false,
    storedVaultSyncEnabled: sync.appearanceSettings && isAppearanceSettings(sync.appearanceSettings) ? (sync.appearanceSettings as any).vaultSyncEnabled : undefined,
    defaultVaultSyncEnabled: defaultAppearanceSettings.vaultSyncEnabled,
    finalSyncEnabled: syncEnabled
  });

   const migrationResult = await vaultService.migrateFromLegacy({ syncEnabled });
   if (migrationResult.migrated) {
     logger.info('[VaultStorage] Migration complete:', migrationResult);
     if (migrationResult.fallbackToLocal) {
       logger.warn('[Store Init] 🔴 FALLBACK TRIGGERED: Migration detected sync quota issue');
     }
   }

   const effectiveSyncEnabled = migrationResult.fallbackToLocal ? false : undefined;
   const loadSyncEnabled = effectiveSyncEnabled !== undefined ? effectiveSyncEnabled : syncEnabled;

   logger.info(`[Store Init] Loading vault with syncEnabled=${loadSyncEnabled} (migrationFallback=${migrationResult.fallbackToLocal})`);
   const loadResult = await vaultService.loadVault({ syncEnabled: loadSyncEnabled });
   logger.info(`[Store Init] Vault loaded: ${loadResult.vault.length} items, timestamp=${loadResult.timestamp}, loadFallback=${loadResult.fallbackToLocal}`);
   
   const loadFallbackToLocal = loadResult.fallbackToLocal || migrationResult.fallbackToLocal;
   const finalEffectiveSyncEnabled = loadFallbackToLocal ? false : effectiveSyncEnabled;
   
   logger.info(`[Store Init] 📊 Final sync state:`);
   logger.info(`[Store Init]   - syncEnabled (from settings): ${syncEnabled}`);
   logger.info(`[Store Init]   - migrationResult.fallbackToLocal: ${migrationResult.fallbackToLocal}`);
   logger.info(`[Store Init]   - loadResult.fallbackToLocal: ${loadResult.fallbackToLocal}`);
   logger.info(`[Store Init]   - loadFallbackToLocal (combined): ${loadFallbackToLocal}`);
   logger.info(`[Store Init]   - effectiveSyncEnabled: ${finalEffectiveSyncEnabled}`);
   
  useStore.setState({ vault: loadResult.vault, lastVaultTimestamp: loadResult.timestamp, effectiveSyncEnabled: finalEffectiveSyncEnabled });

     if (syncEnabled && !loadFallbackToLocal) {
       const quota = await quotaService.getVaultQuota();
       logger.info(`[Store Init] 📊 Quota check: ${quota.used}/${quota.total} bytes (${Math.round(quota.percentage * 100)}%), available=${quota.available}`);
       useStore.setState({ vaultQuota: quota });

       if (quota.percentage >= 1.0) {
         logger.warn(`[Store Init] 🔴 FALLBACK TRIGGERED: Quota critical at ${Math.round(quota.percentage * 100)}% (${quota.used}/${quota.total} bytes)`);
         logger.warn(`[Store Init]   - This vault has fallen back to LOCAL storage due to full sync quota`);
         const currentSettings = sync.appearanceSettings && isAppearanceSettings(sync.appearanceSettings) ? sync.appearanceSettings : defaultAppearanceSettings;
         const updatedSettings = { ...currentSettings, vaultSyncEnabled: false };
         try {
           await vaultService.disableVaultSync(loadResult.vault);
         } catch (error) {
           logger.error('[Store Init] Failed to disable vault sync:', error);
           return;
         }
         useStore.setState({
           appearanceSettings: updatedSettings,
           effectiveSyncEnabled: false,
           vaultQuota: quota
         });
         await settingsService.saveSettings({ appearanceSettings: updatedSettings });
         logger.warn(`[Store Init] 🔴 SYNC DISABLED. To re-enable: Settings → Vault → Enable Vault Sync`);
       } else {
         logger.info(`[Store Init] ✅ Quota check passed: ${Math.round(quota.percentage * 100)}% < 100%`);
         await quotaService.logQuotaDetails();
       }
     } else if (!syncEnabled) {
       logger.info(`[Store Init] ℹ️ Sync was already disabled in settings (vaultSyncEnabled=false)`);
       const orphanedCount = await quotaService.cleanupOrphanedChunks();
       if (orphanedCount > 0) {
         logger.info(`[Store Init] Cleaned up ${orphanedCount} orphaned sync chunks`);
       }
       const quota = await quotaService.getVaultQuota();
       useStore.setState({ vaultQuota: quota });
       await quotaService.logQuotaDetails();
     } else if (loadFallbackToLocal) {
       logger.warn(`[Store Init] 🔴 FALLBACK TRIGGERED: Load/migration detected issues`);
       logger.warn(`[Store Init]   - migrationFallback=${migrationResult.fallbackToLocal}`);
       logger.warn(`[Store Init]   - loadFallback=${loadResult.fallbackToLocal}`);
       const quota = await quotaService.getVaultQuota();
       useStore.setState({ vaultQuota: quota });
       await quotaService.logQuotaDetails();
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
          if (incomingTimestamp > currentTimestamp && !useStore.getState().isUpdating) {
            try {
              const { appearanceSettings: currentSettings, effectiveSyncEnabled: persistedSyncEnabled } = useStore.getState();
              const syncEnabled = persistedSyncEnabled !== undefined ? persistedSyncEnabled : currentSettings.vaultSyncEnabled;
              const loadResult = await vaultService.loadVault({ syncEnabled });
              
              if (loadResult.fallbackToLocal) {
                const updatedSettings = { ...currentSettings, vaultSyncEnabled: false };
                useStore.setState({ 
                  vault: loadResult.vault, 
                  lastVaultTimestamp: incomingTimestamp,
                  effectiveSyncEnabled: false,
                  appearanceSettings: updatedSettings 
                });
                await settingsService.saveSettings({ appearanceSettings: updatedSettings });
              } else {
                useStore.setState({ vault: loadResult.vault, lastVaultTimestamp: incomingTimestamp });
              }
              const quota = await quotaService.getVaultQuota();
              useStore.setState({ vaultQuota: quota });
            } catch (error) {
              logger.error('[Store] Failed to sync vault from storage:', error);
            }
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
