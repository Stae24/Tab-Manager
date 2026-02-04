# Opera GX Island Manager - Sprints 2-4 Comprehensive Work Plan

**Document Date:** 2026-02-04
**Plan Status:** Ready for Execution
**Based On:** PRIORITY_RANKINGS.md analysis + Codebase research

---

## TL;DR

> **Quick Summary**: This plan addresses Reliability & Performance (Sprint 2), Code Quality refactoring (Sprint 3), and Polish with testing (Sprint 4) for the Opera GX Island Manager Chrome Extension. Sprint 1 Type System Stabilization has been completed successfully - `src/types.ts` was deleted, all components now import from canonical `src/types/index.ts`, and `UniversalId` type is properly propagated.

> **Deliverables**:
> - Sprint 2: Memory leak fixes, error boundaries, Zustand optimizations, React virtualization, type safety improvements
> - Sprint 3: Store refactoring into slices, magic number constants, code readability improvements
> - Sprint 4: Comprehensive test suite, JSDoc documentation, README updates, TODO markers

> **Estimated Effort**: 3 Sprints (~6-8 weeks)
> **Parallel Execution**: YES - Multiple waves per sprint
> **Critical Path**: Sprint 2 → Sprint 3 → Sprint 4

---

## Context

### Sprint 1 Status: ✅ COMPLETED

**Verification Completed**:
- `src/types.ts` has been deleted - only `src/types/index.ts` exists (82 lines, comprehensive types)
- All components now import from `../types/index`:
  - `Island.tsx:7` → `import { Island as IslandType, Tab } from '../types/index'`
  - `TabCard.tsx:10` → `import type { Tab } from '../types/index'`
  - `Dashboard.tsx:35` → `import { Island as IslandType, Tab as TabType, VaultQuotaInfo } from '../types/index'`
  - `QuotaWarningBanner.tsx:3` → `import type { QuotaWarningLevel } from '../types/index'`
- `UniversalId` type (`number | string`) properly defined and exported
- `Tab` interface includes all required fields (`id`, `title`, `url`, `favicon`, `active`, `discarded`, `windowId`, `index`, `groupId`, `muted`, `pinned`, `audible`)
- Store imports types correctly: `useStore.ts:2` → `import { Island, Tab, VaultItem, UniversalId, LiveItem, VaultQuotaInfo, VaultStorageResult } from '../types/index'`

**Sprint 1 COMPLETE** - Type system is now stable and canonical.

---

## Sprint 2: Reliability & Performance (P1 Issues)

### Sprint Objective

Fix high-priority reliability and performance issues including memory leaks, race conditions, excessive re-renders, and missing error boundaries. This sprint focuses on making the extension robust under stress conditions (100+ tabs, rapid operations, concurrent Chrome API calls).

### Sprint Scope

**INCLUDED**:
- P1.1: Memory Leak in useProximityGap Hook
- P1.2: Missing Error Boundaries
- P1.3: Background Script Listener Leak
- P1.4: Excessive Re-renders from Non-Selective Subscriptions
- P1.5: No Virtualization for Large Tab Lists
- P1.6: UniversalId Type Propagation Check (ensure consistency)
- P1.7: Unsafe Type Assertions in Storage Handlers
- P1.8: Sync Storage Polling Quota Risk
- P1.9: Inconsistent ID Parsing Edge Cases
- P1.10: Dangerous Export Pattern Without URL Revocation

**EXCLUDED**:
- Store monolith refactoring (P2.1) → Sprint 3
- Code quality improvements → Sprint 3/4
- Testing infrastructure → Sprint 4

### Work Tasks

- [x] Task 2.1: Fix Memory Leak in useProximityGap Hook

**Agent-Executed QA Scenarios**:
```
Scenario: useProximityGap hook memory leak prevention
  Tool: Bash
  Preconditions: Dev server running
  Steps:
    1. Create test file with 100 rapid active toggles
    2. Run: OPENAI_API_KEY="" bun test src/components/__tests__/useProximityGap.test.ts --run
    3. Check memory: chrome://inspect/#memory → Heap snapshot
    4. Count pointermove listeners before and after test
  Expected Result: No listener accumulation (before == after)
  Evidence: Test output + memory snapshot comparison
```

#### Task 2.2: Add React Error Boundaries
**Priority**: P1.2 (High)
**File**: `src/components/ErrorBoundary.tsx` (NEW)

**Problem**: No React error boundaries for DnD operations, Chrome storage failures, or vault corruption.

**Solution**: Create comprehensive ErrorBoundary component:
```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    // Optionally send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorUI error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`react`, `frontend-ui-ux`]
- **Reference**: `src/App.tsx:1` (App root), `src/components/Dashboard.tsx:1` (main DnD context)

**Acceptance Criteria**:
- [ ] ErrorBoundary component created: `src/components/ErrorBoundary.tsx`
- [ ] DefaultErrorUI with recovery options implemented
- [ ] App.tsx wrapped with ErrorBoundary
- [ ] DnD-specific ErrorBoundary around Drag contexts
- [ ] Tests verify error catching and recovery
- [ ] bun test src/components/__tests__/ErrorBoundary.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: ErrorBoundary catches DnD operation errors
  Tool: Playwright
  Preconditions: Dev server running, ErrorBoundary implemented
  Steps:
    1. Navigate to extension page
    2. Inject synthetic error via Chrome console during DnD
    3. Verify error UI displayed with recovery options
    4. Click "Retry" and verify DnD still functional
  Expected Result: Error caught, UI shown, recovery works
  Evidence: Screenshot of error UI, console shows error caught

Scenario: ErrorBoundary handles storage failures gracefully
  Tool: Playwright
  Preconditions: Dev server running, Chrome storage mocked to fail
  Steps:
    1. Navigate to extension page
    2. Trigger vault save operation
    3. Mock chrome.storage.local.set to throw error
    4. Verify error boundary catches and displays user-friendly message
  Expected Result: User sees recovery UI, not crash
  Evidence: Screenshot of graceful error handling
```

#### Task 2.3: Fix Background Script Listener Leak
**Priority**: P1.3 (High)
**File**: `src/background.ts:29-53`

**Problem**: Message listener doesn't remove itself on unload. Extension reloads accumulate listeners.

**Current Code**:
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // No cleanup mechanism for listener removal
});
```

**Solution**: Track listener and remove on suspend:
```typescript
const messageListener = (message, sender, sendResponse) => {
  if (message.type === 'START_ISLAND_CREATION') {
    islandCreationInProgress = true;
    sendResponse({ success: true });
    return false;
  }
  if (message.type === 'END_ISLAND_CREATION') {
    islandCreationInProgress = false;
    setTimeout(() => notifyUI(), 100);
    sendResponse({ success: true });
    return false;
  }
  if (message.type === 'FREEZE_TAB') {
    chrome.tabs.discard(message.tabId).then((discardedTab) => {
      sendResponse({ success: !!discardedTab });
    }).catch(() => {
      sendResponse({ success: false });
    });
    return true;
  }
};

chrome.runtime.onMessage.addListener(messageListener);

chrome.runtime.onSuspend.addListener(() => {
  chrome.runtime.onMessage.removeListener(messageListener);
});
```

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`chrome-extension`]
- **Reference**: `src/background.ts:29-53` (current listener implementation)

**Acceptance Criteria**:
- [ ] Message listener stored in named function
- [ ] onSuspend listener added to remove message listener
- [ ] Test verifies no listener accumulation after reload
- [ ] bun test src/__tests__/background.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: Background script listener cleanup
  Tool: Bash
  Preconditions: Extension loaded in Chrome
  Steps:
    1. chrome.runtime.onMessage.hasListener(listener) → true
    2. Reload extension (chrome://extensions → reload)
    3. chrome.runtime.onMessage.hasListener(listener) → true (new instance)
    4. Count total listeners before and after 5 reloads
  Expected Result: No listener accumulation (each reload = 1 listener)
  Evidence: Console output showing listener counts
```

#### Task 2.4: Fix Excessive Re-renders from Non-Selective Subscriptions
**Priority**: P1.4 (High)
**File**: Multiple components

**Problem**: Components destructuring entire store without selective subscriptions.

**Current Pattern (BAD)**:
```typescript
const { islands, vault, showVault, setShowVault, ... } = useStore();
// Re-renders on ANY store change
```

**Solution**: Use selective selectors:
```typescript
const islands = useStore(state => state.islands);
const vault = useStore(state => state.vault);
const showVault = useStore(state => state.showVault);
```

**Components to Fix**:
- `Sidebar.tsx:8` - Destructures 10+ values
- `AppearanceSettingsPanel.tsx:35` - Imports entire settings object
- `Dashboard.tsx:32` - Imports parseNumericId and useStore

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`react`, `zustand`]
- **Reference**: `src/store/useStore.ts:1` (store structure)

**Acceptance Criteria**:
- [ ] Sidebar.tsx converted to selective subscriptions
- [ ] AppearanceSettingsPanel.tsx converted to selective subscriptions
- [ ] Dashboard.tsx converted to selective subscriptions
- [ ] React DevTools Profiler shows reduced re-render count
- [ ] bun test src/__tests__/useStore.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: Selective subscriptions reduce re-renders
  Tool: Playwright + React DevTools
  Preconditions: Dev server running, components refactored
  Steps:
    1. Navigate to extension page
    2. Open React DevTools → Components tab
    3. Toggle theme setting (affects only appearance panel)
    4. Count re-renders for Sidebar and Dashboard
  Expected Result: Sidebar re-renders 0 times, Dashboard re-renders 0 times
  Evidence: React DevTools profiler output

Scenario: Settings change doesn't re-render unrelated components
  Tool: Playwright
  Preconditions: Dev server running
  Steps:
    1. Open React DevTools → Profiler
    2. Record session while changing accent color
    3. Check which components committed during update
  Expected Result: Only AppearanceSettingsPanel commits
  Evidence: Profiler timeline screenshot
```

#### Task 2.5: Implement Virtualization for Large Tab Lists
**Priority**: P1.5 (High)
**File**: `src/components/Dashboard.tsx` + new virtual list components

**Problem**: DOM explosion with 100+ tabs causes severe performance degradation.

**Solution**: Implement @tanstack/react-virtual for both panels:

**Installation**:
```bash
npm install @tanstack/react-virtual
```

**Architecture**:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

// For flat tab lists (search mode)
const rowVirtualizer = useVirtualizer({
  count: filteredTabs.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => 48, // TabCard height
  overscan: 10,
});

// For grouped lists (Live/Vault panels)
// Use nested virtualization for islands with tabs
```

**Integration with @dnd-kit**:
- Wrap virtual rows with SortableContext
- Use virtualizer.measureElement for dynamic heights
- Handle cross-panel drags with virtual indices

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`react`, `frontend-ui-ux`, `performance`]
- **Reference**: `src/components/Dashboard.tsx:30-79` (current rendering), PRIORITY_RANKINGS research (virtualization analysis)

**Acceptance Criteria**:
- [ ] @tanstack/react-virtual installed
- [ ] LivePanel virtualized (islands + standalone tabs)
- [ ] VaultPanel virtualized
- [ ] Search mode flattened list virtualized
- [ ] DnD works within virtualized lists
- [ ] Performance test: 500 tabs renders in <100ms
- [ ] bun test src/components/__tests__/virtualization.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: Virtualization handles 500+ tabs without lag
  Tool: Playwright + Performance Panel
  Preconditions: Dev server running, 500 tabs mocked
  Steps:
    1. Navigate to extension page
    2. Open Chrome DevTools → Performance
    3. Record session for 10 seconds
    4. Scroll through entire tab list
    5. Measure FPS during scroll
  Expected Result: FPS stays above 50 during scroll
  Evidence: Performance timeline screenshot, FPS graph

Scenario: Drag and drop works with virtualization
  Tool: Playwright
  Preconditions: 200 tabs virtualized, DnD functional
  Steps:
    1. Drag tab from position 50 to position 100
    2. Verify visual feedback shows correct position
    3. Drop tab and verify reorder completes
  Expected Result: DnD completes without errors
  Evidence: Video/screenshot of DnD operation
```

#### Task 2.6: UniversalId Type Propagation Check
**Priority**: P1.6 (Medium)
**Files**: Multiple components

**Problem**: UniversalId type not consistently applied everywhere.

**Verification Required**:
- Check all ID parameters use `UniversalId` type
- Ensure type guards for ID operations
- Update any remaining `number | string` to `UniversalId`

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`typescript`]
- **Reference**: `src/types/index.ts:1` (UniversalId definition), `src/components/TabCard.tsx:10` (current usage)

**Acceptance Criteria**:
- [ ] Audit all ID-related types and parameters
- [ ] Replace remaining `number | string` with `UniversalId`
- [ ] Add type guards for ID parsing
- [ ] tsc --noEmit passes with no errors
- [ ] bun test src/__tests__/types.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: TypeScript compilation with UniversalId consistency
  Tool: Bash
  Preconditions: All components use UniversalId
  Steps:
    1. Run: npx tsc --noEmit
    2. Check output for type errors
  Expected Result: 0 errors
  Evidence: tsc output showing no errors
```

#### Task 2.7: Add Type Guards for Storage Handlers
**Priority**: P1.7 (High)
**File**: `src/store/useStore.ts`

**Problem**: Type assertions without validation in storage handlers.

**Current Pattern (BAD)**:
```typescript
state.setAppearanceSettings(changes.appearanceSettings.newValue as AppearanceSettings);
```

**Solution**: Add type guards:
```typescript
function isAppearanceSettings(value: unknown): value is AppearanceSettings {
  return (
    typeof value === 'object' &&
    value !== null &&
    'theme' in value &&
    ['dark', 'light', 'system'].includes((value as any).theme)
  );
}

// Usage:
if (isAppearanceSettings(changes.appearanceSettings.newValue)) {
  state.setAppearanceSettings(changes.appearanceSettings.newValue);
}
```

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`typescript`, `testing`]
- **Reference**: `src/store/useStore.ts:900+` (storage handlers)

**Acceptance Criteria**:
- [ ] Type guard created for AppearanceSettings
- [ ] Type guard created for VaultItem validation
- [ ] All storage handlers use type guards
- [ ] Invalid data rejected gracefully
- [ ] bun test src/store/__tests__/typeGuards.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: Invalid storage data rejected with type guards
  Tool: Bash
  Preconditions: Type guards implemented
  Steps:
    1. Inject corrupted storage data via Chrome console
    2. Reload extension
    3. Verify default settings loaded (not crash)
  Expected Result: Graceful fallback to defaults
  Evidence: Console output showing invalid data rejected
```

#### Task 2.8: Fix Sync Storage Polling Quota Risk
**Priority**: P1.8 (High)
**File**: `src/store/useStore.ts`

**Problem**: Settings sync debounce is only 1000ms, risking quota exhaustion.

**Current**: 1000ms debounce
**Solution**: Increase to 5000ms with exponential backoff on quota errors

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`chrome-extension`, `performance`]
- **Reference**: `src/store/useStore.ts:syncSettings` (current debounce)

**Acceptance Criteria**:
- [ ] Debounce increased to 5000ms
- [ ] Exponential backoff implemented for quota errors
- [ ] Quota monitoring added
- [ ] bun test src/store/__tests__/sync.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: Rapid settings changes respect quota limits
  Tool: Bash
  Preconditions: Debounce implemented
  Steps:
    1. Run: Node script that sends 50 rapid settings changes
    2. Monitor chrome.storage.sync quota usage
  Expected Result: Changes batched, quota not exceeded
  Evidence: Chrome storage quota monitor output
```

#### Task 2.9: Fix ID Parsing Edge Cases
**Priority**: P1.9 (High)
**File**: `src/store/useStore.ts`

**Problem**: parseNumericId returns 0 on failure, causing ID conflicts.

**Current**:
```typescript
const parseNumericId = (id: UniversalId): number => {
  if (typeof id === 'number') return id;
  const match = id.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0; // ← Returns 0 on failure!
};
```

**Solution**: Return null and handle gracefully:
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

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`typescript`, `testing`]
- **Reference**: `src/store/useStore.ts:parseNumericId` (current implementation)

**Acceptance Criteria**:
- [ ] parseNumericId returns null on parse failure
- [ ] All call sites handle null returns
- [ ] Error logging added for failed parses
- [ ] bun test src/store/__tests__/parseNumericId.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: parseNumericId handles edge cases
  Tool: Bash
  Preconditions: parseNumericId updated
  Steps:
    1. Test: parseNumericId("vault-item-123") → 123
    2. Test: parseNumericId("no-numeric-suffix") → null (not 0)
    3. Test: parseNumericId(456) → 456
  Expected Result: All cases handled correctly
  Evidence: Test output showing correct results
```

#### Task 2.10: Fix Blob URL Revocation in Export
**Priority**: P1.10 (High)
**File**: `src/components/Sidebar.tsx:88-93`

**Problem**: Export creates blob URLs without cleanup.

**Current**:
```typescript
const blob = new Blob([content], { type: mimeType });
const url = URL.createObjectURL(blob);
a.href = url;
a.download = fileName;
a.click();
// ← Missing URL.revokeObjectURL(url)
```

**Solution**:
```typescript
const blob = new Blob([content], { type: mimeType });
const url = URL.createObjectURL(blob);
try {
  a.href = url;
  a.download = fileName;
  a.click();
} finally {
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`frontend-ui-ux`]
- **Reference**: `src/components/Sidebar.tsx:31-95` (export functionality)

**Acceptance Criteria**:
- [ ] URL.revokeObjectURL called after export
- [ ] Test verifies no memory leak after 100 exports
- [ ] bun test src/components/__tests__/export.test.ts → PASS

**Agent-Executed QA Scenarios**:
```
Scenario: Export functionality memory leak test
  Tool: Playwright + Memory Profiler
  Preconditions: Export functionality updated
  Steps:
    1. Open Chrome DevTools → Memory
    2. Take heap snapshot
    3. Perform 100 exports (JSON, CSV, MD)
    4. Force GC and take another snapshot
    5. Compare blob URL counts
  Expected Result: Blob URL count returns to baseline after GC
  Evidence: Memory comparison screenshot
```

---

## Sprint 3: Code Quality (P2 Issues)

### Sprint Objective

Refactor code quality issues including store monolith, magic numbers, nested ternaries, and implicit any types. This sprint focuses on maintainability and reducing technical debt.

### Sprint Scope

**INCLUDED**:
- P2.1: Store Monolith - Maintenance Difficulty
- P2.2: No Separation of Concerns - API and UI Mixed
- P2.3: Tight Coupling Between Components and Chrome APIs
- P2.4: Magic Numbers Throughout Codebase
- P2.5: Nested Ternaries Reducing Readability
- P2.6: Implicit Any Types
- P2.7: Drag Overlay Re-renders Causing Frame Drops
- P2.8: Nullable State Access Without Optional Chaining
- P2.9: Console Logging in Production Code
- P2.10: Generic Constraints Missing

**EXCLUDED**:
- Testing infrastructure → Sprint 4
- Documentation → Sprint 4

### Work Tasks

#### Task 3.1: Split Store into Slices
**Priority**: P2.1 (Medium)
**File**: `src/store/` refactor

**Problem**: Store handles ~1055 lines with multiple concerns (UI state, Chrome API, vault persistence, settings, quota).

**Solution**: Split into focused slices:
```
store/
├── useStore.ts          # Composed store (exports for components)
├── useTabStore.ts       # Live tab operations
├── useVaultStore.ts     # Vault persistence
├── useUISettings.ts     # UI state (theme, divider, etc.)
└── useAppearanceStore.ts # Appearance settings
```

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`zustand`, `architecture`]
- **Reference**: `src/store/useStore.ts:1` (current structure)

**Acceptance Criteria**:
- [ ] Store split into 4 focused slices
- [ ] useStore.ts composes all slices for backward compatibility
- [ ] Each slice has <300 lines
- [ ] Tests pass for each slice
- [ ] bun test src/store/__tests__/ → PASS

#### Task 3.2: Create Service Layer for Chrome API
**Priority**: P2.2 (Medium)
**File**: `src/services/` (NEW)

**Problem**: Chrome API calls mixed with UI state logic.

**Solution**: Create service layer:
```
services/
├── tabService.ts       # chrome.tabs operations
├── vaultService.ts     # vault persistence operations
├── settingsService.ts  # settings sync operations
└── quotaService.ts    # quota monitoring
```

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`chrome-extension`, `architecture`]
- **Reference**: `src/utils/chromeApi.ts` (existing API wrappers)

**Acceptance Criteria**:
- [ ] Service layer created with 4 services
- [ ] Store actions delegate to services
- [ ] Services are independently testable
- [ ] Mock services work in tests
- [ ] bun test src/services/__tests__/ → PASS

#### Task 3.3: Implement Command Pattern for Actions
**Priority**: P2.3 (Medium)
**File**: `src/store/` + `src/components/`

**Problem**: Components directly call store actions that trigger Chrome APIs (no queuing, no undo).

**Solution**: Implement command pattern:
```typescript
interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
}

class MoveTabCommand implements Command {
  constructor(private tabId: UniversalId, private fromIsland: UniversalId, private toIsland: UniversalId) {}
  async execute() { /* ... */ }
  async undo() { /* ... */ }
}

// In components:
const executeCommand = useStore(state => state.executeCommand);
```

**Recommended Agent Profile**:
- **Category**: `artistry`
- **Skills**: [`architecture`, `zustand`]
- **Reference**: `src/components/Island.tsx:1` (current action usage)

**Acceptance Criteria**:
- [ ] Command interface defined
- [ ] MoveTabCommand implemented with undo
- [ ] Command queue in store
- [ ] Undo/redo UI in Sidebar
- [ ] bun test src/store/__tests__/commands.test.ts → PASS

#### Task 3.4: Extract Magic Numbers to Constants
**Priority**: P2.4 (Medium)
**File**: Multiple files

**Problem**: Magic numbers throughout codebase.

**Solution**: Extract to named constants:
```typescript
// constants.ts
export const MAX_SAFE_ID = 2147483647;
export const CHUNK_SIZE_BYTES = 6144;
export const QUOTA_WARNING_THRESHOLD = 0.80;
export const REFRESH_DEBOUNCE_MS = 400;
export const GAP_EXPAND_THRESHOLD_REM = 1;
export const ISLAND_CREATION_DELAY_MS = 100;
```

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`refactoring`]
- **Reference**: Multiple files (magic numbers locations)

**Acceptance Criteria**:
- [ ] constants.ts created with all magic numbers
- [ ] All usages replaced with constants
- [ ] tsc --noEmit passes
- [ ] bun test src/__tests__/constants.test.ts → PASS

#### Task 3.5: Replace Nested Ternaries with Early Returns
**Priority**: P2.5 (Medium)
**File**: `src/components/Dashboard.tsx`

**Problem**: Complex nested ternary operations reduce readability.

**Solution**: Use early returns and guard clauses.

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`refactoring`, `readability`]
- **Reference**: `src/components/Dashboard.tsx` (nested ternaries)

**Acceptance Criteria**:
- [ ] Dashboard.tsx readability improved
- [ ] Cognitive complexity reduced
- [ ] bun test src/components/__tests__/Dashboard.test.ts → PASS

#### Task 3.6: Fix Implicit Any Types
**Priority**: P2.6 (Medium)
**File**: Multiple files

**Problem**: Drag event handlers and functions use implicit `any`.

**Current**:
```typescript
const useProximityGap = (gapId: string, active: any, ...)
```

**Solution**: Replace with proper types:
```typescript
const useProximityGap = (gapId: string, active: UniqueIdentifier | null, isDraggingGroup?: boolean) => {
```

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`typescript`]
- **Reference**: `src/components/Dashboard.tsx:38`, `src/store/useStore.ts` (any types)

**Acceptance Criteria**:
- [ ] No implicit any types remain
- [ ] tsc --noEmit passes with strict mode
- [ ] IDE autocomplete works correctly
- [ ] bun test → PASS

#### Task 3.7: Memoize Drag Overlay
**Priority**: P2.7 (Medium)
**File**: `src/components/Dashboard.tsx`

**Problem**: DragOverlay re-renders on every frame during drag.

**Solution**: Memoize overlay content with React.memo.

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`react`, `performance`]
- **Reference**: `src/components/Dashboard.tsx` (DragOverlay usage)

**Acceptance Criteria**:
- [ ] DragOverlay content memoized
- [ ] Frame drops eliminated during drag
- [ ] Performance test shows improvement
- [ ] bun test → PASS

#### Task 3.8: Add Optional Chaining for Nullable Access
**Priority**: P2.8 (Medium)
**File**: `src/components/TabCard.tsx` + others

**Problem**: Optional chaining not consistently used.

**Solution**: Audit and add optional chaining where appropriate.

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`typescript`]
- **Reference**: `src/components/TabCard.tsx` (nullable accesses)

**Acceptance Criteria**:
- [ ] All nullable accesses have proper handling
- [ ] No "Cannot read property of undefined" errors
- [ ] tsc --noEmit passes
- [ ] bun test → PASS

#### Task 3.9: Create Structured Logger
**Priority**: P2.9 (Medium)
**File**: `src/utils/logger.ts` (NEW)

**Problem**: Console logging not gated behind environment checks.

**Solution**: Create logger utility:
```typescript
// utils/logger.ts
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },
  warn: (...args: any[]) => console.warn(...args), // Always log warnings
  error: (...args: any[]) => console.error(...args), // Always log errors
};
```

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`utility`]
- **Reference**: `src/store/useStore.ts:925` (current console.log)

**Acceptance Criteria**:
- [ ] Logger utility created
- [ ] All console.log replaced with logger.debug
- [ ] Production has no debug output
- [ ] bun test src/utils/__tests__/logger.test.ts → PASS

#### Task 3.10: Add Generic Constraints
**Priority**: P2.10 (Medium)
**File**: `src/store/useStore.ts`

**Problem**: Generic functions lack proper constraints for LiveItem vs VaultItem.

**Solution**: Add proper generic constraints:
```typescript
function findItem<T extends LiveItem | VaultItem>(items: T[], id: UniversalId): T | undefined {
  return items.find(item => item.id === id);
}
```

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`typescript`]
- **Reference**: `src/store/useStore.ts` (generic functions)

**Acceptance Criteria**:
- [ ] All generic functions have proper constraints
- [ ] Type safety improved for generic operations
- [ ] tsc --noEmit passes
- [ ] bun test → PASS

---

## Sprint 4: Polish (P2/P3 Issues)

### Sprint Objective

Complete testing gaps, add documentation, and polish the codebase for production readiness.

### Sprint Scope

**INCLUDED**:
- P2.11-P2.14: Testing Gaps (Error cases, race conditions, integration, components)
- P3.1: Missing Return Type Annotations
- P3.2: Missing JSDoc Documentation
- P3.3: TODO Comments Missing for Known Issues
- P3.4: Inconsistent README Documentation

**EXCLUDED**:
- Nothing - this is the final polish sprint

### Work Tasks

#### Task 4.1: Add Error Case Tests
**Priority**: P2.11 (Medium)
**Files**: `src/utils/__tests__/`, `src/store/__tests__/`

**Coverage Needed**:
- Storage quota exceeded scenarios
- Chrome API failures
- Corrupted vault data handling

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`testing`, `vitest`]
- **Reference**: `src/utils/__tests__/` (existing test patterns)

**Acceptance Criteria**:
- [ ] Quota exceeded test implemented
- [ ] Chrome API failure test implemented
- [ ] Corrupted data recovery test implemented
- [ ] bun test src/utils/__tests__/errorCases.test.ts → PASS

#### Task 4.2: Add Race Condition Tests
**Priority**: P2.12 (Medium)
**Files**: `src/store/__tests__/`

**Coverage Needed**:
- Simultaneous drag operations
- Concurrent vault saves
- Rapid tab creation/deletion

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`testing`, `async`]
- **Reference**: `src/store/useStore.ts` (async operations)

**Acceptance Criteria**:
- [ ] Concurrent drag test implemented
- [ ] Concurrent vault save test implemented
- [ ] Rapid operation test implemented
- [ ] bun test src/store/__tests__/raceConditions.test.ts → PASS

#### Task 4.3: Add Integration Tests
**Priority**: P2.13 (Medium)
**Files**: `src/__tests__/` (NEW)

**Coverage Needed**:
- Full drag-and-drop workflows
- Cross-window sync
- Migration scenarios

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`testing`, `integration`]
- **Reference**: `src/store/__tests__/useStore.test.ts` (existing patterns)

**Acceptance Criteria**:
- [ ] Full DnD workflow test implemented
- [ ] Cross-tab sync test implemented
- [ ] Migration test implemented
- [ ] bun test src/__tests__/integration.test.ts → PASS

#### Task 4.4: Add Component Tests
**Priority**: P2.14 (Medium)
**Files**: `src/components/__tests__/`

**Coverage Needed**:
- Dashboard.tsx tests
- Island.tsx tests
- TabCard.tsx tests
- Sidebar.tsx tests

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`testing`, `react-testing-library`]
- **Reference**: `src/components/__tests__/` (existing test patterns)

**Acceptance Criteria**:
- [ ] Dashboard component test implemented
- [ ] Island component test implemented
- [ ] TabCard component test implemented
- [ ] Sidebar component test implemented
- [ ] bun test src/components/__tests__/ → PASS

#### Task 4.5: Add Return Type Annotations
**Priority**: P3.1 (Low)
**Files**: Multiple

**Solution**: Add explicit return types to exported functions.

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`typescript`]
- **Reference**: Exported functions in components and utils

**Acceptance Criteria**:
- [ ] All exported functions have return types
- [ ] ESLint rule enabled
- [ ] tsc --noEmit passes
- [ ] bun test → PASS

#### Task 4.6: Add JSDoc Documentation
**Priority**: P3.2 (Low)
**Files**: Multiple

**Solution**: Add JSDoc to all exported functions and complex logic.

**Recommended Agent Profile**:
- **Category**: `writing`
- **Skills**: [`documentation`]
- **Reference**: `src/utils/chromeApi.ts` (complex functions)

**Acceptance Criteria**:
- [ ] All exported functions have JSDoc
- [ ] Complex logic has inline comments
- [ ] DnD logic documented
- [ ] bun test → PASS

#### Task 4.7: Add TODO Comments with Issue References
**Priority**: P3.3 (Low)
**Files**: Multiple

**Solution**: Add structured TODO comments for known issues.

**Format**: `// TODO(#123): Description`

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: [`documentation`]
- **Reference**: Known issues in code comments

**Acceptance Criteria**:
- [ ] All known issues have TODO comments
- [ ] TODO comments reference issue numbers
- [ ] TODO-CLI can parse file
- [ ] bun test → PASS

#### Task 4.8: Update README Documentation
**Priority**: P3.4 (Low)
**File**: `README.md`

**Solution**: Update README with current architecture:
- Dual type files resolved
- Vault system documented
- Setup instructions updated
- Architecture diagram

**Recommended Agent Profile**:
- **Category**: `writing`
- **Skills**: [`documentation`]
- **Reference**: `README.md` (current), `AGENTS.md` (architecture)

**Acceptance Criteria**:
- [ ] README updated with current architecture
- [ ] Vault system documented
- [ ] Setup instructions current
- [ ] Architecture diagram included
- [ ] bun test → PASS

---

## Execution Strategy

### Sprint 2 Timeline

```
Week 1:
├── Tasks 2.1-2.3 (Memory leaks, error boundaries, listener leak) in parallel
└── Task 2.4 (Re-renders) - depends on 2.1-2.3

Week 2:
├── Task 2.5 (Virtualization) - biggest task, starts early
├── Task 2.6-2.10 (Type guards, quota, ID parsing, blob URL) in parallel
└── Task 2.4 (Re-renders) - continues if needed

Week 3:
├── Task 2.5 completion and testing
└── All P1 tasks completed and tested
```

### Sprint 3 Timeline

```
Week 4:
├── Task 3.1 (Store slices) - foundation for other tasks
├── Task 3.2 (Service layer) - can start in parallel
└── Task 3.4 (Magic numbers) - quick win

Week 5:
├── Task 3.3 (Command pattern) - depends on 3.1-3.2
├── Task 3.5-3.10 (Code quality) in parallel
└── All P2 tasks completed
```

### Sprint 4 Timeline

```
Week 6:
├── Tasks 4.1-4.4 (All testing gaps) in parallel
└── Tasks 4.5-4.7 (Documentation) in parallel

Week 7:
├── Task 4.8 (README update)
├── All tests passing
└── Code quality metrics green
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 2.1 | None | 2.4 | 2.2, 2.3, 2.6-2.10 |
| 2.2 | None | None | 2.1, 2.3, 2.4 |
| 2.3 | None | None | 2.1, 2.2, 2.4 |
| 2.4 | 2.1, 2.2, 2.3 | None | 2.5-2.10 |
| 2.5 | None | None | 2.4, 2.6-2.10 |
| 2.6 | None | None | 2.1-2.5, 2.7-2.10 |
| 2.7 | None | None | 2.1-2.6, 2.8-2.10 |
| 2.8 | None | None | 2.1-2.7, 2.9-2.10 |
| 2.9 | None | None | 2.1-2.8, 2.10 |
| 2.10 | None | None | 2.1-2.9 |
| 3.1 | None | 3.2, 3.3 | 3.4, 3.5-3.10 |
| 3.2 | 3.1 | 3.3 | 3.4, 3.5-3.10 |
| 3.3 | 3.1, 3.2 | None | 3.4, 3.5-3.10 |
| 3.4 | None | None | 3.1-3.3, 3.5-3.10 |
| 3.5 | None | None | 3.1-3.4, 3.6-3.10 |
| 3.6 | None | None | 3.1-3.5, 3.7-3.10 |
| 3.7 | None | None | 3.1-3.6, 3.8-3.10 |
| 3.8 | None | None | 3.1-3.7, 3.9-3.10 |
| 3.9 | None | None | 3.1-3.8, 3.10 |
| 3.10 | None | None | 3.1-3.9 |
| 4.1 | None | None | 4.2-4.8 |
| 4.2 | None | None | 4.1, 4.3-4.8 |
| 4.3 | None | None | 4.1-4.2, 4.4-4.8 |
| 4.4 | None | None | 4.1-4.3, 4.5-4.8 |
| 4.5 | None | None | 4.1-4.4, 4.6-4.8 |
| 4.6 | None | None | 4.1-4.5, 4.7-4.8 |
| 4.7 | None | None | 4.1-4.6, 4.8 |
| 4.8 | None | None | 4.1-4.7 |

### Agent Dispatch Summary

| Sprint | Tasks | Recommended Agents |
|--------|-------|-------------------|
| 2 | 2.1-2.3 | delegate_task(category="visual-engineering", load_skills=["react", "frontend-ui-ux", "chrome-extension"]) |
| 2 | 2.4-2.5 | delegate_task(category="visual-engineering", load_skills=["react", "frontend-ui-ux", "performance", "zustand"]) |
| 2 | 2.6-2.10 | delegate_task(category="unspecified-low", load_skills=["typescript", "testing", "chrome-extension"]) |
| 3 | 3.1-3.3 | delegate_task(category="unspecified-high", load_skills=["architecture", "zustand", "chrome-extension"]) |
| 3 | 3.4-3.10 | delegate_task(category="unspecified-low", load_skills=["refactoring", "typescript"]) |
| 4 | 4.1-4.4 | delegate_task(category="unspecified-high", load_skills=["testing", "vitest", "react-testing-library"]) |
| 4 | 4.5-4.8 | delegate_task(category="writing", load_skills=["documentation", "typescript"]) |

---

## Success Criteria

### Sprint 2 Success
- [ ] All P1 memory leaks fixed
- [ ] Error boundaries implemented and tested
- [ ] Zustand subscriptions optimized
- [ ] Virtualization working with 500+ tabs
- [ ] Type safety improved
- [ ] All tests passing
- [ ] Performance metrics green

### Sprint 3 Success
- [ ] Store split into slices
- [ ] Service layer implemented
- [ ] Command pattern working
- [ ] All magic numbers extracted
- [ ] No implicit any types
- [ ] Code quality metrics improved

### Sprint 4 Success
- [ ] Test coverage >80%
- [ ] All exported functions documented
- [ ] README updated
- [ ] All tests passing
- [ ] Production-ready

---

## Verification Commands

### Sprint 2 Verification
```bash
# Run all tests
npm test

# Type check
npx tsc --noEmit

# Performance test
npm run build && npm run test:performance

# Memory leak test
npm run test:memory
```

### Sprint 3 Verification
```bash
# Run tests
npm test

# Type check
npx tsc --noEmit

# ESLint
npm run lint

# Code coverage
npm run test:coverage
```

### Sprint 4 Verification
```bash
# Full test suite
npm test

# Type check
npx tsc --noEmit

# Documentation check
npm run docs:check

# Final build
npm run build
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Virtualization breaks DnD | High | Extensive testing, fallback plan |
| Store refactoring breaks compatibility | Medium | Backward-compatible exports |
| Test coverage takes too long | Low | Prioritize critical paths first |
| Performance regression | Medium | Benchmarks before/after |

---

## Notes

- Sprint 1 completed successfully - type system is stable
- Virtualization is the largest task in Sprint 2 - start early
- Store refactoring in Sprint 3 enables better testing in Sprint 4
- Testing gaps in Sprint 4 require all previous sprints to be complete

---

*This plan is ready for execution. Run `/start-work` to begin Sprint 2.*
