import { describe, it, expect } from 'vitest';
import { applyAllFilters, applyFilter } from '../filters';
import type { Tab } from '../../types';
import type { SearchContext, BangType } from '../types';

const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'live-tab-1',
  title: 'Test Tab',
  url: 'https://example.com',
  favicon: '',
  active: false,
  discarded: false,
  windowId: 1,
  index: 0,
  groupId: -1,
  ...overrides,
});

const createMockContext = (overrides: Partial<SearchContext> = {}): SearchContext => ({
  allTabs: [],
  vaultItems: [],
  groups: new Map(),
  scope: 'current',
  duplicateMap: new Map(),
  localPatterns: [],
  ...overrides,
});

describe('filters', () => {
  describe('frozen filter', () => {
    it('should match frozen tabs', () => {
      const tab = createMockTab({ discarded: true });
      const context = createMockContext();
      expect(applyFilter(tab, 'frozen', context)).toBe(true);
    });

    it('should not match active tabs', () => {
      const tab = createMockTab({ discarded: false });
      const context = createMockContext();
      expect(applyFilter(tab, 'frozen', context)).toBe(false);
    });
  });

  describe('audio filter', () => {
    it('should match tabs playing audio', () => {
      const tab = createMockTab({ audible: true });
      const context = createMockContext();
      expect(applyFilter(tab, 'audio', context)).toBe(true);
    });

    it('should not match silent tabs', () => {
      const tab = createMockTab({ audible: false });
      const context = createMockContext();
      expect(applyFilter(tab, 'audio', context)).toBe(false);
    });
  });

  describe('pin filter', () => {
    it('should match pinned tabs', () => {
      const tab = createMockTab({ pinned: true });
      const context = createMockContext();
      expect(applyFilter(tab, 'pin', context)).toBe(true);
    });

    it('should not match unpinned tabs', () => {
      const tab = createMockTab({ pinned: false });
      const context = createMockContext();
      expect(applyFilter(tab, 'pin', context)).toBe(false);
    });
  });

  describe('grouped filter', () => {
    it('should match tabs in a group', () => {
      const tab = createMockTab({ groupId: 123 });
      const context = createMockContext();
      expect(applyFilter(tab, 'grouped', context)).toBe(true);
    });

    it('should not match ungrouped tabs', () => {
      const tab = createMockTab({ groupId: -1 });
      const context = createMockContext();
      expect(applyFilter(tab, 'grouped', context)).toBe(false);
    });
  });

  describe('solo filter', () => {
    it('should match tabs not in a group', () => {
      const tab = createMockTab({ groupId: -1 });
      const context = createMockContext();
      expect(applyFilter(tab, 'solo', context)).toBe(true);
    });

    it('should not match grouped tabs', () => {
      const tab = createMockTab({ groupId: 123 });
      const context = createMockContext();
      expect(applyFilter(tab, 'solo', context)).toBe(false);
    });
  });

  describe('browser filter', () => {
    it('should match chrome:// URLs', () => {
      const tab = createMockTab({ url: 'chrome://extensions' });
      const context = createMockContext();
      expect(applyFilter(tab, 'browser', context)).toBe(true);
    });

    it('should match about: URLs', () => {
      const tab = createMockTab({ url: 'about:blank' });
      const context = createMockContext();
      expect(applyFilter(tab, 'browser', context)).toBe(true);
    });

    it('should not match regular URLs', () => {
      const tab = createMockTab({ url: 'https://example.com' });
      const context = createMockContext();
      expect(applyFilter(tab, 'browser', context)).toBe(false);
    });
  });

  describe('local filter', () => {
    it('should match localhost URLs', () => {
      const tab = createMockTab({ url: 'http://localhost:3000' });
      const context = createMockContext();
      expect(applyFilter(tab, 'local', context)).toBe(true);
    });

    it('should match file:// URLs', () => {
      const tab = createMockTab({ url: 'file:///home/user/doc.html' });
      const context = createMockContext();
      expect(applyFilter(tab, 'local', context)).toBe(true);
    });

    it('should match 192.168.x.x URLs', () => {
      const tab = createMockTab({ url: 'http://192.168.1.1' });
      const context = createMockContext();
      expect(applyFilter(tab, 'local', context)).toBe(true);
    });

    it('should not match regular URLs', () => {
      const tab = createMockTab({ url: 'https://example.com' });
      const context = createMockContext();
      expect(applyFilter(tab, 'local', context)).toBe(false);
    });
  });

  describe('ip filter', () => {
    it('should match IP address URLs', () => {
      const tab = createMockTab({ url: 'http://8.8.8.8' });
      const context = createMockContext();
      expect(applyFilter(tab, 'ip', context)).toBe(true);
    });

    it('should not match domain URLs', () => {
      const tab = createMockTab({ url: 'https://example.com' });
      const context = createMockContext();
      expect(applyFilter(tab, 'ip', context)).toBe(false);
    });
  });

  describe('title filter', () => {
    it('should match title containing value', () => {
      const tab = createMockTab({ title: 'YouTube - Music Video' });
      const context = createMockContext();
      expect(applyFilter(tab, 'title', context, 'music')).toBe(true);
    });

    it('should not match title not containing value', () => {
      const tab = createMockTab({ title: 'Google Search' });
      const context = createMockContext();
      expect(applyFilter(tab, 'title', context, 'youtube')).toBe(false);
    });
  });

  describe('url filter', () => {
    it('should match URL containing value', () => {
      const tab = createMockTab({ url: 'https://youtube.com/watch?v=123' });
      const context = createMockContext();
      expect(applyFilter(tab, 'url', context, 'youtube')).toBe(true);
    });

    it('should not match URL not containing value', () => {
      const tab = createMockTab({ url: 'https://google.com' });
      const context = createMockContext();
      expect(applyFilter(tab, 'url', context, 'youtube')).toBe(false);
    });
  });

  describe('applyAllFilters', () => {
    it('should return true when all filters pass', () => {
      const tab = createMockTab({ discarded: true, audible: true });
      const context = createMockContext();
      const bangs = [
        { type: 'frozen' as BangType, negated: false },
        { type: 'audio' as BangType, negated: false },
      ];
      expect(applyAllFilters(tab, bangs, context)).toBe(true);
    });

    it('should return false when any filter fails', () => {
      const tab = createMockTab({ discarded: true, audible: false });
      const context = createMockContext();
      const bangs = [
        { type: 'frozen' as BangType, negated: false },
        { type: 'audio' as BangType, negated: false },
      ];
      expect(applyAllFilters(tab, bangs, context)).toBe(false);
    });

    it('should handle negated filters', () => {
      const tab = createMockTab({ discarded: false });
      const context = createMockContext();
      const bangs = [
        { type: 'frozen' as BangType, negated: true },
      ];
      expect(applyAllFilters(tab, bangs, context)).toBe(true);
    });
  });
});
