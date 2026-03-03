import { syncSettings, syncLocalSettings } from '../store/utils';
import { AppearanceSettings } from '../types/index';
import { logger } from '../utils/logger';
import { LOCAL_UI_SETTINGS_KEY } from '../constants';

export interface LocalUISettings {
  dividerPosition?: number;
  showVault?: boolean;
  settingsPanelWidth?: number;
}

export const settingsService = {
  loadSettings: async () => {
    const result = await chrome.storage.sync.get(['appearanceSettings']);
    logger.info('SettingsService', 'Loaded sync settings:', {
      hasAppearanceSettings: !!result.appearanceSettings,
      vaultSyncEnabled: (result.appearanceSettings as AppearanceSettings)?.vaultSyncEnabled
    });
    return result;
  },

  saveSettings: (settings: Partial<{
    appearanceSettings: AppearanceSettings;
  }>) => {
    if (settings.appearanceSettings) {
      logger.info('SettingsService', 'Saving settings - vaultSyncEnabled:', settings.appearanceSettings.vaultSyncEnabled);
    }
    syncSettings(settings);
  },

  loadLocalSettings: async (): Promise<LocalUISettings> => {
    const result = await chrome.storage.local.get([LOCAL_UI_SETTINGS_KEY]);
    const settings = result[LOCAL_UI_SETTINGS_KEY] as LocalUISettings | undefined;
    logger.info('SettingsService', 'Loaded local UI settings:', {
      hasSettings: !!settings,
      dividerPosition: settings?.dividerPosition,
      showVault: settings?.showVault,
      settingsPanelWidth: settings?.settingsPanelWidth
    });
    return settings || {};
  },

  saveLocalSettings: (settings: LocalUISettings) => {
    logger.info('SettingsService', 'Saving local UI settings:', settings);
    syncLocalSettings(settings);
  },

  watchSettings: (callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void) => {
    chrome.storage.onChanged.addListener(callback);
    return () => chrome.storage.onChanged.removeListener(callback);
  }
};
