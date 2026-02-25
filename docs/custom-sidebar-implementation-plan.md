  # Custom In-Page Sidebar (Window-Sticky) + Dual Hotkeys

  ## Summary

  Replace native browser sidebar dependencies with a fully
  custom in-page sidebar, controlled by customizable in-app
  hotkeys, with per-window sticky state, toolbar/context-menu
  controls, and fallback manager-page behavior.

  ## Implementation Plan

  ### 1. Manifest + Build Wiring

  1. Update public/manifest.json:

  - Remove sidePanel permission.
  - Remove sidebar_action.
  - Add contextMenus permission.
  - Add content_scripts for <all_urls> using contentScript.js.
  - Expand web_accessible_resources to include index.html and
    assets/* (for iframe sidebar app load).
  - Keep command entry, but remove suggested_key so browser
    command is fallback-only and unbound by default.

  2. Update vite.config.ts:

  - Add contentScript entry input.
  - Emit stable filenames for background.js and
    contentScript.js.

  ### 2. Settings Model (Decision-Complete)

  1. Extend AppearanceSettings in src/types/index.ts with:

  - toolbarClickAction: 'toggle-sidebar' | 'open-manager-page'
  - sidebarLayoutMode: 'overlay' | 'push'
  - sidebarDockSide: 'left' | 'right'
  - sidebarWidthPx: number
  - sidebarToggleHotkey: HotkeyBinding
  - managerPageHotkey: HotkeyBinding

  2. Add HotkeyBinding type:

  - code: string
  - ctrl: boolean
  - meta: boolean
  - alt: boolean
  - shift: boolean

  3. Defaults in src/store/utils.ts:

  - toolbarClickAction = 'toggle-sidebar'
  - sidebarLayoutMode = 'overlay'
  - sidebarDockSide = 'right'
  - sidebarWidthPx = 420
  - sidebarToggleHotkey = Ctrl/Cmd+Shift+Space
  - managerPageHotkey = Ctrl/Cmd+Shift+M

  4. Update isAppearanceSettings and mergeAppearanceSettings
     for these fields.
  5. Add settingsService.updateAppearanceSettings(patch) to
     merge + persist safely.

  ### 3. Shared Hotkey Utilities

  1. Add src/utils/hotkeys.ts:

  - normalizeHotkeyFromEvent(event): HotkeyBinding
  - matchesHotkey(event, binding): boolean
  - formatHotkey(binding): string
  - isValidHotkey(binding): boolean (require at least one
    modifier)
  - hotkeysEqual(a, b): boolean

  2. Rule enforcement:

  - Disallow saving duplicate bindings between sidebar-toggle
    and manager-open hotkeys.
  - Hotkeys fire even in inputs/contenteditable (per your
    requirement).

  ### 4. Background Orchestration

  1. Refactor background command/action logic around a sidebar
     controller module (src/services/sidebarService.ts or
     equivalent):

  - Window-scoped sticky open state.
  - Persist state in chrome.storage.session (survives service
    worker restarts, not cross-window).

  2. Message contract:

  - SIDEBAR_TOGGLE_WINDOW
  - SIDEBAR_SET_WINDOW_OPEN
  - SIDEBAR_SYNC_REQUEST
  - OPEN_MANAGER_PAGE

  3. Toolbar click behavior:

  - Read toolbarClickAction.
  - If toggle-sidebar: toggle current window sticky state.
  - If open-manager-page: run current open/focus manager page
    behavior.

  4. Right-click action menu:

  - Quick actions: Toggle Sidebar, Open Manager Page.
  - Radio defaults: Default Click → Toggle Sidebar / Default
    Click → Open Manager Page.
  - Menu writes toolbarClickAction.

  5. Browser command fallback:

  - Keep command listener.
  - Command toggles sidebar window state.
  - Since unbound by default, no double-trigger with in-app
    hotkeys.

  6. Window-sticky synchronization:

  - On tabs.onActivated and completed tabs.onUpdated, apply
    sticky state to active tab in that window.
  - On window removal, cleanup that window’s sticky state.

  7. Manager-page exclusion:

  - Detect chrome.runtime.getURL('index.html').
  - Never attempt to open sidebar there.
  - Toggling from manager page updates window sticky state for
    other tabs in that window.

  ### 5. Content Script Sidebar Runtime

  1. Add src/contentScript.ts:

  - Inject fixed sidebar host with Shadow DOM.
  - Render iframe with chrome.runtime.getURL('index.html').
  - Add resize handle; clamp width bounds.

  2. Layout modes:

  - overlay: sidebar overlays page.
  - push: apply left/right page offset while open.

  3. Dock side:

  - Support left/right docking dynamically.

  4. Sticky state:

  - On load, send SIDEBAR_SYNC_REQUEST; apply returned open
    state.
  - React to background SET_WINDOW_OPEN messages.

  5. Hotkey handling in content script:

  - Always-on keydown listener.
  - Sidebar hotkey sends SIDEBAR_TOGGLE_WINDOW.
  - Manager hotkey sends OPEN_MANAGER_PAGE.

  6. Persistence:

  - Width/side/layout changes persisted via
    settingsService.updateAppearanceSettings.

  7. Restricted pages:

  - If content script cannot receive/apply, background fallback
    opens manager page when opening is requested.

  ### 6. Manager App Integration (Iframe + Full Page)

  1. Add app-level hotkey hook (used in src/App.tsx) so hotkeys
     also work when focus is inside sidebar iframe.
  2. In manager full page:

  - Sidebar hotkey still sends toggle-window request.
  - Background updates sticky state but does not open sidebar
    on manager page.

  3. Keep existing auto-pin/focus-existing manager-page
     settings behavior.

  ### 7. Settings UI Changes

  1. Update src/components/AppearanceSettingsPanel.tsx:

  - Add hotkey recorder controls for both hotkeys.
  - Add toolbar click default selector.
  - Add layout mode selector (overlay/push).
  - Add dock side selector (left/right).
  - Add width display/reset control (runtime resize remains
    primary control).

  2. Preserve existing “copy chrome://extensions/shortcuts” he
     lper as optional fallback-command configuration aid.

  ## Public API / Interface Changes

  - AppearanceSettings gains six new persisted fields.
  - New HotkeyBinding type.
  - New runtime message types for sidebar/window control and
    sync.
  - Manifest command remains but is unbound by default.

  ## Tests and Scenarios

  ### Automated Tests

  1. src/utils/__tests__/hotkeys.test.ts:

  - Match/format/validation/equality.

  2. Background tests (src/__tests__/background.test.ts):

  - Action click mode routing.
  - Context menu creation and click handling.
  - Window-sticky behavior by window id.

  - Inject/open/close behavior.
  - Overlay vs push offsets.
  - Left/right docking.
  - Resize persistence.
  - Sync on init.

  4. Settings service tests:

  - updateAppearanceSettings merge correctness.

  5. Appearance panel tests:

  - Hotkey capture.
  - Duplicate-hotkey rejection.
  - Toolbar default mode setting.

  ### Verification Commands

  1. npm run test:fail-only
  2. npm run build

  ### Manual Acceptance

  1. Press sidebar hotkey on normal page: sidebar toggles.
  2. Switch tabs in same window: sticky open state follows.
  3. Another browser window remains unaffected.
  4. Sidebar never appears on manager page tab.
  5. Sticky state still applies when returning from manager
     page to normal tabs in same window.
  6. Toolbar click obeys chosen default mode.
  7. Right-click action menu supports quick actions and default
     mode switching.
  8. Overlay/push + left/right + resize all persist correctly.

  ## Assumptions and Defaults

  - Window-sticky means scoped to a browser window session, not
    cross-window/global.
  - Browser command remains fallback-only and ships unbound to
    prevent duplicate firing.
  - Sidebar is custom/in-page only; native sidebar config is
    removed.