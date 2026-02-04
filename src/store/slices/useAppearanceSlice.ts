import { StateCreator } from 'zustand';
import { AppearanceSettings, ThemeMode } from '../../types/index';
import { settingsService } from '../../services/settingsService';
import { defaultAppearanceSettings } from '../utils';

export interface AppearanceSlice {
  appearanceSettings: AppearanceSettings;
  isDarkMode: boolean;
  setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
  toggleTheme: () => void;
}

export const createAppearanceSlice: StateCreator<AppearanceSlice, [], [], AppearanceSlice> = (set, get) => ({
  appearanceSettings: { ...defaultAppearanceSettings },
  isDarkMode: true,

  setAppearanceSettings: (newSettings) => {
    const current = get().appearanceSettings;
    const updated = { ...current, ...newSettings };
    set({ appearanceSettings: updated });

    if (newSettings.theme) {
      const { theme } = updated;
      const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      set({ isDarkMode });
      document.documentElement.classList.toggle('dark', isDarkMode);
    }

    if (newSettings.accentColor) {
      document.documentElement.style.setProperty('--gx-accent', newSettings.accentColor);
    }

    settingsService.saveSettings({ appearanceSettings: updated });
  },

  toggleTheme: () => {
    const { appearanceSettings, setAppearanceSettings } = get();
    const newTheme: ThemeMode = appearanceSettings.theme === 'dark' ? 'light' : appearanceSettings.theme === 'light' ? 'dark' : 'system';
    setAppearanceSettings({ theme: newTheme });
  },
});
