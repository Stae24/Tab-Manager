export type UniversalId = number | string;

export interface HotkeyBinding {
  code: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

export type ToolbarClickAction = 'toggle-sidebar' | 'open-manager-page';
export type SidebarLayoutMode = 'overlay' | 'push';
export type SidebarDockSide = 'left' | 'right';

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
  compressionTier?: CompressionTier;
}

export interface VaultQuotaInfo {
  used: number;
  available: number;
  total: number;
  percentage: number;
  warningLevel: QuotaWarningLevel;
  orphanedChunks?: number;
}

export type CompressionTier = 'full' | 'no_favicons' | 'minimal';

export interface VaultDiff {
  added: VaultItem[];
  deleted: UniversalId[];
  timestamp: number;
}

export interface VaultMeta {
  version: number;
  chunkCount: number;
  chunkKeys: string[];
  checksum: string;
  timestamp: number;
  compressed: boolean;
  compressionTier?: CompressionTier;
  minified?: boolean;
  diffKey?: string;
  domainDedup?: boolean;
}

export interface MinifiedVaultWithDomains {
  version: number;
  domains: string[];
  items: unknown[][];
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
export type ThemeMode = 'dark' | 'light' | 'system' | 'dark-pro' | 'ocean' | 'forest' | 'sunset' | 'dracula' | 'nord' | 'monokai' | 'solarized-light' | 'solarized-dark' | 'midnight' | 'cyberpunk' | 'coffee';
export type AnimationIntensity = 'full' | 'subtle' | 'off';
export type AudioIndicatorMode = 'off' | 'playing' | 'muted' | 'both';
export type BorderRadius = 'none' | 'small' | 'medium' | 'large' | 'full';
export type ButtonSize = 'small' | 'medium' | 'large';
export type IconPack = 'gx' | 'default' | 'minimal';
export type MenuPosition = 'left' | 'center' | 'right';
export type FaviconSource = 'chrome' | 'google' | 'google-hd' | 'duckduckgo' | 'icon-horse';
export type FaviconFallback = FaviconSource | 'none';
export type FaviconSize = '16' | '32' | '64' | '128';

export interface ThemeElementsConfig {
  background: boolean;
  panels: boolean;
  text: boolean;
  accent: boolean;
}

export type LoadingSpinnerStyle = 'pulse' | 'dots' | 'bars' | 'ring';

export interface AppearanceSettings {
  // v1 - Essential
  theme: ThemeMode;
  themeElements: ThemeElementsConfig;
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

  // v2.2 - Behavior
  autoPinTabManager: boolean;
  focusExistingTab?: boolean;

  /**
   * Debounce delay for search input in milliseconds.
   * Must be a finite non-negative number (>= 0) and preferably an integer.
   * NaN, Infinity, and negative values are invalid.
   */
  searchDebounce?: number;

  // v3 - Custom Sidebar
  toolbarClickAction: ToolbarClickAction;
  sidebarLayoutMode: SidebarLayoutMode;
  sidebarDockSide: SidebarDockSide;
  sidebarWidthPx: number;
  /**
   * Maximum sidebar width as a percentage of viewport width (0-100).
   * When both sidebarWidthMaxPct and sidebarWidthPx are set, the effective
   * max width is the lesser of the two constraints; sidebarWidthPx takes
   * precedence if it results in a smaller width.
   */
  sidebarWidthMaxPct?: number;
  sidebarToggleHotkey: HotkeyBinding;
  managerPageHotkey: HotkeyBinding;
  sidebarPanelPadding?: number;
  managerPanelPadding?: number;

  // Dev
  debugMode: boolean;
}
