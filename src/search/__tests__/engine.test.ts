import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllTabs,
  getGroups,
  buildSearchContext,
  sortResults,
  search,
  searchAndExecute,
  isSearchActive,
  hasCommands,
  getResultCount,
} from '../engine';
import type { Tab, Island, VaultItem } from '../../types';
import type { SearchResult, SearchContext, ParsedQuery } from '../types';

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

const createMockIsland = (overrides: Partial<Island> = {}): Island => ({
  id: 'live-group-1',
  title: 'Test Group',
  color: 'blue',
  collapsed: false,
  tabs: [],
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

describe('getAllTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no tabs', async () => {
    (chrome.tabs.query as any).mockResolvedValue([]);
    const tabs = await getAllTabs('current');
    expect(tabs).toEqual([]);
  });

  it('filters tabs with undefined IDs', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://example.com' },
      { id: undefined, title: 'No ID' },
      { id: 2, title: 'Tab 2', url: 'https://example2.com' },
    ]);
    const tabs = await getAllTabs('current');
    expect(tabs).toHaveLength(2);
  });

  it('filters extension pages', async () => {
    const extensionId = chrome.runtime.id;
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://example.com' },
      { id: 2, title: 'Extension', url: `chrome-extension://${extensionId}/popup.html` },
    ]);
    const tabs = await getAllTabs('current');
    expect(tabs).toHaveLength(1);
    expect(tabs[0].url).toBe('https://example.com');
  });

  it('respects current scope (currentWindow: true)', async () => {
    (chrome.tabs.query as any).mockResolvedValue([]);
    await getAllTabs('current');
    expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
  });

  it('respects all scope (no window filter)', async () => {
    (chrome.tabs.query as any).mockResolvedValue([]);
    await getAllTabs('all');
    expect(chrome.tabs.query).toHaveBeenCalledWith({});
  });

  it('maps Chrome tabs to internal Tab format', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      {
        id: 123,
        title: 'Test Title',
        url: 'https://test.com',
        favIconUrl: 'https://test.com/favicon.ico',
        active: true,
        discarded: true,
        windowId: 5,
        index: 3,
        groupId: 10,
        mutedInfo: { muted: true },
        pinned: true,
        audible: true,
      },
    ]);
    const tabs = await getAllTabs('current');
    expect(tabs[0]).toEqual({
      id: 'live-tab-123',
      title: 'Test Title',
      url: 'https://test.com',
      favicon: 'https://test.com/favicon.ico',
      active: true,
      discarded: true,
      windowId: 5,
      index: 3,
      groupId: 10,
      muted: true,
      pinned: true,
      audible: true,
    });
  });

  it('handles tabs without title', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: undefined, url: 'https://example.com' },
    ]);
    const tabs = await getAllTabs('current');
    expect(tabs[0].title).toBe('Untitled');
  });

  it('handles tabs without url', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: 'Tab', url: undefined },
    ]);
    const tabs = await getAllTabs('current');
    expect(tabs[0].url).toBe('');
  });
});

describe('getGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty map when no groups', async () => {
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    const groups = await getGroups('current');
    expect(groups.size).toBe(0);
  });

  it('respects current scope', async () => {
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    await getGroups('current');
    expect(chrome.tabGroups.query).toHaveBeenCalledWith({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  });

  it('respects all scope', async () => {
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    await getGroups('all');
    expect(chrome.tabGroups.query).toHaveBeenCalledWith({});
  });

  it('maps Chrome groups to Island format', async () => {
    (chrome.tabGroups.query as any).mockResolvedValue([
      {
        id: 123,
        title: 'Work',
        color: 'blue',
        collapsed: true,
        windowId: 1,
      },
    ]);
    const groups = await getGroups('current');
    const group = groups.get(123);
    expect(group).toEqual({
      id: 'live-group-123',
      title: 'Work',
      color: 'blue',
      collapsed: true,
      tabs: [],
    });
  });

  it('handles groups without title', async () => {
    (chrome.tabGroups.query as any).mockResolvedValue([
      { id: 123, title: '', color: 'grey', collapsed: false, windowId: 1 },
    ]);
    const groups = await getGroups('current');
    expect(groups.get(123)?.title).toBe('');
  });
});

describe('buildSearchContext', () => {
  it('builds duplicate map from tabs', () => {
    const tabs = [
      createMockTab({ url: 'https://example.com' }),
      createMockTab({ url: 'https://example.com' }),
    ];
    const context = buildSearchContext(tabs, [], new Map());
    expect(context.duplicateMap.size).toBeGreaterThan(0);
  });

  it('includes vault items', () => {
    const vaultItems: VaultItem[] = [
      { ...createMockTab({ id: 'live-tab-1' }), savedAt: Date.now(), originalId: 'live-tab-1' },
    ];
    const context = buildSearchContext([], vaultItems, new Map());
    expect(context.vaultItems).toEqual(vaultItems);
  });

  it('includes groups map', () => {
    const groups = new Map<number, Island>();
    groups.set(1, createMockIsland());
    const context = buildSearchContext([], [], groups);
    expect(context.groups).toBe(groups);
  });

  it('handles empty inputs', () => {
    const context = buildSearchContext([], [], new Map());
    expect(context.allTabs).toEqual([]);
    expect(context.vaultItems).toEqual([]);
    expect(context.groups.size).toBe(0);
    expect(context.duplicateMap.size).toBe(0);
  });

  it('includes scope', () => {
    const context = buildSearchContext([], [], new Map(), 'all');
    expect(context.scope).toBe('all');
  });

  it('includes local patterns', () => {
    const patterns = ['mydev.local'];
    const context = buildSearchContext([], [], new Map(), 'current', patterns);
    expect(context.localPatterns).toEqual(patterns);
  });
});

describe('sortResults', () => {
  const createResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
    tab: createMockTab(),
    matchScore: 1,
    ...overrides,
  });

  it('sorts by title (alphabetical)', () => {
    const results = [
      createResult({ tab: createMockTab({ title: 'Zebra' }) }),
      createResult({ tab: createMockTab({ title: 'Apple' }) }),
      createResult({ tab: createMockTab({ title: 'Mango' }) }),
    ];
    const sorted = sortResults(results, 'title');
    expect(sorted[0].tab.title).toBe('Apple');
    expect(sorted[1].tab.title).toBe('Mango');
    expect(sorted[2].tab.title).toBe('Zebra');
  });

  it('sorts by url (alphabetical)', () => {
    const results = [
      createResult({ tab: createMockTab({ url: 'https://z.com' }) }),
      createResult({ tab: createMockTab({ url: 'https://a.com' }) }),
    ];
    const sorted = sortResults(results, 'url');
    expect(sorted[0].tab.url).toBe('https://a.com');
    expect(sorted[1].tab.url).toBe('https://z.com');
  });

  it('sorts by index (default)', () => {
    const results = [
      createResult({ tab: createMockTab({ index: 5 }) }),
      createResult({ tab: createMockTab({ index: 1 }) }),
      createResult({ tab: createMockTab({ index: 3 }) }),
    ];
    const sorted = sortResults(results, 'index');
    expect(sorted[0].tab.index).toBe(1);
    expect(sorted[1].tab.index).toBe(3);
    expect(sorted[2].tab.index).toBe(5);
  });

  it('handles null/undefined titles', () => {
    const results = [
      createResult({ tab: createMockTab({ title: undefined as any }) }),
      createResult({ tab: createMockTab({ title: 'Apple' }) }),
    ];
    const sorted = sortResults(results, 'title');
    expect(sorted).toHaveLength(2);
  });

  it('handles null/undefined urls', () => {
    const results = [
      createResult({ tab: createMockTab({ url: '' }) }),
      createResult({ tab: createMockTab({ url: 'https://a.com' }) }),
    ];
    const sorted = sortResults(results, 'url');
    expect(sorted).toHaveLength(2);
  });

  it('returns new array (immutable)', () => {
    const results = [createResult()];
    const sorted = sortResults(results, 'index');
    expect(sorted).not.toBe(results);
  });
});

describe('search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty for empty query', async () => {
    const { results, parsedQuery } = await search('');
    expect(results).toEqual([]);
    expect(parsedQuery.textTerms).toEqual([]);
    expect(parsedQuery.bangs).toEqual([]);
  });

  it('returns empty when no textTerms or bangs', async () => {
    (chrome.tabs.query as any).mockResolvedValue([{ id: 1, title: 'Tab', url: 'https://example.com' }]);
    const { results } = await search('   ');
    expect(results).toEqual([]);
  });

  it('applies text search (OR logic for comma terms)', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: 'YouTube Video', url: 'https://youtube.com' },
      { id: 2, title: 'Spotify Music', url: 'https://spotify.com' },
      { id: 3, title: 'Google Search', url: 'https://google.com' },
    ]);
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    
    const { results } = await search('youtube, spotify');
    expect(results).toHaveLength(2);
  });

  it('applies filters (AND logic)', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: 'YouTube', url: 'https://youtube.com', audible: true, discarded: false },
      { id: 2, title: 'YouTube', url: 'https://youtube.com', audible: false, discarded: true },
      { id: 3, title: 'YouTube', url: 'https://youtube.com', audible: true, discarded: true },
    ]);
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    
    const { results } = await search('youtube !audio !frozen');
    expect(results).toHaveLength(1);
    expect(results[0].tab.id).toBe('live-tab-3');
  });

  it('handles scope parameter', async () => {
    (chrome.tabs.query as any).mockResolvedValue([]);
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    
    await search('test', { scope: 'all' });
    expect(chrome.tabs.query).toHaveBeenCalledWith({});
  });
});

describe('searchAndExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns results without executing if no commands', async () => {
    (chrome.tabs.query as any).mockResolvedValue([{ id: 1, title: 'Tab', url: 'https://example.com' }]);
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    
    const result = await searchAndExecute('test');
    expect(result.results).toBeDefined();
    expect(result.commandResults).toBeUndefined();
  });

  it('executes commands on results', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: 'Test Tab', url: 'https://example.com' },
    ]);
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    (chrome.tabs.remove as any).mockResolvedValue(undefined);
    
    const result = await searchAndExecute('test /delete');
    expect(result.commandResults).toBeDefined();
    expect(result.commandResults).toHaveLength(1);
  });

  it('returns command results', async () => {
    (chrome.tabs.query as any).mockResolvedValue([
      { id: 1, title: 'Test Tab', url: 'https://example.com' },
    ]);
    (chrome.tabGroups.query as any).mockResolvedValue([]);
    (chrome.tabs.remove as any).mockResolvedValue(undefined);
    
    const result = await searchAndExecute('test /delete');
    expect(result.commandResults?.[0]?.success).toBe(true);
    expect(result.commandResults?.[0]?.affectedCount).toBe(1);
  });
});

describe('isSearchActive', () => {
  it('returns false for null query', () => {
    expect(isSearchActive(null)).toBe(false);
  });

  it('returns false for empty textTerms and bangs', () => {
    const parsed: ParsedQuery = {
      textTerms: [],
      bangs: [],
      commands: [],
      sort: 'index',
      errors: [],
      raw: '',
    };
    expect(isSearchActive(parsed)).toBe(false);
  });

  it('returns true when textTerms present', () => {
    const parsed: ParsedQuery = {
      textTerms: ['test'],
      bangs: [],
      commands: [],
      sort: 'index',
      errors: [],
      raw: 'test',
    };
    expect(isSearchActive(parsed)).toBe(true);
  });

  it('returns true when bangs present', () => {
    const parsed: ParsedQuery = {
      textTerms: [],
      bangs: [{ type: 'audio', negated: false, raw: '!audio', position: { start: 0, end: 6 } }],
      commands: [],
      sort: 'index',
      errors: [],
      raw: '!audio',
    };
    expect(isSearchActive(parsed)).toBe(true);
  });
});

describe('hasCommands', () => {
  it('detects commands', () => {
    const parsed: ParsedQuery = {
      textTerms: [],
      bangs: [],
      commands: ['delete'],
      sort: 'index',
      errors: [],
      raw: '/delete',
    };
    expect(hasCommands(parsed)).toBe(true);
  });

  it('returns false when no commands', () => {
    const parsed: ParsedQuery = {
      textTerms: ['test'],
      bangs: [],
      commands: [],
      sort: 'index',
      errors: [],
      raw: 'test',
    };
    expect(hasCommands(parsed)).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasCommands(null)).toBe(false);
  });
});

describe('getResultCount', () => {
  it('counts results', () => {
    const results: SearchResult[] = [
      { tab: createMockTab(), matchScore: 1 },
      { tab: createMockTab(), matchScore: 1 },
      { tab: createMockTab(), matchScore: 1 },
    ];
    expect(getResultCount(results)).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(getResultCount([])).toBe(0);
  });
});
