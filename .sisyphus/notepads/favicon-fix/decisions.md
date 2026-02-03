# Architectural Decisions - Favicon Resilience

## Tiered Fallback System (2026-02-02)
To handle `net::ERR_FAILED` errors which are common when the browser blocks internal `_favicon` requests or when specific domains have restrictive CORP/COEP headers.

### Strategy
1. **Tier 0 (Internal)**: Use `chrome-extension://${id}/_favicon/`. This is the preferred method as it's local and respects privacy.
2. **Tier 1 (External)**: Fallback to `https://www.google.com/s2/favicons?domain=${hostname}`. This bypasses local browser restrictions but is external.
3. **Tier 2 (Static)**: Fallback to a generic `<Globe />` icon if all network-based attempts fail.

### Implementation
- Managed via a `tier` state (0, 1, 2).
- Automatic reset on prop change.
- `onError` triggers the next tier.
