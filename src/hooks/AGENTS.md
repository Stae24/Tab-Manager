# src/hooks AGENTS.md

## OVERVIEW
React hooks for browser state synchronization and drag-and-drop proximity detection. Bridges Chrome runtime messages to Zustand store updates.

---

## HOOKS

### useTabSync
Background↔UI synchronization via `chrome.runtime.onMessage`. Prevents UI "snap-back" during rapid tab operations.

**Key Features:**
- **Operation Tracking**: `pendingOperations` set tracks in-flight moves
- **Debounced Refresh**: 200ms delay for batching
- **Visibility Handling**: Re-syncs when sidebar becomes visible
- **Timeout Safety**: 5000ms clears stale operations

**Message Types:**
| Type | Action |
|------|--------|
| `TAB_MOVED` | Clear pending, trigger refresh |
| `GROUP_MOVED` | Clear pending, trigger refresh |
| `REFRESH_TABS` | Sync live tabs (debounced if updating) |

### useProximityGap
Expands invisible drop zones between Islands during drag. Uses `useDroppable` from @dnd-kit.

**Expansion Logic:**
- Expand Up: `distance < 0 && |distance| < 1rem`
- Expand Down: `0 <= distance < 3rem`
- Horizontal bounds check: `clientX within gapRect`

**Returns:** `{ ref, isOver, expanded }`

---

## USAGE

```typescript
// useTabSync - add to top-level component
useTabSync(); // Handles all Chrome runtime sync

// useProximityGap - in droppable gap components
const { ref, isOver, expanded } = useProximityGap(index, isDragging);
```

---

## CONVENTIONS

```typescript
useEffect(() => {
  const listener = (msg) => { /* ... */ };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}, []);
```

| Pattern | Example |
|---------|---------|
| Ref pattern | `useRef` + `useCallback` for dnd-kit refs |
| Cleanup | Always remove listeners in `useEffect` return |
| Store access | `useStore.getState()` inside effects |

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Direct `chrome.runtime.onMessage` | `useTabSync` for operation tracking |
| Skipping cleanup | Memory leaks from `pointermove` listeners |
| Selector in effects | `useStore.getState()` for fresh state |
