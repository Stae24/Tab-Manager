# Store Test Coverage Plan

## Overview

This plan covers test improvements for `src/store/` and `src/store/slices/`. Current overall coverage: **62.38%**, target: **70%**.

---

## 1. useStore.ts

**Current Coverage:** 43.93%  
**Target Coverage:** 70%  
**Uncovered Lines:** 52-62, 247-255, 262, 269-273

### File Analysis

The main store file contains:
- Store creation with slice composition
- `loadVaultWithRetry()` - Vault loading with retry logic
- `attemptSelfHealing()` - Sync recovery logic
- `init()` - Store initialization
- Settings change listener

### Uncovered Code Analysis

| Lines | Function | Description |
|-------|----------|-------------|
| 52-62 | `loadVaultWithRetry` | Retry logic for vault loading |
| 247-255 | `init` settings listener | Fallback handling on sync load failure |
| 262 | `init` error handler | Error logging on sync failure |
| 269-273 | `init` local listener | Local storage change handling |

### Test Cases Needed

```typescript
// src/store/__tests__/useStore.init.test.ts

describe('useStore initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useStore.setState({
      vault: [],
      appearanceSettings: defaultAppearanceSettings,
      effectiveSyncEnabled: true,
    });
  });

  describe('loadVaultWithRetry', () => {
    it('should return result on first successful load', async () => {
      const mockResult = { vault: [], timestamp: 123, fallbackToLocal: false };
      vi.mocked(vaultService.loadVault).mockResolvedValue(mockResult);
      
      const result = await loadVaultWithRetry(true);
      expect(result).toEqual(mockResult);
      expect(vaultService.loadVault).toHaveBeenCalledTimes(1);
    });

    it('should retry on fallbackToLocal with exponential backoff', async () => {
      const failResult = { vault: [], timestamp: 0, fallbackToLocal: true };
      const successResult = { vault: [{ id: 'vault-1' }], timestamp: 123, fallbackToLocal: false };
      
      vi.mocked(vaultService.loadVault)
        .mockResolvedValueOnce(failResult)
        .mockResolvedValueOnce(failResult)
        .mockResolvedValueOnce(successResult);
      
      const result = await loadVaultWithRetry(true);
      expect(result).toEqual(successResult);
      expect(vaultService.loadVault).toHaveBeenCalledTimes(3);
    });

    it('should return fallback result after max retries', async () => {
      const failResult = { vault: [], timestamp: 0, fallbackToLocal: true };
      vi.mocked(vaultService.loadVault).mockResolvedValue(failResult);
      
      const result = await loadVaultWithRetry(true);
      expect(result.fallbackToLocal).toBe(true);
      expect(vaultService.loadVault).toHaveBeenCalledTimes(VAULT_LOAD_MAX_RETRIES);
    });

    it('should not retry when syncEnabled is false', async () => {
      const result = await loadVaultWithRetry(false);
      expect(vaultService.loadVault).toHaveBeenCalledWith({ syncEnabled: false });
    });
  });

  describe('attemptSelfHealing', () => {
    it('should return success when sync is disabled', async () => {
      const result = await attemptSelfHealing([], false);
      expect(result).toEqual({ success: true, effectiveSyncEnabled: false });
    });

    it('should recover sync successfully', async () => {
      vi.mocked(vaultService.recoverVaultSync).mockResolvedValue({
        success: true,
        fallbackToLocal: false,
      });
      
      const result = await attemptSelfHealing([], true);
      expect(result).toEqual({ success: true, effectiveSyncEnabled: true });
    });

    it('should fallback to local on quota exceeded', async () => {
      vi.mocked(vaultService.recoverVaultSync).mockResolvedValue({
        success: false,
        fallbackToLocal: true,
      });
      
      const result = await attemptSelfHealing([], true);
      expect(result).toEqual({ success: false, effectiveSyncEnabled: false });
    });

    it('should handle recovery errors gracefully', async () => {
      vi.mocked(vaultService.recoverVaultSync).mockRejectedValue(new Error('Network error'));
      
      const result = await attemptSelfHealing([], true);
      expect(result).toEqual({ success: false, effectiveSyncEnabled: false });
    });
  });

  describe('init function', () => {
    it('should load settings on initialization', async () => {
      vi.mocked(settingsService.loadSettings).mockResolvedValue({
        appearanceSettings: { ...defaultAppearanceSettings, uiScale: 1.5 },
        dividerPosition: 30,
        showVault: false,
      });
      
      // Trigger init (would need to export init or re-import)
      await init();
      
      expect(useStore.getState().appearanceSettings.uiScale).toBe(1.5);
      expect(useStore.getState().dividerPosition).toBe(30);
      expect(useStore.getState().showVault).toBe(false);
    });

    it('should use default settings when invalid', async () => {
      vi.mocked(settingsService.loadSettings).mockResolvedValue({
        appearanceSettings: { invalid: true } as any,
      });
      
      await init();
      
      expect(useStore.getState().appearanceSettings).toEqual(defaultAppearanceSettings);
    });

    it('should detect browser and init capabilities', async () => {
      vi.mocked(detectBrowser).mockResolvedValue('opera');
      
      await init();
      
      expect(detectBrowser).toHaveBeenCalled();
    });

    it('should run vault migration', async () => {
      vi.mocked(vaultService.migrateFromLegacy).mockResolvedValue({
        migrated: true,
        fallbackToLocal: false,
      });
      
      await init();
      
      expect(vaultService.migrateFromLegacy).toHaveBeenCalled();
    });

    it('should disable sync on migration fallback', async () => {
      vi.mocked(vaultService.migrateFromLegacy).mockResolvedValue({
        migrated: true,
        fallbackToLocal: true,
      });
      vi.mocked(settingsService.saveSettings).mockResolvedValue(undefined);
      
      await init();
      
      expect(useStore.getState().effectiveSyncEnabled).toBe(false);
    });

    it('should attempt self-healing on load fallback', async () => {
      vi.mocked(vaultService.loadVault).mockResolvedValue({
        vault: [],
        timestamp: 0,
        fallbackToLocal: true,
      });
      vi.mocked(vaultService.recoverVaultSync).mockResolvedValue({
        success: true,
        fallbackToLocal: false,
      });
      
      await init();
      
      expect(vaultService.recoverVaultSync).toHaveBeenCalled();
    });

    it('should disable sync on quota critical', async () => {
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue({
        used: 102400,
        total: 102400,
        percentage: 1.0,
        available: 0,
      });
      vi.mocked(vaultService.disableVaultSync).mockResolvedValue(undefined);
      vi.mocked(settingsService.saveSettings).mockResolvedValue(undefined);
      
      await init();
      
      expect(useStore.getState().effectiveSyncEnabled).toBe(false);
    });

    it('should cleanup orphaned chunks when sync disabled', async () => {
      vi.mocked(quotaService.cleanupOrphanedChunks).mockResolvedValue(5);
      
      await init();
      
      expect(quotaService.cleanupOrphanedChunks).toHaveBeenCalled();
    });
  });

  describe('settings change listener', () => {
    it('should update appearanceSettings on sync change', async () => {
      await init();
      
      // Simulate settings change
      const changes = {
        appearanceSettings: {
          newValue: { ...defaultAppearanceSettings, uiScale: 2.0 },
        },
      };
      
      settingsService.watchSettings.mock.calls[0][0](changes, 'sync');
      
      expect(useStore.getState().appearanceSettings.uiScale).toBe(2.0);
    });

    it('should reload vault on vault_meta change', async () => {
      vi.mocked(vaultService.loadVault).mockResolvedValue({
        vault: [{ id: 'vault-1' }],
        timestamp: 200,
        fallbackToLocal: false,
      });
      
      await init();
      useStore.setState({ lastVaultTimestamp: 100 });
      
      const changes = {
        vault_meta: { newValue: { timestamp: 200 } },
      };
      
      settingsService.watchSettings.mock.calls[0][0](changes, 'sync');
      
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(useStore.getState().vault).toHaveLength(1);
    });

    it('should ignore older vault_meta timestamps', async () => {
      await init();
      useStore.setState({ lastVaultTimestamp: 200 });
      
      const changes = {
        vault_meta: { newValue: { timestamp: 100 } },
      };
      
      settingsService.watchSettings.mock.calls[0][0](changes, 'sync');
      
      // Should not reload
      expect(vaultService.loadVault).toHaveBeenCalledTimes(1); // Only from init
    });

    it('should update vault on local storage change when sync disabled', async () => {
      vi.mocked(quotaService.getVaultQuota).mockResolvedValue({
        used: 0,
        total: 102400,
        percentage: 0,
        available: 102400,
      });
      
      await init();
      useStore.setState({ effectiveSyncEnabled: false, isUpdating: false });
      
      const newVault = [{ id: 'vault-1', url: 'https://example.com' }];
      const changes = {
        vault: { newValue: newVault },
      };
      
      settingsService.watchSettings.mock.calls[0][0](changes, 'local');
      
      expect(useStore.getState().vault).toEqual(newVault);
    });

    it('should not update vault when isUpdating is true', async () => {
      await init();
      useStore.setState({ effectiveSyncEnabled: false, isUpdating: true });
      
      const changes = {
        vault: { newValue: [{ id: 'vault-1' }] },
      };
      
      settingsService.watchSettings.mock.calls[0][0](changes, 'local');
      
      // Vault should not change
      expect(vaultService.loadVault).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Mock Setup

```typescript
// tests/setup.ts additions or test file mocks
vi.mock('../services/vaultService', () => ({
  vaultService: {
    loadVault: vi.fn(),
    migrateFromLegacy: vi.fn(),
    recoverVaultSync: vi.fn(),
    disableVaultSync: vi.fn(),
  },
}));

vi.mock('../services/quotaService', () => ({
  quotaService: {
    getVaultQuota: vi.fn(),
    cleanupOrphanedChunks: vi.fn(),
    logQuotaDetails: vi.fn(),
  },
}));

vi.mock('../services/settingsService', () => ({
  settingsService: {
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    watchSettings: vi.fn(),
  },
}));

vi.mock('../utils/browser', () => ({
  detectBrowser: vi.fn(),
}));
```

---

## 2. useUISlice.ts

**Current Coverage:** 56.25%  
**Target Coverage:** 70%  
**Uncovered Lines:** 56-58, 66-74

### File Analysis

UI slice contains:
- Divider position state
- Vault visibility state
- Renaming state
- Appearance panel state
- Settings panel width
- Search state

### Uncovered Code Analysis

| Lines | Function | Description |
|-------|----------|-------------|
| 56-58 | `setIsRenaming` | Simple state setter |
| 66-74 | Search setters | `setShowSearchHelp`, `setSearchScope`, `setSearchResults`, `setIsSearching`, `setParsedQuery` |

### Test Cases Needed

```typescript
// src/store/slices/__tests__/useUISlice.test.ts

describe('useUISlice', () => {
  // Existing tests cover basic setters - need to add:

  describe('setIsRenaming', () => {
    it('should set isRenaming to true', () => {
      useStore.setState({ isRenaming: false });
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
      const results = [{ tabId: 'tab-1', score: 1.0 }];
      useStore.getState().setSearchResults(results as any);
      expect(useStore.getState().searchResults).toEqual(results);
    });

    it('should clear search results', () => {
      useStore.setState({ searchResults: [{ tabId: 'tab-1' }] as any });
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
      const parsed = { text: 'test', bangs: [], filters: [] };
      useStore.getState().setParsedQuery(parsed as any);
      expect(useStore.getState().parsedQuery).toEqual(parsed);
    });

    it('should clear parsed query', () => {
      useStore.setState({ parsedQuery: { text: 'test' } as any });
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

    it('should save to settings service', async () => {
      useStore.getState().setSettingsPanelWidth(500);
      expect(settingsService.saveSettings).toHaveBeenCalledWith({ settingsPanelWidth: 500 });
    });
  });
});
```

---

## 3. Store Utilities

The store utilities in `src/store/utils.ts` should also be tested for completeness:

### Test Cases Needed

```typescript
// src/store/__tests__/utils.test.ts (expand existing)

describe('store utilities', () => {
  describe('parseNumericId', () => {
    it('should parse live-tab ID', () => {
      expect(parseNumericId('live-tab-123')).toBe(123);
    });

    it('should parse live-group ID', () => {
      expect(parseNumericId('live-group-456')).toBe(456);
    });

    it('should parse vault ID', () => {
      expect(parseNumericId('vault-789')).toBe(789);
    });

    it('should return null for invalid ID', () => {
      expect(parseNumericId('invalid')).toBeNull();
    });

    it('should handle numeric input', () => {
      expect(parseNumericId(123)).toBe(123);
    });
  });

  describe('isTab', () => {
    it('should return true for tab object', () => {
      const tab = { id: 'tab-1', url: 'https://example.com' };
      expect(isTab(tab)).toBe(true);
    });

    it('should return false for island object', () => {
      const island = { id: 'group-1', tabs: [] };
      expect(isTab(island)).toBe(false);
    });
  });

  describe('isIsland', () => {
    it('should return true for island object', () => {
      const island = { id: 'group-1', tabs: [] };
      expect(isIsland(island)).toBe(true);
    });

    it('should return false for tab object', () => {
      const tab = { id: 'tab-1', url: 'https://example.com' };
      expect(isIsland(tab)).toBe(false);
    });
  });

  describe('findItemInList', () => {
    it('should find tab in flat list', () => {
      const items = [{ id: 'tab-1' }, { id: 'tab-2' }];
      const result = findItemInList(items, 'tab-1');
      expect(result).toEqual({ item: { id: 'tab-1' }, index: 0, containerId: 'root' });
    });

    it('should find tab in nested island', () => {
      const items = [
        { id: 'group-1', tabs: [{ id: 'tab-1' }, { id: 'tab-2' }] },
      ];
      const result = findItemInList(items, 'tab-2');
      expect(result).toEqual({ item: { id: 'tab-2' }, index: 1, containerId: 'group-1' });
    });

    it('should return null for not found', () => {
      const items = [{ id: 'tab-1' }];
      expect(findItemInList(items, 'tab-999')).toBeNull();
    });
  });
});
```

---

## Implementation Order

1. **useStore.ts initialization tests** - Critical for app startup
2. **useUISlice.ts** - Quick wins for simple setters
3. **Store utilities** - Helper function coverage

## Test File Locations

- `src/store/__tests__/useStore.init.test.ts` (NEW)
- `src/store/slices/__tests__/useUISlice.test.ts` (EXPAND)
- `src/store/__tests__/utils.test.ts` (EXPAND)

## Dependencies

- `vitest` - Test framework
- `../services/*` - Service mocks
- `../utils/browser` - Browser detection mock
