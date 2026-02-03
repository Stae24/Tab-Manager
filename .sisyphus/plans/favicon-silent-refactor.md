# Favicon Silent Refactor Plan

## TL;DR

> **Quick Summary**: Refactor favicon fetching to use a background-first "Probe-then-Render" pattern. This bypasses CORP/CORS restrictions using `declarativeNetRequest` and keeps the page console silent by only rendering verified Data URLs.
> 
> **Deliverables**:
> - `manifest.json` updates (Permissions & DNR)
> - `public/ruleset.json` (Header stripping rules)
> - `src/background.ts` (Robust async favicon fetcher with protocol validation)
> - `src/components/Favicon.tsx` (Probe-only UI logic)
> 
> **Estimated Effort**: Short (Tiki-Taka)
> **Parallel Execution**: NO - sequential updates required for manifest/rules dependencies.
> **Critical Path**: Manifest/DNR Setup → Background Handler → UI Refactor

---

## Context

### Original Request
The user is experiencing console noise (ERR_FAILED, 403 CORP) and unreliable favicon loading in their Chrome Extension (MV3). They want a silent, reliable refactor.

### Interview Summary
**Key Discussions**:
- **Strategy**: Background-first fetching with base64 conversion.
- **Header Stripping**: Use `declarativeNetRequest` to remove CORP/COEP headers for extension requests.
- **UI Logic**: `Favicon.tsx` will never set a remote `src` directly; it waits for a Data URL from the background.
- **Conflict Prevention**: Ensure `onMessage` in `background.ts` correctly handles multiple async responders using async IIFE pattern.

**Research Findings**:
- `declarativeNetRequest` rules with `modifyHeaders` can effectively strip headers.
- **DNR Limitation**: `initiatorDomains` does NOT support extension IDs. Rules should be scoped by `resourceTypes` and potentially `requestDomains`.
- `fetch` in the service worker bypasses most site-level CSP/CORS if `host_permissions` are present.
- `chrome-extension://ID/_favicon/` is prone to `ERR_FAILED` if not already in Chrome's internal cache.

---

## Work Objectives

### Core Objective
Implement a "Silent Proxy" favicon system where the background script probes URLs and strips restrictive headers, returning only valid Data URLs to the UI.

### Concrete Deliverables
- `public/manifest.json`: Updated permissions and DNR declaration.
- `public/ruleset.json`: Rule to strip `Cross-Origin-Resource-Policy` and `Cross-Origin-Embedder-Policy`.
- `src/background.ts`: Refactored message listener with protocol validation and async-safe handling.
- `src/components/Favicon.tsx`: Refactored to show placeholders during background probes.

### Definition of Done
- [x] No `net::ERR_FAILED` or `403 Forbidden` logs in the **extension dashboard console**.
- [x] Favicons load for sites previously blocked by CORP (e.g., haxnode.net).
- [x] Internal protocols (chrome://, etc.) correctly show the `Globe` icon without attempting a fetch in either UI or background.

### Must Have
- `declarativeNetRequest` and `declarativeNetRequestFeedback` permissions.
- Async-safe `onMessage` handling (async IIFE wrapper).
- Protocol validation in **both** UI and Background.
- `Globe` fallback for all failed or restricted loads.

### Must NOT Have (Guardrails)
- NO direct remote URLs in `<img> src` (except verified `data:` URLs).
- NO use of `initiatorDomains` in DNR rules (not supported for extensions).
- NO use of `finally` blocks for `sendResponse` (prevents double-call errors).

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: Manual-only (Visual verification in browser is paramount for console noise detection).

### Automated Verification (Agent-Executable)

**For UI changes** (using playwright skill):
1. Load extension in Playwright.
2. Open the dashboard/popup.
3. Check for console errors using page.on('console').
4. Assert: No "net::ERR_" or "403" errors appear in the page console.

---

## Execution Strategy

### Wave 1 (Sequential)
1. Update `manifest.json`.
2. Create `ruleset.json`.
3. Refactor `background.ts`.
4. Refactor `Favicon.tsx`.

---

## TODOs

- [x] 1. Update Manifest & Ruleset
  
  **What to do**:
  - Add `declarativeNetRequest` and `declarativeNetRequestFeedback` to `manifest.json`.
  - Add `declarative_net_request` block to `manifest.json` pointing to `ruleset.json`.
  - Create `public/ruleset.json` with a rule to strip CORP/COEP headers.
  - **DNR Rule**:
    - `action.type`: "modifyHeaders"
    - `responseHeaders`: remove "Cross-Origin-Resource-Policy" and "Cross-Origin-Embedder-Policy".
    - `condition.resourceTypes`: ["xmlhttprequest", "image"].
    - `condition.urlFilter`: "*".
  
  **Acceptance Criteria**:
  - [x] `manifest.json` contains `declarativeNetRequest`.
  - [x] `public/ruleset.json` exists with valid JSON (NO `initiatorDomains`).
  - [x] Extension loads without manifest errors.

- [x] 2. Refactor Background Script
  
  **What to do**:
  - Implement `FETCH_FAVICON` handler inside an async IIFE wrapper.
  - **Protocol Validation**: Use the same logic as `Favicon.tsx` to skip `chrome://`, `view-source:`, etc.
  - Use `fetch` and convert to Base64 Data URL.
  - Ensure `sendResponse` is called exactly once in `try` and once in `catch`.
  
  **Acceptance Criteria**:
  - [x] `FETCH_FAVICON` successfully returns Data URLs.
  - [x] Background script rejects internal protocols silently.
  - [x] No "Message port closed" errors in background.

- [x] 3. Refactor Favicon Component
  
  **What to do**:
  - Remove all logic that sets `displaySrc` to a remote URL.
  - Update `useEffect` to trigger a background fetch immediately if a URL is provided.
  - Show `Globe` icon while `loading` or on `error`.
  - Only update `displaySrc` when background returns a `data:` URL.
  
  **Acceptance Criteria**:
  - [x] Component correctly shows `Globe` while fetching.
  - [x] Component updates to favicon image once background probe succeeds.
  - [x] Page console remains silent during the entire process.

---

## Success Criteria

### Final Checklist
- [x] No network errors in page console for favicon loads.
- [x] Favicons load reliably for CORP-restricted sites.
- [x] All requirements met.
