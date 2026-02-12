export type UniversalId = number | string;

export interface Tab {
  id: UniversalId;
  title: string;
  url: string;
  favicon: string;
  active: boolean;
  discarded: boolean;
  windowId: number;
  index: number;
  groupId: number;
  muted?: boolean;
  pinned?: boolean;
  audible?: boolean;
}

export interface Island {
  id: UniversalId;
  title: string;
  color: string;
  collapsed: boolean;
  tabs: Tab[];
}

export type LiveItem = Island | Tab;

export type DashboardRow =
  | { type: 'gap'; id: string; index: number }
  | { type: 'item'; id: UniversalId; item: Island | Tab };

export type VaultItem = (Island | Tab) & {
  savedAt: number;
  originalId: UniversalId;
};

// Vault Storage Types
export interface VaultStorageConfig {
  syncEnabled: boolean;
}

export type VaultStorageErrorType = 
  | 'QUOTA_EXCEEDED'
  | 'SYNC_FAILED'
  | 'CORRUPTION'
  | 'CHUNK_MISMATCH';

export type QuotaWarningLevel = 'none' | 'warning' | 'critical';

export interface VaultStorageResult {
  success: boolean;
  error?: VaultStorageErrorType;
  bytesUsed?: number;
  bytesAvailable?: number;
  warningLevel?: QuotaWarningLevel;
  fallbackToLocal?: boolean;
}

export interface VaultQuotaInfo {
  used: number;
  available: number;
  total: number;
  percentage: number;
  warningLevel: QuotaWarningLevel;
  orphanedChunks?: number;
}

export interface VaultMeta {
  version: number;
  chunkCount: number;
  chunkKeys: string[];
  checksum: string;
  timestamp: number;
  compressed: boolean;
}

export interface MigrationResult {
  migrated: boolean;
  itemCount: number;
  from?: 'sync_legacy' | 'local_legacy' | 'none';
  error?: string;
  fallbackToLocal?: boolean;
}

export interface VaultLoadResult {
  vault: VaultItem[];
  timestamp: number;
  fallbackToLocal?: boolean;
}

// Appearance settings types
export type ThemeMode = 'dark' | 'light' | 'system';
export type AnimationIntensity = 'full' | 'subtle' | 'off';
export type AudioIndicatorMode = 'off' | 'playing' | 'muted' | 'both';
export type BorderRadius = 'none' | 'small' | 'medium' | 'large' | 'full';
export type ButtonSize = 'small' | 'medium' | 'large';
export type IconPack = 'gx' | 'default' | 'minimal';
export type MenuPosition = 'left' | 'center' | 'right';
export type FaviconSource = 'chrome' | 'google' | 'google-hd' | 'duckduckgo' | 'icon-horse';
export type FaviconFallback = FaviconSource | 'none';
export type FaviconSize = '16' | '32' | '64' | '128';

export interface AppearanceSettings {
  // v1 - Essential
  theme: ThemeMode;
  uiScale: number;
  settingsScale: number;
  tabDensity: 'minified' | 'compact' | 'normal' | 'spacious';
  animationIntensity: AnimationIntensity;

  // v1.1 - High Value
  showFavicons: boolean;
  showAudioIndicators: AudioIndicatorMode;
  showFrozenIndicators: boolean;
  showActiveIndicator: boolean;
  showTabCount: boolean;

  // v1.2 - Polish
  accentColor: string;
  borderRadius: BorderRadius;
  compactGroupHeaders: boolean;
  buttonSize: ButtonSize;
  iconPack: IconPack;

  // v2 - Nice to Have
  customFontFamily?: string;
  dragOpacity: number;
  loadingSpinnerStyle: 'pulse' | 'dots' | 'bars' | 'ring';
  menuPosition: MenuPosition;

  // v2.1 - Storage
  vaultSyncEnabled: boolean;

  faviconSource: FaviconSource;
  faviconFallback: FaviconFallback;
  faviconSize: FaviconSize;

  sortGroupsByCount: boolean;
  sortVaultGroupsByCount: boolean;
}
