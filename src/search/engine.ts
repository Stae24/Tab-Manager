import { Tab, Island, VaultItem, LiveItem } from '../types/index';
import { parseQuery } from './parser';
import { applyAllFilters, applyTextSearch } from './filters';
import { executeCommandsSequentially } from './commands';
import { buildDuplicateMap } from './utils';
import {
  ParsedQuery,
  SearchResult,
  SearchContext,
  CommandType,
  SortType,
} from './types';

export { parseQuery } from './parser';
export { executeCommandsSequentially as executeCommands } from './commands';

export interface SearchOptions {
  scope?: 'current' | 'all';
  vaultItems?: VaultItem[];
  localPatterns?: string[];
}

export async function getAllTabs(scope: 'current' | 'all' = 'current'): Promise<Tab[]> {
  const queryOpts: chrome.tabs.QueryInfo = scope === 'all' ? {} : { currentWindow: true };
  const chromeTabs = await chrome.tabs.query(queryOpts);
  const extensionPrefix = `chrome-extension://${chrome.runtime.id}/`;

  return chromeTabs
    .filter((t) => t.id !== undefined)
    .filter((t) => !t.url?.startsWith(extensionPrefix))
    .map((t) => ({
      id: `live-tab-${t.id}`,
      title: t.title || 'Untitled',
      url: t.url || '',
      favicon: t.favIconUrl || '',
      active: t.active,
      discarded: t.discarded,
      windowId: t.windowId,
      index: t.index,
      groupId: t.groupId,
      muted: t.mutedInfo?.muted ?? false,
      pinned: t.pinned,
      audible: t.audible ?? false,
    }));
}

export async function getGroups(scope: 'current' | 'all' = 'current'): Promise<Map<number, Island>> {
  const groupMap = new Map<number, Island>();

  const queryOpts: chrome.tabGroups.QueryInfo = scope === 'all' ? {} : { windowId: chrome.windows.WINDOW_ID_CURRENT };
  const chromeGroups = await chrome.tabGroups.query(queryOpts);

  for (const g of chromeGroups) {
    groupMap.set(g.id, {
      id: `live-group-${g.id}`,
      title: g.title || '',
      color: g.color,
      collapsed: g.collapsed,
      tabs: [],
    });
  }

  return groupMap;
}

export function buildSearchContext(
  tabs: Tab[],
  vaultItems: VaultItem[] = [],
  groups: Map<number, Island>,
  scope: 'current' | 'all' = 'current',
  localPatterns: string[] = []
): SearchContext {
  const duplicateMap = buildDuplicateMap(tabs);

  return {
    allTabs: tabs,
    vaultItems,
    groups,
    scope,
    duplicateMap,
    localPatterns,
  };
}

export function sortResults(results: SearchResult[], sort: SortType): SearchResult[] {
  const sorted = [...results];

  switch (sort) {
    case 'title':
      sorted.sort((a, b) => (a.tab.title || '').localeCompare(b.tab.title || ''));
      break;
    case 'url':
      sorted.sort((a, b) => (a.tab.url || '').localeCompare(b.tab.url || ''));
      break;
    case 'index':
    default:
      sorted.sort((a, b) => (a.tab.index || 0) - (b.tab.index || 0));
      break;
  }

  return sorted;
}

export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; parsedQuery: ParsedQuery }> {
  const { scope = 'current', vaultItems = [], localPatterns = [] } = options;

  const parsedQuery = parseQuery(query);

  // If there's no text terms, bangs, or commands, return empty results
  if (parsedQuery.textTerms.length === 0 && parsedQuery.bangs.length === 0 && parsedQuery.commands.length === 0) {
    return { results: [], parsedQuery };
  }

  const [tabs, groups] = await Promise.all([getAllTabs(scope), getGroups(scope)]);

  const context = buildSearchContext(tabs, vaultItems, groups, scope, localPatterns);

  const titleScopeBang = parsedQuery.bangs.find((b) => b.type === 'title');
  const urlScopeBang = parsedQuery.bangs.find((b) => b.type === 'url');

  const otherBangs = parsedQuery.bangs.filter((b) => b.type !== 'title' && b.type !== 'url');

  const results: SearchResult[] = [];

  for (const tab of tabs) {
    const textMatch = applyTextSearch(
      tab,
      parsedQuery.textTerms,
      !!titleScopeBang && !titleScopeBang.negated,
      !!urlScopeBang && !urlScopeBang.negated
    );

    if (!textMatch) continue;

    const filterMatch = applyAllFilters(tab, otherBangs, context);

    if (!filterMatch) continue;

    results.push({ tab, matchScore: 1 });
  }

  const sortedResults = sortResults(results, parsedQuery.sort);

  return { results: sortedResults, parsedQuery };
}

export async function searchAndExecute(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; parsedQuery: ParsedQuery; commandResults?: Awaited<ReturnType<typeof executeCommandsSequentially>> }> {
  const { results, parsedQuery } = await search(query, options);

  // Execute commands when there are commands and results to operate on
  if (parsedQuery.commands.length > 0 && results.length > 0) {
    const [tabs, groups] = await Promise.all([getAllTabs(options.scope || 'current'), getGroups(options.scope || 'current')]);
    const context = buildSearchContext(tabs, options.vaultItems || [], groups, options.scope || 'current', options.localPatterns || []);

    const matchedTabs = results.map((r) => r.tab);
    const commandResults = await executeCommandsSequentially(parsedQuery.commands, matchedTabs, context);

    return { results, parsedQuery, commandResults };
  }

  // If there are commands but no results (e.g., command-only query with filters that matched nothing),
  // still try to execute on all tabs when there's only a command with no text/bangs
  if (parsedQuery.commands.length > 0 && results.length === 0) {
    const [tabs, groups] = await Promise.all([getAllTabs(options.scope || 'current'), getGroups(options.scope || 'current')]);
    const context = buildSearchContext(tabs, options.vaultItems || [], groups, options.scope || 'current', options.localPatterns || []);

    // Execute command on all tabs when there's a command but no text or bangs
    const commandResults = await executeCommandsSequentially(parsedQuery.commands, tabs, context);

    return { results: tabs.map((tab) => ({ tab, matchScore: 1 })), parsedQuery, commandResults };
  }

  return { results, parsedQuery };
}

export function isSearchActive(parsedQuery: ParsedQuery | null): boolean {
  if (!parsedQuery) return false;
  return parsedQuery.textTerms.length > 0 || parsedQuery.bangs.length > 0 || parsedQuery.commands.length > 0;
}

export function hasCommands(parsedQuery: ParsedQuery | null): boolean {
  return parsedQuery ? parsedQuery.commands.length > 0 : false;
}

export function getResultCount(results: SearchResult[]): number {
  return results.length;
}
