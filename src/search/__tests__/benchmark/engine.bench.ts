import { bench, describe } from 'vitest';
import { sortResults, buildSearchContext } from '../../engine';
import type { Tab, Island } from '../../../types';
import type { SearchResult, SearchContext } from '../../types';

function createMockTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: `live-tab-${Math.random().toString(36).slice(2)}`,
    title: `Test Tab`,
    url: `https://example.com/page`,
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
  const titles = [
    'YouTube - Music Video',
    'Google Search Results',
    'GitHub - Repository',
    'Stack Overflow - Question',
    'Reddit - Discussion',
    'Twitter - Timeline',
    'LinkedIn - Profile',
    'Amazon - Product',
    'Netflix - Movie',
    'Spotify - Playlist',
  ];
  
  const domains = [
    'youtube.com/watch?v=',
    'google.com/search?q=',
    'github.com/user/repo/',
    'stackoverflow.com/questions/',
    'reddit.com/r/',
    'twitter.com/status/',
    'linkedin.com/in/',
    'amazon.com/dp/',
    'netflix.com/watch/',
    'spotify.com/track/',
  ];
  
  return Array.from({ length: count }, (_, i) => createMockTab({
    id: `live-tab-${i}`,
    title: `${titles[i % titles.length]} ${i}`,
    url: `https://${domains[i % domains.length]}${i}`,
    discarded: i % 3 === 0,
    audible: i % 5 === 0,
    pinned: i % 10 === 0,
    groupId: i % 4 === 0 ? (i % 5) + 1 : -1,
    index: i,
  }));
}

function generateGroups(count: number): Map<number, Island> {
  const groups = new Map<number, Island>();
  const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  
  for (let i = 1; i <= count; i++) {
    groups.set(i, {
      id: `live-group-${i}`,
      title: `Group ${i}`,
      color: colors[i % colors.length],
      collapsed: i % 2 === 0,
      tabs: [],
    });
  }
  
  return groups;
}

function createMockContext(tabs: Tab[], groups: Map<number, Island>): SearchContext {
  return {
    allTabs: tabs,
    vaultItems: [],
    groups,
    scope: 'current',
    duplicateMap: new Map(),
    localPatterns: [],
  };
}

const tabs50 = generateTabs(50);
const tabs200 = generateTabs(200);
const tabs500 = generateTabs(500);
const tabs1000 = generateTabs(1000);

const groups10 = generateGroups(10);
const groups50 = generateGroups(50);

const context50 = createMockContext(tabs50, groups10);
const context200 = createMockContext(tabs200, groups10);
const context500 = createMockContext(tabs500, groups50);
const context1000 = createMockContext(tabs1000, groups50);

function createResults(tabs: Tab[]): SearchResult[] {
  return tabs.map(tab => ({ tab, matchScore: 1 }));
}

const results50 = createResults(tabs50);
const results200 = createResults(tabs200);
const results500 = createResults(tabs500);
const results1000 = createResults(tabs1000);

describe('sortResults benchmarks', () => {
  bench('50 results - by title', () => {
    sortResults(results50, 'title');
  });

  bench('200 results - by title', () => {
    sortResults(results200, 'title');
  });

  bench('500 results - by title', () => {
    sortResults(results500, 'title');
  });

  bench('1000 results - by title', () => {
    sortResults(results1000, 'title');
  });

  bench('500 results - by url', () => {
    sortResults(results500, 'url');
  });

  bench('500 results - by index', () => {
    sortResults(results500, 'index');
  });

  bench('1000 results - by url', () => {
    sortResults(results1000, 'url');
  });

  bench('1000 results - by index', () => {
    sortResults(results1000, 'index');
  });
});

describe('buildSearchContext benchmarks', () => {
  bench('50 tabs', () => {
    buildSearchContext(tabs50, [], new Map());
  });

  bench('200 tabs', () => {
    buildSearchContext(tabs200, [], new Map());
  });

  bench('500 tabs', () => {
    buildSearchContext(tabs500, [], new Map());
  });

  bench('1000 tabs', () => {
    buildSearchContext(tabs1000, [], new Map());
  });

  bench('500 tabs with groups', () => {
    buildSearchContext(tabs500, [], groups50);
  });

  bench('1000 tabs with groups', () => {
    buildSearchContext(tabs1000, [], groups50);
  });
});

describe('search simulation benchmarks (without Chrome API)', () => {
  bench('filter 50 tabs for youtube', () => {
    tabs50.filter(tab => 
      tab.title?.toLowerCase().includes('youtube') || 
      tab.url?.toLowerCase().includes('youtube')
    );
  });

  bench('filter 200 tabs for youtube', () => {
    tabs200.filter(tab => 
      tab.title?.toLowerCase().includes('youtube') || 
      tab.url?.toLowerCase().includes('youtube')
    );
  });

  bench('filter 500 tabs for youtube', () => {
    tabs500.filter(tab => 
      tab.title?.toLowerCase().includes('youtube') || 
      tab.url?.toLowerCase().includes('youtube')
    );
  });

  bench('filter 1000 tabs for youtube', () => {
    tabs1000.filter(tab => 
      tab.title?.toLowerCase().includes('youtube') || 
      tab.url?.toLowerCase().includes('youtube')
    );
  });

  bench('filter 500 tabs with multiple conditions', () => {
    tabs500.filter(tab => 
      (tab.title?.toLowerCase().includes('youtube') || tab.url?.toLowerCase().includes('youtube')) &&
      tab.discarded === true &&
      tab.audible === false
    );
  });

  bench('filter 500 tabs with 3 OR terms', () => {
    const terms = ['youtube', 'google', 'github'];
    tabs500.filter(tab => 
      terms.some(term => 
        tab.title?.toLowerCase().includes(term) || 
        tab.url?.toLowerCase().includes(term)
      )
    );
  });

  bench('filter 1000 tabs with 5 OR terms', () => {
    const terms = ['youtube', 'google', 'github', 'stack', 'reddit'];
    tabs1000.filter(tab => 
      terms.some(term => 
        tab.title?.toLowerCase().includes(term) || 
        tab.url?.toLowerCase().includes(term)
      )
    );
  });
});

describe('combined search operations', () => {
  bench('build context + filter + sort 500 tabs', () => {
    const ctx = buildSearchContext(tabs500, [], new Map());
    const filtered = tabs500.filter(tab => 
      tab.title?.toLowerCase().includes('youtube') || 
      tab.url?.toLowerCase().includes('youtube')
    );
    const results = filtered.map(tab => ({ tab, matchScore: 1 }));
    sortResults(results, 'title');
  });

  bench('build context + filter + sort 1000 tabs', () => {
    const ctx = buildSearchContext(tabs1000, [], new Map());
    const filtered = tabs1000.filter(tab => 
      tab.title?.toLowerCase().includes('youtube') || 
      tab.url?.toLowerCase().includes('youtube')
    );
    const results = filtered.map(tab => ({ tab, matchScore: 1 }));
    sortResults(results, 'title');
  });
});
