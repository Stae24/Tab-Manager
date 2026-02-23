# Opera GX Island Manager - Priority Rankings

**Document Date:** 2026-01-30  
**Purpose:** Comprehensive ranking of all problems and improvements by criticality  
**Based On:** CODE_REVIEW.md, ROADMAP.md, source code analysis

---

## Ranking System

| Priority | Severity | Timeline | Description |
|----------|----------|----------|-------------|
| **P0** | Critical | Fix Immediately | Security vulnerabilities, data loss risks, crashes, type system collapse |
| **P1** | High | Fix This Sprint | Major bugs, significant performance issues, type safety gaps |
| **P2** | Medium | Fix Next 2 Sprints | Code quality, minor performance, maintainability, architecture |
| **P3** | Low | Backlog | Nice-to-haves, refactoring, future improvements, documentation |

---

## P0 (Critical - Fix Immediately)

### P0.1: Duplicate Type Definitions Causing Type Confusion
**File References:** [`src/types.ts`](src/types.ts:1), [`src/types/index.ts`](src/types/index.ts:1)

**Problem:** Two competing type definition files exist with incompatible definitions:

| Feature | `src/types.ts` | `src/types/index.ts` |
|---------|----------------|----------------------|
| `Tab.id` | `number` | `UniversalId` (number \| string) |
| `Island.id` | `number` | `UniversalId` |
| `Tab.index` | Missing | Present |
| `Tab.groupId` | Missing | Present |
| `VaultItem` | Minimal | Comprehensive with `savedAt`, `originalId` |

**Why P0:** Type confusion at runtime leads to silent failures, data corruption in vault operations, and unpredictable behavior when IDs are compared or passed between components using different type definitions.

**Impact:**
- Runtime crashes when components expect `UniversalId` but receive `number`
- Vault data corruption during migrations
- Silent failures in drag-and-drop operations

**Recommended Solution:**
1. Audit all imports to identify which components use each type file
2. Migrate all types from [`src/types.ts`](src/types.ts:1) to [`src/types/index.ts`](src/types/index.ts:1)
3. Update all imports throughout codebase to use canonical types
4. Delete [`src/types.ts`](src/types.ts:1) after verification
5. Add ESLint rule to prevent importing from deprecated path

---

### P0.2: Mixed Import Sources Creating Type Inconsistency
**File References:** [`src/components/Island.tsx:7`](src/components/Island.tsx:7), [`src/components/Dashboard.tsx:33`](src/components/Dashboard.tsx:33)

**Problem:** Components inconsistently import from competing type sources:

```typescript
// Island.tsx - Line 7 (OLD TYPES)
import { Island as IslandType, Tab } from '../types';

// Dashboard.tsx - Line 33 (NEW TYPES)
import { Island as IslandType, Tab as TabType, VaultQuotaInfo } from '../types/index';
```

**Why P0:** Mixed type sources create type coercion errors at runtime. The `Island` component may receive a `Tab` with `id: UniversalId` but treat it as `id: number`, causing ID comparison failures.

**Impact:**
- Type coercion errors in production
- Drag-and-drop failures when IDs don't match
- Potential data loss during vault operations

**Recommended Solution:**
1. Standardize all imports to [`src/types/index.ts`](src/types/index.ts:1)
2. Use find-and-replace to update all import statements
3. Run `tsc --noEmit` to verify type consistency
4. Remove [`src/types.ts`](src/types.ts:1) after all imports migrated

---

### P0.3: Type Mismatch in TabCard Component
**File References:** [`src/components/TabCard.tsx:10-19`](src/components/TabCard.tsx:10)

**Problem:** The `TabCard` component defines its own local `Tab` interface that conflicts with canonical types:

```typescript
// TabCard.tsx - Lines 10-19
interface TabCardProps {
  tab: {
    id: number | string;  // ← Should use UniversalId type
    title: string;
    url: string;
    // ...
  };
}
```

**Why P0:** Local type definition bypasses centralized `UniversalId` type, creating maintenance overhead and potential runtime type mismatches when parent components pass `UniversalId` typed data.

**Impact:**
- Type widening weakens type safety
- Inconsistent ID handling across components
- Future refactoring becomes error-prone

**Recommended Solution:**
1. Remove local `Tab` interface definition
2. Import canonical `Tab` type from [`src/types/index.ts`](src/types/index.ts:1)
3. Update all usages to respect `UniversalId` type

---

### P0.4: Race Condition in syncLiveTabs Flag Check
**File References:** [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** The `isRefreshing` flag check and set are not atomic:

```typescript
// Pattern seen in useStore.ts
if (get().isRefreshing) return;
set({ isRefreshing: true });
// ← Window for race condition between check and set
```

**Why P0:** Multiple rapid calls can pass the check before any set the flag, causing duplicate Chrome API operations, inconsistent state, and potential data corruption during rapid tab operations.

**Impact:**
- Duplicate Chrome API calls causing rate limiting
- Inconsistent UI state during rapid operations
- Potential data corruption during concurrent vault saves

**Recommended Solution:**
1. Use atomic operations via Zustand middleware
2. Implement proper mutex pattern:
   ```typescript
   const withLock = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
     if (get().isRefreshing) return undefined;
     set({ isRefreshing: true });
     try {
       return await fn();
     } finally {
       set({ isRefreshing: false });
     }
   };
   ```

---

### P0.5: Storage Event Race Condition During Active Saves
**File References:** [`src/store/useStore.ts:934-962`](src/store/useStore.ts:934)

**Problem:** The `chrome.storage.onChanged` listener triggers during active saves:

```typescript
// useStore.ts - Lines 934-962
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync') {
    if (changes.vault_meta) {
      if (!useStore.getState().isUpdating) {  // ← Race window
        // Reloads vault during potential save
      }
    }
  }
});
```

**Why P0:** Race window between `isUpdating` check and vault reload can cause data loss or corruption during concurrent saves across multiple extension instances.

**Impact:**
- Data loss when vault is reloaded mid-save
- Stale data overwriting fresh changes
- Inconsistent state across browser windows

**Recommended Solution:**
1. Implement timestamp/version checking:
   ```typescript
   const currentVersion = get().vaultVersion;
   if (changes.vault_meta?.newValue?.version > currentVersion) {
     // Only reload if incoming version is newer
   }
   ```
2. Use compare-and-swap pattern for vault updates
3. Add conflict resolution UI for detected conflicts

---

## P1 (High - Fix This Sprint)

### P1.1: Memory Leak in useProximityGap Hook
**File References:** [`src/components/Dashboard.tsx:36-77`](src/components/Dashboard.tsx:36)

**Problem:** The `useProximityGap` hook adds/removes `pointermove` listeners on every `active` change without proper cleanup verification:

```typescript
useEffect(() => {
  if (!active || !gapRef.current || isDraggingGroup) {
    setExpanded(false);
    return;  // ← Early return without cleanup
  }
  document.addEventListener('pointermove', handlePointerMove);
  return () => {
    document.removeEventListener('pointermove', handlePointerMove);
  };
}, [active, isDraggingGroup]);
```

**Why P1:** Rapid drag operations could create multiple listener registrations before cleanup occurs, causing memory accumulation and degraded performance during extended DnD sessions.

**Impact:**
- Memory accumulation during drag operations
- Degraded performance over time
- Potential browser tab crash on memory-constrained systems

**Recommended Solution:**
1. Use ref to track listener state:
   ```typescript
   const listenerAttached = useRef(false);
   
   useEffect(() => {
     if (!active || !gapRef.current || isDraggingGroup) {
       if (listenerAttached.current) {
         document.removeEventListener('pointermove', handlePointerMove);
         listenerAttached.current = false;
       }
       setExpanded(false);
       return;
     }
     if (!listenerAttached.current) {
       document.addEventListener('pointermove', handlePointerMove);
       listenerAttached.current = true;
     }
   }, [active, isDraggingGroup]);
   ```

---

### P1.2: Missing Error Boundaries
**File References:** [`src/App.tsx`](src/App.tsx:1), [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:1)

**Problem:** No React error boundaries are implemented for:
- Drag-and-drop operation failures
- Chrome storage API failures
- Vault storage corruption recovery

**Why P1:** Unhandled errors in DnD or storage can crash the entire UI, requiring users to reload the extension and potentially losing unsaved work.

**Impact:**
- Complete UI crashes on unhandled errors
- Loss of unsaved vault changes
- Poor user experience requiring extension reload

**Recommended Solution:**
1. Create `ErrorBoundary.tsx` component with recovery options
2. Wrap main App component with error boundary
3. Add DnD-specific error boundary around drag contexts
4. Implement graceful degradation UI

---

### P1.3: Background Script Listener Leak
**File References:** [`src/background.ts:36-55`](src/background.ts:36)

**Problem:** The message listener doesn't remove itself on unload:

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // No cleanup mechanism for listener removal
});
```

**Why P1:** Extension reloads accumulate listeners, causing memory leaks and potential duplicate message handling.

**Impact:**
- Memory leak on extension reload
- Duplicate message handling after updates
- Degraded performance over multiple reloads

**Recommended Solution:**
1. Track listeners in background script
2. Remove listeners in `chrome.runtime.onSuspend`:
   ```typescript
   const messageListener = (message, sender, sendResponse) => { ... };
   chrome.runtime.onMessage.addListener(messageListener);
   
   chrome.runtime.onSuspend.addListener(() => {
     chrome.runtime.onMessage.removeListener(messageListener);
   });
   ```

---

### P1.4: Excessive Re-renders from Non-Selective Subscriptions
**File References:** [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** Zustand store subscriptions aren't selective:

```typescript
// Pattern: Non-selective subscription
const { appearanceSettings } = useStore();  // Re-renders on ANY store change
```

**Why P1:** Components re-render on every store change, causing UI jank and wasted render cycles, especially during rapid tab operations.

**Impact:**
- UI jank during state changes
- Wasted render cycles reducing battery life
- Poor performance on lower-end devices

**Recommended Solution:**
1. Use selector patterns throughout:
   ```typescript
   const appearanceSettings = useStore(state => state.appearanceSettings);
   ```
2. Use multiple selectors for multiple values:
   ```typescript
   const islands = useStore(state => state.islands);
   const vault = useStore(state => state.vault);
   ```

---

### P1.5: No Virtualization for Large Tab Lists
**File References:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:1)

**Problem:** Long tab lists render all items at once without virtualization. With 100+ tabs, the DOM becomes excessively large.

**Why P1:** DOM explosion with many tabs causes severe performance degradation, making the extension unusable for power users with many open tabs.

**Impact:**
- Severe performance degradation with 50+ tabs
- Browser tab unresponsive with 200+ tabs
- Memory usage grows linearly with tab count

**Recommended Solution:**
1. Implement `react-window` or `@tanstack/react-virtual`
2. Render only visible items plus overscan buffer
3. Handle DnD within virtualized lists
4. Test with 500+ tabs

---

### P1.6: UniversalId Type Propagation Inconsistency
**File References:** [`src/components/TabCard.tsx:11`](src/components/TabCard.tsx:11), [`src/components/Island.tsx`](src/components/Island.tsx:1), [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** The `UniversalId` type (number | string) isn't consistently applied:

| File | Issue |
|------|-------|
| TabCard.tsx:11 | Uses `number \| string` directly instead of `UniversalId` |
| Island.tsx | Uses old `number` type from deprecated types.ts |
| useStore.ts | Mixed usage, some places use `number`, others `UniversalId` |

**Why P1:** Inconsistent type propagation leads to type checking gaps and potential runtime failures.

**Impact:**
- Type checking gaps
- Runtime failures on ID comparisons
- Refactoring becomes hazardous

**Recommended Solution:**
1. Export `UniversalId` type from central location
2. Replace all `number \| string` with `UniversalId`
3. Add type-only import where needed
4. Create utility type guards for ID operations

---

### P1.7: Unsafe Type Assertions in Storage Handlers
**File References:** [`src/store/useStore.ts:916`](src/store/useStore.ts:916)

**Problem:** Type assertions without validation:

```typescript
state.setAppearanceSettings(changes.appearanceSettings.newValue as AppearanceSettings);
```

**Why P1:** Storage corruption or API changes could inject invalid data, causing runtime failures.

**Impact:**
- Runtime crashes on corrupted storage data
- Silent failures with invalid settings
- Difficult to debug data issues

**Recommended Solution:**
1. Create type guard functions:
   ```typescript
   function isAppearanceSettings(value: unknown): value is AppearanceSettings {
     return (
       typeof value === 'object' &&
       value !== null &&
       'theme' in value &&
       ['dark', 'light', 'system'].includes((value as any).theme)
     );
   }
   ```
2. Validate before casting, throw or fallback on invalid data

---

### P1.8: Sync Storage Polling Quota Risk
**File References:** [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** Settings sync debounce is only 1 second, which could exceed `chrome.storage.sync` quotas (100KB total, 8KB per item).

**Why P1:** Rapid setting changes could exceed storage quotas, causing sync failures and data loss.

**Impact:**
- Chrome storage quota exhaustion
- Sync failures preventing cross-device consistency
- Data loss when quota exceeded

**Recommended Solution:**
1. Increase debounce to 5+ seconds
2. Implement exponential backoff on quota errors
3. Add quota monitoring and user warnings
4. Consider compression for large settings

---

### P1.9: Inconsistent ID Parsing Edge Cases
**File References:** [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** The `parseNumericId` function uses regex that could fail:

```typescript
const parseNumericId = (id: UniversalId): number => {
  if (typeof id === 'number') return id;
  const match = id.match(/(\d+)$/);  // ← Assumes numeric suffix
  return match ? parseInt(match[1], 10) : 0;  // ← Returns 0 on failure
};
```

**Why P1:** Vault IDs with non-numeric suffixes return `0`, causing conflicts and potential data corruption.

**Impact:**
- ID conflicts when parsing fails
- Wrong tab/group operations
- Data corruption in edge cases

**Recommended Solution:**
1. Add validation and error logging:
   ```typescript
   const parseNumericId = (id: UniversalId): number | null => {
     if (typeof id === 'number') return id;
     const match = id.match(/(\d+)$/);
     if (!match) {
       console.error(`[parseNumericId] Unable to parse ID: ${id}`);
       return null;
     }
     return parseInt(match[1], 10);
   };
   ```
2. Handle null returns in all call sites

---

### P1.10: Dangerous Export Pattern Without URL Revocation
**File References:** [`src/components/Sidebar.tsx:89-94`](src/components/Sidebar.tsx:89)

**Problem:** Export functionality creates blob URLs without cleanup:

```typescript
const blob = new Blob([content], { type: mimeType });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = fileName;
a.click();
// ← Missing URL.revokeObjectURL(url)
```

**Why P1:** Blob URLs accumulate in memory without revocation, causing memory leaks on repeated exports.

**Impact:**
- Memory leak on repeated exports
- Potential browser resource exhaustion
- Poor performance over time

**Recommended Solution:**
1. Revoke object URLs after use:
   ```typescript
   const url = URL.createObjectURL(blob);
   try {
     a.href = url;
     a.download = fileName;
     a.click();
   } finally {
     setTimeout(() => URL.revokeObjectURL(url), 1000);
   }
   ```
2. Consider using `URL.createObjectURL` with `revokeObjectURL` wrapper utility

---

## P2 (Medium - Fix Next 2 Sprints)

### P2.1: Store Monolith - Maintenance Difficulty
**File References:** [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** The store handles ~970 lines of code with multiple concerns:
- UI state (dark mode, divider position)
- Chrome API orchestration
- Vault persistence
- Appearance settings
- Quota management

**Why P2:** Monolithic store creates maintenance difficulty, reduces testability, and increases risk of unintended side effects.

**Impact:**
- Difficult to understand and maintain
- Hard to test individual concerns
- Increased risk of bugs during changes

**Recommended Solution:**
1. Split into focused slices:
   ```
   store/
     uiStore.ts       - UI state
     vaultStore.ts    - Vault operations  
     tabStore.ts      - Live tab sync
     settingsStore.ts - Appearance settings
   ```
2. Use Zustand's slice pattern for composition
3. Create cross-domain actions in separate files

---

### P2.2: No Separation of Concerns - API and UI Mixed
**File References:** [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** Chrome API calls are mixed with UI state logic in the same file.

**Why P2:** Violates single responsibility principle, making testing and maintenance difficult.

**Impact:**
- Difficult to mock for testing
- UI logic intertwined with API logic
- Hard to reason about side effects

**Recommended Solution:**
1. Create service layer:
   ```
   services/
     tabService.ts
     vaultService.ts
     settingsService.ts
   ```
2. Store only calls services, doesn't directly use Chrome API

---

### P2.3: Tight Coupling Between Components and Chrome APIs
**File References:** Multiple components

**Problem:** Components directly call store actions that trigger Chrome APIs:

```typescript
const moveToVault = useStore(state => state.moveToVault);
// This immediately triggers Chrome API calls
```

**Why P2:** Direct coupling makes testing difficult and prevents offline mode or queuing.

**Impact:**
- Hard to test components in isolation
- No ability to queue operations
- No undo/redo capability

**Recommended Solution:**
1. Implement command pattern with queue/undo support
2. Create action creators that return command objects
3. Separate command execution from UI

---

### P2.4: Magic Numbers Throughout Codebase
**File References:** Multiple

**Problem:** Magic numbers without semantic meaning:

| Value | Location | Context |
|-------|----------|---------|
| `2147483647` | chromeApi.ts | Max ID sentinel |
| `6144` | vaultStorage.ts | Storage chunk size |
| `0.80` | useStore.ts | Quota threshold |
| `400` | background.ts | Refresh delay |
| `100` | background.ts | Island creation delay |
| `1 * baseRem` | Dashboard.tsx | Gap detection |

**Why P2:** Magic numbers reduce code readability and increase maintenance burden.

**Impact:**
- Reduced readability
- Risk of inconsistent values
- Difficult to change values globally

**Recommended Solution:**
1. Extract to named constants:
   ```typescript
   export const MAX_SAFE_ID = 2147483647;
   export const CHUNK_SIZE_BYTES = 6144;
   export const QUOTA_WARNING_THRESHOLD = 0.80;
   export const REFRESH_DEBOUNCE_MS = 400;
   export const GAP_EXPAND_THRESHOLD_REM = 1;
   ```

---

### P2.5: Nested Ternaries Reducing Readability
**File References:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:1)

**Problem:** Complex nested ternary operations for conditional rendering.

**Why P2:** Reduces maintainability and increases cognitive load when reading code.

**Impact:**
- Reduced code readability
- Higher cognitive load for developers
- Increased bug risk during modifications

**Recommended Solution:**
1. Replace with early returns
2. Use guard clauses
3. Extract component rendering logic to separate functions

---

### P2.6: Implicit Any Types
**File References:** [`src/components/Dashboard.tsx:36`](src/components/Dashboard.tsx:36), [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** Drag event handlers and store functions lack proper typing:

```typescript
// Dashboard.tsx - Line 36
const useProximityGap = (gapId: string, active: any, ...)  // ← active: any
```

**Why P2:** Loss of type safety leads to runtime errors and reduces IDE autocomplete effectiveness.

**Impact:**
- Loss of type safety
- Reduced IDE autocomplete
- Runtime errors from unexpected types

**Recommended Solution:**
1. Replace all `any` with proper union types or generics
2. Use `unknown` when type is truly unknown, with type guards
3. Enable `noImplicitAny` in tsconfig

---

### P2.7: Drag Overlay Re-renders Causing Frame Drops
**File References:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:1)

**Problem:** The `DragOverlay` re-renders on every frame during drag operations.

**Why P2:** Animation frame drops degrade the drag-and-drop experience.

**Impact:**
- Animation frame drops during drag
- Janky drag experience
- Poor perceived performance

**Recommended Solution:**
1. Memoize overlay content with `React.memo`
2. Use `useMemo` for dragged item rendering
3. Reduce overlay DOM complexity

---

### P2.8: Nullable State Access Without Optional Chaining
**File References:** [`src/components/TabCard.tsx`](src/components/TabCard.tsx:1)

**Problem:** Optional chaining not consistently used for potentially null values.

**Why P2:** Risk of null reference errors in edge cases.

**Impact:**
- Potential null reference errors
- Inconsistent error handling

**Recommended Solution:**
1. Audit all nullable accesses
2. Add optional chaining where appropriate
3. Add null checks with early returns

---

### P2.9: Console Logging in Production Code
**File References:** [`src/store/useStore.ts:925`](src/store/useStore.ts:925)

**Problem:** Debug logging not gated behind environment checks:

```typescript
console.log('[VaultStorage] Migration complete:', migrationResult);
```

**Why P2:** Debug noise in production, potential information leakage.

**Impact:**
- Debug noise in production console
- Potential information leakage
- Performance impact from unnecessary I/O

**Recommended Solution:**
1. Create structured logger utility:
   ```typescript
   // utils/logger.ts
   export const logger = {
     debug: (...args: any[]) => {
       if (process.env.NODE_ENV === 'development') {
         console.log(...args);
       }
     },
     error: (...args: any[]) => console.error(...args),
   };
   ```

---

### P2.10: Generic Constraints Missing
**File References:** [`src/store/useStore.ts`](src/store/useStore.ts:1)

**Problem:** Generic functions lack proper constraints for `LiveItem` vs `VaultItem`.

**Why P2:** Reduced type safety for generic operations.

**Impact:**
- Reduced type safety
- Potential runtime errors

**Recommended Solution:**
1. Add proper generic constraints:
   ```typescript
   function findItem<T extends LiveItem | VaultItem>(items: T[], id: UniversalId): T | undefined
   ```

---

## P3 (Low - Backlog)

### P3.1: Missing Return Type Annotations
**File References:** Multiple

**Problem:** Several functions lack explicit return type annotations, relying on TypeScript inference.

**Why P3:** While not critical, explicit return types improve documentation and catch errors early.

**Impact:**
- Reduced code documentation
- Delayed error detection

**Recommended Solution:**
1. Add explicit return types to all exported functions
2. Enable ESLint rule for explicit return types

---

### P3.2: Missing JSDoc Documentation
**File References:** Most functions

**Problem:** Complex functions lack JSDoc comments explaining parameters and return values.

**Why P3:** Reduces maintainability and onboarding difficulty.

**Impact:**
- Reduced maintainability
- Steeper learning curve for new developers

**Recommended Solution:**
1. Add JSDoc to all exported functions
2. Document component props with `@param` tags
3. Add inline comments for complex DnD logic

---

### P3.3: TODO Comments Missing for Known Issues
**File References:** Multiple

**Problem:** Known issues exist in code but lack `TODO` or `FIXME` markers for tracking.

**Why P3:** Technical debt not tracked, making it easy to forget about known issues.

**Impact:**
- Technical debt not tracked
- Known issues forgotten

**Recommended Solution:**
1. Add structured TODOs with issue references
2. Use TODO format: `// TODO(#123): Description`
3. Consider using tools like `todo-cli` or `leasot`

---

### P3.4: Inconsistent README Documentation
**File References:** Project root

**Problem:** README doesn't reflect current architecture (dual type files, vault system).

**Why P3:** Outdated documentation confuses new contributors.

**Impact:**
- Confusion for new contributors
- Outdated onboarding information

**Recommended Solution:**
1. Update README with current architecture
2. Document vault system
3. Add setup instructions

---

## Testing Gaps

### P2.11: Missing Error Case Tests
**Coverage:**
- Storage quota exceeded scenarios
- Chrome API failures
- Corrupted vault data handling

**Recommended Solution:**
1. Mock Chrome API failures in tests
2. Test quota exceeded handling
3. Test corrupted data recovery

---

### P2.12: Missing Race Condition Tests
**Coverage:**
- Simultaneous drag operations
- Concurrent vault saves
- Rapid tab creation/deletion

**Recommended Solution:**
1. Create async tests with concurrent operations
2. Test lock mechanisms
3. Test state consistency after rapid operations

---

### P2.13: Missing Integration Tests
**Coverage:**
- Full drag-and-drop workflows
- Cross-window sync
- Migration scenarios

**Recommended Solution:**
1. Implement E2E tests with Playwright or Puppeteer
2. Test full user workflows
3. Test cross-tab synchronization

---

### P2.14: Component Test Coverage Gaps

| Component | Status | Priority |
|-----------|--------|----------|
| Dashboard.tsx | ❌ None | Critical |
| Island.tsx | ❌ None | High |
| TabCard.tsx | ❌ None | High |
| Sidebar.tsx | ❌ None | Medium |

**Recommended Solution:**
1. Implement component tests using `@testing-library/react`
2. Add interaction tests for DnD
3. Test component state transitions

---

## Summary by Category

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| Type System | 5 | 2 | 1 | 1 | 9 |
| Security/Data | 0 | 2 | 0 | 0 | 2 |
| Performance | 0 | 3 | 2 | 0 | 5 |
| Memory Leaks | 0 | 3 | 0 | 0 | 3 |
| Race Conditions | 2 | 0 | 0 | 0 | 2 |
| Code Quality | 0 | 0 | 5 | 2 | 7 |
| Architecture | 0 | 0 | 3 | 0 | 3 |
| Testing | 0 | 0 | 4 | 0 | 4 |
| UX/Features | 0 | 0 | 0 | 1 | 1 |
| **Total** | **7** | **10** | **15** | **4** | **36** |

---

## Recommended Sprint Allocation

### Sprint 1: Type System Stabilization (P0)
- Fix duplicate type definitions (P0.1)
- Standardize all imports (P0.2)
- Fix TabCard type mismatch (P0.3)
- Fix race conditions (P0.4, P0.5)

### Sprint 2: Reliability & Performance (P1)
- Fix memory leaks (P1.1, P1.3, P1.10)
- Add error boundaries (P1.2)
- Fix excessive re-renders (P1.4)
- Implement virtualization (P1.5)

### Sprint 3: Code Quality (P2)
- Store monolith refactoring (P2.1, P2.2, P2.3)
- Extract magic numbers (P2.4)
- Add comprehensive tests (P2.11-P2.14)

### Sprint 4: Polish (P2/P3)
- Fix remaining code quality issues
- Add documentation
- Performance monitoring

---

*This document should be reviewed and updated weekly as issues are resolved and new issues are discovered.*
