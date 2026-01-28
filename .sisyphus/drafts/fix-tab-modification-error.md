# Draft: Fix 'Tab cannot be modified' in sortGroupsToTop

## Requirements (confirmed)
- Standardize moves using wrappers in `chromeApi.ts`.
- Implement a retry mechanism with backoff for "Tab cannot be modified" / "dragging" errors.
- Add a re-entrance guard to `sortGroupsToTop`.
- Improve error handling to skip failing items instead of aborting the entire sort.

## Technical Decisions
- **Retry strategy**: Proposed 3 attempts, 50ms initial delay, exponential backoff (multiplier 2).
- **Error Matching**: Target "Tab cannot be modified" and "dragging" error messages.
- **Re-entrance guard**: Check `isUpdating` and return immediately if true.
- **Error Handling**: Wrap each move operation in `sortGroupsToTop` in a try-catch to allow the loop to continue.

## Research Findings
- `sortGroupsToTop` currently uses `moveIsland` (group) and `chrome.tabs.move` (tab).
- `chromeApi.ts` has `moveIsland` and `moveTab` but they are simple wrappers without retry logic.
- `isUpdating` state already exists in the store but isn't checked at the start of `sortGroupsToTop`.

## Open Questions
- Are the proposed retry settings (3 attempts, 50ms base) acceptable?
- Should we use the retry logic globally for all tab/group moves in `chromeApi.ts`?
- Should the re-entrance guard log a warning or be silent?

## Scope Boundaries
- INCLUDE: `src/store/useStore.ts` (`sortGroupsToTop`, `moveIsland`), `src/utils/chromeApi.ts`.
- EXCLUDE: Other parts of the extension logic.
