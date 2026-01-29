# Utils AGENTS.md

## OVERVIEW
The `src/utils/` directory serves as the technical bedrock for the Opera GX Island Manager. It encapsulates the complexities of the Chrome Extension APIs and provides a unified interface for the rest of the application. By centralizing these concerns, we ensure that the state in our React components remains synchronized with the actual browser state, even in the presence of transient errors or browser-specific quirks.

All developers must prioritize using these utilities over direct `chrome.*` calls to maintain the "Island" abstraction and benefit from built-in error recovery mechanisms.

## CHROME API WRAPPERS
The `chromeApi.ts` module exports high-level functions that manage the lifecycle of tabs and islands (tab groups).
- **Type Safety**: Leverages TypeScript to enforce correct parameter passing, such as ensuring `tabIds` is a non-empty array for grouping operations.
- **Window Management**: Automatically resolves the `targetWindowId` by evaluating the majority location of the tabs being processed, preventing cross-window grouping errors.
- **State Feedback**: Returns success indicators or new IDs (like `groupId`) to allow the calling store to perform optimistic updates or rollback on failure.
- **Key Functions**:
  - `moveIsland`: Moves an entire group to a specific index or window.
  - `createIsland`: Orchestrates the complex process of grouping tabs with Opera GX compatibility logic.
  - `duplicateIsland`: Clones a set of tabs into a new group, preserving their URLs and relative order.

## RETRY STRATEGY
Browser operations are often asynchronous and can fail if the user is currently interacting with the tab strip. The `withRetry` utility mitigates this:
- **Error Matching**: Uses regex-like string matching on `chrome.runtime.lastError` to identify retryable conditions such as "dragging" or "not editable".
- **Exponential Backoff**: 
  - Attempt 1: Immediate.
  - Attempt 2: 100ms delay.
  - Attempt 3: 200ms delay.
- **Circuit Breaking**: If the error persists after 3 attempts or is deemed non-retryable (e.g., "invalid ID"), it rethrows immediately to prevent infinite loops.
- **Logging**: All retries are logged with a specific label (e.g., `[moveTab]`) to assist in debugging race conditions in production.

## OPERA GX HACKS
Opera GX and Chromium exhibit specific behaviors regarding tab groups that require specialized handling:
- **Companion Tabs**: A single-tab group is often unstable or visually inconsistent in certain browser versions. `createIsland` forces the creation of a blank companion tab if grouping only one item.
- **Active State Preservation**: When moving or grouping, we carefully track and restore the `active` tab state to ensure the user's focus isn't disrupted by background operations.
- **Sync Throttling**: While not in `chromeApi.ts` directly, these wrappers are designed to be called by debounced store actions to avoid hitting `chrome.storage.sync` quotas during rapid updates.

## STYLING UTILITY
The styling layer ensures visual consistency across the extension's dual-panel interface.
- **`cn.ts`**: A wrapper around `clsx` and `tailwind-merge`. This is the single source of truth for class manipulation, ensuring that Tailwind's dynamic styles (like `bg-${color}`) are merged without conflict.
- **Border Mapping**: `getIslandBorderColor` maps internal color names to the precise hex codes used by the Opera GX UI. This ensures that our "Neural Vault" matches the "Live Workspace" exactly.
- **Accessibility**: These helpers also handle high-contrast and dark-mode adjustments by ensuring color values are derived from a consistent palette.

## GUIDELINES FOR NEW UTILITIES
When adding new functionality to this directory:
1. **Always wrap async Chrome calls** in `withRetry` if they can be interrupted by user interaction.
2. **Handle `chrome.runtime.lastError`** explicitly within the wrapper to prevent silent failures.
3. **Prefer functional purity** in `cn.ts` and other UI helpers; avoid side effects that depend on global state.
4. **Maintain consistent logging** patterns using bracketed labels like `[UtilityName]` for easy filtering in the console.
