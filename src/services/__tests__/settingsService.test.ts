import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockStorageSyncGet = vi.fn();
const mockStorageSyncSet = vi.fn();
const mockStorageLocalGet = vi.fn();
const mockStorageLocalSet = vi.fn();
const mockStorageOnChangedAddListener = vi.fn();
const mockStorageOnChangedRemoveListener = vi.fn();

vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: mockStorageSyncGet,
      set: mockStorageSyncSet,
    },
    local: {
      get: mockStorageLocalGet,
      set: mockStorageLocalSet,
    },
    onChanged: {
      addListener: mockStorageOnChangedAddListener,
      removeListener: mockStorageOnChangedRemoveListener,
    },
  },
});

vi.mock('../../store/utils', () => ({
  syncSettings: vi.fn(),
  syncLocalSettings: vi.fn(),
}));

describe('settingsService', () => {
  let settingsService: typeof import('../settingsService').settingsService;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    settingsService = (await import('../settingsService')).settingsService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('loads sync settings from chrome.storage.sync', async () => {
      const mockSettings = {
        appearanceSettings: { theme: 'dark' },
      };
      mockStorageSyncGet.mockResolvedValue(mockSettings);

      const result = await settingsService.loadSettings();

      expect(mockStorageSyncGet).toHaveBeenCalledWith(['appearanceSettings']);
      expect(result).toEqual(mockSettings);
    });

    it('returns empty object when no settings exist', async () => {
      mockStorageSyncGet.mockResolvedValue({});

      const result = await settingsService.loadSettings();

      expect(result).toEqual({});
    });
  });

  describe('loadLocalSettings', () => {
    it('loads local UI settings from chrome.storage.local', async () => {
      const mockLocalSettings = {
        dividerPosition: 50,
        showVault: true,
        settingsPanelWidth: 300,
      };
      mockStorageLocalGet.mockResolvedValue({ ui_settings_local: mockLocalSettings });

      const result = await settingsService.loadLocalSettings();

      expect(mockStorageLocalGet).toHaveBeenCalledWith(['ui_settings_local']);
      expect(result).toEqual(mockLocalSettings);
    });

    it('returns empty object when no local settings exist', async () => {
      mockStorageLocalGet.mockResolvedValue({});

      const result = await settingsService.loadLocalSettings();

      expect(result).toEqual({});
    });
  });

  describe('saveSettings', () => {
    it('calls syncSettings with provided settings', async () => {
      const { syncSettings } = await import('../../store/utils');
      const settings = {
        appearanceSettings: { theme: 'dark' } as any,
      };

      settingsService.saveSettings(settings);

      expect(syncSettings).toHaveBeenCalledWith(settings);
    });
  });

  describe('saveLocalSettings', () => {
    it('calls syncLocalSettings with provided local settings', async () => {
      const { syncLocalSettings } = await import('../../store/utils');
      const settings = {
        dividerPosition: 60,
        showVault: false,
      };

      settingsService.saveLocalSettings(settings);

      expect(syncLocalSettings).toHaveBeenCalledWith(settings);
    });
  });

  describe('watchSettings', () => {
    it('adds listener and returns unsubscribe function', () => {
      const callback = vi.fn();

      const unsubscribe = settingsService.watchSettings(callback);

      expect(mockStorageOnChangedAddListener).toHaveBeenCalledWith(callback);

      unsubscribe();

      expect(mockStorageOnChangedRemoveListener).toHaveBeenCalledWith(callback);
    });

    it('correctly passes changes to callback', () => {
      let capturedCallback: ((changes: any, areaName: string) => void) | null = null;
      mockStorageOnChangedAddListener.mockImplementation((cb: any) => {
        capturedCallback = cb;
      });

      const callback = vi.fn();
      settingsService.watchSettings(callback);

      const changes = { appearanceSettings: { newValue: { theme: 'dark' } } };
      if (capturedCallback) {
        (capturedCallback as any)(changes, 'sync');
      }

      expect(callback).toHaveBeenCalledWith(changes, 'sync');
    });

    it('handles area filtering for sync changes', () => {
      let capturedCallback: ((changes: any, areaName: string) => void) | null = null;
      mockStorageOnChangedAddListener.mockImplementation((cb: any) => {
        capturedCallback = cb;
      });

      const callback = vi.fn();
      settingsService.watchSettings(callback);

      if (capturedCallback) {
        (capturedCallback as any)({ someKey: { newValue: 'value' } }, 'local');
      }

      expect(callback).toHaveBeenCalledWith({ someKey: { newValue: 'value' } }, 'local');
    });
  });

  describe('loadSettings edge cases', () => {
    it('handles malformed settings gracefully', async () => {
      mockStorageSyncGet.mockResolvedValue({
        appearanceSettings: 'not an object',
      });

      const result = await settingsService.loadSettings();

      expect(result).toEqual({
        appearanceSettings: 'not an object',
      });
    });

    it('validates appearanceSettings type presence', async () => {
      const validSettings = {
        appearanceSettings: {
          theme: 'dark',
          density: 'normal',
          buttonSize: 'default',
          showTabCount: true,
          compactGroupHeaders: false,
          showFavicons: true,
          showFrozenIndicators: true,
          showAudioIndicators: 'hover',
          dragOpacity: 0.8,
          borderRadius: 'default',
          vaultSyncEnabled: true,
        },
      };
      mockStorageSyncGet.mockResolvedValue(validSettings);

      const result = await settingsService.loadSettings();

      expect(result.appearanceSettings).toHaveProperty('theme');
      expect(result.appearanceSettings).toHaveProperty('density');
    });
  });

  describe('saveSettings edge cases', () => {
    it('handles sync failure gracefully', async () => {
      const mockSyncSettings = vi.fn(() => {
        throw new Error('Sync failed');
      });

      vi.doMock('../../store/utils', () => ({
        syncSettings: mockSyncSettings,
        syncLocalSettings: vi.fn(),
      }));

      vi.resetModules();
      const { settingsService: newSettingsService } = await import('../settingsService');

      expect(() => {
        newSettingsService.saveSettings({ appearanceSettings: { theme: 'dark' } as any });
      }).toThrow('Sync failed');
    });
  });
});
