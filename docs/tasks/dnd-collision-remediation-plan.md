# DnD Collision and Dependency Remediation Plan

## Goal
Stabilize drag-and-drop collision behavior across Live and Vault panels, remove ambiguous drop outcomes, and harden drag finalization paths without changing product behavior outside DnD.

## Scope Mapped (Current System)
- DnD orchestration: `src/components/Dashboard.tsx` (`DndContext`, `handleDragStart/Over/End/Cancel`, `collisionDetection={closestCorners}`)
- Droppable surfaces:
  - Live panel: `live-panel-dropzone`, `live-bottom`, `create-island-dropzone` in `src/components/LivePanel.tsx`
  - Vault panel: `vault-dropzone`, `vault-bottom` in `src/components/VaultPanel.tsx`
  - Gap droppables: `live-gap-{index}`, `vault-gap-{index}` via `src/components/DroppableGap.tsx` + `src/hooks/useProximityGap.ts`
- Optimistic move engine: `src/store/slices/useTabSlice.ts` -> `prepareOptimisticMove` in `src/store/operations/moveItem.ts`
- Drag final execution: `MoveTabCommand`, `MoveIslandCommand`, `moveToVault`, `restoreFromVault`, `reorderVault`
- Pointer dependency for gap expansion: `src/contexts/PointerPositionContext.tsx`

## Findings Driving This Plan
1. P0 correctness bug: create-island drop path can resolve group IDs as tab IDs.
- Location: `src/components/Dashboard.tsx:346-356`
- Impact: dragging a live group to create-island dropzone can call `chrome.tabs.get(groupNumericId)`, which is semantically wrong and may target unrelated tabs.

2. P1 collision precision gap under UI scaling.
- Location: scaled container at `src/components/Dashboard.tsx:506-510`; no DnD modifier configured at `:514-522`.
- Existing signal: `src/components/__tests__/dndScaling.test.ts` documents expected transform scaling behavior but is not integrated into runtime DnD wiring.

3. P1 collision strategy is too generic for mixed targets.
- Location: global `closestCorners` at `src/components/Dashboard.tsx:516` with both broad panel droppables and fine-grained item/gap droppables active.
- Risk: panel-level zones can win collisions when user intent is item/gap reorder, especially near panel edges and virtualized regions.

4. P1/P2 stale geometry in proximity-gap expansion.
- Location: cached rect logic in `src/hooks/useProximityGap.ts:14-43`, reused in pointer updates `:80-103`.
- Risk: scrolling/resizing during drag can make gap expansion lag behind actual DOM position.

5. P2 debug/instrumentation leakage in live-bottom dropzone wrapper.
- Location: `src/components/VirtualizedLiveList.tsx:59-71` returns cleanup from a ref callback (ignored by React), while observers/listeners are created.
- Also `dropzoneRect` debug overlay is always rendered when present (`:180-203`), adding persistent visual/noise overhead.

6. P2 ID comparison inconsistency.
- Locations:
  - `src/components/Dashboard.tsx:258` uses `activeId === overId`
  - `src/store/operations/moveItem.ts:192` uses `activeId === overId`
- Project rule prefers string-normalized comparison for IDs.

7. P2 service-boundary drift in DnD finalization path.
- Locations:
  - `src/components/Dashboard.tsx:368,378,390,399`
  - `src/store/commands/MoveTabCommand.ts:24,27,37,40`
- Direct `chrome.*` usage in drag path reduces testability and violates established service-layer conventions.

## Finalized Implementation Workstreams

## Workstream 1: Fix Safety-Critical Drag End Behavior (P0)
### Files
- `src/components/Dashboard.tsx`
- `src/components/VirtualizedLiveList.tsx` (visual affordance only)
- `src/components/__tests__/Dashboard.dnd.test.tsx`

### Implementation Steps
1. Gate create-island execution to tab drags only.
- Require active drag data `type === 'tab'` before resolving tab ID.
- If drag data is missing or non-tab, abort with logged warning and cleanup.

2. Remove fallback path that parses group-like `activeId` into a tab ID for create-island flow.
- Keep tab-ID resolution deterministic from tab payload and/or known tab ID namespace.

3. Align UI affordance with behavior.
- Ensure create-island dropzone is non-actionable for group drags in behavior (not just styling).

### Acceptance Criteria
- Dropping a group on create-island does nothing except safe cleanup/logging.
- Dropping a live tab on create-island still works.
- No regression to vault restore/move flows.

## Workstream 2: Replace Collision Strategy with Intent-Aware Detector (P1)
### Files
- `src/components/Dashboard.tsx`
- New utility: `src/components/dnd/collisionDetection.ts` (or similar colocated module)
- `src/components/__tests__/Dashboard.dnd.test.tsx`
- New focused tests: `src/components/__tests__/collisionDetection.test.ts`

### Implementation Steps
1. Introduce a custom collision detector with priority buckets.
- Bucket 1: direct item/gap targets in active panel.
- Bucket 2: explicit cross-panel targets (`vault-dropzone`, `vault-bottom`, `live-panel-dropzone`, `live-bottom`) when source/target panel differ.
- Bucket 3: create-island target only for eligible live tabs.

2. Use `pointerWithin`-first behavior with deterministic fallback (`closestCenter`/`closestCorners`) when pointer overlap is unavailable.

3. Prevent broad panel droppables from preempting in-panel list reorder when a nearer item/gap target exists.

4. Keep existing IDs and drag events intact to minimize integration risk.

### Acceptance Criteria
- Same-panel reordering consistently targets item/gap over panel root.
- Cross-panel drags still resolve to panel dropzones reliably.
- Create-island only resolves for eligible tab drags.

## Workstream 3: Make DnD Scale-Aware and Geometry-Accurate (P1)
### Files
- `src/components/Dashboard.tsx`
- `src/hooks/useProximityGap.ts`
- `src/contexts/PointerPositionContext.tsx` (if needed for precision tuning)
- `src/components/__tests__/dndScaling.test.ts`
- `src/hooks/__tests__/useProximityGap.test.ts`

### Implementation Steps
1. Add DnD transform modifier that compensates for `appearanceSettings.uiScale`.
- Apply at `DndContext` level so drag coordinates/collision align with scaled UI.

2. Rework `useProximityGap` rect caching.
- Refresh cached gap rect on scroll/resize while dragging, or recompute from current DOM rect in a throttled manner.
- Keep current performance guardrails (movement threshold / RAF-friendly behavior).

3. Preserve existing dynamic gap-height logic and cross-panel suppression behavior.

### Acceptance Criteria
- Drag targets remain accurate when `uiScale !== 1`.
- Gap expansion tracks pointer correctly after scroll.
- No noticeable drag-performance degradation.

## Workstream 4: Remove Debug Leakage and Harden Dropzone Instrumentation (P2)
### Files
- `src/components/VirtualizedLiveList.tsx`
- `src/components/__tests__/LivePanel.test.tsx` or new virtualized-list tests

### Implementation Steps
1. Replace ref-callback side-effect pattern with proper `useEffect` setup/cleanup for observers/listeners.
2. Gate debug overlay visuals behind explicit debug-mode setting (or remove in production path).
3. Preserve functional bottom dropzone behavior and `isBottomOver` feedback.

### Acceptance Criteria
- No leaked scroll listeners/ResizeObservers.
- No always-on debug overlay in normal operation.
- Bottom dropzone collision behavior unchanged or improved.

## Workstream 5: Consistency and Service-Layer Cleanup (P2)
### Files
- `src/components/Dashboard.tsx`
- `src/store/operations/moveItem.ts`
- `src/store/commands/MoveTabCommand.ts`
- `src/services/tabService.ts` (extend API)
- related tests

### Implementation Steps
1. Normalize ID comparisons to `String(a) === String(b)` in DnD pipeline.
2. Move direct `chrome.tabs.group/ungroup`, `chrome.tabs.get`, and runtime message operations behind service abstractions used by DnD logic.
3. Keep command interfaces stable for undo/redo compatibility.

### Acceptance Criteria
- No direct `chrome.*` calls remain in DnD-specific components/commands.
- Behavior parity preserved for move/undo flows.

## Test Plan Required for Completion
1. Unit tests for collision detector priority rules.
2. Unit tests for create-island eligibility gating (tab-only).
3. Unit tests for scale modifier behavior wired through runtime DnD config.
4. Unit tests for `useProximityGap` under pointer movement + scroll updates.
5. Integration-style DnD tests for:
- live tab reorder in panel
- live tab to vault
- vault item reorder
- vault item restore to live
- create-island with tab
- create-island with group (no-op)

## Verification Commands
```bash
npm run test:fail-only
npm run build
```

## Sequencing for Parallel Agents
1. Agent A: Workstream 1 (safety) + tests.
2. Agent B: Workstream 2 (collision detector) + tests.
3. Agent C: Workstream 3 (scale + proximity geometry) + tests.
4. Agent D: Workstream 4 and 5 cleanup after A-C merge, then full verification.

## Out of Scope
- Redesigning DnD UX or changing ID namespace scheme.
- Replacing dnd-kit.
- Altering vault persistence model.
