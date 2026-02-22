import { describe, it, expect } from 'vitest';
import { isTab, isIsland, findItemInList } from '../utils';
import type { Tab, Island, VaultItem } from '../../types/index';

describe('store utilities - type guards', () => {
  describe('isTab', () => {
    it('should return true for valid tab object', () => {
      const tab: Tab = {
        id: 'live-tab-1',
        title: 'Test Tab',
        url: 'https://example.com',
        favicon: 'https://example.com/favicon.ico',
        active: true,
        discarded: false,
        windowId: 1,
        index: 0,
        groupId: -1,
        muted: false,
        pinned: false,
        audible: false,
      };
      expect(isTab(tab)).toBe(true);
    });

    it('should return false for island object', () => {
      const island: Island = {
        id: 'live-group-1',
        title: 'Test Group',
        color: 'blue',
        collapsed: false,
        tabs: [],
      };
      expect(isTab(island)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isTab(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isTab(undefined)).toBe(false);
    });

    it('should return false for primitive', () => {
      expect(isTab('string')).toBe(false);
      expect(isTab(123)).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(isTab({ id: 'tab-1' })).toBe(false);
      expect(isTab({ title: 'Test' })).toBe(false);
    });
  });

  describe('isIsland', () => {
    it('should return true for valid island object', () => {
      const tab: Tab = {
        id: 'live-tab-1',
        title: 'Test Tab',
        url: 'https://example.com',
        favicon: '',
        active: false,
        discarded: false,
        windowId: 1,
        index: 0,
        groupId: -1,
        muted: false,
        pinned: false,
        audible: false,
      };
      const island: Island = {
        id: 'live-group-1',
        title: 'Test Group',
        color: 'blue',
        collapsed: false,
        tabs: [tab],
      };
      expect(isIsland(island)).toBe(true);
    });

    it('should return false for tab object', () => {
      const tab: Tab = {
        id: 'live-tab-1',
        title: 'Test Tab',
        url: 'https://example.com',
        favicon: '',
        active: false,
        discarded: false,
        windowId: 1,
        index: 0,
        groupId: -1,
        muted: false,
        pinned: false,
        audible: false,
      };
      expect(isIsland(tab)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isIsland(null)).toBe(false);
    });

    it('should return false for primitive', () => {
      expect(isIsland('string')).toBe(false);
      expect(isIsland(123)).toBe(false);
    });

    it('should return false for object missing required fields', () => {
      expect(isIsland({ id: 'group-1' })).toBe(false);
      expect(isIsland({ title: 'Group' })).toBe(false);
    });

    it('should return false for island with invalid tabs', () => {
      const invalidIsland = {
        id: 'live-group-1',
        title: 'Test Group',
        color: 'blue',
        collapsed: false,
        tabs: ['not a tab' as any],
      };
      expect(isIsland(invalidIsland)).toBe(false);
    });
  });

  describe('findItemInList', () => {
    const createTab = (id: string): Tab => ({
      id: id as any,
      title: `Tab ${id}`,
      url: 'https://example.com',
      favicon: '',
      active: false,
      discarded: false,
      windowId: 1,
      index: 0,
      groupId: -1,
      muted: false,
      pinned: false,
      audible: false,
    });

    const createIsland = (id: string, tabs: Tab[]): Island => ({
      id: id as any,
      title: `Group ${id}`,
      color: 'blue',
      collapsed: false,
      tabs,
    });

    it('should find tab in flat list', () => {
      const items: (Tab | Island)[] = [createTab('tab-1'), createTab('tab-2')];
      const result = findItemInList(items, 'tab-1');
      expect(result).not.toBeNull();
      expect(result?.containerId).toBe('root');
      expect(result?.index).toBe(0);
      expect((result?.item as Tab).id).toBe('tab-1');
    });

    it('should find tab in nested island', () => {
      const items: (Tab | Island)[] = [
        createIsland('group-1', [createTab('tab-1'), createTab('tab-2')]),
      ];
      const result = findItemInList(items, 'tab-2');
      expect(result).not.toBeNull();
      expect(result?.containerId).toBe('group-1');
      expect(result?.index).toBe(1);
      expect((result?.item as Tab).id).toBe('tab-2');
    });

    it('should return null for not found', () => {
      const items: (Tab | Island)[] = [createTab('tab-1')];
      const result = findItemInList(items, 'tab-999');
      expect(result).toBeNull();
    });

    it('should find island at root level', () => {
      const items: (Tab | Island)[] = [createIsland('group-1', [])];
      const result = findItemInList(items, 'group-1');
      expect(result).not.toBeNull();
      expect(result?.containerId).toBe('root');
      expect(result?.index).toBe(0);
    });

    it('should handle numeric IDs', () => {
      const items: (Tab | Island)[] = [createTab('1')];
      const result = findItemInList(items, 1);
      expect(result).not.toBeNull();
      expect(result?.index).toBe(0);
    });

    it('should handle empty list', () => {
      const items: (Tab | Island)[] = [];
      const result = findItemInList(items, 'tab-1');
      expect(result).toBeNull();
    });
  });
});
