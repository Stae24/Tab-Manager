# Plan: Tab Buttons Should Fit Without Expanding the Tab

## Problem

When hovering over a tab, action buttons (Save, Close, Restore) appear. Their internal padding (`p-1` / `p-1.5` / `p-2` from the buttonSize preset) can make the button taller than the tab's content area, causing the tab to expand vertically on hover. This should only happen when custom button sizes are enabled.

## Goal

When `customButtonHoverSize` is **disabled** (default), buttons must stretch to fill the tab's available vertical space without exceeding it. The icon size and horizontal padding stay the same — vertical fit is determined by the tab's height (which is controlled by density), not by the button's own padding.

When `customButtonHoverSize` is **enabled**, preserve current behavior: the slider-controlled padding applies in all directions and is allowed to expand the tab.

## File to Change

`src/components/TabCard.tsx`

## Changes

### 1. Split preset padding to horizontal-only

Change the `buttonPadding` map from all-directional padding to horizontal-only:

```ts
// Before
const buttonPadding: Record<string, string> = {
  small: 'p-1',
  medium: 'p-1.5',
  large: 'p-2',
};

// After
const buttonPadding: Record<string, string> = {
  small: 'px-1',
  medium: 'px-1.5',
  large: 'px-2',
};
```

### 2. Make buttons stretch to fill available height

On the button container div (the `hidden group-hover:flex` wrapper), add `items-stretch` so child buttons fill the tab's height:

```tsx
// Before
<div className="hidden group-hover:flex items-center gap-1.5 relative z-20">

// After
<div className="hidden group-hover:flex items-stretch gap-1.5 relative z-20">
```

### 3. Center icon content inside stretched buttons

Each `<button>` element now stretches to the full tab height. Add `flex items-center` to vertically center the icon within:

```tsx
// Before (each button)
className={cn(
  "rounded-lg hover:bg-gx-cyan/20 text-gx-muted hover:text-gx-cyan transition-all group/save",
  getButtonPaddingClass()
)}

// After (each button) — add "flex items-center"
className={cn(
  "flex items-center rounded-lg hover:bg-gx-cyan/20 text-gx-muted hover:text-gx-cyan transition-all group/save",
  getButtonPaddingClass()
)}
```

Apply the same `flex items-center` addition to all three buttons (Save, Restore/Open, Close).

### 4. No changes to custom button size path

`getButtonPaddingStyle()` (the inline style path for custom sizes) remains unchanged. When `customButtonHoverSize` is true, `getButtonPaddingClass()` already returns `''` and the inline style applies all-directional padding — this continues to allow tab expansion as intended.

## What NOT to Change

- Icon sizes (`buttonIconSize` map) — stay at 14/16/18px per preset
- Horizontal padding — stays as-is per preset
- Custom button size behavior — preserves current expansion
- Island.tsx buttons — out of scope (only TabCard)

## Verification

1. Run `npm run test:fail-only` — fix any failures
2. Run `npm run build` — ensure it compiles
3. Manual check: hover over tabs at each density (minified/compact/normal/spacious) and each button size (small/medium/large) — tab height must not change on hover
4. Manual check: enable custom button size, use slider — tab is allowed to expand as before
