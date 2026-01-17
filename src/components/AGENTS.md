# AGENTS.md for src/components
Overview focused on Drag-and-Drop orchestration, UI scaling, and GX-themed styling patterns within the components layer.

## OVERVIEW
This document captures the DnD concerns, UI responsibilities, and styling conventions implemented in src/components. It emphasizes how the DndContext is composed, how collision detection guides drop targets, the distinct roles of the Dashboard (Live panel) and the Sidebar (Vault/utility panel), and how GX styling patterns are applied to reinforce the extension's visual language.

## UI ARCHITECTURE
- DndContext at the top level orchestrates drag-and-drop across the Dashboard and Sidebar panels. It wires sensors, collision strategy, and the drag lifecycle handlers.
- Sensors typically include PointerSensor (mouse/touch) and KeyboardSensor for accessible drag via keys.
- Collision detection favors a robust mix, often using closestCenter for primary alignment and rectIntersection boundaries to handle panel transitions.
- Panels:
  - Dashboard (Live panel): hosts draggable items (TabCard, Island) with optimistic local updates.
  - Sidebar (Vault panel): hosts vault items and secondary actions. Items here are droppable targets for moves from Dashboard and within the vault.
- Components:
  - TabCard / Island: draggable items with IDs namespaced under the active workspace. They drive reordering and cross-panel moves.
  - Dashboard and Sidebar containers manage layout and render logic, including responsive scaling hooks that adapt to viewport changes.
- State interactions:
  - The store (useStore) drives the recursive move engine and persists layout changes. DnD events trigger optimistic updates which are reconciled by the background state.
- Styling:
  - GX-themed tokens and utility classes live in sx/Tailwind ranges. Focused borders, glow, and pulse effects communicate active drag targets.

## DND FLOW
1) Drag Start
   - User initiates drag on a TabCard/Island. The onDragStart handler captures the activeId and records the origin panel.
   - Visual feedback uses a glowing drag overlay and a subtle scale transform, consistent with GX styling.

2) Drag Over / Collision
   - As the item moves, onDragOver computes the potential overId using collision detection strategy. If over a target in the Dashboard or Sidebar, the target highlights with a neon accent.
   - Cross-panel movement is detected when the collision resolves to a target in the other panel.

3) Drag End / Drop
   - On drop, onDragEnd decides whether the item should be reordered within its panel or moved to the target panel. It updates the store with a single, coherent move action.
   - If the move is valid, the optimistic update is confirmed; otherwise, a smooth rollback occurs without jarring UI changes.

4) Validation & Constraints
   - Vault prefixes (e.g., vault-*) are honored during moves to preserve identity semantics.
   - Pinned/locked items maintain their relative order and prevent unstable reordering.

## STYLING PATTERNS
- GX Theme:
  - Neon border mapping for panels and interactive elements. Active targets feature glow rings and pulsing shadows.
  - Pulsing indicators on the item being dragged or hovered targets to convey focus.
- Tailwind v4:
  - Uses @import "tailwindcss" and CSS variables for color tokens and gradients.
  - Consistent utility classes for spacing, typography, and border radii.
- Visual language:
  - Dark, neon-blue-heavy palette with bright accent colors for drop targets.
  - Gradients applied to headers and panels to evoke depth and motion.
- Accessibility:
  - Keyboard drag support and clear focus outlines to satisfy accessibility requirements while preserving GX aesthetics.

## NOTES
- All DnD interactions reflect optimistic updates; the backend/browser reconciliation should correct any divergence.
- Any new styling tokens should be added to the theme system to stay consistent with the GX aesthetic.
- Avoid cross-panel layout churn; keep DndContext central logic to minimize reflow and ensure predictable scaling.