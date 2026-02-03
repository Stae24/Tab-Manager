# Favicon Final Simplification: Native MV3 Service

## TL;DR

> **Quick Summary**: Simplifies the favicon system by removing the failed "Background Proxy" and switching to a direct usage of the native `_favicon` service. This restores all favicons while maintaining 100% console silence (as the service handles its own fallbacks).
> 
> **Deliverables**:
> - `src/background.ts`: Removed `FETCH_FAVICON` handler.
> - `src/components/Favicon.tsx`: Switched to direct `_favicon` URL rendering.
> - `public/manifest.json`: Kept DNR rules for general reliability.
> 
> **Estimated Effort**: Very Short
> **Parallel Execution**: NO
> **Critical Path**: Update `Favicon.tsx` → Cleanup `background.ts`.

---

## Context

### Original Request
All favicons are currently globes because the background proxy cannot `fetch()` the internal `_favicon` service or remote icons without CORS.

### Research Findings
- **SW Limitation**: Service Workers cannot `fetch()` the `chrome-extension://.../_favicon/` endpoint.
- **CORS Trap**: Remote favicon fetches in the background result in Opaque Responses, making Data URL conversion impossible.
- **Native Solution**: The `_favicon` service URL used directly in an `<img>` tag is silent, secure, and automatically handles fallbacks without console errors.

---

## Work Objectives

### Core Objective
Restore favicon visibility while maintaining console silence by using the native `_favicon` service directly in the UI.

### Concrete Deliverables
- `src/components/Favicon.tsx` (simplified)
- `src/background.ts` (cleaned up)

### Definition of Done
- [x] Actual favicons appear for standard tabs.
- [x] ZERO `net::ERR_FAILED` or CORS errors in the console.
- [x] Globe icon only appears for system pages or absolute failures.
- [x] Background logs are clear of fetch errors.

---

## Success Criteria

### Verification Commands
```bash
npm run build
```

### Final Checklist
- [x] Icons restored.
- [x] Console silent.
- [x] Code simplified.
