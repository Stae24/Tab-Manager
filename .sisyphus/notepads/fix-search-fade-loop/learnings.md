
## Stabilizing Search Mode UI
- **Issue**: Entrance animations (fadeIn) were re-triggering during background syncs because the Search Mode container and results list were being re-mounted.
- **Root Cause**: Conditional rendering blocks without stable keys and a non-referentially-stable `filteredTabs` array caused React to re-mount DOM nodes.
- **Solution**:
    1. Added stable `key="search-mode-header"` and `key="search-results-list"` to the conditional blocks in `Dashboard.tsx`.
    2. Optimized `allTabs` computation to avoid creating new object references for tabs within islands.
    3. Stabilized `filteredTabs` using a `useRef` to store the previous result and performing a property-based comparison to maintain referential stability when the underlying tab data (ID, title, URL, active state) remains the same.
