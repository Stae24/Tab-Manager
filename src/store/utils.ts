import { UniqueIdentifier } from '@dnd-kit/core';
import { Island, Tab, VaultItem, AppearanceSettings, LiveItem } from '../types/index';
import { logger } from '../utils/logger';
import { 
  DEBOUNCE_DEFAULT_MS, 
  CHROME_32BIT_INT_MAX, 
  DEFAULT_DRAG_OPACITY, 
  MAX_SYNC_RETRIES, 
  INITIAL_SYNC_BACKOFF, 
  SYNC_SETTINGS_DEBOUNCE_MS 
} from '../constants';

export const debounce = <T extends (...args: any[]) => any>(fn: T, ms = DEBOUNCE_DEFAULT_MS) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: unknown, ...args: Parameters<T>) {
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
      if (num > 0 && Number.isSafeInteger(num) && num <= CHROME_32BIT_INT_MAX) {
        return num;
      }
    }
  }

  // Log failure to aid debugging, especially for "live-" prefixed IDs which should always have a numeric component
  if (idStr.startsWith('live-')) {
    logger.error(`[Store] Failed to parse mandatory numeric ID from live item: ${idStr}`);
  } else {
    logger.debug(`[Store] No numeric ID found in: ${idStr}`);
  }

  return null;
};

export const isTab = (item: unknown): item is Tab => {
  if (!item || typeof item !== 'object') return false;
  const t = item as Partial<Tab>;
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
  const i = item as Partial<Island>;
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
  const v = item as Partial<VaultItem>;
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
  const s = settings as Partial<AppearanceSettings>;
  
  return (
    !!s.theme && ['dark', 'light', 'system'].includes(s.theme) &&
    typeof s.uiScale === 'number' &&
    typeof s.settingsScale === 'number' &&
    !!s.tabDensity && ['minified', 'compact', 'normal', 'spacious'].includes(s.tabDensity) &&
    !!s.animationIntensity && ['full', 'subtle', 'off'].includes(s.animationIntensity) &&
    typeof s.showFavicons === 'boolean' &&
    !!s.showAudioIndicators && ['off', 'playing', 'muted', 'both'].includes(s.showAudioIndicators) &&
    typeof s.showFrozenIndicators === 'boolean' &&
    typeof s.showActiveIndicator === 'boolean' &&
    typeof s.showTabCount === 'boolean' &&
    typeof s.accentColor === 'string' &&
    !!s.borderRadius && ['none', 'small', 'medium', 'large', 'full'].includes(s.borderRadius) &&
    typeof s.compactGroupHeaders === 'boolean' &&
    !!s.buttonSize && ['small', 'medium', 'large'].includes(s.buttonSize) &&
    !!s.iconPack && ['gx', 'default', 'minimal'].includes(s.iconPack) &&
    typeof s.dragOpacity === 'number' &&
    !!s.loadingSpinnerStyle && ['pulse', 'dots', 'bars', 'ring'].includes(s.loadingSpinnerStyle) &&
    !!s.menuPosition && ['left', 'center', 'right'].includes(s.menuPosition) &&
    typeof s.vaultSyncEnabled === 'boolean' &&
    !!s.faviconSource && ['chrome', 'google', 'google-hd', 'duckduckgo', 'icon-horse'].includes(s.faviconSource) &&
    !!s.faviconFallback && ['chrome', 'google', 'google-hd', 'duckduckgo', 'icon-horse', 'none'].includes(s.faviconFallback) &&
    !!s.faviconSize && ['16', '32', '64', '128'].includes(s.faviconSize) &&
    typeof s.sortGroupsByCount === 'boolean' &&
    typeof s.sortVaultGroupsByCount === 'boolean' &&
    typeof s.autoPinTabManager === 'boolean' &&
    (typeof s.debugMode === 'boolean' || s.debugMode === undefined)
  );
};

// Tactical Item Discovery
export const findItemInList = <T extends LiveItem | VaultItem>(
  list: T[], 
  id: UniqueIdentifier
): { item: T | Tab; containerId: UniqueIdentifier | 'root'; index: number } | null => {
  const idStr = String(id);

  // Check root level first
  const rootIndex = list.findIndex(i => i && String(i.id) === idStr);
  if (rootIndex !== -1) {
    return { item: list[rootIndex], containerId: 'root' as const, index: rootIndex };
  }

  // Check nested levels (tabs inside groups)
  for (const entry of list) {
    if (entry && 'tabs' in entry && Array.isArray(entry.tabs)) {
      const tabs = entry.tabs as Tab[];
      const tabIndex = tabs.findIndex((t: Tab) => String(t.id) === idStr);
      if (tabIndex !== -1) {
        return { item: tabs[tabIndex], containerId: (entry as T).id, index: tabIndex };
      }
    }
  }
  return null;
};

export const cloneWithDeepGroups = <T extends LiveItem | VaultItem>(list: T[]): T[] => {
  return list.map(item => {
    if (item && 'tabs' in item) {
      return { ...item, tabs: [...(item.tabs || [])] } as T;
    }
    return item;
  });
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
  dragOpacity: DEFAULT_DRAG_OPACITY,
  loadingSpinnerStyle: 'pulse',
  menuPosition: 'left',
  vaultSyncEnabled: true,
  faviconSource: 'google',
  faviconFallback: 'duckduckgo',
  faviconSize: '32',
  sortGroupsByCount: true,
  sortVaultGroupsByCount: true,
  autoPinTabManager: true,
  debugMode: false,
};

export type SyncState = Partial<{
  appearanceSettings: AppearanceSettings;
  dividerPosition: number;
  showVault: boolean;
  settingsPanelWidth: number;
}>;

export const performSync = async (settings: SyncState, retryCount = 0) => {
  try {
    await chrome.storage.sync.set(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isQuotaError = message.includes('QUOTA_EXCEEDED');
    const isThrottled = message.includes('MAX_WRITE_OPERATIONS') || message.includes('throttled');
    
    logger.error(`[SyncSettings] Failed to sync settings (attempt ${retryCount + 1}):`, error);
    
    if (retryCount < MAX_SYNC_RETRIES && (isQuotaError || isThrottled)) {
      const delay = INITIAL_SYNC_BACKOFF * Math.pow(2, retryCount);
      setTimeout(() => performSync(settings, retryCount + 1), delay);
    }
  }
};

export const syncSettings = debounce((settings: SyncState) => {
  performSync(settings);
}, SYNC_SETTINGS_DEBOUNCE_MS);

