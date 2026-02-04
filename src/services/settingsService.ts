import { syncSettings } from '../store/utils';
import { AppearanceSettings } from '../types/index';

export const settingsService = {
  loadSettings: async () => {
    return chrome.storage.sync.get(['appearanceSettings', 'dividerPosition', 'showVault', 'settingsPanelWidth']);
  },

  saveSettings: (settings: Partial<{
    appearanceSettings: AppearanceSettings;
    dividerPosition: number;
    showVault: boolean;
    settingsPanelWidth: number;
  }>) => {
    syncSettings(settings);
  },

  watchSettings: (callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void) => {
    chrome.storage.onChanged.addListener(callback);
    return () => chrome.storage.onChanged.removeListener(callback);
  }
};
