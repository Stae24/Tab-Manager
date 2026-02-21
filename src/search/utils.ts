import { Tab } from '../types/index';

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

const LOCAL_PATTERNS = [
  /^file:\/\//i,
  /^localhost/i,
  /.*\.local$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
];

export function isLocalUrl(url: string, additionalPatterns: string[] = []): boolean {
  try {
    const urlLower = url.toLowerCase();
    
    if (urlLower.startsWith('file://')) {
      return true;
    }

    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();

    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    for (const pattern of LOCAL_PATTERNS) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    for (const pattern of additionalPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(url) || regex.test(hostname)) {
          return true;
        }
      } catch {
        if (hostname.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function isIpAddress(hostname: string): boolean {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^\[?([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]?$/;

  if (ipv4Pattern.test(hostname)) {
    const parts = hostname.split('.').map(Number);
    return parts.every((part) => part >= 0 && part <= 255);
  }

  if (ipv6Pattern.test(hostname)) {
    return true;
  }

  return false;
}

export function isBrowserUrl(url: string): boolean {
  const browserPatterns = [
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^about:/i,
    /^edge:\/\//i,
    /^opera:\/\//i,
    /^brave:\/\//i,
    /^vivaldi:\/\//i,
    /^firefox:\/\//i,
    /^moz-extension:\/\//i,
  ];

  return browserPatterns.some((pattern) => pattern.test(url));
}

export function normalizeUrl(url: string, mode: 'strict' | 'loose' = 'loose'): string {
  try {
    const urlObj = new URL(url);

    if (mode === 'strict') {
      return `${urlObj.protocol}//${urlObj.host.toLowerCase()}${urlObj.pathname.replace(/\/+$/, '').toLowerCase()}${urlObj.search}${urlObj.hash}`;
    }

    return `${urlObj.protocol}//${urlObj.host.toLowerCase()}${urlObj.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    if (mode === 'strict') {
      return url.trim().replace(/\/+$/, '').toLowerCase();
    }
    return url.split('#')[0].split('?')[0].trim().replace(/\/+$/, '').toLowerCase();
  }
}

export function buildDuplicateMap(tabs: Tab[], mode: 'strict' | 'loose' = 'loose'): Map<string, Tab[]> {
  const map = new Map<string, Tab[]>();

  for (const tab of tabs) {
    if (!tab.url) continue;

    const normalized = normalizeUrl(tab.url, mode);
    const existing = map.get(normalized) || [];
    existing.push(tab);
    map.set(normalized, existing);
  }

  return map;
}

export function findDuplicates(tab: Tab, duplicateMap: Map<string, Tab[]>, mode: 'strict' | 'loose' = 'loose'): boolean {
  if (!tab.url) return false;

  const normalized = normalizeUrl(tab.url, mode);
  const tabs = duplicateMap.get(normalized);
  return tabs ? tabs.length > 1 : false;
}

export function getGroupId(tab: Tab): number | null {
  const groupId = tab.groupId;
  return groupId !== undefined && groupId !== -1 ? groupId : null;
}

export function matchesText(tab: Tab, term: string, scope?: 'title' | 'url'): boolean {
  const lowerTerm = term.toLowerCase();

  if (scope === 'title') {
    return tab.title?.toLowerCase().includes(lowerTerm) ?? false;
  }

  if (scope === 'url') {
    return tab.url?.toLowerCase().includes(lowerTerm) ?? false;
  }

  const titleMatch = tab.title?.toLowerCase().includes(lowerTerm) ?? false;
  const urlMatch = tab.url?.toLowerCase().includes(lowerTerm) ?? false;
  return titleMatch || urlMatch;
}
