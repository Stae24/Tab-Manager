export const CHROME_32BIT_INT_MAX = 2147483647;
export const STORAGE_VERSION = 3;
export const VAULT_CHUNK_SIZE = 4096;
export const CHROME_SYNC_ITEM_MAX_BYTES = 8192;
export const MAX_SYNC_RETRIES = 3;
export const INITIAL_SYNC_BACKOFF = 1000;
export const CHROME_SYNC_QUOTA_BYTES = 102400;
export const SYNC_SETTINGS_RESERVE_BYTES = 10240;
export const QUOTA_WARNING_THRESHOLD = 0.8;
export const QUOTA_CRITICAL_THRESHOLD = 0.9;
export const VAULT_QUOTA_SAFETY_MARGIN_BYTES = 2048;

export const VAULT_LOAD_MAX_RETRIES = 3;
export const VAULT_LOAD_RETRY_BASE_DELAY_MS = 100;

export const VAULT_DIFF_KEY = 'vault_diff';
export const DIFF_COMPACT_THRESHOLD = 0.3;
export const COMPACT_IDLE_INTERVAL_MS = 900000;

export const COMPRESSION_TIERS: readonly ('full' | 'no_favicons' | 'minimal')[] = ['full', 'no_favicons', 'minimal'];

export const SETTINGS_PANEL_MIN_WIDTH = 320;
export const SETTINGS_PANEL_MAX_WIDTH = 800;
export const SETTINGS_PANEL_DEFAULT_WIDTH = 480;
export const SETTINGS_PANEL_WINDOW_GAP = 50;
export const DROPDOWN_MAX_HEIGHT = 300;
export const UI_SCALE_MIN = 0.5;
export const UI_SCALE_MAX = 2.0;
export const UI_SCALE_STEP = 0.05;
export const DRAG_OPACITY_MIN = 0.1;
export const DRAG_OPACITY_MAX = 1.0;
export const DRAG_OPACITY_STEP = 0.1;
export const DIVIDER_POSITION_MIN = 20;
export const DIVIDER_POSITION_MAX = 80;
export const DIVIDER_POSITION_DEFAULT = 50;
export const DND_ACTIVATION_DISTANCE = 8;
export const BASE_FONT_SIZE = 16;

export const DEBOUNCE_DEFAULT_MS = 500;
export const SYNC_SETTINGS_DEBOUNCE_MS = 5000;
export const SEARCH_DEBOUNCE_MS = 100;
export const SEARCH_DEBOUNCE_MIN = 50;
export const SEARCH_DEBOUNCE_MAX = 500;
export const SEARCH_DEBOUNCE_STEP = 10;
export const TAB_ACTION_RETRY_DELAY_BASE = 100;
export const PANEL_CLOSE_DELAY_MS = 200;
export const REFRESH_UI_DELAY_MS = 100;
export const ISLAND_CREATION_REFRESH_DELAY_MS = 400;
export const POST_ISLAND_CREATION_DELAY_MS = 300;
export const REFRESH_TABS_DEBOUNCE_MS = 200;

export const VIRTUAL_ROW_ESTIMATE_SIZE = 40;
export const VIRTUAL_ROW_OVERSCAN = 10;
export const VIRTUAL_ROW_GAP_PX = 8;

// Proximity gap threshold constants
export const PROXIMITY_THRESHOLD_UP_REM = 1;
export const PROXIMITY_THRESHOLD_DOWN_REM = 3;
export const CLEANUP_ANIMATION_DELAY_MS = 500;
export const NO_TABS_ICON_SIZE = 48;
export const INTERSECTION_OBSERVER_MARGIN_PX = 500;
export const TAB_LOAD_DELAY_BASE_MS = 50;

export const Z_INDEX_SCALE = {
  base: 0,
  panel: 10,
  header: 20,
  dropdown: 100,
  sticky: 200,
  overlay: 1000,
  dragOverlay: 9999,
  modal: 10000,
  tooltip: 10001,
} as const;

export const DEFAULT_DRAG_OPACITY = 0.5;

export const GX_ACCENT_COLOR = '#7f22fe';
export const GX_RED_COLOR = '#ff1b1b';
export const GX_CYAN_COLOR = '#00d4ff';
export const GX_GREEN_COLOR = '#00ff88';

export const VAULT_META_KEY = 'vault_meta';
export const VAULT_CHUNK_PREFIX = 'vault_chunk_';
export const LEGACY_VAULT_KEY = 'vault';

export const SIDEBAR_MIN_WIDTH = 300;
export const SIDEBAR_MAX_WIDTH_PCT_MIN = 10;
export const SIDEBAR_MAX_WIDTH_PCT_MAX = 100;
export const SIDEBAR_MAX_WIDTH_PCT_DEFAULT = 90;
export const SIDEBAR_DEFAULT_WIDTH = 420;
export const SIDEBAR_DEFAULT_DOCK_SIDE: 'left' | 'right' = 'right';
export const SIDEBAR_DEFAULT_LAYOUT_MODE: 'overlay' | 'push' = 'overlay';

export const PANEL_PADDING_MIN = 0;
export const PANEL_PADDING_MAX = 32;
export const PANEL_PADDING_STEP = 2;
export const SIDEBAR_PANEL_PADDING_DEFAULT = 4;
export const MANAGER_PANEL_PADDING_DEFAULT = 8;

// Sidebar Header Spacing
export const SIDEBAR_HEADER_PADDING_MIN = 0;
export const SIDEBAR_HEADER_PADDING_MAX = 48;
export const SIDEBAR_HEADER_PADDING_DEFAULT = 16;
export const SIDEBAR_HEADER_PADDING_STEP = 2;

export const SIDEBAR_ROW_GAP_MIN = 0;
export const SIDEBAR_ROW_GAP_MAX = 32;
export const SIDEBAR_ROW_GAP_DEFAULT = 16;
export const SIDEBAR_ROW_GAP_STEP = 2;

export const SIDEBAR_BUTTON_GAP_MIN = 0;
export const SIDEBAR_BUTTON_GAP_MAX = 24;
export const SIDEBAR_BUTTON_GAP_DEFAULT = 8;
export const SIDEBAR_BUTTON_GAP_STEP = 2;

export const SIDEBAR_BUTTON_PADDING_Y_MIN = 0;
export const SIDEBAR_BUTTON_PADDING_Y_MAX = 24;
export const SIDEBAR_BUTTON_PADDING_Y_DEFAULT = 8;
export const SIDEBAR_BUTTON_PADDING_Y_STEP = 2;

export const SIDEBAR_BUTTON_ICON_SIZE_MIN = 8;
export const SIDEBAR_BUTTON_ICON_SIZE_MAX = 24;
export const SIDEBAR_BUTTON_ICON_SIZE_DEFAULT = 14;
export const SIDEBAR_BUTTON_ICON_SIZE_STEP = 1;

// Panel Header Spacing
export const PANEL_HEADER_PADDING_Y_MIN = 0;
export const PANEL_HEADER_PADDING_Y_MAX = 32;
export const PANEL_HEADER_PADDING_Y_DEFAULT = 12;
export const PANEL_HEADER_PADDING_Y_STEP = 2;

export const PANEL_HEADER_PADDING_X_MIN = 0;
export const PANEL_HEADER_PADDING_X_MAX = 32;
export const PANEL_HEADER_PADDING_X_DEFAULT = 16;
export const PANEL_HEADER_PADDING_X_STEP = 2;

// Granular panel header padding (replaces PANEL_HEADER_PADDING_Y/X)
export const PANEL_HEADER_PADDING_TOP_MIN = 0;
export const PANEL_HEADER_PADDING_TOP_MAX = 32;
export const PANEL_HEADER_PADDING_TOP_DEFAULT = 12;
export const PANEL_HEADER_PADDING_TOP_STEP = 1;

export const PANEL_HEADER_PADDING_BOTTOM_MIN = 0;
export const PANEL_HEADER_PADDING_BOTTOM_MAX = 32;
export const PANEL_HEADER_PADDING_BOTTOM_DEFAULT = 12;
export const PANEL_HEADER_PADDING_BOTTOM_STEP = 1;

export const PANEL_HEADER_PADDING_LEFT_MIN = 0;
export const PANEL_HEADER_PADDING_LEFT_MAX = 32;
export const PANEL_HEADER_PADDING_LEFT_DEFAULT = 16;
export const PANEL_HEADER_PADDING_LEFT_STEP = 1;

export const PANEL_HEADER_PADDING_RIGHT_MIN = 0;
export const PANEL_HEADER_PADDING_RIGHT_MAX = 32;
export const PANEL_HEADER_PADDING_RIGHT_DEFAULT = 16;
export const PANEL_HEADER_PADDING_RIGHT_STEP = 1;

export const PANEL_HEADER_ACTION_GAP_MIN = 0;
export const PANEL_HEADER_ACTION_GAP_MAX = 32;
export const PANEL_HEADER_ACTION_GAP_DEFAULT = 12;
export const PANEL_HEADER_ACTION_GAP_STEP = 2;

export const PANEL_HEADER_ICON_TITLE_GAP_MIN = 0;
export const PANEL_HEADER_ICON_TITLE_GAP_MAX = 32;
export const PANEL_HEADER_ICON_TITLE_GAP_DEFAULT = 12;
export const PANEL_HEADER_ICON_TITLE_GAP_STEP = 1;

export const PANEL_HEADER_TITLE_ACTION_GAP_MIN = 0;
export const PANEL_HEADER_TITLE_ACTION_GAP_MAX = 32;
export const PANEL_HEADER_TITLE_ACTION_GAP_DEFAULT = 12;
export const PANEL_HEADER_TITLE_ACTION_GAP_STEP = 1;

// Panel List Spacing
export const PANEL_LIST_GAP_MIN = 0;
export const PANEL_LIST_GAP_MAX = 24;
export const PANEL_LIST_GAP_DEFAULT = 8;
export const PANEL_LIST_GAP_STEP = 2;

export const PANEL_LIST_PADDING_TOP_MIN = 0;
export const PANEL_LIST_PADDING_TOP_MAX = 32;
export const PANEL_LIST_PADDING_TOP_DEFAULT = 8;
export const PANEL_LIST_PADDING_TOP_STEP = 2;

export const PANEL_LIST_PADDING_BOTTOM_MIN = 0;
export const PANEL_LIST_PADDING_BOTTOM_MAX = 48;
export const PANEL_LIST_PADDING_BOTTOM_DEFAULT = 16;
export const PANEL_LIST_PADDING_BOTTOM_STEP = 2;

// Settings Panel Spacing
export const SETTINGS_HEADER_PADDING_MIN = 0;
export const SETTINGS_HEADER_PADDING_MAX = 48;
export const SETTINGS_HEADER_PADDING_DEFAULT = 16;
export const SETTINGS_HEADER_PADDING_STEP = 2;

export const SETTINGS_TABS_PADDING_MIN = 0;
export const SETTINGS_TABS_PADDING_MAX = 32;
export const SETTINGS_TABS_PADDING_DEFAULT = 12;
export const SETTINGS_TABS_PADDING_STEP = 2;

export const SETTINGS_TAB_GAP_MIN = 0;
export const SETTINGS_TAB_GAP_MAX = 16;
export const SETTINGS_TAB_GAP_DEFAULT = 4;
export const SETTINGS_TAB_GAP_STEP = 1;

export const SETTINGS_CONTENT_PADDING_MIN = 0;
export const SETTINGS_CONTENT_PADDING_MAX = 48;
export const SETTINGS_CONTENT_PADDING_DEFAULT = 20;
export const SETTINGS_CONTENT_PADDING_STEP = 2;

export const SETTINGS_SECTION_GAP_MIN = 0;
export const SETTINGS_SECTION_GAP_MAX = 48;
export const SETTINGS_SECTION_GAP_DEFAULT = 16;
export const SETTINGS_SECTION_GAP_STEP = 2;

export const GROUP_HEADERS_SECTION = 'group-headers';
export const TAB_COUNT_SECTION = 'tab-count';
export const SORT_GROUPS_SECTION = 'sort-groups';
export const PANEL_HEADERS_SECTION = 'panel-headers';

export const PANEL_HEADER_TRUNCATE_THRESHOLD = 320;
export const PANEL_HEADER_ICON_ONLY_THRESHOLD = 280;
export const PANEL_HEADER_HIDDEN_THRESHOLD = 240;
