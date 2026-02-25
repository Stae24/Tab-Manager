import { Tab, VaultItem, Island } from '../types/index';

export interface SearchToken {
  type: 'text' | 'bang' | 'command' | 'exclude';
  raw: string;
  value: string;
  bangType?: BangType;
  bangValue?: string;
  position: { start: number; end: number };
}

export interface ParsedQuery {
  textTerms: string[];
  bangs: BangFilter[];
  commands: CommandType[];
  sort: SortType;
  errors: ParseError[];
  raw: string;
}

export interface BangFilter {
  type: BangType;
  value?: FilterValue;
  negated: boolean;
  raw: string;
  position: { start: number; end: number };
}

export type FilterValue = string | number;

export type BangType =
  | 'title'
  | 'url'
  | 'frozen'
  | 'audio'
  | 'pin'
  | 'vault'
  | 'grouped'
  | 'solo'
  | 'duplicate'
  | 'local'
  | 'ip'
  | 'browser'
  | 'groupname'
  | 'groupcolor';

export type CommandType = 'delete' | 'save' | 'freeze' | 'group' | 'ungroup';

export type SortType = 'index' | 'title' | 'url';

export interface ParseError {
  message: string;
  position: { start: number; end: number };
  raw: string;
  severity: 'error' | 'warning';
}

export interface SearchResult {
  tab: Tab;
  matchScore: number;
}

export interface SearchContext {
  allTabs: Tab[];
  vaultItems: VaultItem[];
  groups: Map<number, Island>;
  scope: 'current' | 'all';
  duplicateMap: Map<string, Tab[]>;
  localPatterns: string[];
}

export interface SearchState {
  query: string;
  scope: 'current' | 'all';
  results: SearchResult[];
  isSearching: boolean;
  errors: ParseError[];
  parsedQuery: ParsedQuery | null;
}

export interface BangDefinition {
  name: string;
  short?: string;
  description: string;
  type: 'text-scope' | 'boolean' | 'value' | 'sort';
  aliases?: string[];
}

export interface CommandDefinition {
  name: string;
  short?: string;
  description: string;
  destructive: boolean;
}

export type FilterFunction = (
  tab: Tab,
  context: SearchContext,
  value?: FilterValue
) => boolean;

export type CommandFunction = (
  tabs: Tab[],
  context: SearchContext
) => Promise<CommandResult>;

export interface CommandResult {
  success: boolean;
  affectedCount: number;
  error?: string;
  undoAction?: () => Promise<void>;
}

export interface AutocompleteSuggestion {
  type: 'bang' | 'command' | 'sort';
  value: string;
  display: string;
  description: string;
  short?: string;
}
