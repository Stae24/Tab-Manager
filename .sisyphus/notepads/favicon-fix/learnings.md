- Fixed Favicon component to use tiered fallback: src -> _favicon -> Globe.
- Implemented system URL scheme filtering in getFaviconUrl to avoid net::ERR_FAILED.
- Added trailing slash cleaning for chrome.runtime.getURL("/_favicon/").
- Ensured error and fallback states are reset when src or url props change.
- Installed @testing-library/react for component testing.
- Fixed accessibility issue in tests where img with alt="" is assigned role "presentation" instead of "img".
## 2026-02-02 Task: Fix Favicon.tsx Fallback Logic
- Implemented tiered fallback chain: src -> _favicon service -> Globe icon.
- Added guards for system URL schemes (chrome://, about:, etc.) in getFaviconUrl.
- Fixed _favicon URL construction to handle trailing slashes correctly.
- Added Vitest unit tests in src/components/__tests__/Favicon.test.tsx.
- Installed @testing-library/react and related dependencies for testing.
## 2026-02-02 Task: Add DNR Ruleset for CORP/COEP Header Stripping
- Added declarativeNetRequest and declarativeNetRequestFeedback permissions to manifest.json.
- Added declarative_net_request block with ruleset_1 resource pointing to ruleset.json.
- Created ruleset.json with header modification rules to strip Cross-Origin-Resource-Policy and Cross-Origin-Embedder-Policy headers.
- This enables the "Silent Proxy" background fetching for _favicon service by bypassing CORP/COEP restrictions.
- Build verification passed - manifest JSON is valid.
## 2026-02-02 Task: Implement FETCH_FAVICON Message Handler in background.ts
- Added async FETCH_FAVICON message handler to chrome.runtime.onMessage.addListener.
- Implemented strict protocol validation to filter restricted schemes: chrome://, about:, file:, data:, edge:, opera:, chrome-extension:, view-source:.
- Used async IIFE pattern to handle Chrome extension async message responses properly.
- Implemented fetch + Base64 conversion for favicon images, returning Data URLs.
- Added robust error handling with proper TypeScript typing (unknown error types).
- Ensured sendResponse is called exactly once per request path.
- Build verification passed - no TypeScript compilation errors.
## 2026-02-02 Task: Favicon Silent Refactor
- Completed transition to 'Background Proxy' architecture for 100% console silence.
- Implemented DNR rules in public/ruleset.json to strip CORP/COEP headers.
- Refactored background.ts with FETCH_FAVICON async handler using fetch + Base64 conversion.
- Updated Favicon.tsx to never request remote URLs directly, only safe Data URIs or background probes.
- Verified fix with Vitest tests and confirmed protocol guards for system pages.
## 2026-02-02 Task: Refactor Favicon.tsx for net::ERR_FAILED Resilience
- Implemented a tiered fallback system: Internal Service (Tier 0) -> Google Proxy (Tier 1) -> Globe Icon (Tier 2).
- Replaced `hasError` boolean with `tier` state for granular fallback control.
- Added `useEffect` to reset `tier` to 0 whenever `src` or `url` props change.
- Ensured `new URL(url).hostname` is wrapped in try/catch for safety.
- Bypassed fallback logic for `data:` URIs and restricted protocols.
- Build verification passed.
