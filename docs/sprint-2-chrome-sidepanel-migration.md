# Sprint 2: Chrome sidePanel API Migration (Recommended Architecture)

## Goal
Dramatically improve the performance of the sidebar by migrating from the current "injected iframe per tab" architecture to the native `chrome.sidePanel` API. 

## Issues Identified in Current Architecture
Currently, the Tab Manager injects `<div id="island-manager-sidebar">` into the DOM of *every single tab*. Inside this div is an `iframe` that loads `index.html` (the full React application). 
- **Memory Leak**: If a user has 100 tabs open, there are 100 instances of the React application running in memory.
- **Tab Switching Delay**: When switching tabs, the extension must message the new tab's content script to slide the UI in, creating a visual disconnect. It inherently feels "un-sticky".

## Proposed Changes

### Migrate to `chrome.sidePanel`
- **Files Affected**: `manifest.json`, `src/background.ts`, `src/services/sidebarService.ts`, `src/contentScript.ts`
- **Action**: 
  1. Add `"side_panel"` to permissions in `manifest.json`.
  2. Declare `"side_panel": { "default_path": "index.html" }` in `manifest.json`.
  3. Refactor `sidebarService.ts` to use `chrome.sidePanel.setOptions()` to control whether the side panel is enabled globally or per-window.
  4. Deprecate the injection of the sidebar via `contentScript.ts`. Content scripts should only be used for page-specific text extraction or hotkey listeners, not for rendering the heavy UI.
  
### Why `chrome.sidePanel`?
- **Native Stickiness**: The native Side Panel persists across tab switches seamlessly. There is zero loading delay when switching tabs within a window because the side panel is tied to the *window*, not the *tab*.
- **Zero Page Interference**: It does not inject into the DOM, meaning it will never conflict with a website's CSS, trigger layout reflows on the host page, or fail to load on restricted pages like `chrome://` or `about:blank`.
- **Memory Efficiency**: Only ONE instance of the React app runs per window, drastically reducing RAM usage by orders of magnitude compared to the iframe approach.

## Implementation Steps
1. Update `manifest.json` and install `@types/chrome` if the `sidePanel` types are missing.
2. Update the Hotkey listeners in `contentScript.ts` to simply call `chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' })`.
3. In `background.ts` / `sidebarService.ts`, handle the toggle message by invoking `chrome.sidePanel.setOptions({ enabled: true })` or `chrome.sidePanel.open({ windowId })`.
4. Remove all `iframe` injection logic, resize handler logic, and shadow DOM creation from `contentScript.ts`.
5. Remove `SIDEBAR_SYNC_REQUEST`, `SIDEBAR_SET_WINDOW_OPEN`, etc. as the Side Panel manages its own lifecycle.

## Verification Plan
1. **Memory Profile**: Open Task Manager in Chrome. Compare RAM usage of 20 open tabs with the old injected sidebar vs the new native Side Panel.
2. **Visual Consistency**: Open the side panel, switch between 5 different tabs. Verify the sidebar remains perfectly static and does not reload or jiggle.
3. **Restricted Pages**: Navigate to `chrome://extensions` and verify the Side Panel is still accessible and fully functional.
