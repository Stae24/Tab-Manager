# Decisions - Appearance System Overhaul
## 2026-01-25 Task: Initialization
- Use Vitest with `jsdom` for testing.
- Manual mocks for Chrome API since no standard library is provided.
- Store refactor will enforce strict equality `===` and proper types.

## Store Refactor (2026-01-25)
- **Decoupled State**: Separated `Live` (islands) and `Vault` (vault) state management.
- **Source of Truth**: Removed raw `tabs` and `groups` from exported store state to enforce using `islands` as the single source of truth for the Live panel.
- **Robust Vault Actions**: Implemented `moveToVault` and `restoreFromVault` with `chromeApi` wrappers, ensuring atomic operations and proper deep cloning.
- **Type Safety**: Introduced `LiveItem` and `UniversalId` to better distinguish between entity types and ID formats.
