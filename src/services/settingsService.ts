import { syncSettings } from '../store/utils';
import { AppearanceSettings } from '../types/index';
import { logger } from '../utils/logger';

export const settingsService = {
  loadSettings: async () => {
    const result = await chrome.storage.sync.get(['appearanceSettings', 'dividerPosition', 'showVault', 'settingsPanelWidth']);
    logger.info('[SettingsService] Loaded settings:', {
      hasAppearanceSettings: !!result.appearanceSettings,
      vaultSyncEnabled: (result.appearanceSettings as AppearanceSettings)?.vaultSyncEnabled
    });
    return result;
  },

  saveSettings: (settings: Partial<{
    appearanceSettings: AppearanceSettings;
    dividerPosition: number;
    showVault: boolean;
    settingsPanelWidth: number;
  }>) => {
    if (settings.appearanceSettings) {
      logger.info('[SettingsService] Saving settings - vaultSyncEnabled:', settings.appearanceSettings.vaultSyncEnabled);
    }
    syncSettings(settings);
  },

  watchSettings: (callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void) => {
    chrome.storage.onChanged.addListener(callback);
    return () => chrome.storage.onChanged.removeListener(callback);
  }
};
