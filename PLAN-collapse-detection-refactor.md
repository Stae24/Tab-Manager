# Plan: Remove Destructive Runtime Collapse Detection

## Problem
`detectGroupCollapseSupport()` toggles the first group's collapse state during extension load, causing inconsistent UI state on refresh. The first group's collapse state varies randomly across refreshes instead of syncing with the browser.

## Root Cause
In `src/utils/browser.ts`, the `detectGroupCollapseSupport()` function performs a destructive runtime test:
1. Takes the first group from the browser (`groups[0]`)
2. Toggles its collapse state to test API support
3. Only restores if `changeApplied` is true (line 84)
4. If verification fails or errors occur, the first group is left in toggled state

## Solution
Remove the destructive runtime test entirely. Since commit c454f1a added a Brave workaround in `updateTabGroupCollapse()`, all Chromium browsers now work correctly:
- Chrome, Edge, Opera, Brave → All support collapse (Brave uses workaround)
- Firefox → No tab groups API (extension wouldn't work anyway)

Replace runtime detection with browser-vendor-based detection.

---

## Files to Modify

### 1. `src/utils/browser.ts`

**Remove:**
- `collapseDetectionAttempted` variable (line 18)
- Destructive runtime test (lines 64-105)
- `setGroupCollapseSupport()` function (lines 124-134)
- `resetCapabilitiesCache()` - remove `collapseDetectionAttempted = false` line (line 142)

**Rename:**
- `detectGroupCollapseSupport` → `initBrowserCapabilities`

**Simplify to:**
```typescript
export async function initBrowserCapabilities(): Promise<boolean> {
  if (cachedCapabilities !== null) {
    return cachedCapabilities.supportsGroupCollapse ?? true;
  }
  
  const browser = await detectBrowser();
  const supported = browser !== 'firefox';
  
  cachedCapabilities = {
    vendor: browser,
    supportsGroupCollapse: supported,
    supportsSingleTabGroups: browser !== 'opera'
  };
  
  if (browser === 'brave') {
    logger.info('[initBrowserCapabilities] Brave detected - visual refresh workaround enabled');
  }
  
  return supported;
}
```

### 2. `src/services/tabService.ts`

**Remove lines 264-271 in `updateTabGroupCollapse()`:**
```typescript
// DELETE THIS BLOCK - capabilities are now set upfront during init
const cached = getCachedCapabilities();
if (cached !== null && cached.supportsGroupCollapse === null) {
  setGroupCollapseSupport(changeApplied);
  
  if (!changeApplied) {
    logger.warn(`[updateTabGroupCollapse] Browser does not support group collapse API...`);
  }
}
```

**Keep the Brave workaround (lines 249-262) - this is still needed.**

**Update import:**
- Remove `setGroupCollapseSupport` from import
- Keep `getCachedCapabilities`, `needsCompanionTabForSingleTabGroup`, `getBrowserCapabilities`

### 3. `src/store/slices/useTabSlice.ts`

**Update import:**
```typescript
// Change:
import { detectGroupCollapseSupport } from '../../utils/browser';
// To:
import { initBrowserCapabilities } from '../../utils/browser';
```

**Rename function and simplify:**
```typescript
// Rename:
detectCollapseSupport: async () => {
// To:
initBrowserCapabilities: async () => {
```

```typescript
// Simplify implementation (no try/catch needed anymore):
initBrowserCapabilities: async () => {
  const { supportsGroupCollapse } = get();
  if (supportsGroupCollapse !== null) return;

  const supported = await initBrowserCapabilities();
  set({ supportsGroupCollapse: supported });
  
  if (supported) {
    logger.info('[initBrowserCapabilities] Browser supports group collapse');
  } else {
    logger.info('[initBrowserCapabilities] Browser does NOT support group collapse');
  }
},
```

**Update type interface (line 27):**
```typescript
// Change:
detectCollapseSupport: () => Promise<void>;
// To:
initBrowserCapabilities: () => Promise<void>;
```

### 4. `src/store/useStore.ts`

**Update line 126:**
```typescript
// Change:
await state.detectCollapseSupport();
// To:
await state.initBrowserCapabilities();
```

### 5. `src/services/__tests__/tabService.test.ts`

**Update mock (around line 64):**
- Remove `setGroupCollapseSupport` mock
- Add `initBrowserCapabilities` mock if needed

---

## No Changes Needed
- `src/components/Island.tsx` - already uses `supportsGroupCollapse !== false`
- `src/types/index.ts` - no changes

---

## Verification
After changes:
1. Extension loads without modifying any group's collapse state
2. First group's collapse state correctly reflects browser state on refresh
3. Brave still gets the dummy-tab workaround on collapse toggle
4. All tests pass

## Commands
```bash
npm run test     # Run tests
npm run build    # Verify build
```
