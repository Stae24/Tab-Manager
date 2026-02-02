# Plan: Fix Search Mode Fade-in Loop

## TL;DR

> **Quick Summary**: Fix the Search Mode indicator bar and results list from re-triggering their entrance animations (looping fade) during state updates or background syncs.
> 
> **Deliverables**: 
> - Stabilized `Search Mode Header` and results container in `Dashboard.tsx`.
> - Optimized `filteredTabs` memoization to prevent unnecessary re-renders.
> 
> **Estimated Effort**: Short (~15 mins)
> **Parallel Execution**: NO - sequential UI fix.
> **Critical Path**: Dashboard.tsx logic update.

---

## Context

### Original Request
The user reported that the search mode indicator bar (below the main header) is fading in and out on a loop.

### Interview Summary
**Key Discussions**:
- **Diagnosis**: The bar is not coded to loop, but React is re-mounting the component due to state changes (background sync or filter updates), which re-triggers the `fadeIn` animation.
- **Root Cause**: Lack of stable keys and referential instability in the filtered results array.

---

## Work Objectives

### Core Objective
Prevent the Search Mode UI from re-animating unless the user explicitly enters/exits search mode.

### Concrete Deliverables
- `src/components/Dashboard.tsx`: Add stable keys and stabilize re-renders.

### Definition of Done
- [x] Typing in search triggers animation exactly once.
- [x] Background tab syncs do not cause the search header to flicker or re-fade.
- [x] Clearing search and re-typing triggers the animation again correctly.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: NO (Manual UI verification preferred for animation issues)
- **QA approach**: Manual verification via browser automation/terminal simulation.

### Automated Verification (Agent-Executable)

**For Dashboard UI stability**:
```
# Agent executes via playwright browser automation:
1. Navigate to: [Extension URL]
2. Type "a" in search input.
3. Observe: Search Mode Header fades in (fadeIn animation).
4. Simulate background update: `chrome.storage.local.set({ islands: [...] })`
5. Assert: Search Mode Header remains visible and OPAQUE (no re-fade).
6. Clear search.
7. Observe: Search Mode Header disappears.
8. Type "a" again.
9. Assert: Search Mode Header fades in again.
```

---

## TODOs

- [x] 1. Stabilize Search Mode UI in `Dashboard.tsx`

  **What to do**:
  - Add a stable `key="search-mode-container"` to the conditional Search Mode Header block (around line 361).
  - Add a stable `key="search-results-list"` to the search results `div` (around line 384).
  - Modify `filteredTabs` memoization or use a `useRef` to maintain referential equality if the underlying tab data hasn't actually changed.

  **Must NOT do**:
  - Do not remove the `search-mode-enter` class (the initial fade is desired).
  - Do not disable `islands` sync while searching (data must stay fresh, just stable).

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Requires understanding of React rendering lifecycle and CSS animations.
  - **Skills**: [`frontend-ui-ux`]

  **Acceptance Criteria**:
  - [x] `Dashboard.tsx` updated with stable keys.
  - [x] Manual verification (code audit) confirms no re-fading on state update.

  **Commit**: YES
  - Message: `fix(ui): stabilize search mode header to prevent animation loop`

---

## Success Criteria

### Verification Commands
```bash
# Verify no lint errors
npm run lint

# Verify build succeeds
npm run build
```
