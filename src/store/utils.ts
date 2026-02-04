import { UniqueIdentifier } from '@dnd-kit/core';
import { Island, Tab, VaultItem, AppearanceSettings } from '../types/index';

export const debounce = (fn: Function, ms = 500) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

// Helper to extract numeric ID from prefixed strings
export const parseNumericId = (id: UniqueIdentifier): number | null => {
  if (id === null || id === undefined) return null;
  const idStr = String(id);

  // Search for the first valid numeric segment
  const segments = idStr.split('-');
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (/^\d+$/.test(s)) {
      // Check if it was preceded by an empty segment (e.g., --1) which indicates a negative number
      if (i > 0 && segments[i - 1] === '') continue;

      const num = Number(s);
      // Chrome API constraints: 1 to 2^31-1 (32-bit signed int limit)
      if (num > 0 && Number.isSafeInteger(num) && num <= 2147483647) {
        return num;
      }
    }
  }

  // Log failure to aid debugging, especially for "live-" prefixed IDs which should always have a numeric component
  if (idStr.startsWith('live-')) {
    console.error(`[Store] Failed to parse mandatory numeric ID from live item: ${idStr}`);
  } else {
    console.debug(`[Store] No numeric ID found in: ${idStr}`);
  }

  return null;
};

export const isTab = (item: unknown): item is Tab => {
  if (!item || typeof item !== 'object') return false;
  const t = item as any;
  return (
    (typeof t.id === 'string' || typeof t.id === 'number') &&
    typeof t.title === 'string' &&
    typeof t.url === 'string' &&
    typeof t.favicon === 'string' &&
    typeof t.active === 'boolean' &&
    typeof t.discarded === 'boolean' &&
    typeof t.windowId === 'number' &&
    typeof t.index === 'number' &&
    typeof t.groupId === 'number'
  );
};

export const isIsland = (item: unknown): item is Island => {
  if (!item || typeof item !== 'object') return false;
  const i = item as any;
  return (
    (typeof i.id === 'string' || typeof i.id === 'number') &&
    typeof i.title === 'string' &&
    typeof i.color === 'string' &&
    typeof i.collapsed === 'boolean' &&
    Array.isArray(i.tabs) &&
    i.tabs.every(isTab)
  );
};

export const isVaultItem = (item: unknown): item is VaultItem => {
  if (!item || typeof item !== 'object') return false;
  const v = item as any;
  return (
    typeof v.savedAt === 'number' &&
    (typeof v.originalId === 'string' || typeof v.originalId === 'number') &&
    (isIsland(v) || isTab(v))
  );
};

export const isVaultItems = (items: unknown): items is VaultItem[] => {
  return Array.isArray(items) && items.every(isVaultItem);
};

export const isAppearanceSettings = (settings: unknown): settings is AppearanceSettings => {
  if (!settings || typeof settings !== 'object') return false;
  const s = settings as any;
  
  return (
    ['dark', 'light', 'system'].includes(s.theme) &&
    typeof s.uiScale === 'number' &&
    typeof s.settingsScale === 'number' &&
    ['minified', 'compact', 'normal', 'spacious'].includes(s.tabDensity) &&
    ['full', 'subtle', 'off'].includes(s.animationIntensity) &&
    typeof s.showFavicons === 'boolean' &&
    ['off', 'playing', 'muted', 'both'].includes(s.showAudioIndicators) &&
    typeof s.showFrozenIndicators === 'boolean' &&
    typeof s.showActiveIndicator === 'boolean' &&
    typeof s.showTabCount === 'boolean' &&
    typeof s.accentColor === 'string' &&
    ['none', 'small', 'medium', 'large', 'full'].includes(s.borderRadius) &&
    typeof s.compactGroupHeaders === 'boolean' &&
    ['small', 'medium', 'large'].includes(s.buttonSize) &&
    ['gx', 'default', 'minimal'].includes(s.iconPack) &&
    typeof s.dragOpacity === 'number' &&
    ['pulse', 'dots', 'bars', 'ring'].includes(s.loadingSpinnerStyle) &&
    ['left', 'center', 'right'].includes(s.menuPosition) &&
    typeof s.vaultSyncEnabled === 'boolean' &&
    ['chrome', 'google', 'google-hd', 'duckduckgo', 'icon-horse'].includes(s.faviconSource) &&
    ['chrome', 'google', 'google-hd', 'duckduckgo', 'icon-horse', 'none'].includes(s.faviconFallback) &&
    ['16', '32', '64', '128'].includes(s.faviconSize) &&
    typeof s.sortGroupsByCount === 'boolean' &&
    typeof s.sortVaultGroupsByCount === 'boolean'
  );
};

// Tactical Item Discovery
export const findItemInList = (list: any[], id: UniqueIdentifier) => {
  const idStr = String(id);

  // Check root level first
  const rootIndex = list.findIndex(i => i && String(i.id) == idStr);
  if (rootIndex !== -1) {
    return { item: list[rootIndex], containerId: 'root', index: rootIndex };
  }

  // Check nested levels (tabs inside groups)
  for (const entry of list) {
    if (entry && (entry as any).tabs && Array.isArray((entry as any).tabs)) {
      const tabs = (entry as any).tabs;
      const tabIndex = tabs.findIndex((t: any) => String(t.id) == idStr);
      if (tabIndex !== -1) {
        return { item: tabs[tabIndex], containerId: entry.id, index: tabIndex };
      }
    }
  }
  return null;
};

// Default appearance settings for reset functionality
export const defaultAppearanceSettings: AppearanceSettings = {
  theme: 'system',
  uiScale: 1,
  settingsScale: 1,
  tabDensity: 'normal',
  animationIntensity: 'full',
  showFavicons: true,
  showAudioIndicators: 'both',
  showFrozenIndicators: true,
  showActiveIndicator: true,
  showTabCount: true,
  accentColor: 'gx-accent',
  borderRadius: 'medium',
  compactGroupHeaders: false,
  buttonSize: 'medium',
  iconPack: 'gx',
  customFontFamily: undefined,
  dragOpacity: 0.5,
  loadingSpinnerStyle: 'pulse',
  menuPosition: 'left',
  vaultSyncEnabled: true,
  faviconSource: 'google',
  faviconFallback: 'duckduckgo',
  faviconSize: '32',
  sortGroupsByCount: true,
  sortVaultGroupsByCount: true,
};

const MAX_SYNC_RETRIES = 3;
const INITIAL_SYNC_BACKOFF = 1000;

export const performSync = async (settings: any, retryCount = 0) => {
  try {
    await chrome.storage.sync.set(settings);
  } catch (error: any) {
    const message = error?.message || String(error);
    const isQuotaError = message.includes('QUOTA_EXCEEDED');
    const isThrottled = message.includes('MAX_WRITE_OPERATIONS') || message.includes('throttled');
    
    console.error(`[SyncSettings] Failed to sync settings (attempt ${retryCount + 1}):`, error);
    
    if (retryCount < MAX_SYNC_RETRIES && (isQuotaError || isThrottled)) {
      const delay = INITIAL_SYNC_BACKOFF * Math.pow(2, retryCount);
      setTimeout(() => performSync(settings, retryCount + 1), delay);
    }
  }
};

export const syncSettings = debounce((settings: any) => {
  performSync(settings);
}, 5000);
