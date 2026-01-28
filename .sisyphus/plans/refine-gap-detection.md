# Plan: Refine Droppable Gap Detection

## Context

### Original Request
The droppable gap between two groups doesn't account for where the mouse is horizontally, so it opens the gap even if you are to the side of it. Make a plan to properly detect this so you have to actually be dragging over the gap for it to open.

### Interview Summary
**Key Discussions**:
- The gap expansion should be constrained to the width of the tab groups.
- No horizontal buffer is needed (strict detection).
- Manual verification is preferred over automated tests.

**Research Findings**:
- The `useProximityGap` hook in `src/components/Dashboard.tsx` handles the gap expansion logic.
- It currently uses a global `pointermove` listener and only checks vertical proximity (`expandUp` / `expandDown`).
- The horizontal bounds check is missing.

### Metis Review
**Identified Gaps** (addressed):
- **Which gaps?**: Both `LivePanel` and `VaultPanel` use `useProximityGap`. The fix will apply to both automatically.
- **Horizontal Bounds**: The `DroppableGap` component is `w-full` inside a container with `p-4` padding. Using `gapRect.left` and `gapRect.right` will effectively constrain detection to the width of the tab group area.
- **Guardrails**: Must NOT modify vertical proximity logic or change the expanded height value.

---

## Work Objectives

### Core Objective
Restrict droppable gap expansion to only trigger when the pointer is horizontally within the bounds of the tab groups.

### Concrete Deliverables
- Modified `useProximityGap` hook in `src/components/Dashboard.tsx`.

### Definition of Done
- [x] Gaps in both Live and Vault panels only expand when the pointer is horizontally over them.
- [x] Existing vertical proximity behavior is preserved.
- [x] Drag-and-drop functionality remains fully operational.

### Must Have
- Horizontal constraint based on `gapRect.left` and `gapRect.right`.
- Strict check with no buffer.
- Consistency across `LivePanel` and `VaultPanel`.

### Must NOT Have (Guardrails)
- NO horizontal buffers/padding.
- NO changes to vertical proximity thresholds (1rem up, 3rem down).
- NO changes to `DroppableGap` JSX or CSS.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: NO
- **QA approach**: Manual verification using interactive browser testing.

### Manual QA Procedures

**For Live and Vault Panels:**
- [x] Using the extension dashboard:
  - Drag a tab/island vertically near a gap.
  - Move the mouse horizontally outside the panel (e.g., over the sidebar or the other panel).
  - Verify: Gap CONTRACTS/STAYS CLOSED when mouse is horizontally outside.
  - Move the mouse horizontally back over the gap area.
  - Verify: Gap EXPANDS when mouse is vertically near and horizontally over.
  - Action: Drop the item into the expanded gap.
  - Verify: Item is moved correctly to the target position.

---

## Task Flow

```
Task 1 (Implementation) → Task 2 (Verification)
```

---

## TODOs

- [x] 1. Restrict horizontal detection in `useProximityGap`

  **What to do**:
  - Edit `src/components/Dashboard.tsx`.
  - Inside the `handlePointerMove` function within `useProximityGap` hook:
    - Get `gapRect` using `gapRef.current.getBoundingClientRect()`.
    - Calculate `isWithinHorizontal = e.clientX >= gapRect.left && e.clientX <= gapRect.right`.
    - Update `setExpanded` to only be true if `(expandUp || expandDown) && isWithinHorizontal`.

  **Must NOT do**:
  - Add any `baseRem` or pixel buffers to the horizontal check.

  **Parallelizable**: NO

  **References**:
  - `src/components/Dashboard.tsx:34-74` - The `useProximityGap` hook definition and pointer event logic.

  **Acceptance Criteria**:
  - [x] `useProximityGap` logic includes horizontal bounds check.
  - [x] No syntax errors or regressions in vertical logic.

  **Commit**: YES
  - Message: `feat(ui): restrict droppable gap expansion to horizontal bounds`
  - Files: `src/components/Dashboard.tsx`

- [x] 2. Manual Verification

  **What to do**:
  - Open the extension in a browser.
  - Perform drag operations as described in the Verification Strategy.
  - Verify gaps only open when the mouse is horizontally over the panel content area.

  **Acceptance Criteria**:
  - [x] Gaps in LivePanel only open when mouse is within LivePanel width.
  - [x] Gaps in VaultPanel only open when mouse is within VaultPanel width.
  - [x] No expansion when mouse is over Sidebar or Divider.

  **Commit**: NO

---

## Success Criteria

### Verification Commands
- Manual testing in browser: Drag items horizontally and vertically to verify gap expansion logic.

### Final Checklist
- [x] Gaps only open when horizontally over the tab groups.
- [x] No horizontal buffer added.
- [x] Vertical proximity logic untouched.
- [x] Works in both Live and Vault panels.
