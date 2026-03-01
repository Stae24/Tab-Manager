# Fix: Vault Panel Resize Handle Behavior

## Problem

When dragging the resize handle to the left, the vault panel first shifts to the left alongside the handle, then expands to fill the remaining space to its right. The resize feels jittery and incorrect.

## Root Cause

Two issues in the resize implementation:

### 1. Panel widths overflow the flex container

In `Dashboard.tsx` (line 529), a flex row contains three children:

- `LivePanel` — `width: ${dividerPosition}%`
- Resize handle — `w-1` (0.25rem), `flex-shrink-0`
- `VaultPanel` — `width: ${100 - dividerPosition}%`

The two panel widths always sum to exactly 100%, but the handle adds extra width. The total exceeds the container width, and since the handle has `flex-shrink-0`, the browser shrinks the panels unpredictably to resolve the overflow — producing the "move then fill" visual artifact.

### 2. `window.innerWidth` doesn't match actual container width

In `Dashboard.tsx` (line 156), the divider position is calculated as:

```ts
const percentage = (e.clientX / window.innerWidth) * 100;
```

The dashboard container applies a `transform: scale(uiScale)` with compensating width/height (lines 511–514). When `uiScale !== 1`, `window.innerWidth` doesn't reflect the actual container width, so the percentage is wrong.

## Fix

All changes are in **`src/components/Dashboard.tsx`**.

### Step 1: Add a ref for the flex container

Add a `useRef` for the flex container (the `div.flex.flex-1` at line 529) so we can measure its actual width:

```tsx
const containerRef = useRef<HTMLDivElement>(null);
```

Attach it to the flex container div at line 529:

```tsx
<div ref={containerRef} className="flex flex-1 overflow-hidden relative overscroll-none">
```

### Step 2: Fix the mouse move calculation

Replace the `handleMouseMove` logic (lines 152–158) to use the container's bounding rect instead of `window.innerWidth`:

```tsx
const handleMouseMove = (e: MouseEvent) => {
  if (!isResizing || !containerRef.current) return;
  const rect = containerRef.current.getBoundingClientRect();
  const percentage = ((e.clientX - rect.left) / rect.width) * 100;
  setDividerPosition(Math.max(DIVIDER_POSITION_MIN, Math.min(DIVIDER_POSITION_MAX, percentage)));
};
```

This correctly handles UI scale and any other offset.

### Step 3: Account for handle width in panel sizing

Change the panel width styles to subtract the handle width using `calc()`. The handle is `w-1` = `0.25rem`.

**`LivePanel`** (in `LivePanel.tsx`, line 326):

```tsx
style={{ width: showVault ? `calc(${dividerPosition}% - 0.125rem)` : '100%' }}
```

**`VaultPanel`** (in `VaultPanel.tsx`, line 221):

```tsx
style={{ width: `calc(${100 - dividerPosition}% - 0.125rem)` }}
```

Each panel subtracts half the handle width (0.125rem) so the total is exactly:  
`dividerPosition% - 0.125rem` + `0.25rem` + `(100 - dividerPosition)% - 0.125rem` = `100%`.

## Files to modify

| File | Change |
|---|---|
| `src/components/Dashboard.tsx` | Add `containerRef`, attach to flex container, fix `handleMouseMove` to use `containerRef.current.getBoundingClientRect()` |
| `src/components/LivePanel.tsx` | Change width style to `calc(${dividerPosition}% - 0.125rem)` |
| `src/components/VaultPanel.tsx` | Change width style to `calc(${100 - dividerPosition}% - 0.125rem)` |

## Verification

1. Run `npm run test:fail-only` — no test regressions.
2. Run `npm run build` — compiles cleanly.
3. Manual: drag resize handle left/right — both panels should resize smoothly without jitter or "move then fill" artifact.
4. Manual: change UI scale in appearance settings, then resize — should still work correctly.
