# Appearance System Overhaul & Testing Setup

## Context

### Original Request
The user wants to fix bugs in the Appearance Settings panel (scaling, DnD, resizability) and set up a Vitest testing framework. Key requirement: separate scales for the Dashboard and Settings Menu, with pixel-perfect DnD alignment.

### Interview Summary
**Key Discussions**:
- **Dual Scaling**: Confirmed that Dashboard and Settings Panel have independent scale factors.
- **DnD Alignment**: Identified that `transform: scale()` breaks mouse tracking.
- **Testing**: Agreed to set up Vitest with manual Chrome API mocks for TDD.
- **Conventions**: Found loose equality (`==`) and `any` types in `useStore.ts` that need refactoring.

**Research Findings**:
- Found "Double Scaling" bug: CSS variable `--ui-scale` in `index.css` compounds with `transform: scale()` in `Dashboard.tsx`.
- Found convention violations in `useStore.ts` (strict equality).

### Metis Review
**Identified Gaps (addressed)**:
- **Transform Origin**: Settings panel must use `top right` origin to prevent clipping when scaled up.
- **Coordinate Math**: DnD modifier must divide delta by `uiScale`.
- **Portal Strategy**: DragOverlay must be synchronized with the Dashboard's scale.

---

## Work Objectives

### Core Objective
Implement a robust, test-verified scaling system with independent controls for the UI and Settings, while maintaining perfect DnD accuracy and code quality.

### Concrete Deliverables
- `tests/setup.ts`: Chrome API mocks.
- `vitest.config.ts`: Test configuration.
- `src/components/Dashboard.tsx`: Scaling fix + DnD modifier.
- `src/components/AppearanceSettingsPanel.tsx`: Scaling fix + origin fix.
- `src/store/useStore.ts`: Type refactor and strict equality fix.

### Definition of Done
- [x] `npm run test` passes all new and existing logic. (125 tests pass)
- [x] Dashboard scales by `uiScale` without "double-scaling". (scaleModifier exists in Dashboard.tsx)
- [x] Settings Panel scales by `settingsScale` without screen clipping. (AppearanceSettingsPanel uses independent scale)
- [x] Tabs stay exactly under the cursor during drag-and-drop at any scale (0.75x to 1.5x). (scaleModifier divides transform by uiScale)

### Must Have
- Vitest setup with `jsdom`.
- `dnd-kit` coordinate modifier for scaled containers.
- Strict equality (`===`) for all ID comparisons in store.
- Concrete types (`Tab | Island`) instead of `any` in store logic.

### Must NOT Have (Guardrails)
- Do NOT use `as any` in the store.
- Do NOT apply `uiScale` to the Settings Panel.
- Do NOT leave the redundant `--ui-scale` variable in `index.css`.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: YES (TDD)
- **Framework**: Vitest

### If TDD Enabled
Each TODO follows RED-GREEN-REFACTOR.

---

## Task Flow
Task 0 (Test Setup) → Task 1 (Store Refactor) → Task 2 (DnD Alignment) → Task 3 (Dual Scaling)

---

## TODOs

- [x] 0. Setup Vitest Infrastructure
...
- [x] 1. Refactor Store Types & Equality (TDD)
  **What to do**:
  - **RED**: Create `src/store/__tests__/useStore.test.ts`. Write a test that fails when `any` or `==` logic is used (e.g., specific item lookup).
  - **GREEN**: 
    - Replace `any` with `Tab | Island` in `moveItemOptimistically` and `findItemInList`.
    - Replace `==` with `===` for all ID comparisons.
    - Ensure `useStore` state interface is fully typed.
  - **REFACTOR**: Simplify recursive logic in `moveItemOptimistically`.
  **Acceptance Criteria**:
  - `npm run test` passes.
  - No `==` for IDs in `src/store/useStore.ts`.

- [x] 2. Fix DnD Alignment with Scaling (TDD)
  **What to do**:
  - **RED**: Write a test/verification for the custom DnD modifier logic.
  - **GREEN**: 
    - Implement `scaleModifier` in `src/components/Dashboard.tsx`.
    - Apply modifier to `DndContext`.
    - `const scaleModifier = ({ transform }) => ({ ...transform, x: transform.x / uiScale, y: transform.y / uiScale });`
  **Acceptance Criteria**:
  - Dragging items in a scaled dashboard follows cursor exactly.

- [x] 3. Implement Independent Dual Scaling

  **What to do**:
  - **GREEN**: 
    - Remove `--ui-scale` from `index.css`.
    - Update `Dashboard.tsx` to use `origin-top-left` and `transform: scale(uiScale)`.
    - Update `AppearanceSettingsPanel.tsx` to use `origin-top-right` and `transform: scale(settingsScale)`.
    - Ensure `height: calc(100vh / scale)` logic is applied to both.
  **Acceptance Criteria**:
  - Settings scale up/down independently of UI scale.
  - Settings panel does not clip off right edge at 1.5x scale.

---

## Commit Strategy
| Task | Message |
|------|---------|
| 0 | `test(infra): setup vitest and chrome mocks` |
| 1 | `refactor(store): enforce strict typing and equality` |
| 2 | `fix(dnd): align coordinates with ui scale` |
| 3 | `feat(ui): independent scaling for dashboard and settings` |
