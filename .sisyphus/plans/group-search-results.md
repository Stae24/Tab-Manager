# Plan: Group Search Results Feature

## TL;DR

> **Quick Summary**: Add a "Group Results" button to the Live Search UI that moves all filtered tabs into a new, random-colored group in the current window.
> 
> **Deliverables**:
> - New utility `consolidateAndGroupTabs` in `chromeApi.ts`.
> - New store action `groupSearchResults` in `useStore.ts`.
> - Updated `Dashboard.tsx` with the new button and search mode logic.
> - Unit tests for the new grouping logic.
> 
> **Estimated Effort**: Short/Medium
> **Parallel Execution**: NO - sequential implementation recommended for sync reliability.
> **Critical Path**: `chromeApi.ts` -> `useStore.ts` -> `Dashboard.tsx` -> Tests.

---

## Context

### Original Request
Add an option to the live search to move all results into a new group. The button should be in the purple search mode bar, greyed out if < 2 results. Handle partial failures and log them.

### Interview Summary
**Key Discussions**:
- **Naming**: The new group will have a blank name by default.
- **Color**: Random color from the Chrome group colors.
- **Window Handling**: Consolidate all tabs into the current focused window before grouping.
- **Logging**: Exhaustive console logging for each tab's status (success/failure + reason).

### Metis Review
**Identified Gaps** (addressed):
- **Cross-window grouping**: tabs must be in the same window before grouping. Plan includes explicit move step.
- **Restricted tabs**: Pinned and `chrome://` tabs will be filtered out to avoid API errors.
- **Current Window**: Using `chrome.windows.getLastFocused` for accurate target window identification.
- **Search Clearance**: Search will automatically clear after successful grouping to reveal the new group.

---

## Work Objectives

### Core Objective
Implement a reliable "Group All" feature for search results that handles cross-window consolidation and provides transparent logging for debugging.

### Concrete Deliverables
- `src/utils/chromeApi.ts`: `consolidateAndGroupTabs` function.
- `src/store/useStore.ts`: `groupSearchResults` action.
- `src/components/Dashboard.tsx`: "Group Results" button in the search header.
- `src/utils/__tests__/chromeApi.test.ts`: Unit tests for the new utility.

### Definition of Done
- [ ] Button appears only in search mode.
- [ ] Button is disabled when search results (groupable) are < 2.
- [ ] Clicking moves tabs across windows and groups them.
- [ ] Failure of one tab does not block others.
- [ ] Success/Failure of each tab is logged to console with reasons.
- [ ] Search clears after grouping.
- [ ] All tests pass.

### Must Have
- Individual `withRetry` for tab movements.
- Filtering of pinned/chrome internal tabs.
- Random color selection.

### Must NOT Have (Guardrails)
- Do NOT use `chrome.tabs.group` on tabs from multiple windows simultaneously.
- Do NOT stop the entire process if one `chrome.tabs.move` fails.
- Do NOT ignore the `isUpdating` store lock.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (after)
- **Framework**: Vitest

### Automated Verification
Each TODO includes executable verification procedures.

---

## TODOs

- [x] 1. Implement `consolidateAndGroupTabs` in `src/utils/chromeApi.ts`

  **What to do**:
  - Add `consolidateAndGroupTabs(tabIds: number[], options: { color?: string })` function.
  - Logic:
    1. Resolve target window using `chrome.windows.getLastFocused`.
    2. Filter out pinned tabs and restricted URLs (`chrome://`, `edge://`, etc.).
    3. Loop through tabs not in target window:
       - Try `chrome.tabs.move(id, { windowId, index: -1 })` with `withRetry`.
       - Log success/failure per tab with `[GroupSearchResults]`.
    4. Collect all tabs now in target window.
    5. If count >= 2, call `chrome.tabs.group`.
    6. Return success status and list of failed tab IDs.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-medium`
  - **Skills**: [`explore`]
  - Reason: Requires integration with existing `withRetry` pattern and deep understanding of Chrome APIs.

  **Acceptance Criteria**:
  - [ ] Function correctly moves a tab from Window A to Window B.
  - [ ] Function skips pinned tabs and logs them as "Skipped (Pinned)".
  - [ ] Function groups remaining tabs even if one move fails.
  - [ ] Verify via unit test: `npm run test src/utils/__tests__/chromeApi.test.ts` (once created).

- [x] 2. Add `groupSearchResults` action to `src/store/useStore.ts`

  **What to do**:
  - Add `groupSearchResults: (tabs: Tab[]) => Promise<void>` to the store.
  - Logic:
    1. Set `setIsUpdating(true)`.
    2. Call `consolidateAndGroupTabs` with random color.
    3. Call `syncLiveTabs()` to refresh UI.
    4. Set `setIsUpdating(false)`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`explore`]
  - Reason: Standard store action addition following existing patterns.

- [x] 3. Update `src/components/Dashboard.tsx` UI

  **What to do**:
  - Locate `search-mode-header` (around line 361).
  - Add a "Group Results" button next to the "ESC to clear" indicator.
  - Style: GX-themed, matching the purple bar.
  - Logic:
    - Disabled if `filteredTabs.filter(t => !t.pinned).length < 2`.
    - On Click: Call `store.groupSearchResults(filteredTabs)`, then `setSearchQuery('')`.
    - Add a `LayoutGroup` or `FolderPlus` icon from `lucide-react`.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
  - Reason: UI implementation requires matching the project's tactical GX theme.

- [x] 4. Create unit tests for grouping logic

  **What to do**:
  - Create `src/utils/__tests__/chromeApi.test.ts`.
  - Mock `chrome` API.
  - Test `consolidateAndGroupTabs` with various scenarios (cross-window, pinned tabs, API failures).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-medium`
  - **Skills**: [`explore`]
  - Reason: Requires setup of mocks and careful assertion of browser-level side effects.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(api): add consolidateAndGroupTabs utility` | `src/utils/chromeApi.ts` | `npm run build` |
| 2 | `feat(store): add groupSearchResults action` | `src/store/useStore.ts` | `npm run build` |
| 3 | `feat(ui): add Group Results button to search bar` | `src/components/Dashboard.tsx` | Visual Check |
| 4 | `test(api): add tests for consolidateAndGroupTabs` | `src/utils/__tests__/chromeApi.test.ts` | `npm run test` |

---

## Success Criteria

### Verification Commands
```bash
npm run test  # All tests pass
npm run build # Build succeeds
```

### Final Checklist
- [ ] Button is correctly greyed out when < 2 results.
- [ ] Grouping moves tabs from other windows to the current one.
- [ ] Console shows logs like `[GroupSearchResults] Successfully moved tab 123` or `[GroupSearchResults] Failed to move tab 456: Error message`.
- [ ] Search clears automatically after grouping.
- [ ] Random color is applied to the new group.
