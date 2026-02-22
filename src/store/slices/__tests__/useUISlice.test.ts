import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/settingsService', () => ({
  settingsService: {
    saveSettings: vi.fn().mockResolvedValue(undefined),
    loadSettings: vi.fn().mockResolvedValue({}),
    watchSettings: vi.fn(() => vi.fn()),
  },
}));

vi.resetModules();

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  },
  writable: true,
  configurable: true,
});

import { useStore } from '../../useStore';
import { settingsService } from '../../../services/settingsService';
import { SETTINGS_PANEL_MIN_WIDTH, SETTINGS_PANEL_MAX_WIDTH } from '../../../constants';
import type { SearchResult, ParsedQuery } from '../../../search';
import type { Tab } from '../../../types/index';

describe('useUISlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      dividerPosition: 50,
      showVault: true,
      isRenaming: false,
      showAppearancePanel: false,
      settingsPanelWidth: 300,
      showSearchHelp: false,
      searchScope: 'current',
      searchResults: [],
      isSearching: false,
      parsedQuery: null,
    });
  });

  describe('setIsRenaming', () => {
    it('should set isRenaming to true', () => {
      useStore.getState().setIsRenaming(true);
      expect(useStore.getState().isRenaming).toBe(true);
    });

    it('should set isRenaming to false', () => {
      useStore.setState({ isRenaming: true });
      useStore.getState().setIsRenaming(false);
      expect(useStore.getState().isRenaming).toBe(false);
    });
  });

  describe('setShowSearchHelp', () => {
    it('should show search help', () => {
      useStore.getState().setShowSearchHelp(true);
      expect(useStore.getState().showSearchHelp).toBe(true);
    });

    it('should hide search help', () => {
      useStore.setState({ showSearchHelp: true });
      useStore.getState().setShowSearchHelp(false);
      expect(useStore.getState().showSearchHelp).toBe(false);
    });
  });

  describe('setSearchScope', () => {
    it('should set scope to current', () => {
      useStore.setState({ searchScope: 'all' });
      useStore.getState().setSearchScope('current');
      expect(useStore.getState().searchScope).toBe('current');
    });

    it('should set scope to all', () => {
      useStore.getState().setSearchScope('all');
      expect(useStore.getState().searchScope).toBe('all');
    });
  });

  describe('setSearchResults', () => {
    it('should update search results', () => {
      const mockTab: Tab = { id: 'live-tab-1', title: 'Test', url: 'https://test.com', favicon: '', active: false, discarded: false, windowId: 1, index: 0, groupId: -1, muted: false, pinned: false, audible: false };
      const results: SearchResult[] = [{ tab: mockTab, matchScore: 1.0 }];
      useStore.getState().setSearchResults(results);
      expect(useStore.getState().searchResults).toEqual(results);
    });

    it('should clear search results', () => {
      const mockTab: Tab = { id: 'live-tab-1', title: 'Test', url: 'https://test.com', favicon: '', active: false, discarded: false, windowId: 1, index: 0, groupId: -1, muted: false, pinned: false, audible: false };
      useStore.setState({ searchResults: [{ tab: mockTab, matchScore: 1.0 }] });
      useStore.getState().setSearchResults([]);
      expect(useStore.getState().searchResults).toEqual([]);
    });
  });

  describe('setIsSearching', () => {
    it('should set isSearching to true', () => {
      useStore.getState().setIsSearching(true);
      expect(useStore.getState().isSearching).toBe(true);
    });

    it('should set isSearching to false', () => {
      useStore.setState({ isSearching: true });
      useStore.getState().setIsSearching(false);
      expect(useStore.getState().isSearching).toBe(false);
    });
  });

  describe('setParsedQuery', () => {
    it('should set parsed query', () => {
      const parsed: ParsedQuery = { textTerms: ['test'], bangs: [], commands: [], sort: 'index', errors: [], raw: 'test' };
      useStore.getState().setParsedQuery(parsed);
      expect(useStore.getState().parsedQuery).toEqual(parsed);
    });

    it('should clear parsed query', () => {
      useStore.setState({ parsedQuery: { textTerms: ['test'], bangs: [], commands: [], sort: 'index', errors: [], raw: 'test' } });
      useStore.getState().setParsedQuery(null);
      expect(useStore.getState().parsedQuery).toBeNull();
    });
  });

  describe('setSettingsPanelWidth', () => {
    it('should clamp width to minimum', () => {
      useStore.getState().setSettingsPanelWidth(100);
      expect(useStore.getState().settingsPanelWidth).toBe(SETTINGS_PANEL_MIN_WIDTH);
    });

    it('should clamp width to maximum', () => {
      useStore.getState().setSettingsPanelWidth(2000);
      expect(useStore.getState().settingsPanelWidth).toBe(SETTINGS_PANEL_MAX_WIDTH);
    });

    it('should accept valid width', () => {
      useStore.getState().setSettingsPanelWidth(500);
      expect(useStore.getState().settingsPanelWidth).toBe(500);
    });

    it('should save to settings service', () => {
      useStore.getState().setSettingsPanelWidth(500);
      expect(settingsService.saveSettings).toHaveBeenCalledWith({ settingsPanelWidth: 500 });
    });
  });

  describe('setShowAppearancePanel', () => {
    it('should show appearance panel', () => {
      useStore.getState().setShowAppearancePanel(true);
      expect(useStore.getState().showAppearancePanel).toBe(true);
    });

    it('should hide appearance panel', () => {
      useStore.setState({ showAppearancePanel: true });
      useStore.getState().setShowAppearancePanel(false);
      expect(useStore.getState().showAppearancePanel).toBe(false);
    });
  });
});
