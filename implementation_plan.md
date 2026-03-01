# Dynamic DroppableGap Height — Match Dragged Element

The [DroppableGap](file:///home/stae/Projects/Tab%20Manager/src/components/DroppableGap.tsx#12-33) expands to a hardcoded `h-[2.375rem]` (38px) regardless of tab density. This causes a visible size mismatch: the gap opens larger or smaller than the DragOverlay (the ghost copy of the dragged tab). The fix is to make the gap expand to exactly the height of the dragged element.

## Proposed Changes

### Core Hook

#### [MODIFY] [useProximityGap.ts](file:///home/stae/Projects/Tab Manager/src/hooks/useProximityGap.ts)

- Read `active.rect.current.initial.height` from the `active` object already available via the hook's parameter.
- Return a new `expandedHeight` value (in px) alongside `expanded`.
- When `active` is null or the gap shouldn't expand, `expandedHeight` stays `0`.
- When expanding, set `expandedHeight` to `active.rect.current.initial.height`.

---

### Gap Component

#### [MODIFY] [DroppableGap.tsx](file:///home/stae/Projects/Tab Manager/src/components/DroppableGap.tsx)

- Destructure `expandedHeight` from [useProximityGap](file:///home/stae/Projects/Tab%20Manager/src/hooks/useProximityGap.ts#7-62) (in addition to `expanded`).
- Replace the hardcoded Tailwind class `h-[2.375rem]` with an inline `style={{ height }}` that uses `expandedHeight` when expanded, and `0` otherwise.
- Keep `transition-all duration-200 ease-out` for smooth animation.

---

### Test Updates

#### [MODIFY] [DroppableGap.test.tsx](file:///home/stae/Projects/Tab Manager/src/components/__tests__/DroppableGap.test.tsx)

- Update the `mockProximityGapResult` to include `expandedHeight`.
- Update the "has expanded height when expanded=true" test to assert on inline `style.height` instead of the removed `h-[2.375rem]` class.

#### [MODIFY] [useProximityGap.test.ts](file:///home/stae/Projects/Tab Manager/src/hooks/__tests__/useProximityGap.test.ts)

- Update tests that check return values to also assert `expandedHeight`.
- Add a test that verifies `expandedHeight` comes from `active.rect.current.initial.height` when expanded.
- Update existing expansion tests to pass an `active` mock that includes `rect.current.initial.height`.

## Verification Plan

### Automated Tests

```bash
npm run test:fail-only
```

This runs all tests and outputs only failures. Should output nothing after changes.

### Manual Verification

> [!IMPORTANT]
> The implementer should ask the user to visually test the drag behavior across all four tab densities (minified, compact, normal, spacious) in both the Live and Vault panels to confirm the gap matches the DragOverlay height with no visible jump.
