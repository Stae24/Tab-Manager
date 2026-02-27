import { StateCreator } from 'zustand';
import { AppearanceSettings, ThemeMode } from '../../types/index';
import { settingsService } from '../../services/settingsService';
import { defaultAppearanceSettings } from '../utils';
import { logger, setDebugMode } from '../../utils/logger';
import { THEME_DEFINITIONS } from '../../utils/themeDefs';

export interface AppearanceSlice {
  appearanceSettings: AppearanceSettings;
  isDarkMode: boolean;
  setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
  toggleTheme: () => void;
}

const LIGHT_THEMES = ['light', 'solarized-light'];

const resolveTheme = (theme: ThemeMode): string => {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};

const applyThemeVariables = (theme: ThemeMode, elements: AppearanceSettings['themeElements']) => {
  const root = document.documentElement;

  const resolvedTheme = resolveTheme(theme);
  const isDarkBase = !LIGHT_THEMES.includes(resolvedTheme);

  const fallbackTheme = THEME_DEFINITIONS[isDarkBase ? 'dark' : 'light'];
  const activeTheme = THEME_DEFINITIONS[resolvedTheme] || THEME_DEFINITIONS.dark;

  const safeElements = elements || { background: true, panels: true, text: true, accent: true };

  root.style.setProperty('--base-dark', safeElements.background ? activeTheme.bg : fallbackTheme.bg);
  root.style.setProperty('--base-gray', safeElements.panels ? activeTheme.panel : fallbackTheme.panel);
  root.style.setProperty('--base-text', safeElements.text ? activeTheme.text : fallbackTheme.text);
  root.style.setProperty('--base-border', safeElements.panels ? activeTheme.border : fallbackTheme.border);
  root.style.setProperty('--base-muted', activeTheme.muted || (isDarkBase ? '#a1a1aa' : '#71717a'));
  root.style.setProperty('--base-subtle', activeTheme.subtle || (isDarkBase ? '#71717a' : '#a1a1aa'));
  root.style.setProperty('--base-hover', activeTheme.hover || (isDarkBase ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'));
  root.style.setProperty('--base-scrollbar', activeTheme.scrollbar || (isDarkBase ? '#333333' : '#d4d4d8'));
};

export const createAppearanceSlice: StateCreator<AppearanceSlice, [], [], AppearanceSlice> = (set, get) => ({
  appearanceSettings: { ...defaultAppearanceSettings },
  isDarkMode: true,

  setAppearanceSettings: (newSettings) => {
    const current = get().appearanceSettings;
    const updated = { ...current, ...newSettings };

    if ('vaultSyncEnabled' in newSettings) {
      logger.info('AppearanceSlice', 'vaultSyncEnabled changing:', {
        from: current.vaultSyncEnabled,
        to: newSettings.vaultSyncEnabled,
        stack: new Error().stack
      });
    }

    if ('debugMode' in newSettings) {
      setDebugMode(newSettings.debugMode ?? false);
    }

    set({ appearanceSettings: updated });

    if (newSettings.theme || newSettings.themeElements) {
      const { theme, themeElements } = updated;
      const isDarkMode =
        theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches :
          !['light', 'solarized-light'].includes(theme);

      set({ isDarkMode });
      document.documentElement.classList.toggle('dark', isDarkMode);

      applyThemeVariables(theme, themeElements);
    }

    if (newSettings.accentColor !== undefined || newSettings.themeElements !== undefined || newSettings.theme !== undefined) {
      const resolvedTheme = resolveTheme(updated.theme);
      const isLightTheme = LIGHT_THEMES.includes(resolvedTheme);
      
      let finalAccent = updated.accentColor;
      if (finalAccent === 'gx-accent') {
        finalAccent = '';
        updated.accentColor = finalAccent;
      }

      const hasCustomAccent = !!finalAccent;
      const shouldThemeAccent = updated.themeElements?.accent ?? true;
      const themeColors = THEME_DEFINITIONS[resolvedTheme] || THEME_DEFINITIONS.dark;

      if (hasCustomAccent) {
        document.documentElement.style.setProperty('--gx-accent', finalAccent);
      } else if (shouldThemeAccent) {
        document.documentElement.style.setProperty('--gx-accent', themeColors.primary);
      } else {
        document.documentElement.style.removeProperty('--gx-accent');
      }
    }

    settingsService.saveSettings({ appearanceSettings: updated });
  },

  toggleTheme: () => {
    const { appearanceSettings, setAppearanceSettings } = get();
    const isDark = !['light', 'solarized-light'].includes(appearanceSettings.theme);
    const newTheme: ThemeMode = isDark ? 'light' : 'dark';
    setAppearanceSettings({ theme: newTheme });
  },
});
