import { create } from 'zustand';
import { vaultService } from '../services/vaultService';
import { quotaService } from '../services/quotaService';
import { settingsService, LocalUISettings } from '../services/settingsService';
import { logger, setDebugMode } from '../utils/logger';
import { isAppearanceSettings, isVaultItems, defaultAppearanceSettings, mergeAppearanceSettings } from './utils';
import { detectBrowser } from '../utils/browser';

import { createTabSlice } from './slices/useTabSlice';
import { createVaultSlice } from './slices/useVaultSlice';
import { createUISlice } from './slices/useUISlice';
import { createAppearanceSlice } from './slices/useAppearanceSlice';
import { createCommandSlice } from './slices/useCommandSlice';
import { StoreState } from './types';
import { AppearanceSettings, VaultLoadResult, VaultItem } from '../types/index';
import { VAULT_LOAD_MAX_RETRIES, VAULT_LOAD_RETRY_BASE_DELAY_MS } from '../constants';

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
  AppearanceSettings,
  HotkeyBinding,
  ToolbarClickAction,
  SidebarLayoutMode,
  SidebarDockSide
} from '../types/index';

// Re-export constants and helpers for public API consistency
export { defaultAppearanceSettings } from './utils';
export { parseNumericId, isTab, isIsland, isVaultItem, isVaultItems, isAppearanceSettings, findItemInList, cloneWithDeepGroups, isVaultId, isLiveId } from './utils';

export const useStore = create<StoreState>()((...a) => ({
  ...createTabSlice(...a),
  ...createVaultSlice(...a),
  ...createUISlice(...a),
  ...createAppearanceSlice(...a),
  ...createCommandSlice(...a),
}));

async function loadVaultWithRetry(syncEnabled: boolean, attempt = 1): Promise<VaultLoadResult> {
  const result = await vaultService.loadVault({ syncEnabled });

  if (!result.fallbackToLocal) {
    return result;
  }

  if (attempt < VAULT_LOAD_MAX_RETRIES) {
    const delay = VAULT_LOAD_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    logger.warn('Store', `Load attempt ${attempt} failed with fallback, retrying in ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return loadVaultWithRetry(syncEnabled, attempt + 1);
  }

  logger.warn('Store', `All ${VAULT_LOAD_MAX_RETRIES} load attempts failed`);
  return result;
}

async function attemptSelfHealing(vault: VaultItem[], syncEnabled: boolean): Promise<{ success: boolean; effectiveSyncEnabled: boolean }> {
  if (!syncEnabled) {
    return { success: true, effectiveSyncEnabled: false };
  }

  logger.info('Store', 'Attempting self-healing from backup...');

  try {
    const saveResult = await vaultService.recoverVaultSync(vault);

    if (saveResult.success && !saveResult.fallbackToLocal) {
      logger.info('Store', 'Self-healing successful - sync recovered');
      return { success: true, effectiveSyncEnabled: true };
    }

    if (saveResult.fallbackToLocal) {
      logger.warn('Store', 'Self-healing failed - quota exceeded, falling back to local');
      return { success: false, effectiveSyncEnabled: false };
    }

    logger.warn('Store', 'Self-healing failed - save error');
    return { success: false, effectiveSyncEnabled: false };
  } catch (error) {
    logger.error('Store', 'Self-healing error:', error);
    return { success: false, effectiveSyncEnabled: false };
  }
}

const init = async () => {
  const [sync, local] = await Promise.all([
    settingsService.loadSettings(),
    settingsService.loadLocalSettings()
  ]);

  const state = useStore.getState();

  if (sync.appearanceSettings) {
    const mergedSettings = mergeAppearanceSettings(sync.appearanceSettings);
    state.setAppearanceSettings(mergedSettings);
  } else {
    state.setAppearanceSettings(defaultAppearanceSettings);
  }

  // Load local-only UI settings (not synced)
  if (local.dividerPosition !== undefined) {
    state.setDividerPosition(Number(local.dividerPosition));
  }
  if (local.showVault !== undefined) {
    state.setShowVault(Boolean(local.showVault));
  }
  if (local.settingsPanelWidth !== undefined) {
    state.setSettingsPanelWidth(Number(local.settingsPanelWidth));
  }

  const debugMode = sync.appearanceSettings
    ? mergeAppearanceSettings(sync.appearanceSettings).debugMode
    : defaultAppearanceSettings.debugMode;
  setDebugMode(debugMode);

  const syncEnabled = sync.appearanceSettings
    ? mergeAppearanceSettings(sync.appearanceSettings).vaultSyncEnabled
    : defaultAppearanceSettings.vaultSyncEnabled;

  logger.info('Store', 'Settings loaded:', {
    hasAppearanceSettings: !!sync.appearanceSettings,
    isValidSettings: sync.appearanceSettings ? isAppearanceSettings(sync.appearanceSettings) : false,
    storedVaultSyncEnabled: sync.appearanceSettings ? mergeAppearanceSettings(sync.appearanceSettings).vaultSyncEnabled : undefined,
    defaultVaultSyncEnabled: defaultAppearanceSettings.vaultSyncEnabled,
    finalSyncEnabled: syncEnabled
  });

  const browserVendor = await detectBrowser();
  logger.info('Store', `Browser detected: ${browserVendor}`);

  await state.initBrowserCapabilities();

  const migrationResult = await vaultService.migrateFromLegacy({ syncEnabled });
  if (migrationResult.migrated) {
    logger.info('Store', 'Migration complete:', migrationResult);
  }

  let effectiveSyncEnabled = syncEnabled;

  if (migrationResult.fallbackToLocal) {
    logger.warn('Store', 'Migration triggered fallback to local');
    effectiveSyncEnabled = false;
    const currentSettings = sync.appearanceSettings
      ? mergeAppearanceSettings(sync.appearanceSettings)
      : defaultAppearanceSettings;
    const updatedSettings = { ...currentSettings, vaultSyncEnabled: false };
    useStore.setState({ appearanceSettings: updatedSettings, showSyncDisabledWarning: true });
    await settingsService.saveSettings({ appearanceSettings: updatedSettings });
  }

  logger.info('Store', `Loading vault with syncEnabled=${effectiveSyncEnabled}`);
  const loadResult = await loadVaultWithRetry(effectiveSyncEnabled);
  logger.info('Store', `Vault loaded: ${loadResult.vault.length} items, timestamp=${loadResult.timestamp}, fallback=${loadResult.fallbackToLocal}`);

  if (loadResult.fallbackToLocal && effectiveSyncEnabled) {
    logger.warn('Store', 'Load detected corrupted/missing sync data');

    const recovery = await attemptSelfHealing(loadResult.vault, effectiveSyncEnabled);

    if (recovery.success && recovery.effectiveSyncEnabled) {
      useStore.setState({
        vault: loadResult.vault,
        lastVaultTimestamp: loadResult.timestamp,
        effectiveSyncEnabled: true,
        syncRecovered: true
      });
      logger.info('Store', 'Sync recovered from backup');
    } else {
      effectiveSyncEnabled = false;
      const currentSettings = sync.appearanceSettings
        ? mergeAppearanceSettings(sync.appearanceSettings)
        : defaultAppearanceSettings;
      const updatedSettings = { ...currentSettings, vaultSyncEnabled: false };

      await vaultService.disableVaultSync(loadResult.vault);

      useStore.setState({
        vault: loadResult.vault,
        lastVaultTimestamp: loadResult.timestamp,
        effectiveSyncEnabled: false,
        appearanceSettings: updatedSettings,
        showSyncDisabledWarning: true
      });
      await settingsService.saveSettings({ appearanceSettings: updatedSettings });
      logger.warn('Store', 'Sync disabled - using local storage');
    }
  } else {
    useStore.setState({
      vault: loadResult.vault,
      lastVaultTimestamp: loadResult.timestamp,
      effectiveSyncEnabled
    });
  }

  if (effectiveSyncEnabled) {
    const quota = await quotaService.getVaultQuota();
    logger.info('Store', `Quota check: ${quota.used}/${quota.total} bytes (${Math.round(quota.percentage * 100)}%)`);
    useStore.setState({ vaultQuota: quota });
    // Warning banner will show automatically based on warningLevel
  } else {
    logger.info('Store', 'Sync disabled - using local storage');
    const orphanedCount = await quotaService.cleanupOrphanedChunks();
    if (orphanedCount > 0) {
      logger.info('Store', `Cleaned up ${orphanedCount} orphaned sync chunks`);
    }
    const quota = await quotaService.getVaultQuota();
    useStore.setState({ vaultQuota: quota });
    await quotaService.logQuotaDetails();
  }

  settingsService.watchSettings(async (changes, area) => {
    const { setAppearanceSettings, setShowVault, setDividerPosition, setSettingsPanelWidth } = useStore.getState();
    if (area === 'sync') {
      if (changes.appearanceSettings?.newValue) {
        setAppearanceSettings(mergeAppearanceSettings(changes.appearanceSettings.newValue));
      }

      if (changes.vault_meta) {
        const incomingTimestamp = (changes.vault_meta.newValue as { timestamp?: number })?.timestamp ?? 0;
        const currentTimestamp = useStore.getState().lastVaultTimestamp;
        if (incomingTimestamp > currentTimestamp && !useStore.getState().isUpdating) {
          try {
            const { effectiveSyncEnabled: currentSyncEnabled } = useStore.getState();
            const loadResult = await vaultService.loadVault({ syncEnabled: currentSyncEnabled });

            if (loadResult.fallbackToLocal) {
              const { appearanceSettings: currentSettings } = useStore.getState();
              const updatedSettings = { ...currentSettings, vaultSyncEnabled: false };
              useStore.setState({
                vault: loadResult.vault,
                lastVaultTimestamp: incomingTimestamp,
                effectiveSyncEnabled: false,
                appearanceSettings: updatedSettings,
                showSyncDisabledWarning: true
              });
              await settingsService.saveSettings({ appearanceSettings: updatedSettings });
            } else {
              useStore.setState({ vault: loadResult.vault, lastVaultTimestamp: incomingTimestamp });
            }
            const quota = await quotaService.getVaultQuota();
            useStore.setState({ vaultQuota: quota });
          } catch (error) {
            logger.error('Store', 'Failed to sync vault from storage:', error);
          }
        }
      }
    }

    if (area === 'local') {
      if (changes.vault && isVaultItems(changes.vault.newValue) && !useStore.getState().effectiveSyncEnabled) {
        if (!useStore.getState().isUpdating) {
          useStore.setState({ vault: changes.vault.newValue });
          const quota = await quotaService.getVaultQuota();
          useStore.setState({ vaultQuota: quota });
        }
      }
      // Handle local-only UI settings changes
      if (changes.ui_settings_local?.newValue && !useStore.getState().isUpdating) {
        const localSettings = changes.ui_settings_local.newValue as LocalUISettings;
        if (localSettings.dividerPosition !== undefined) setDividerPosition(Number(localSettings.dividerPosition));
        if (localSettings.showVault !== undefined) setShowVault(Boolean(localSettings.showVault));
        if (localSettings.settingsPanelWidth !== undefined) setSettingsPanelWidth(Number(localSettings.settingsPanelWidth));
      }
    }
  });
};

init();
export type { StoreState };
