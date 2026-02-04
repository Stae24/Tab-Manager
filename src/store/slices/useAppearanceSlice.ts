import { StateCreator } from 'zustand';
import { AppearanceSettings, ThemeMode } from '../../types/index';
import { defaultAppearanceSettings, syncSettings } from '../utils';

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

    // Apply theme changes immediately
    if (newSettings.theme) {
      const { theme } = updated;
      const isDarkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      set({ isDarkMode });
      document.documentElement.classList.toggle('dark', isDarkMode);
    }

    // Apply accent color immediately
    if (newSettings.accentColor) {
      document.documentElement.style.setProperty('--gx-accent', newSettings.accentColor);
    }

    syncSettings({ appearanceSettings: updated });
  },

  toggleTheme: () => {
    const { appearanceSettings, setAppearanceSettings } = get();
    const newTheme: ThemeMode = appearanceSettings.theme === 'dark' ? 'light' : appearanceSettings.theme === 'light' ? 'dark' : 'system';
    setAppearanceSettings({ theme: newTheme });
  },
});
