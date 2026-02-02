# Favicon Fix: Resolve net::ERR_FAILED and Fallback Logic

## TL;DR

> **Quick Summary**: Fixes "net::ERR_FAILED" for favicons by correctly implementing a fallback chain in the `Favicon` component: using Chrome's cached `favIconUrl` first, falling back to the `_favicon` service, and finally using a Globe icon.
> 
> **Deliverables**:
> - Optimized `Favicon.tsx` component with robust error handling and fallback logic.
> 
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential fix in a single file.
> **Critical Path**: Update `Favicon.tsx` → Verify in extension.

---

## Context

### Original Request
The user reported that all favicons are using the fallback icon and failing with "net::ERR_FAILED" in the console.

### Interview Summary
**Key Discussions**:
- Recent changes introduced a `Favicon` component that uses the `_favicon` service.
- The component currently ignores the `src` prop (`tab.favIconUrl`) provided by `TabCard.tsx`.
- The `_favicon` service URL construction might be slightly off (trailing slash issues).

**Research Findings**:
- `manifest.json` has correct `favicon` permission and `web_accessible_resources`.
- `Favicon.tsx` destructures `url` but not `src`, bypassing the most reliable source of icons.
- `net::ERR_FAILED` is likely caused by attempting to use `_favicon` on invalid URLs (chrome://, about:blank) or malformed service URLs.

### Metis Review
**Identified Gaps** (addressed):
- **Missing `src` usage**: Confirmed that `Favicon.tsx` ignores the `src` prop.
- **Edge cases**: `chrome://`, `file://`, and `about:` URLs need explicit bypass of the `_favicon` service.
- **Fallback Chain**: Recommended a tiered approach: `src` → `_favicon` → `Globe`.

---

## Work Objectives

### Core Objective
Ensure favicons display correctly using the most reliable source available, with graceful fallbacks.

### Concrete Deliverables
- `src/components/Favicon.tsx` (modified)

### Definition of Done
- [ ] No "net::ERR_FAILED" errors for favicons in the console.
- [ ] Standard tabs (https://...) show their actual favicons.
- [ ] System tabs (chrome://...) show the Globe icon without console errors.
- [ ] Vault items show favicons if available.

### Must Have
- Use of `src` prop (`tab.favIconUrl`) as the primary source.
- Fallback to `_favicon` service for missing `src`.
- Graceful Globe icon fallback on any failure.
- Explicit guards for system URL schemes.

### Must NOT Have (Guardrails)
- NO additional caching/storage for icons.
- NO prefetching logic.
- NO changes to `TabCard.tsx` or `useStore.ts` unless absolutely necessary (current props are sufficient).

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **User wants tests**: YES (Vitest for logic) + Manual (for UI)
- **QA approach**: Vitest unit tests for URL construction + Manual verification in extension context.

### Automated Verification (Agent-Executable)

**Logic Verification (using Vitest):**
\`\`\`bash
# Agent runs:
npm test src/components/__tests__/Favicon.test.tsx
# Assert: URL construction and fallback logic pass.
\`\`\`

**UI Verification (Manual):**
1. Load extension index.html in Opera GX/Chrome.
2. Verify favicons display for standard sites.
3. Verify Globe icon displays for chrome:// pages.
4. Verify no ERR_FAILED in console.

---

## Execution Strategy

### Sequential Steps
1. Update `Favicon.tsx` to include `src` in props and implement fallback logic.
2. Fix `getFaviconUrl` to handle trailing slashes and invalid schemes.
3. Verify in browser.

---

## TODOs

- [x] 1. Fix Favicon.tsx Fallback Logic

  **What to do**:
  - Update component signature to destructure `src`.
  - Update `useEffect` to reset `useFallback` and `error` states when `src` or `url` change.
  - Implement logic to try `src` first.
  - Update `getFaviconUrl` to:
    - Return `undefined` for `chrome://`, `about:`, `file:`, `data:` schemes.
    - Properly clean the base URL from `chrome.runtime.getURL("/_favicon/")` (ensure no trailing slash conflict).
  - Update render logic to:
    - If `!error` and `src` exists, try `src`.
    - On `src` error, set `useFallback(true)` and try `_favicon`.
    - On `_favicon` error or missing URL, show `Globe`.

  **Must NOT do**:
  - Do not change component interface.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component fix with visual feedback requirements.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Expertise in React component logic and styling.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Sequential**
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/components/Favicon.tsx` - Target file.
  - `src/components/TabCard.tsx:133` - Usage site.
  - `public/manifest.json` - Permission reference.

  **Acceptance Criteria**:
  - [ ] `src` prop is used in the first attempt to render the image.
  - [ ] `_favicon` service URL is constructed without trailing slash bugs.
  - [ ] System URLs (chrome://) immediately fall back to Globe icon.
  - [ ] Image `onError` handler triggers fallback to `_favicon` or Globe.
  - [ ] New Vitest test `src/components/__tests__/Favicon.test.tsx` passes.

  **Commit**: YES
  - Message: `fix(ui): implement robust favicon fallback chain and fix net::ERR_FAILED`
  - Files: `src/components/Favicon.tsx`

---

## Success Criteria

### Verification Commands
```bash
# Manual check of console for net::ERR_FAILED
# Visual check of favicons in extension
```

### Final Checklist
- [ ] `src` prop used correctly.
- [ ] `_favicon` fallback implemented.
- [ ] System URL guards added.
- [ ] Console is clean of favicon-related ERR_FAILED.
