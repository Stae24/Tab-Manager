# DnD Workstream 4: Dropzone Instrumentation and Debug Cleanup (P2)

## Goal
Remove leakage-prone debug instrumentation patterns from the live-bottom dropzone while preserving behavior.

## Scope
- `src/components/VirtualizedLiveList.tsx`
- `src/components/__tests__/LivePanel.test.tsx` and/or dedicated virtualized-list tests

## Problem Statement
Current bottom-dropzone instrumentation uses a ref callback that creates observers/listeners but returns a cleanup function React will ignore. Debug overlays are always available in normal rendering paths.

## Implementation Plan
1. Move observer/listener lifecycle into `useEffect`.
- Track node reference explicitly.
- Attach and clean up `ResizeObserver`/scroll listeners in effect cleanup.

2. Restrict debug overlay rendering.
- Gate dropzone debug overlay behind debug-mode setting or remove from default runtime path.

3. Preserve bottom dropzone behavior.
- Keep `setBottomRef` wiring intact.
- Keep visual hover feedback (`isBottomOver`) unchanged.

## Required Tests
1. Mount/unmount does not accumulate listeners/observers.
2. Bottom dropzone still registers and responds to hover state.
3. Debug overlay does not render in normal mode.

## Acceptance Criteria
- No listener/observer leaks from bottom-dropzone instrumentation.
- No always-on debug overlay in production/default mode.
- Live-bottom collision semantics unchanged.

## Verification Commands
```bash
npm run test:fail-only
npm run build
```
