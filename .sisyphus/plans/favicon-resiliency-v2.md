# Favicon Resiliency: External Proxy First

## TL;DR

> **Quick Summary**: Swaps the favicon fallback order to use a reliable external proxy (Google) as the primary source. This bypasses the buggy/restricted internal `_favicon` service in Opera GX that was causing `net::ERR_FAILED` console noise.
> 
> **Deliverables**:
> - `src/components/Favicon.tsx`: Updated tiered logic (External -> Internal -> Globe).
> 
> **Estimated Effort**: Very Short
> **Parallel Execution**: NO
> **Critical Path**: Update `Favicon.tsx` logic.

---

## Context

### Original Request
User reports `net::ERR_FAILED` for every page despite the previous tiered fallback.

### Diagnosis
- The internal `chrome-extension://ID/_favicon/` service is either not supported or restricted in the user's Opera GX environment.
- Because it was Tier 0, every single tab attempt triggered a network-level failure log in the console before falling back.
- To achieve "Zero Noise," we must use a source that is guaranteed to be network-accessible without triggering internal browser errors.

---

## Work Objectives

### Core Objective
Restore favicon visibility and eliminate console noise by prioritizing a high-availability external proxy.

### Concrete Deliverables
- `src/components/Favicon.tsx` (Refactored)

### Definition of Done
- [x] No `net::ERR_FAILED` logs in the console for standard sites.
- [x] Favicons appear correctly.
- [x] Fallback chain works: Google Proxy -> Internal Service -> Globe.

---

## TODOs

- [x] 1. Refactor Favicon Tiers
  - **What to do**:
    - Swap the tiers in `Favicon.tsx`.
    - **Tier 0**: Google Favicon Proxy (`https://www.google.com/s2/favicons?domain=...`).
    - **Tier 1**: Internal Service (as a backup).
    - **Tier 2**: Globe icon.
    - Add `referrerPolicy="no-referrer"` to the `<img>` tag for extra privacy and to bypass some basic referer-based blocks.
  - **Acceptance Criteria**: Favicons load silently from Google.

---

## Success Criteria

### Verification Commands
```bash
npm run build
```

### Final Checklist
- [x] Console silent.
- [x] Icons visible.
