import { create } from 'zustand';
import { loadVault, migrateFromLegacy, getVaultQuota } from '../utils/vaultStorage';
import { isAppearanceSettings, isVaultItems, defaultAppearanceSettings } from './utils';

import { createTabSlice } from './slices/useTabSlice';
import { createVaultSlice } from './slices/useVaultSlice';
import { createUISlice } from './slices/useUISlice';
import { createAppearanceSlice } from './slices/useAppearanceSlice';
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
export { parseNumericId, isTab, isIsland, isVaultItem, isVaultItems, isAppearanceSettings, findItemInList } from './utils';

export const useStore = create<StoreState>()((...a) => ({
  ...createTabSlice(...a),
  ...createVaultSlice(...a),
  ...createUISlice(...a),
  ...createAppearanceSlice(...a),
}));

// Cross-Window Sync Initialization
const init = async () => {
  const sync = await chrome.storage.sync.get(['appearanceSettings', 'dividerPosition', 'showVault', 'settingsPanelWidth']);

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

  const migrationResult = await migrateFromLegacy({ syncEnabled });
  if (migrationResult.migrated) {
    console.log('[VaultStorage] Migration complete:', migrationResult);
  }

  const { vault, timestamp } = await loadVault({ syncEnabled });
  useStore.setState({ vault, lastVaultTimestamp: timestamp });

  const quota = await getVaultQuota();
  useStore.setState({ vaultQuota: quota });

  chrome.storage.onChanged.addListener(async (changes, area) => {
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
          const currentSettings = useStore.getState().appearanceSettings;
          const { vault: reloadedVault } = await loadVault({ syncEnabled: currentSettings.vaultSyncEnabled });
          useStore.setState({ vault: reloadedVault, lastVaultTimestamp: incomingTimestamp });
          const quota = await getVaultQuota();
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
          const quota = await getVaultQuota();
          useStore.setState({ vaultQuota: quota });
        }
      }
    }
  });
};

init();
export type { StoreState };
