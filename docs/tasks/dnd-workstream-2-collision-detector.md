# DnD Workstream 2: Intent-Aware Collision Detector (P1)

## Goal
Replace broad collision behavior with deterministic, intent-aware collision selection across mixed target types.

## Scope
- `src/components/Dashboard.tsx`
- New module: `src/components/dnd/collisionDetection.ts` (or equivalent)
- `src/components/__tests__/Dashboard.dnd.test.tsx`
- New tests: `src/components/__tests__/collisionDetection.test.ts`

## Problem Statement
Using a single `closestCorners` strategy across panel roots, bottoms, gaps, and items can mis-prioritize broad panel targets over precise reorder targets.

## Implementation Plan
1. Implement custom collision detector with explicit priority buckets.
- Priority 1: in-panel item and gap targets.
- Priority 2: explicit panel root/bottom targets for cross-panel moves.
- Priority 3: create-island target only when source is eligible live tab.

2. Use pointer-first resolution.
- Prefer `pointerWithin` semantics when pointer overlap data exists.
- Fallback deterministically to `closestCenter` or `closestCorners` when necessary.

3. Protect same-panel reorder intent.
- Prevent panel root dropzones from overriding nearby item/gap reorder targets.

4. Integrate without changing existing target IDs.
- Keep current dropzone IDs and drag event contracts unchanged.

## Required Tests
1. Same-panel drag near items/gaps prioritizes item/gap over panel root.
2. Cross-panel drag resolves to destination panel dropzone.
3. Live tab to create-zone resolves only when eligible.
4. Vault/group drags do not resolve create-zone as active collision target.

## Acceptance Criteria
- Collision outcomes are stable and predictable at panel boundaries.
- In-panel reorder precision improves without breaking cross-panel flows.
- Existing DnD IDs and store move logic remain compatible.

## Verification Commands
```bash
npm run test:fail-only
npm run build
```
