# Learnings - Appearance System Overhaul
## 2026-01-25 Task: Initialization
- Starting work on independent scaling and Vitest setup.
- Dual scaling is confirmed: Dashboard (uiScale) vs Settings Panel (settingsScale).
- `transform: scale()` breaks DnD mouse tracking; needs a modifier.

## Store Refactor (Live vs Vault)
- **Separation**: Distinct `moveToVault` (destructive) and `saveToVault` (non-destructive) actions clarify user intent.
- **State Logic**: Moving complex logic (like closing tabs after vaulting) from Components to Store (`useStore`) simplifies the UI layer and ensures consistency.
- **Naming**: `syncLiveTabs` is a more accurate name than `refreshTabs` for the background synchronization signal.
- **Optimization**: Blocking updates when `isUpdating` is true is critical for preventing DND flicker.
- **Chrome API Object Identity**: `chrome.tabs.query` returns new objects every call. Strict equality checks in React might fail if we don't careful, but Zustand's `set` handles replacement fine.
- **Optimistic Updates**: Optimistic updates need strict locking (`isUpdating`) to prevent race conditions with Chrome event listeners, especially when mixing local state (`islands`) updates with async Chrome API calls.
