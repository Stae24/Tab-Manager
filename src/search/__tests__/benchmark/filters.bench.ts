import { bench, describe } from 'vitest';
import { applyFilter, applyAllFilters, applyTextSearch } from '../../filters';
import type { Tab } from '../../../types';
import type { SearchContext, BangType } from '../../types';

function createMockTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: `live-tab-${Math.random()}`,
    title: `Test Tab ${Math.random()}`,
    url: `https://example${Math.random()}.com/page`,
    favicon: '',
    active: false,
    discarded: Math.random() > 0.5,
    windowId: 1,
    index: Math.floor(Math.random() * 100),
    groupId: Math.random() > 0.5 ? Math.floor(Math.random() * 10) : -1,
    audible: Math.random() > 0.8,
    pinned: Math.random() > 0.9,
    ...overrides,
  };
}

function createMockContext(tabs: Tab[]): SearchContext {
  return {
    allTabs: tabs,
    vaultItems: [],
    groups: new Map(),
    scope: 'current',
    duplicateMap: new Map(),
    localPatterns: [],
  };
}

function generateTabs(count: number): Tab[] {
  return Array.from({ length: count }, (_, i) => createMockTab({
    id: `live-tab-${i}`,
    title: `Tab ${i} - ${['YouTube', 'Google', 'GitHub', 'Stack Overflow', 'Reddit'][i % 5]}`,
    url: `https://${['youtube.com', 'google.com', 'github.com', 'stackoverflow.com', 'reddit.com'][i % 5]}/page/${i}`,
    discarded: i % 3 === 0,
    audible: i % 5 === 0,
    pinned: i % 10 === 0,
    groupId: i % 4 === 0 ? i % 5 : -1,
  }));
}

const tabs50 = generateTabs(50);
const tabs200 = generateTabs(200);
const tabs500 = generateTabs(500);
const tabs1000 = generateTabs(1000);
const tabs2000 = generateTabs(2000);

const context50 = createMockContext(tabs50);
const context200 = createMockContext(tabs200);
const context500 = createMockContext(tabs500);
const context1000 = createMockContext(tabs1000);
const context2000 = createMockContext(tabs2000);

describe('applyFilter - single boolean', () => {
  bench('50 tabs - audio filter', () => {
    tabs50.forEach(tab => applyFilter(tab, 'audio', context50));
  });

  bench('200 tabs - audio filter', () => {
    tabs200.forEach(tab => applyFilter(tab, 'audio', context200));
  });

  bench('500 tabs - audio filter', () => {
    tabs500.forEach(tab => applyFilter(tab, 'audio', context500));
  });

  bench('1000 tabs - audio filter', () => {
    tabs1000.forEach(tab => applyFilter(tab, 'audio', context1000));
  });

  bench('2000 tabs - audio filter', () => {
    tabs2000.forEach(tab => applyFilter(tab, 'audio', context2000));
  });

  bench('500 tabs - frozen filter', () => {
    tabs500.forEach(tab => applyFilter(tab, 'frozen', context500));
  });

  bench('500 tabs - grouped filter', () => {
    tabs500.forEach(tab => applyFilter(tab, 'grouped', context500));
  });

  bench('500 tabs - browser filter', () => {
    tabs500.forEach(tab => applyFilter(tab, 'browser', context500));
  });
});

describe('applyAllFilters - multiple filters', () => {
  const bangs3 = [
    { type: 'audio' as BangType, negated: false },
    { type: 'frozen' as BangType, negated: false },
    { type: 'grouped' as BangType, negated: false },
  ];

  const bangs5 = [
    ...bangs3,
    { type: 'pin' as BangType, negated: false },
    { type: 'browser' as BangType, negated: false },
  ];

  bench('500 tabs - 3 filters', () => {
    tabs500.forEach(tab => applyAllFilters(tab, bangs3, context500));
  });

  bench('500 tabs - 5 filters', () => {
    tabs500.forEach(tab => applyAllFilters(tab, bangs5, context500));
  });

  bench('1000 tabs - 3 filters', () => {
    tabs1000.forEach(tab => applyAllFilters(tab, bangs3, context1000));
  });

  bench('1000 tabs - 5 filters', () => {
    tabs1000.forEach(tab => applyAllFilters(tab, bangs5, context1000));
  });
});

describe('applyTextSearch', () => {
  bench('500 tabs - 1 term', () => {
    tabs500.forEach(tab => applyTextSearch(tab, ['youtube']));
  });

  bench('500 tabs - 3 terms comma-separated', () => {
    tabs500.forEach(tab => applyTextSearch(tab, ['youtube', 'google', 'github']));
  });

  bench('500 tabs - 5 terms comma-separated', () => {
    tabs500.forEach(tab => applyTextSearch(tab, ['youtube', 'google', 'github', 'stack', 'reddit']));
  });

  bench('1000 tabs - 1 term', () => {
    tabs1000.forEach(tab => applyTextSearch(tab, ['youtube']));
  });

  bench('1000 tabs - 5 terms', () => {
    tabs1000.forEach(tab => applyTextSearch(tab, ['youtube', 'google', 'github', 'stack', 'reddit']));
  });

  bench('2000 tabs - 1 term', () => {
    tabs2000.forEach(tab => applyTextSearch(tab, ['youtube']));
  });

  bench('500 tabs - title scope', () => {
    tabs500.forEach(tab => applyTextSearch(tab, ['Tab'], true, false));
  });

  bench('500 tabs - url scope', () => {
    tabs500.forEach(tab => applyTextSearch(tab, ['com'], false, true));
  });
});

describe('applyFilter - text scope', () => {
  bench('500 tabs - title filter', () => {
    tabs500.forEach(tab => applyFilter(tab, 'title', context500, 'Tab'));
  });

  bench('500 tabs - url filter', () => {
    tabs500.forEach(tab => applyFilter(tab, 'url', context500, 'com'));
  });

  bench('1000 tabs - title filter', () => {
    tabs1000.forEach(tab => applyFilter(tab, 'title', context1000, 'Tab'));
  });
});

describe('applyFilter - negated', () => {
  bench('500 tabs - negated audio', () => {
    tabs500.forEach(tab => applyFilter(tab, 'audio', context500, undefined, true));
  });

  bench('500 tabs - negated frozen', () => {
    tabs500.forEach(tab => applyFilter(tab, 'frozen', context500, undefined, true));
  });
});
