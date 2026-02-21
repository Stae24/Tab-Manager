import { StateCreator } from 'zustand';
import { settingsService } from '../../services/settingsService';
import {
  DIVIDER_POSITION_DEFAULT,
  SETTINGS_PANEL_DEFAULT_WIDTH,
  SETTINGS_PANEL_MIN_WIDTH,
  SETTINGS_PANEL_MAX_WIDTH
} from '../../constants';
import type { SearchResult, ParsedQuery } from '../../search';

export interface UISlice {
  dividerPosition: number;
  showVault: boolean;
  isRenaming: boolean;
  showAppearancePanel: boolean;
  settingsPanelWidth: number;
  setDividerPosition: (pos: number) => void;
  setShowVault: (show: boolean) => void;
  setIsRenaming: (val: boolean) => void;
  setShowAppearancePanel: (show: boolean) => void;
  setSettingsPanelWidth: (width: number) => void;
  showSearchHelp: boolean;
  searchScope: 'current' | 'all';
  searchResults: SearchResult[];
  isSearching: boolean;
  parsedQuery: ParsedQuery | null;
  setShowSearchHelp: (show: boolean) => void;
  setSearchScope: (scope: 'current' | 'all') => void;
  setSearchResults: (results: SearchResult[]) => void;
  setIsSearching: (isSearching: boolean) => void;
  setParsedQuery: (parsed: ParsedQuery | null) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  dividerPosition: DIVIDER_POSITION_DEFAULT,
  showVault: true,
  isRenaming: false,
  showAppearancePanel: false,
  settingsPanelWidth: SETTINGS_PANEL_DEFAULT_WIDTH,
  showSearchHelp: false,
  searchScope: 'current',
  searchResults: [],
  isSearching: false,
  parsedQuery: null,

  setDividerPosition: (dividerPosition) => {
    set({ dividerPosition });
    settingsService.saveSettings({ dividerPosition });
  },

  setShowVault: (showVault) => {
    set({ showVault });
    settingsService.saveSettings({ showVault });
  },

  setIsRenaming: (isRenaming) => set({ isRenaming }),

  setShowAppearancePanel: (showAppearancePanel) => set({ showAppearancePanel }),

  setSettingsPanelWidth: (width) => {
    const clampedWidth = Math.max(SETTINGS_PANEL_MIN_WIDTH, Math.min(SETTINGS_PANEL_MAX_WIDTH, width));
    set({ settingsPanelWidth: clampedWidth });
    settingsService.saveSettings({ settingsPanelWidth: clampedWidth });
  },

  setShowSearchHelp: (showSearchHelp) => set({ showSearchHelp }),

  setSearchScope: (searchScope) => set({ searchScope }),

  setSearchResults: (searchResults) => set({ searchResults }),

  setIsSearching: (isSearching) => set({ isSearching }),

  setParsedQuery: (parsedQuery) => set({ parsedQuery }),
});
