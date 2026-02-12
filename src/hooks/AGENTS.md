# src/hooks AGENTS.md

## OVERVIEW
React hooks for browser state synchronization and drag-and-drop proximity detection. Bridges Chrome runtime messages to Zustand store updates.

## HOOKS

### useTabSync
Background↔UI synchronization via `chrome.runtime.onMessage`. Maintains operation state to prevent UI "snap-back" during rapid tab operations.

**Key Features:**
- **Operation Tracking**: `pendingOperations` set tracks in-flight moves
- **Debounced Refresh**: `REFRESH_TABS_DEBOUNCE_MS` delay for batching
- **Visibility Handling**: Re-syncs when sidebar becomes visible
- **Timeout Safety**: `OPERATION_TIMEOUT_MS` (5000ms) clears stale operations

**Message Types:**
- `TAB_MOVED` / `GROUP_MOVED`: Clear pending operation, trigger refresh
- `REFRESH_TABS`: Sync live tabs (debounced if `isUpdating`)

### useProximityGap
Expands invisible drop zones between Islands during drag operations. Uses `useDroppable` from @dnd-kit with pointer proximity detection.

**Expansion Logic:**
- Expand Up: `distance < 0 && |distance| < 1rem`
- Expand Down: `0 <= distance < 3rem`
- Horizontal bounds check: `clientX within gapRect`

**Returns:** `{ ref, isOver, expanded }`

## CONVENTIONS
- **Ref Pattern**: Use `useRef` + `useCallback` for DOM refs passed to dnd-kit
- **Cleanup**: Always remove event listeners in `useEffect` return
- **Store Access**: Use `useStore.getState()` inside effects, not selector

## ANTI-PATTERNS
- **Direct chrome.runtime.onMessage**: Use `useTabSync` to ensure proper operation tracking
- **Skipping cleanup**: Memory leaks from pointermove listeners
