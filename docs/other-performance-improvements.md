# General Performance Improvements & Code Smells

During the investigation of the sidebar, several other areas of the codebase were identified as having potential for performance optimizations.

## 1. React Virtualization & Search Filtering (`src/components/LivePanel.tsx`)
- **Issue**: `useVirtualizer` is used heavily, which is great, but the `displayTabs` and `rowItems` are recalculated on every render if dependencies change. The `renderLiveList` maps over virtual items and creates `Island` or `TabCard` components with complex inline functions (e.g. `onTabClick={(tab) => handleTabClick(tab.id)}`).
- **Optimization**: Wrap the inline callback functions in `useCallback` inside `LivePanel`, or better yet, pass the IDs down to memoized list item components to prevent React from re-rendering every single virtual list item when the parent `LivePanel` state updates slightly.

## 2. Frequent DOM Polling or Reflows (`src/contentScript.ts`)
- **Issue**: The resizing handler `onMouseMove` in the content script directly modifies `sidebarContainer.style.width = ...` inside rapid mouse move events.
- **Optimization**: Wrap the `style.width` assignment inside a `requestAnimationFrame()` to ensure smooth 60fps resizing without synchronous layout thrashing.

```typescript
// Example fix for drag resizing
let rafId: number | null = null;
const onMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    if (rafId) cancelAnimationFrame(rafId);
    
    rafId = requestAnimationFrame(() => {
        // Calculate and set width here
    });
};
```

## 3. Excessive Message Broadcasting (`src/services/sidebarService.ts`)
- **Issue**: `broadcastSidebarState` does a `chrome.tabs.query({ windowId })` and loops through EVERY tab to send a `chrome.tabs.sendMessage`. If a user has 50 tabs open, this sends 50 messages simultaneously on every window focus or state toggle. 
- **Optimization**: If migrating to `chrome.sidePanel` (Sprint 2), this is obsolete. If staying on the iframe architecture, consider only messaging the *currently active tab* immediately, and lazily messaging inactive tabs when they become active (via `onActivated`).

## 4. Debounce Search & State Writes
- **Issue**: `LivePanel.tsx` uses a custom `setTimeout` for debouncing search, which works, but `isSearching` state triggers renders. Ensure that the global store (`useStore`) isn't causing massive component tree re-renders across the dashboard when `setIsSearching` flips back and forth rapidly during typing.
- **Optimization**: Ensure components that don't need to know about `isSearching` are wrapped in `React.memo()`.

## 5. Storage Access
- **Issue**: `sidebarService.loadSettings()` calls `chrome.storage.sync.get()` every time `getToolbarClickAction` or `openManagerPage` is triggered (e.g., clicking the extension icon). Storage calls are asynchronous and can be slow.
- **Optimization**: Cache `appearanceSettings` in memory in the background script. Use `chrome.storage.onChanged` to keep the in-memory cache updated. This makes retrieving the toolbar click action synchronous and instant.
