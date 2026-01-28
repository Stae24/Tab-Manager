# Draft: Sort Groups to Top

## Requirements (confirmed)
- Implement "Sort groups to top" button for both Live and Vault panels.
- Logic: Pinned tabs MUST stay at the very top. Groups move immediately below pinned tabs. Standalone tabs move below groups.
- Maintain relative order: If Group A was before Group B, it should stay before Group B after sorting.
- UI: Use Lucide icons (e.g., `ArrowUpToLine`) and maintain Opera GX aesthetic.
- Sync: Live Workspace sorting must be reflected in the actual Chrome browser tab bar.

## Technical Decisions
- **Store Actions**: Add `sortGroupsToTopLive` and `sortGroupsToTopVault` to `useStore.ts`.
- **Live Sync**: Iterate through the sorted `islands` array and use `chrome.tabs.move` / `chrome.tabGroups.move` to reconcile browser state.
- **Vault Sync**: Local state update followed by `persistVault`.
- **Locking**: Use `setIsUpdating(true)` during Live sorting to prevent race conditions with background refreshes.

## Research Findings
- `LiveItem` can be a `Tab` or an `Island` (Group).
- `pinned` property exists on `Tab` objects.
- `Island` objects have a `tabs` array.
- Current headers in `Dashboard.tsx` have enough space for another icon button.
- Existing `moveIsland` and `moveTab` wrappers in `chromeApi.ts` can be used.

## Open Questions
- Should the sorting action also sort the tabs *inside* each group (e.g., alphabetically)? *Decision: Default to root-level entity sorting only, unless specified otherwise.*

## Scope Boundaries
- INCLUDE: Root-level reordering of tabs and groups in Live and Vault panels.
- INCLUDE: Browser synchronization for Live Workspace.
- EXCLUDE: Sorting of tabs inside groups.
- EXCLUDE: Multi-window sorting (stick to current window).
- EXCLUDE: Automated recurring sorting (manual trigger only).
