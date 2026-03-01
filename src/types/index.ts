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
  | { type: 'item'; id: UniversalId; item: Island | Tab | VaultItem };

export interface VaultTab {
  id: UniversalId;
  title: string;
  url: string;
  favicon: string;
  savedAt: number;
  originalId: UniversalId;
  wasPinned?: boolean;
  wasMuted?: boolean;
  wasFrozen?: boolean;
}

export interface VaultIsland {
  id: UniversalId;
  title: string;
  color: string;
  collapsed: boolean;
  tabs: VaultTab[];
  savedAt: number;
  originalId: UniversalId;
}

export type VaultItem = VaultTab | VaultIsland;

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
export type TabElementOrder = 'favicon-indicators-title' | 'favicon-first' | 'indicators-first';

export type LoadingSpinnerStyle = 'pulse' | 'dots' | 'bars' | 'ring';
export type AccentMode = 'custom' | 'theme' | 'none';

export interface ThemeElementsConfig {
  background: boolean;
  panels: boolean;
  text: boolean;
  accent: AccentMode;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  themeElements: ThemeElementsConfig;
  uiScale: number;
  settingsScale: number;
  tabDensity: 'minified' | 'compact' | 'normal' | 'spacious';
  animationIntensity: AnimationIntensity;

  showFavicons: boolean;
  showAudioIndicators: AudioIndicatorMode;
  showFrozenIndicators: boolean;
  showActiveIndicator: boolean;
  showTabCount: boolean;
  showPanelName: boolean;
  showPanelIcon: boolean;

  accentColor: string;
  borderRadius: BorderRadius;
  compactGroupHeaders: boolean;
  buttonSize: ButtonSize;
  iconPack: IconPack;

  customFontFamily?: string;
  dragOpacity: number;
  loadingSpinnerStyle: LoadingSpinnerStyle;
  menuPosition: MenuPosition;

  vaultSyncEnabled: boolean;

  faviconSource: FaviconSource;
  faviconFallback: FaviconFallback;
  faviconSize: FaviconSize;

  sortGroupsByCount: boolean;
  sortVaultGroupsByCount: boolean;

  tabElementOrder: TabElementOrder;
  customButtonHoverSize: boolean;
  buttonHoverPaddingPx: number;

  autoPinTabManager: boolean;
  focusExistingTab?: boolean;

  searchDebounce?: number;

  toolbarClickAction: ToolbarClickAction;
  sidebarLayoutMode: SidebarLayoutMode;
  sidebarDockSide: SidebarDockSide;
  sidebarWidthPx: number;
  sidebarWidthMaxPct?: number;
  sidebarToggleHotkey: HotkeyBinding;
  managerPageHotkey: HotkeyBinding;
  sidebarPanelPadding?: number;
  managerPanelPadding?: number;

  showIslandManagerIcon: boolean;
  showIslandManagerTitle: boolean;
  moveSettingsButtonDown: boolean;

  // Sidebar Header Spacing
  sidebarHeaderPadding?: number;
  sidebarRowGap?: number;
  sidebarButtonGap?: number;
  sidebarButtonPaddingY?: number;
  sidebarButtonIconSize?: number;

  /**
   * @deprecated Use panelHeaderPaddingTop and panelHeaderPaddingBottom instead.
   * This field will be removed in a future version.
   * When migrating, copy the value to both panelHeaderPaddingTop and panelHeaderPaddingBottom.
   * Example: if panelHeaderPaddingY was 8, set panelHeaderPaddingTop: 8 and panelHeaderPaddingBottom: 8
   */
  panelHeaderPaddingY?: number;
  /**
   * @deprecated Use panelHeaderPaddingLeft and panelHeaderPaddingRight instead.
   * This field will be removed in a future version.
   * When migrating, copy the value to both panelHeaderPaddingLeft and panelHeaderPaddingRight.
   * Example: if panelHeaderPaddingX was 12, set panelHeaderPaddingLeft: 12 and panelHeaderPaddingRight: 12
   */
  panelHeaderPaddingX?: number;
  // Granular panel header padding
  panelHeaderPaddingTop?: number;
  panelHeaderPaddingBottom?: number;
  panelHeaderPaddingLeft?: number;
  panelHeaderPaddingRight?: number;
  panelHeaderIconTitleGap?: number;
  panelHeaderTitleActionGap?: number;
  panelHeaderActionGap?: number;
  collapseExpandLayout?: 'vertical' | 'horizontal';

  // Panel List Spacing
  panelListGap?: number;
  panelListPaddingTop?: number;
  panelListPaddingBottom?: number;

  // Settings Panel Spacing
  settingsHeaderPadding?: number;
  settingsTabsPadding?: number;
  settingsTabGap?: number;
  settingsContentPadding?: number;
  settingsSectionGap?: number;

  debugMode: boolean;
  settingsBackgroundBlur: number;
  settingsBackgroundOpacity: number;

  restorePinnedState: boolean;
  restoreMutedState: boolean;
  restoreFrozenState: boolean;
}
