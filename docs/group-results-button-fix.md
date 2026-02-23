# Plan: Fix Group Results Button Disabled State

## Problem
The "Group Results" button in the search bar is disabled when there are fewer than 2 non-pinned tabs, regardless of browser. However, Opera and Opera GX require 2+ tabs to create a group, while other browsers (Chrome, Edge, Brave) can group a single tab.

## Current Code
In `src/components/LivePanel.tsx` at line 535:
```typescript
disabled={displayTabs.filter(t => !t.pinned).length < 2}
```

## Solution
Use the existing `needsCompanionTabForSingleTabGroup()` function from `src/utils/browser.ts` to determine browser-specific behavior:

- **Opera/Opera GX**: Require 2+ tabs (disabled when count < 2)
- **Other browsers**: Allow 1 tab (disabled only when count === 0)

## Todo List

- [x] 1. Import `needsCompanionTabForSingleTabGroup` from `../utils/browser` in `LivePanel.tsx`
- [x] 2. Update the disabled logic to check browser capabilities:
  ```typescript
  const nonPinnedCount = displayTabs.filter(t => !t.pinned).length;
  disabled={needsCompanionTabForSingleTabGroup() ? nonPinnedCount < 2 : nonPinnedCount === 0}
  ```
- [ ] 3. Add/update tests in `LivePanel.test.tsx` to verify:
  - Button is disabled for 0 tabs on all browsers
  - Button is disabled for 1 tab on Opera/Opera GX
  - Button is enabled for 1 tab on Chrome/Edge/Brave
  - Button is enabled for 2+ tabs on all browsers

## Files Modified
- `src/components/LivePanel.tsx` - Updated disabled logic

## Notes
- The `needsCompanionTabForSingleTabGroup()` function is already used in `tabService.ts` for similar browser-specific behavior
- This aligns with the existing pattern in the codebase for handling Opera GX restrictions
- All tests pass (TypeScript compilation, LivePanel tests, browser utility tests)
