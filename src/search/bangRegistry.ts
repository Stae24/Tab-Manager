import { BangDefinition, CommandDefinition, BangType, CommandType, SortType } from './types';

export const BANG_REGISTRY: Record<BangType, BangDefinition> = {
  title: {
    name: 'title',
    short: 't',
    description: 'Search in tab title only',
    type: 'text-scope',
  },
  url: {
    name: 'url',
    short: 'u',
    description: 'Search in tab URL only',
    type: 'text-scope',
  },
  frozen: {
    name: 'frozen',
    short: 'f',
    description: 'Frozen/suspended tabs',
    type: 'boolean',
  },
  audio: {
    name: 'audio',
    short: 'a',
    description: 'Tabs playing audio',
    type: 'boolean',
  },
  pin: {
    name: 'pin',
    short: 'p',
    description: 'Pinned tabs',
    type: 'boolean',
  },
  vault: {
    name: 'vault',
    short: 'v',
    description: 'Tabs in vault',
    type: 'boolean',
  },
  grouped: {
    name: 'grouped',
    short: 'g',
    description: 'Tabs in a group',
    type: 'boolean',
  },
  solo: {
    name: 'solo',
    short: 's',
    description: 'Tabs not in any group',
    type: 'boolean',
  },
  duplicate: {
    name: 'duplicate',
    short: 'd',
    description: 'Duplicate tabs (same URL)',
    type: 'boolean',
  },
  local: {
    name: 'local',
    short: 'l',
    description: 'Local URLs (localhost, file://, etc.)',
    type: 'boolean',
  },
  ip: {
    name: 'ip',
    short: 'i',
    description: 'IP address URLs (not domain names)',
    type: 'boolean',
  },
  browser: {
    name: 'browser',
    short: 'b',
    description: 'Browser internal pages (chrome://, about:, etc.)',
    type: 'boolean',
  },
  groupname: {
    name: 'groupname',
    short: 'gn',
    description: 'Group name contains text',
    type: 'value',
  },
  groupcolor: {
    name: 'groupcolor',
    short: 'gc',
    description: 'Group color (grey, blue, red, etc.)',
    type: 'value',
  },
};

export const COMMAND_REGISTRY: Record<CommandType, CommandDefinition> = {
  delete: {
    name: 'delete',
    short: 'd',
    description: 'Close all matching tabs',
    destructive: true,
  },
  save: {
    name: 'save',
    short: 's',
    description: 'Save all matching tabs to vault',
    destructive: false,
  },
  freeze: {
    name: 'freeze',
    short: 'f',
    description: 'Freeze/suspend all matching tabs',
    destructive: false,
  },
  group: {
    name: 'group',
    short: 'g',
    description: 'Group all matching tabs',
    destructive: false,
  },
  ungroup: {
    name: 'ungroup',
    short: 'ug',
    description: 'Ungroup all matching tabs',
    destructive: false,
  },
};

export const SORT_OPTIONS: Record<SortType, { name: string; description: string }> = {
  index: {
    name: 'index',
    description: 'Browser order (default)',
  },
  title: {
    name: 'title',
    description: 'Alphabetical by title',
  },
  url: {
    name: 'url',
    description: 'Alphabetical by URL',
  },
};

export const CHROME_GROUP_COLORS: readonly string[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

const BANG_ALIAS_MAP: Record<string, BangType> = {};
for (const [key, def] of Object.entries(BANG_REGISTRY)) {
  BANG_ALIAS_MAP[key.toLowerCase()] = key as BangType;
  if (def.short) {
    BANG_ALIAS_MAP[def.short.toLowerCase()] = key as BangType;
  }
}

const COMMAND_ALIAS_MAP: Record<string, CommandType> = {};
for (const [key, def] of Object.entries(COMMAND_REGISTRY)) {
  COMMAND_ALIAS_MAP[key.toLowerCase()] = key as CommandType;
  if (def.short) {
    COMMAND_ALIAS_MAP[def.short.toLowerCase()] = key as CommandType;
  }
}

export function resolveBang(name: string): BangType | null {
  return BANG_ALIAS_MAP[name.toLowerCase()] ?? null;
}

export function resolveCommand(name: string): CommandType | null {
  return COMMAND_ALIAS_MAP[name.toLowerCase()] ?? null;
}

export function resolveSort(name: string): SortType | null {
  const normalized = name.toLowerCase();
  if (normalized in SORT_OPTIONS) {
    return normalized as SortType;
  }
  return null;
}

export function getAllBangNames(): string[] {
  const names = new Set<string>();
  for (const [key, def] of Object.entries(BANG_REGISTRY)) {
    names.add(key);
    if (def.short) names.add(def.short);
  }
  return Array.from(names);
}

export function getAllCommandNames(): string[] {
  const names = new Set<string>();
  for (const [key, def] of Object.entries(COMMAND_REGISTRY)) {
    names.add(key);
    if (def.short) names.add(def.short);
  }
  return Array.from(names);
}
