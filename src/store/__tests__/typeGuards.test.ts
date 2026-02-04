import { describe, it, expect } from 'vitest';
import { isAppearanceSettings, isVaultItems, defaultAppearanceSettings } from '../useStore';
import { VaultItem, Tab, Island } from '../../types';

describe('Type Guards', () => {
  describe('isAppearanceSettings', () => {
    it('should return true for valid appearance settings', () => {
      expect(isAppearanceSettings(defaultAppearanceSettings)).toBe(true);
    });

    it('should return false for missing fields', () => {
      const invalid = { ...defaultAppearanceSettings };
      delete (invalid as any).theme;
      expect(isAppearanceSettings(invalid)).toBe(false);
    });

    it('should return false for invalid field types', () => {
      const invalid = { ...defaultAppearanceSettings, uiScale: '1' };
      expect(isAppearanceSettings(invalid)).toBe(false);
    });

    it('should return false for invalid enum values', () => {
      const invalid = { ...defaultAppearanceSettings, theme: 'invalid' };
      expect(isAppearanceSettings(invalid)).toBe(false);
    });
  });

  describe('isVaultItems', () => {
    const validTab: Tab = {
      id: 'live-tab-1',
      title: 'Test Tab',
      url: 'https://test.com',
      favicon: '',
      active: true,
      discarded: false,
      windowId: 1,
      index: 0,
      groupId: -1
    };

    const validIsland: Island = {
      id: 'live-group-1',
      title: 'Test Group',
      color: 'blue',
      collapsed: false,
      tabs: [validTab]
    };

    const validVaultTab: VaultItem = {
      ...validTab,
      savedAt: Date.now(),
      originalId: 1
    };

    const validVaultIsland: VaultItem = {
      ...validIsland,
      savedAt: Date.now(),
      originalId: 1
    };

    it('should return true for valid vault items array', () => {
      expect(isVaultItems([validVaultTab, validVaultIsland])).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(isVaultItems([])).toBe(true);
    });

    it('should return false for non-array', () => {
      expect(isVaultItems({})).toBe(false);
    });

    it('should return false if any item is invalid', () => {
      const invalidVaultTab = { ...validVaultTab };
      delete (invalidVaultTab as any).savedAt;
      expect(isVaultItems([validVaultTab, invalidVaultTab])).toBe(false);
    });

    it('should return false if any nested tab is invalid', () => {
      const invalidIsland = { ...validVaultIsland, tabs: [{ ...validTab, url: 123 } as any] };
      expect(isVaultItems([invalidIsland])).toBe(false);
    });
  });
});
