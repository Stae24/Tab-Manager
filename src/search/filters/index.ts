import { Tab, Island } from '../../types/index';
import { BangType, FilterFunction, SearchContext, FilterValue } from '../types';
import {
  isLocalUrl,
  isIpAddress,
  isBrowserUrl,
  findDuplicates,
  matchesText,
  getGroupId,
} from '../utils';

const createTextScopeFilter = (scope: 'title' | 'url'): FilterFunction => {
  return (tab: Tab, _context: SearchContext, value?: FilterValue): boolean => {
    if (!value || typeof value !== 'string') return true;
    return matchesText(tab, value, scope);
  };
};

const createBooleanFilter = (
  checkFn: (tab: Tab, context: SearchContext) => boolean
): FilterFunction => {
  return (tab: Tab, context: SearchContext): boolean => {
    return checkFn(tab, context);
  };
};

const createValueFilter = (
  checkFn: (tab: Tab, context: SearchContext, value: FilterValue) => boolean
): FilterFunction => {
  return (tab: Tab, context: SearchContext, value?: FilterValue): boolean => {
    if (value === undefined) return true;
    return checkFn(tab, context, value);
  };
};

const frozenFilter: FilterFunction = createBooleanFilter((tab) => tab.discarded === true);

const audioFilter: FilterFunction = createBooleanFilter((tab) => tab.audible === true);

const pinFilter: FilterFunction = createBooleanFilter((tab) => tab.pinned === true);

const vaultFilter: FilterFunction = createBooleanFilter((tab, context) => {
  return context.vaultItems.some((v) => {
    if ('url' in v) {
      return v.originalId === tab.id || v.url === tab.url;
    }
    return v.originalId === tab.id;
  });
});

const groupedFilter: FilterFunction = createBooleanFilter((tab) => {
  const groupId = getGroupId(tab);
  return groupId !== null;
});

const soloFilter: FilterFunction = createBooleanFilter((tab) => {
  const groupId = getGroupId(tab);
  return groupId === null;
});

const duplicateFilter: FilterFunction = createBooleanFilter((tab, context) => {
  return findDuplicates(tab, context.duplicateMap);
});

const localFilter: FilterFunction = createBooleanFilter((tab, context) => {
  if (!tab.url) return false;
  return isLocalUrl(tab.url, context.localPatterns);
});

const ipFilter: FilterFunction = createBooleanFilter((tab) => {
  if (!tab.url) return false;
  try {
    const urlObj = new URL(tab.url);
    return isIpAddress(urlObj.hostname);
  } catch {
    return false;
  }
});

const browserFilter: FilterFunction = createBooleanFilter((tab) => {
  if (!tab.url) return false;
  return isBrowserUrl(tab.url);
});

const groupnameFilter: FilterFunction = createValueFilter(
  (tab: Tab, context: SearchContext, value: FilterValue): boolean => {
    const groupId = getGroupId(tab);
    if (groupId === null) return false;

    const group = context.groups.get(groupId);
    if (!group) return false;

    const searchValue = String(value).toLowerCase();
    return group.title?.toLowerCase().includes(searchValue) ?? false;
  }
);

const groupcolorFilter: FilterFunction = createValueFilter(
  (tab: Tab, context: SearchContext, value: FilterValue): boolean => {
    const groupId = getGroupId(tab);
    if (groupId === null) return false;

    const group = context.groups.get(groupId);
    if (!group) return false;

    const searchColor = String(value).toLowerCase();
    return group.color?.toLowerCase() === searchColor;
  }
);

export const FILTER_REGISTRY: Record<BangType, FilterFunction> = {
  title: createTextScopeFilter('title'),
  url: createTextScopeFilter('url'),
  frozen: frozenFilter,
  audio: audioFilter,
  pin: pinFilter,
  vault: vaultFilter,
  grouped: groupedFilter,
  solo: soloFilter,
  duplicate: duplicateFilter,
  local: localFilter,
  ip: ipFilter,
  browser: browserFilter,
  groupname: groupnameFilter,
  groupcolor: groupcolorFilter,
};

export function applyFilter(
  tab: Tab,
  bangType: BangType,
  context: SearchContext,
  value?: FilterValue,
  negated: boolean = false
): boolean {
  const filterFn = FILTER_REGISTRY[bangType];
  if (!filterFn) return true;

  const result = filterFn(tab, context, value);
  return negated ? !result : result;
}

export function applyAllFilters(
  tab: Tab,
  bangs: Array<{ type: BangType; value?: FilterValue; negated: boolean }>,
  context: SearchContext
): boolean {
  for (const bang of bangs) {
    if (!applyFilter(tab, bang.type, context, bang.value, bang.negated)) {
      return false;
    }
  }
  return true;
}

export function applyTextSearch(
  tab: Tab,
  terms: string[],
  titleScope: boolean = false,
  urlScope: boolean = false
): boolean {
  if (terms.length === 0) return true;

  for (const term of terms) {
    const scope: 'title' | 'url' | undefined = titleScope ? 'title' : urlScope ? 'url' : undefined;
    if (!matchesText(tab, term, scope)) {
      return false;
    }
  }
  return true;
}
