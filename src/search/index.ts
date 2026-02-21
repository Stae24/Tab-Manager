export type * from './types';
export { tokenize, parseQuery, getQueryString } from './parser';
export {
  search,
  searchAndExecute,
  isSearchActive,
  hasCommands,
  getResultCount,
  getAllTabs,
  getGroups,
  buildSearchContext,
  sortResults,
} from './engine';
export type { SearchOptions } from './engine';
export {
  BANG_REGISTRY,
  COMMAND_REGISTRY,
  SORT_OPTIONS,
  CHROME_GROUP_COLORS,
  resolveBang,
  resolveCommand,
  resolveSort,
  getAllBangNames,
  getAllCommandNames,
} from './bangRegistry';
export {
  isLocalUrl,
  isIpAddress,
  isBrowserUrl,
  normalizeUrl,
  buildDuplicateMap,
  findDuplicates,
  getGroupId,
  matchesText,
} from './utils';

export { applyAllFilters, applyTextSearch, applyFilter } from './filters';
export { executeCommandsSequentially, executeCommand } from './commands';
