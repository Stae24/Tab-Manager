# OVERVIEW
The `src/store` serves as the reactive core of the Island Manager, orchestrating state for both the "Live Workspace" (active Chrome tabs/groups) and the "Neural Vault" (persistent archives). It abstracts the asynchronous complexity of the Chrome Extension APIs into a predictable, unified Zustand interface. The store is designed to provide a "tactical" feel, prioritizing speed, optimistic UI responses, and robust cross-context synchronization between the background worker and multiple frontend instances.

## MOVE ENGINE
The `moveItemOptimistically` action is a high-performance engine designed for fluid, real-time drag-and-drop operations across hierarchical structures.
- **Atomic State Transitions**: Moves are calculated against a deep-cloned snapshot of the current state. This ensures that the UI updates in a single, atomic render cycle, minimizing layout shift and ensuring data integrity during complex reordering.
- **Frame-Aligned Scheduling**: To mitigate "React Error #185" (Too many re-renders), the engine uses an internal buffer and `requestAnimationFrame`. This aligns state updates with the browser's paint cycle, preventing the UI from choking or throwing errors during rapid drag-over events.
- **Hierarchical Path Resolution**: The engine uses `findItemInList` to resolve items across nested structures (e.g., Tabs inside Islands). It handles complex edge cases like dropping a tab onto a collapsed group header, auto-expanding targets, or preventing illegal recursive group nesting.
- **Update Locking (`isUpdating`)**: This semaphore is the bridge between the UI and the Chrome API. It signals to the `useTabSync` hook to ignore incoming Chrome events while a local move is being processed. This effectively prevents the "Snap-Back" bug where the UI reverts to the pre-move state before the Chrome API confirms the change.
- **ID Normalization & Namespacing**: All IDs are handled as `UniqueIdentifier`. The `parseNumericId` utility is used to strip internal prefixes (e.g., `live-tab-`) before passing IDs to the underlying `chrome.tabs` or `chrome.tabGroups` APIs, ensuring seamless interoperability.

## STORAGE STRATEGY
Persistence is strictly tiered to balance speed, cross-device reliability, and Chrome's rigorous storage quotas:
- **Global Settings (Sync Tier)**: Small, roamable metadata such as `appearanceSettings`, `theme`, and `dividerPosition` are stored in `chrome.storage.sync`. This ensures that the user's customized look and feel (accent colors, UI scale) follows them across any device synced to their Google account.
- **Large Data & Reorders (Local Tier)**: The "Neural Vault" data and high-frequency reorder metadata for live islands are offloaded to `chrome.storage.local`. This bypasses the 100KB `sync` quota limit and provides significantly higher throughput for the frequent writes generated during intense organization sessions.
- **Debounced Persistence Engine**: The `syncSettings` helper employs a 1000ms debounce. This is essential for preventing the extension from hitting Chrome's "MAX_WRITE_OPERATIONS_PER_HOUR" limit, especially during rapid-fire adjustments to UI sliders or toggles.
- **Distributed State Synchronization**: Upon initialization, the store attaches a robust listener to `chrome.storage.onChanged`. This allows multiple extension contexts (e.g., a sidebar, a popup, and a settings page) to stay perfectly in sync. When the `vault` or `appearanceSettings` change in one instance, the updates are reactively propagated to all other active views.

## ANTI-PATTERNS
- **Immutable Violations**: Directly pushing to or splicing `islands` or `vault` arrays. Always use the clone-and-set pattern to ensure Zustand correctly triggers React's reconciliation and component re-renders.
- **API Guard Bypassing**: Executing `chrome.tabs.move` or `chrome.tabGroups.move` without checking or setting the `isUpdating` lock. This leads to race conditions where the UI reflects an outdated background state.
- **Loose ID Comparison**: Using `==` instead of `===` or failing to stringify IDs. Since Chrome uses numeric IDs and the store uses prefixed strings, strict type-safety is paramount to avoid silent "item not found" failures.
- **Transient Data Persistence**: Attempting to store raw `chrome.tabs.Tab` objects. These contain `windowId` and `id` values that are only valid for the current browser session; always map to internal `Tab` or `VaultItem` schemas before saving.
- **Direct API Interaction**: Calling `chrome.*` methods directly outside of the `src/utils/chromeApi.ts` wrappers. These wrappers provide the retry logic and error handling necessary for a stable user experience.
