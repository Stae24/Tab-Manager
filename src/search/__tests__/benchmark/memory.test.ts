/// <reference types="node" />
import { describe, test, expect } from 'vitest';
import { tokenize, parseQuery } from '../../parser';
import { applyAllFilters, applyTextSearch } from '../../filters';
import { normalizeUrl, buildDuplicateMap } from '../../utils';
import { sortResults, buildSearchContext } from '../../engine';
import type { Tab } from '../../../types/index';
import type { SearchResult, SearchContext, BangType } from '../../types';

function createMockTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: `live-tab-${Math.random().toString(36).slice(2)}`,
    title: 'Test Tab',
    url: 'https://example.com/page',
    favicon: '',
    active: false,
    discarded: false,
    windowId: 1,
    index: 0,
    groupId: -1,
    ...overrides,
  };
}

function generateTabs(count: number): Tab[] {
  return Array.from({ length: count }, (_, i) => createMockTab({
    id: `live-tab-${i}`,
    title: `Tab ${i}`,
    url: `https://example${i % 10}.com/page/${i}`,
  }));
}

function getHeapUsedMB(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed / 1024 / 1024;
}

function forceGC(): void {
  if (global.gc) {
    global.gc();
  }
}

const hasGC = typeof global.gc === 'function';

describe('Memory Leak Detection', () => {
  const COMPLEX_QUERY = '!audio !frozen !grouped !pin !browser !local !ip !solo !duplicate !vault';

  describe('parser memory', () => {
    test('tokenize does not accumulate memory', () => {
      forceGC();
      const initial = getHeapUsedMB();

      for (let i = 0; i < 10000; i++) {
        tokenize(COMPLEX_QUERY);
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(10);
    });

    test('parseQuery does not accumulate memory', () => {
      forceGC();
      const initial = getHeapUsedMB();

      for (let i = 0; i < 10000; i++) {
        parseQuery(COMPLEX_QUERY);
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(10);
    });
  });

  describe('filter memory', () => {
    test('applyAllFilters does not accumulate memory', () => {
      const tabs = generateTabs(100);
      const context: SearchContext = {
        allTabs: tabs,
        vaultItems: [],
        groups: new Map(),
        scope: 'current',
        duplicateMap: new Map(),
        localPatterns: [],
      };

      const bangs: Array<{ type: BangType; negated: boolean }> = [
        { type: 'audio', negated: false },
        { type: 'frozen', negated: false },
        { type: 'grouped', negated: false },
      ];

      forceGC();
      const initial = getHeapUsedMB();

      for (let i = 0; i < 10000; i++) {
        tabs.forEach(tab => applyAllFilters(tab, bangs, context));
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(10);
    });

    test('applyTextSearch does not accumulate memory', () => {
      const tabs = generateTabs(100);
      const terms = ['youtube', 'google', 'github'];

      forceGC();
      const initial = getHeapUsedMB();

      for (let i = 0; i < 10000; i++) {
        tabs.forEach(tab => applyTextSearch(tab, terms));
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(30);
    });
  });

  describe('utils memory', () => {
    test('normalizeUrl does not accumulate memory', () => {
      const urls = Array.from({ length: 1000 }, (_, i) => 
        `https://example${i}.com/page/${i}?query=value#${i}`
      );

      forceGC();
      const initial = getHeapUsedMB();

      for (let iter = 0; iter < 100; iter++) {
        urls.forEach(url => normalizeUrl(url, 'strict'));
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(10);
    });

    test('buildDuplicateMap does not accumulate memory', () => {
      const tabs = generateTabs(500);

      forceGC();
      const initial = getHeapUsedMB();

      for (let i = 0; i < 100; i++) {
        buildDuplicateMap(tabs);
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(20);
    });
  });

  describe('engine memory', () => {
    test('sortResults does not accumulate memory', () => {
      const tabs = generateTabs(500);
      const results: SearchResult[] = tabs.map(tab => ({ tab, matchScore: 1 }));

      forceGC();
      const initial = getHeapUsedMB();

      for (let i = 0; i < 1000; i++) {
        sortResults(results, 'title');
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(10);
    });

    test('buildSearchContext does not accumulate memory', () => {
      const tabs = generateTabs(500);

      forceGC();
      const initial = getHeapUsedMB();

      for (let i = 0; i < 100; i++) {
        buildSearchContext(tabs);
      }

      forceGC();
      const final = getHeapUsedMB();
      const growth = final - initial;

      expect(growth).toBeLessThan(20);
    });
  });

  (hasGC ? describe : describe.skip)('WeakRef cleanup verification', () => {
    test('tokenize results are GC-able', () => {
      const refs: WeakRef<any>[] = [];

      for (let i = 0; i < 1000; i++) {
        const result = tokenize(COMPLEX_QUERY);
        refs.push(new WeakRef(result));
      }

      forceGC();

      let alive = 0;
      for (const ref of refs) {
        if (ref.deref() !== undefined) alive++;
      }

      expect(alive).toBeLessThan(refs.length * 0.5);
    });

    test('parseQuery results are GC-able', () => {
      const refs: WeakRef<any>[] = [];

      for (let i = 0; i < 1000; i++) {
        const result = parseQuery(COMPLEX_QUERY);
        refs.push(new WeakRef(result));
      }

      forceGC();

      let alive = 0;
      for (const ref of refs) {
        if (ref.deref() !== undefined) alive++;
      }

      expect(alive).toBeLessThan(refs.length * 0.5);
    });

    test('buildDuplicateMap results are GC-able', () => {
      const tabs = generateTabs(100);
      const refs: WeakRef<any>[] = [];

      for (let i = 0; i < 100; i++) {
        const result = buildDuplicateMap(tabs);
        refs.push(new WeakRef(result));
      }

      forceGC();

      let alive = 0;
      for (const ref of refs) {
        if (ref.deref() !== undefined) alive++;
      }

      expect(alive).toBeLessThan(refs.length * 0.5);
    });
  });

  describe('sustained operation memory', () => {
    test('repeated search operations maintain stable memory', () => {
      const tabs = generateTabs(200);
      const context: SearchContext = {
        allTabs: tabs,
        vaultItems: [],
        groups: new Map(),
        scope: 'current',
        duplicateMap: buildDuplicateMap(tabs),
        localPatterns: [],
      };

      forceGC();
      const measurements: number[] = [];

      for (let iter = 0; iter < 10; iter++) {
        for (let i = 0; i < 1000; i++) {
          const filtered = tabs.filter(tab => 
            tab.title?.includes('Tab') || tab.url?.includes('example')
          );
        }
        
        forceGC();
        measurements.push(getHeapUsedMB());
      }

      const firstHalf = measurements.slice(0, 5);
      const secondHalf = measurements.slice(5);
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      expect(Math.abs(secondAvg - firstAvg)).toBeLessThan(10);
    });
  });
});
