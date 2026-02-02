# Plan: Fix 'Tab cannot be modified' in sortGroupsToTop

## TL;DR

> **Quick Summary**: Implement a robust retry mechanism for Chrome API tab/group operations and add re-entrance guards to the sorter to handle browser state locks (dragging/pending).
> 
> **Deliverables**:
> - Updated `src/utils/chromeApi.ts` with `withRetry` helper and resilient wrappers.
> - Updated `src/store/useStore.ts` with guarded and resilient `sortGroupsToTop`.
> 
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential updates to core utility and store logic.
> **Critical Path**: `withRetry` implementation → Sorter refactoring.

---

## Context

### Original Request
The user reported a 'Tab cannot be modified' error in `sortGroupsToTop`. This happens when the browser locks tab modification during certain operations (like dragging) or when tabs are in a pending state.

### Interview Summary
**Key Discussions**:
- **Retry Strategy**: 3 attempts, 100ms base delay, exponential backoff (100, 200, 400).
- **Global Application**: The retry logic should apply to `moveTab`, `moveIsland`, `ungroupTab`, and `updateTabGroup`.
- **Re-entrance Guard**: `sortGroupsToTop` should silently return if `isUpdating` is true.
- **Resilience**: The sorter should continue processing items even if a specific move fails after all retries.

### Metis Review
**Identified Gaps** (addressed):
- **Window ID Changes**: The sorter should be aware that tabs might move windows during processing.
- **Closed Tabs**: Handle the case where a tab is closed during the sort loop.
- **Error Matching**: Ensure the retry logic specifically targets modification and dragging errors to avoid retrying on permanent failures (like "Tab not found").

---

## Work Objectives

### Core Objective
Ensure the tab sorting process is resilient to temporary browser locks and concurrent state updates.

### Concrete Deliverables
- `src/utils/chromeApi.ts`: `withRetry` utility and updated exports.
- `src/store/useStore.ts`: Guarded `sortGroupsToTop` function.

### Definition of Done
- [x] Sorting 10+ tabs during a simulated drag operation (or with synthetic delay) does not crash the extension.
- [x] Logs show "Retrying move..." when a modification lock is encountered.
- [x] The `isUpdating` lock prevents overlapping sort executions.

### Must Have
- Exponential backoff (100, 200, 400ms).
- Re-entrance guard in `sortGroupsToTop`.
- Standardized use of `moveTab` in the sorter.

### Must NOT Have (Guardrails)
- Infinite retry loops.
- Retries on "Tab not found" errors (these should fail fast).
- Blocking UI for the duration of retries (use `isUpdating` state).

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: NO
- **QA approach**: Manual verification via logs and interactive browser testing.

### Manual QA Procedure

**For Tab/Group Moves:**
- [x] Using interactive_bash (tmux session):
  - Add `console.log` to `withRetry` to verify attempts.
  - Trigger `sortGroupsToTop`.
  - Verify that if a lock is hit, it retries and succeeds (or skips after 3 attempts).
- [x] Visual verification:
  - Drag a tab while clicking the "Sort" button (if exposed in UI) or trigger the command.
  - Verify the extension remains responsive and eventually completes the sort or skips locked items.

---

## Execution Strategy

### Parallel Execution Waves
Sequential - core utility must be updated before the store can use it reliably.

---

## TODOs

- [x] 1. Implement `withRetry` utility in `src/utils/chromeApi.ts`

  **What to do**:
  - Add a private `withRetry` helper function that takes a task function.
  - Logic:
    - Max attempts: 3.
    - Base delay: 100ms.
    - Match error messages: "Tab cannot be modified", "dragging", "moving".
    - Log retry attempts with `console.warn`.
  - Update `moveTab`, `moveIsland`, `ungroupTab`, and `updateTabGroup` to wrap their internal Chrome API calls with `withRetry`.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Implementing a reusable utility with specific logic.
  - **Skills**: [`javascript`, `chrome-extension`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 2

  **References**:
  - `src/utils/chromeApi.ts` - Existing wrappers.

  **Acceptance Criteria**:
  - [x] `moveTab` correctly retries on "Tab cannot be modified".
  - [x] `moveTab` fails fast on "Tab not found".

- [x] 2. Refactor `sortGroupsToTop` in `src/store/useStore.ts`

  **What to do**:
  - Add re-entrance guard at the start: `if (get().isUpdating) return;`.
  - Use `moveTab` wrapper instead of `chrome.tabs.move`.
  - Wrap the move call inside the loop in a `try...catch`.
  - If a move fails after retries, log the error and `continue` the loop.
  - Ensure `setIsUpdating(false)` is always called in `finally`.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Modifying store logic and concurrency management.
  - **Skills**: [`zustand`, `typescript`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 1

  **References**:
  - `src/store/useStore.ts:792-826` - Current `sortGroupsToTop` implementation.

  **Acceptance Criteria**:
  - [x] Sorter uses `moveTab` and `moveIsland` wrappers.
  - [x] Sorter continues if one item fails.
  - [x] `isUpdating` is false after completion/failure.

---

## Success Criteria

### Final Checklist
- [x] No more "Tab cannot be modified" unhandled errors.
- [x] Sorting is resilient to user interaction (dragging).
- [x] `chromeApi.ts` provides a robust foundation for all move operations.
