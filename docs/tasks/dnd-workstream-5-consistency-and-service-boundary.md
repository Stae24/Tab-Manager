# DnD Workstream 5: Consistency and Service-Boundary Hardening (P2)

## Goal
Standardize ID handling and enforce service abstraction boundaries across DnD execution paths.

## Scope
- `src/components/Dashboard.tsx`
- `src/store/operations/moveItem.ts`
- `src/store/commands/MoveTabCommand.ts`
- `src/services/tabService.ts` (extend with needed wrappers)
- Related DnD tests

## Problem Statement
DnD code paths use mixed ID comparison styles and still contain direct `chrome.*` calls in command/component drag execution logic, which weakens consistency and testability.

## Implementation Plan
1. Normalize ID equality checks.
- Replace direct strict-equality checks for drag IDs with `String(a) === String(b)` in DnD-relevant logic.

2. Move direct Chrome operations behind services.
- Add/extend tab service APIs for operations currently called directly in DnD command/component paths (group/ungroup/tab lookup/message orchestration as applicable).

3. Preserve undo/redo behavior.
- Keep command interfaces stable while swapping implementation internals to service methods.

4. Add targeted regression tests.
- Ensure command execute/undo semantics remain unchanged.
- Ensure service wrappers are invoked instead of direct `chrome.*` in DnD path.

## Required Tests
1. ID comparison regression tests with mixed numeric/string representations.
2. MoveTabCommand execute/undo parity tests after service extraction.
3. Dashboard drag-end action tests validating service usage.

## Acceptance Criteria
- DnD ID comparisons are consistently string-normalized.
- DnD-critical component/command paths no longer call `chrome.*` directly.
- Undo/redo and drag-end behaviors remain unchanged functionally.

## Verification Commands
```bash
npm run test:fail-only
npm run build
```
