# DnD Workstream 1: Safety-Critical Drag End Fixes (P0)

## Goal
Eliminate unsafe or invalid drag-end behavior in high-impact paths, especially create-island handling.

## Scope
- `src/components/Dashboard.tsx`
- `src/components/VirtualizedLiveList.tsx` (behavioral affordance alignment only)
- `src/components/__tests__/Dashboard.dnd.test.tsx`

## Problem Statement
Current create-island flow can attempt to resolve non-tab IDs (including group IDs) as tab IDs during drag-end resolution. This can trigger incorrect Chrome tab lookups and unpredictable behavior.

## Implementation Plan
1. Gate create-island flow to tab drags only.
- In `handleDragEnd`, require active drag payload to be `type === 'tab'` before entering create-island logic.
- If drag data is missing or non-tab, exit early with cleanup and warning log.

2. Remove ambiguous ID fallback paths for create-island.
- Avoid resolving create-island tab ID from generic/parsed IDs that may represent groups.
- Resolve from tab payload and tab-namespace-safe sources only.

3. Align create-zone UX with execution constraints.
- Ensure groups cannot trigger create-island behavior even if visually dropped on that zone.
- Keep existing visual disabled state for groups/vault items consistent with actual logic.

## Required Tests
1. Positive: live tab dropped on `create-island-dropzone` triggers island creation path.
2. Negative: live group dropped on `create-island-dropzone` is a no-op (no create call).
3. Negative: vault item dropped on create-island remains blocked.
4. Cleanup: pending-operation tracking is always released on all create-island exit paths.

## Acceptance Criteria
- Group drag to create-island never calls tab lookup/grouping flow.
- Tab drag to create-island still works end-to-end.
- No regressions in live reorder, live->vault, vault reorder, or vault->live restore.

## Verification Commands
```bash
npm run test:fail-only
npm run build
```
