# Sprint 1: Sidebar Quick Wins & Content Script Optimizations

## Goal
Optimize the existing injected iframe sidebar to reduce load times, mitigate transition jiggle, and prevent heavy re-renders when switching tabs, without completely rewriting the extension architecture.

## Issues Identified
1. **Iframe Re-initialization**: Every time `chrome.tabs.onActivated` fires, `sidebarService` broadcasts the sticky state. If the target tab hasn't initialized the sidebar, `contentScript.ts` creates the iframe from scratch and loads `index.html`. This requires downloading/parsing the full React app and syncing state.
2. **Layout Thrashing**: Using `margin-left` and `margin-right` for `sidebarLayoutMode === 'push'` triggers expensive browser reflows (or "jiggle") across all elements on the page.
3. **Heavy Message Passing**: State synchronization sends multiple messages between the background worker and the content script on tab switch.

## Proposed Changes

### 1. Pre-injected Background Iframe for Sticky Windows
- **File**: `src/contentScript.ts`
- **Action**: Modify `createSidebar()`. Instead of creating the iframe *only* when the sidebar is opened, preemptively create the iframe (hidden with `display: none` or `visibility: hidden`) on window load if the window is known to have sticky state enabled.
- **Why**: The React bundle will parse and mount in the background before the user even clicks "toggle sidebar", making the appearance instantaneous.

### 2. CSS Optimization (Avoid Reflows)
- **File**: `src/contentScript.ts`
- **Action**: In `openSidebar()` / `closeSidebar()`, avoid editing `document.body.style.marginLeft`. Alternatively, if push mode is strictly required, use `transform: translateX()` on the primary body wrapper if one exists, or simply rely on `overlay` mode as the default recommended high-performance mode. Warn the user in settings if they choose "push" that it affects performance.

### 3. Iframe Lazy Initialization for Non-Sticky Windows
- **File**: `src/contentScript.ts`
- **Action**: Add a `srcdoc` or delay assigning the `src` of the iframe until right before it needs to become visible, *unless* the window is marked as sticky. This saves memory on tabs where the sidebar will never be used.

### 4. Debounced Tab Activation Syncing
- **File**: `src/services/sidebarService.ts`
- **Action**: In `chrome.tabs.onActivated.addListener`, debounce the `broadcastSidebarState` call by roughly `50ms-100ms`. When users rapidly cycle tabs, we don't need to force the sidebar open and closed over and over on intermediary tabs.

## Verification Plan
1. **Manual Testing**: Rapidly switch between 10 tabs with the sidebar "sticky" state on. Measure the visual delay before the sidebar renders in the new tab.
2. **Performance Profiler**: Open Chrome DevTools, record performance while toggling the sidebar in "push" mode vs "overlay" mode. Verify layout shifts are reduced.
