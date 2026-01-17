# Plan: Fix Tactical Island Group Creation

## Requirements
- Fix the "Tactical Island creation" zone (dropzone) which is currently failing to create groups.
- Ensure the tab being dragged is correctly identified and grouped in the browser.
- No regression for existing drag-and-drop features.

## Technical Decisions
- **Harden API Wrapper**: Update `createIsland` in `src/utils/chromeApi.ts` to be more robust.
- **Improved Drag Orchestration**: Fix the early state clearing in `Dashboard.tsx`'s `handleDragEnd`.
- **Z-Index/Collision Priority**: Ensure the `create-island-dropzone` has priority over the parent `live-panel-dropzone`.
- **Diagnostic Logging**: Add persistent console logs for the drop scenario.

## Research Findings
- The zone turns purple, confirming `isOver` works in the UI.
- `handleDragEnd` resets `activeItem` at the very beginning, potentially breaking the fallback logic for Scenario 5.
- `createIsland` passes an object with a potentially `undefined` key, which can cause issues with the Chrome API.

## Tasks

### 1. Harden chromeApi Utility
- **File**: `src/utils/chromeApi.ts`
- **Action**: Modify `createIsland` to only include `windowId` in `createProperties` if it exists.
- **Justification**: Prevents potential Chrome API errors with `undefined` parameters.

### 2. Fix Dashboard Drag Orchestration
- **File**: `src/components/Dashboard.tsx`
- **Action**:
    - Move `setActiveItem(null)` and `setIsDraggingVaultItem(false)` to the end of the `handleDragEnd` function (or after the creation logic).
    - Add explicit logging at the start of `handleDragEnd` to capture `active.id` and `over.id`.
    - Refine Scenario 5 logic to use more robust tab ID resolution.
- **Justification**: Ensures the necessary state is available when the creation logic runs.

### 3. Verification
- **Test Case 1**: Drag a single tab from "Live Workspace" to the "Tactical Island creation" zone.
    - **Expected**: A new group (island) is created in the browser containing that tab.
- **Test Case 2**: Verify standard tab reordering still works.
- **Test Case 3**: Verify dragging a tab into an existing island still works.

## Guardrails
- **Minimal Changes**: Avoid refactoring the entire dnd-kit implementation.
- **No Suppression**: Do not suppress any Chrome API errors.
- **Atomic Commits**: (Handled by the execution agent)
