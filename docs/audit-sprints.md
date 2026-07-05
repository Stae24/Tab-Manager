# Codebase Audit — Implementation Sprints

> Generated from a full codebase audit. Each sprint is independent and can be executed in parallel by separate agents. Files modified per sprint are disjoint.

---

## Summary of Findings

### Bugs (Confirmed)
1. **Hotkey matching is broken on Linux** — `matchesHotkey()` in `hotkeys.ts` fails when `ctrl=true, meta=true` bindings are used on Linux (metaKey is always false).
2. **Double message handler** — `SIDEBAR_TOGGLE_WINDOW` is handled both in `setupSidebarMessageListener` AND directly in `background.ts:messageListener`, creating redundant side-panel opens.
3. **Content script hotkeys go stale** — Settings are loaded once at init; `chrome.storage.onChanged` is never registered, so changed hotkey bindings never take effect until page reload.
4. **Optimistic revert uses stale state** — `toggleLiveGroupCollapse` reverts from a captured `islands` snapshot that may be outdated by the time the revert happens.

### Code Quality / Design Issues
5. **3 different URL normalizers** — `vaultService.ts`, `search/utils.ts`, and inline in `useVaultSlice.ts` / `useTabSlice.ts` all implement URL normalization differently, causing inconsistent duplicate detection.
6. **`debounce` uses `any`** — Violates project's no-`any` rule.
7. **Fire-and-forget retries** — `performSync` in `store/utils.ts` retries via `setTimeout` but never tracks/serializes retries, risking stale overwrites.
8. **Unbounded undo stack** — `useCommandSlice.ts` grows `undoStack` array forever with no cap.
9. **Redundant Chrome API calls** — `searchAndExecute` in `engine.ts` calls `getAllTabs`/`getGroups` twice (once in `search()`, again after).
10. **Misleading empty cleanup** — `useProximityGap.ts` second `useEffect` returns a no-op cleanup function with a comment suggesting something should be there.

### Dead Code
11. **`openExtensionTab()`** in `background.ts` — defined but never called (replaced by `sidebarService.openManagerPage()`).
12. **`vaultStorage.ts`** — pure re-export facade with zero production imports (only test imports, which can use `vaultService` directly).
13. **`failing.test.ts`** — intentionally-failing test file that is permanently `.skip`'d; serves no purpose.
14. **`broadcastSidebarState`** in `sidebarService.ts` — deprecated no-op method.

### Duplicated Code
15. **Insertion index calculation** — `restoreFromVault` in `useVaultSlice.ts` duplicates the "find insertion index after last group" logic twice (~30 lines each, lines 369-386 and 398-413).

### Missing Test Coverage (Component tests)
16. Components without tests: `AdvancedTab`, `AppearanceTab`, `BehaviorTab`, `ContextMenu`, `Dashboard` (unit), `IndicatorsTab`, `LayoutTab`, `QuotaWarningBanner`, `SearchResultList`, `TabIndicators`, `VaultSettings`, `VirtualizedLiveList`.

### Test Quality
17. **Heavy `as any` usage in tests** — 150+ instances of `as any` across test files, undermining type safety.
18. **`tests/setup.ts`** uses both `@ts-ignore` and `as any` where one would suffice.

### Build Warning
19. **Main chunk is 530KB** — Vite warns about chunk size; code-splitting could improve load time.

---

## Sprint 1 — Fix Bugs in Hotkeys, Background Message Handler, and Content Script

**Priority:** Critical (user-facing bugs)
**Files modified:** `src/utils/hotkeys.ts`, `src/background.ts`, `src/contentScript.ts`, `src/utils/__tests__/hotkeys.test.ts`, `src/__tests__/background.test.ts`, `src/__tests__/contentScript.test.ts`

### Task 1.1: Fix `matchesHotkey` semantics

**File:** `src/utils/hotkeys.ts`

The current logic:
```ts
const ctrlMatches = (event.ctrlKey || event.metaKey) === (binding.ctrl || binding.meta);
const metaMatches = event.metaKey === binding.meta;
```
is buggy. When `ctrl=true, meta=true` (the defaults), on Linux pressing Ctrl gives `ctrlKey=true, metaKey=false`. `ctrlMatches` = `true === true` ✓, but `metaMatches` = `false === true` ✗. The hotkey fails.

**Fix:** Interpret `ctrl=true && meta=true` as "primary modifier" (Ctrl OR Cmd). When only one is set, match it exclusively. When neither is set, reject if either is pressed.

```ts
export const matchesHotkey = (event: KeyboardEvent, binding: HotkeyBinding): boolean => {
  if (event.code !== binding.code) return false;

  const wantCtrl = binding.ctrl;
  const wantMeta = binding.meta;

  let modMatches: boolean;
  if (wantCtrl && wantMeta) {
    // "Primary modifier" — either Ctrl or Cmd
    modMatches = event.ctrlKey || event.metaKey;
  } else if (wantCtrl) {
    modMatches = event.ctrlKey;
  } else if (wantMeta) {
    modMatches = event.metaKey;
  } else {
    modMatches = !event.ctrlKey && !event.metaKey;
  }

  return modMatches && event.altKey === binding.alt && event.shiftKey === binding.shift;
};
```

**Tests to add:** Linux scenario (ctrlKey=true, metaKey=false with ctrl=true, meta=true binding), Mac scenario (metaKey=true, ctrlKey=false), ctrl-only binding, meta-only binding, no-modifier binding rejects Ctrl press.

### Task 1.2: Remove duplicate `SIDEBAR_TOGGLE_WINDOW` handler from `background.ts`

**File:** `src/background.ts`

Delete the `if (message.type === 'SIDEBAR_TOGGLE_WINDOW')` block (lines 184-198). The `setupSidebarMessageListener` already handles this message type and returns `true` (async response). The duplicate creates a fallback path that can call `sidePanel.open()` a second time if `setupSidebarMessageListener` returns false for some edge case.

**Tests to update:** Verify the `SIDEBAR_TOGGLE_WINDOW` handling test in `background.test.ts` now routes through `setupSidebarMessageListener`.

### Task 1.3: Fix stale hotkeys in content script

**File:** `src/contentScript.ts`

Add a `chrome.storage.onChanged` listener inside `initialize()` that updates `settings.sidebarToggleHotkey` and `settings.managerPageHotkey` when `appearanceSettings` changes in sync storage.

```ts
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.appearanceSettings?.newValue) return;
  const ap = changes.appearanceSettings.newValue;
  if (ap.sidebarToggleHotkey) settings.sidebarToggleHotkey = ap.sidebarToggleHotkey;
  if (ap.managerPageHotkey) settings.managerPageHotkey = ap.managerPageHotkey;
});
```

**Tests to add:** Verify settings update when storage change fires, verify original init still works.

### Verification
```bash
npm run test:fail-only
npm run build
```

---

## Sprint 2 — Fix Optimistic Revert Race & Vault Race Conditions

**Priority:** High (data integrity)
**Files modified:** `src/store/slices/useTabSlice.ts`, `src/store/slices/useVaultSlice.ts`, `src/store/slices/__tests__/useTabSlice.test.ts`, `src/store/slices/__tests__/useVaultSlice.test.ts`

### Task 2.1: Fix `toggleLiveGroupCollapse` stale revert

**File:** `src/store/slices/useTabSlice.ts`

Currently on failure, the revert uses a captured `islands` snapshot. If `islands` changed while the Chrome API call was in flight, this clobbers the new state.

**Fix:** On failure, call `syncLiveTabs()` to re-fetch authoritative state from Chrome, rather than reverting to a stale snapshot:

```ts
if (!success) {
  // Re-sync from Chrome to get authoritative state
  await get().syncLiveTabs();
}
```

Remove the `revertIslands` logic entirely.

**Tests:** Verify that on failure, `syncLiveTabs` is called instead of setting stale islands state.

### Task 2.2: Fix `restoreFromVault` duplicated insertion index calculation

**File:** `src/store/slices/useVaultSlice.ts`

The "find insertion index after last group" block is duplicated at lines ~369-386 and ~398-413. Extract to a helper:

```ts
async function calculateInsertionIndex(): Promise<number> {
  const currentWindowTabs = await tabService.getCurrentWindowTabs();
  const currentWindowGroups = await tabService.getCurrentWindowGroups();

  if (currentWindowGroups.length > 0) {
    const groupsWithIndices = currentWindowGroups.map(g => {
      const groupTabs = currentWindowTabs.filter(t => t.groupId === g.id);
      const maxIndex = groupTabs.length > 0 ? Math.max(...groupTabs.map(t => t.index)) : -1;
      return { ...g, maxIndex };
    }).filter(g => g.maxIndex !== -1);

    if (groupsWithIndices.length > 0) {
      const lastGroup = groupsWithIndices.reduce((prev, current) =>
        current.maxIndex > prev.maxIndex ? current : prev
      );
      return lastGroup.maxIndex + 1;
    }
  }

  return currentWindowTabs.length;
}
```

Replace both inline blocks with `const insertionIndex = await calculateInsertionIndex();`.

### Verification
```bash
npm run test:fail-only
npm run build
```

---

## Sprint 3 — Consolidate URL Normalization

**Priority:** Medium (consistency bug)
**Files modified:** `src/utils/url.ts` (new), `src/store/slices/useVaultSlice.ts` (inline `normalizeUrl` removal), `src/store/slices/useTabSlice.ts` (inline `normalizeUrl` removal), `src/search/utils.ts` (delegate to shared util), `src/utils/__tests__/url.test.ts` (new)

### Task 3.1: Create unified URL normalizer

**New file:** `src/utils/url.ts`

Create a single `normalizeUrlForDedupe(url: string): string` function that:
- Lowercases host
- Removes trailing slashes
- Strips `#fragment`
- Keeps query string (safer: fewer false-positive "duplicates")
- Handles non-parseable URLs gracefully

This replaces the inline `normalizeUrl` in `deleteVaultDuplicates` and the one in `deleteDuplicateTabs`.

Also re-export the existing `search/utils.ts normalizeUrl` as-is for search use, and leave `vaultService.ts normalizeUrl/denormalizeUrl` alone (those are for storage compression, different purpose).

### Task 3.2: Replace inline normalizers

**File:** `src/store/slices/useVaultSlice.ts` — In `deleteVaultDuplicates`, replace the inline `normalizeUrl` function with `import { normalizeUrlForDedupe } from '../../utils/url'`.

**File:** `src/store/slices/useTabSlice.ts` — In `deleteDuplicateTabs`, replace the inline URL normalization logic (lines 219-228) with `normalizeUrlForDedupe`.

### Task 3.3: Add comprehensive tests

**New file:** `src/utils/__tests__/url.test.ts`

Test cases:
- Case normalization (`Example.COM` → `example.com`)
- Trailing slash removal
- Fragment stripping (`#section` removed)
- Query string preserved
- `www.` prefix handling
- Non-parseable URLs returned as-is
- Protocol preserved
- Port numbers preserved
- Tracking parameters (NOT stripped — dedupe should be conservative)

### Verification
```bash
npm run test:fail-only
npm run build
```

---

## Sprint 4 — Clean Up Dead Code & Code Quality

**Priority:** Medium (maintainability)
**Files modified:** `src/background.ts`, `src/utils/vaultStorage.ts` (delete), `src/utils/__tests__/failing.test.ts` (delete), `src/services/sidebarService.ts`, `src/store/utils.ts`, `src/hooks/useProximityGap.ts`, `src/utils/__tests__/vaultStorage.test.ts` (update imports)

### Task 4.1: Remove dead `openExtensionTab()` from `background.ts`

**File:** `src/background.ts`

Delete the `openExtensionTab()` function (lines 22-62). It's fully replaced by `sidebarService.openManagerPage()` and is never called.

### Task 4.2: Delete `vaultStorage.ts` re-export facade

**File:** `src/utils/vaultStorage.ts` — Delete this file. It has zero production imports.

**File:** `src/utils/__tests__/vaultStorage.test.ts` — Update imports to use `vaultService` and `quotaService` directly instead of the deleted facade.

### Task 4.3: Delete `failing.test.ts`

**File:** `src/utils/__tests__/failing.test.ts` — Delete. Permanently-skipped intentionally-failing tests serve no purpose.

### Task 4.4: Remove deprecated `broadcastSidebarState` no-op

**File:** `src/services/sidebarService.ts`

Delete the `broadcastSidebarState` method (line 139-141). It's a no-op with a deprecation comment and no callers.

### Task 4.5: Fix `debounce` typing (remove `any`)

**File:** `src/store/utils.ts`

Change:
```ts
export const debounce = <T extends (...args: any[]) => any>(fn: T, ms = DEBOUNCE_DEFAULT_MS) => {
```
To:
```ts
export const debounce = <T extends (...args: unknown[]) => unknown>(fn: T, ms = DEBOUNCE_DEFAULT_MS) => {
```

### Task 4.6: Remove misleading empty cleanup in `useProximityGap`

**File:** `src/hooks/useProximityGap.ts`

Remove the empty cleanup return at lines 143-146:
```ts
    // Cleanup function
    return () => {
      // Reset cached calculation on unmount or before next effect run
      // Note: we don't reset expanded state here as it's handled by dependencies
    };
```

### Verification
```bash
npm run test:fail-only
npm run build
```

---

## Sprint 5 — Fix Unbounded Undo Stack & Serialized Sync Retries

**Priority:** Medium (resource management)
**Files modified:** `src/store/slices/useCommandSlice.ts`, `src/store/utils.ts`, `src/store/__tests__/commands.test.ts`, `src/store/__tests__/sync.test.ts`

### Task 5.1: Cap the undo/redo stack

**File:** `src/store/slices/useCommandSlice.ts`

Add a constant and apply it:
```ts
const UNDO_STACK_LIMIT = 200;
```

In `executeCommand`:
```ts
set((state: StoreState) => ({
  undoStack: [...state.undoStack, command].slice(-UNDO_STACK_LIMIT),
  redoStack: [],
}));
```

**Tests to add:** Verify stack doesn't exceed 200 entries after 250 commands. Verify oldest commands are evicted first.

### Task 5.2: Serialize and deduplicate settings sync retries

**File:** `src/store/utils.ts`

The current `performSync` retries via fire-and-forget `setTimeout`. This can cause:
- Multiple concurrent retries from different calls
- Stale settings overwriting newer ones

**Fix:** Track the latest settings payload and a single retry timer. On each call, update the latest payload. If a retry is in progress, let it use the latest payload when it fires.

```ts
let pendingRetryTimer: ReturnType<typeof setTimeout> | null = null;
let latestSyncPayload: SyncState | null = null;

export const performSync = async (settings: SyncState, retryCount = 0) => {
  latestSyncPayload = settings;

  try {
    await chrome.storage.sync.set(settings);
    latestSyncPayload = null;
    if (pendingRetryTimer) {
      clearTimeout(pendingRetryTimer);
      pendingRetryTimer = null;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isRetryable = message.includes('QUOTA_EXCEEDED') ||
      message.includes('MAX_WRITE_OPERATIONS') ||
      message.includes('throttled');

    logger.error('SyncSettings', `Failed to sync settings (attempt ${retryCount + 1}):`, error);

    if (retryCount < MAX_SYNC_RETRIES && isRetryable) {
      const delay = INITIAL_SYNC_BACKOFF * Math.pow(2, retryCount);
      if (pendingRetryTimer) clearTimeout(pendingRetryTimer);
      pendingRetryTimer = setTimeout(() => {
        pendingRetryTimer = null;
        if (latestSyncPayload) {
          performSync(latestSyncPayload, retryCount + 1);
        }
      }, delay);
    }
  }
};
```

**Tests to add:** Verify only latest payload is retried. Verify timer is cleared on success.

### Verification
```bash
npm run test:fail-only
npm run build
```

---

## Sprint 6 — Eliminate Redundant Chrome API Calls in Search Engine

**Priority:** Low (performance)
**Files modified:** `src/search/engine.ts`, `src/search/__tests__/engine.test.ts`

### Task 6.1: Return context from `search()` and reuse in `searchAndExecute()`

**File:** `src/search/engine.ts`

Currently `search()` fetches `[getAllTabs, getGroups]` internally. Then `searchAndExecute()` calls `search()` and then fetches `[getAllTabs, getGroups]` again for command execution. This is wasteful and can cause subtle mismatches (tabs may change between the two fetches).

**Fix:** Change `search()` to also return the fetched tabs and context:

```ts
export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: SearchResult[]; parsedQuery: ParsedQuery; tabs: Tab[]; context: SearchContext }> {
  // ... existing logic ...
  return { results: sortedResults, parsedQuery, tabs, context };
}
```

Update `searchAndExecute()` to reuse the `tabs` and `context` from the `search()` result instead of fetching again.

**Tests to update:** Verify `chrome.tabs.query` is only called once during `searchAndExecute()`. Update any test assertions on the `search()` return type.

### Verification
```bash
npm run test:fail-only
npm run build
```

---

## Sprint 7 — Test Quality: Reduce `as any` in Tests

**Priority:** Low (test quality, large scope)
**Files modified:** Test files only (`src/**/__tests__/**/*.ts`, `src/**/__tests__/**/*.tsx`, `tests/setup.ts`)

> **Note:** This sprint is large and can be split into sub-sprints by directory (services tests, store tests, component tests, search tests).

### Task 7.1: Fix `tests/setup.ts`

Replace:
```ts
// @ts-ignore
global.chrome = chromeMock as any;
```
With a properly typed assignment using `unknown`:
```ts
(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
```

### Task 7.2: Create typed mock helpers

Create `tests/helpers.ts` with properly typed mock factories:

```ts
import { Tab, Island, VaultTab, VaultIsland, AppearanceSettings } from '../src/types';

export function createMockTab(overrides?: Partial<Tab>): Tab { ... }
export function createMockIsland(overrides?: Partial<Island>): Island { ... }
export function createMockVaultTab(overrides?: Partial<VaultTab>): VaultTab { ... }
// etc.
```

### Task 7.3: Replace `as any` casts in test files

For each test file, replace `as any` casts with:
- Proper typed mock factories from `tests/helpers.ts`
- `vi.mocked()` for mock function access
- `Partial<T>` spreads where appropriate
- `as unknown as T` only where truly necessary (e.g., testing invalid input)

### Verification
```bash
npm run test:fail-only
npm run build
```

---

## Cross-Sprint Dependencies

```
Sprint 1 ─────────────────────────────── Independent
Sprint 2 ─────────────────────────────── Independent
Sprint 3 ─────────────────────────────── Independent (new file, modifies different lines)
Sprint 4 ─────────────────────────────── Independent
Sprint 5 ─────────────────────────────── Independent
Sprint 6 ─────────────────────────────── Independent
Sprint 7 ─────────────────────────────── Independent (test files only)
```

All sprints can run in parallel. No sprint modifies files touched by another sprint.

---

## Files Modified Per Sprint (Deconfliction Matrix)

| File | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|------|----|----|----|----|----|----|-----|
| `src/utils/hotkeys.ts` | ✓ | | | | | | |
| `src/background.ts` | ✓ | | | ✓ | | | |
| `src/contentScript.ts` | ✓ | | | | | | |
| `src/store/slices/useTabSlice.ts` | | ✓ | ✓ | | | | |
| `src/store/slices/useVaultSlice.ts` | | ✓ | ✓ | | | | |
| `src/utils/url.ts` (new) | | | ✓ | | | | |
| `src/utils/vaultStorage.ts` | | | | ✓ | | | |
| `src/utils/__tests__/failing.test.ts` | | | | ✓ | | | |
| `src/services/sidebarService.ts` | | | | ✓ | | | |
| `src/store/utils.ts` | | | | ✓ | ✓ | | |
| `src/hooks/useProximityGap.ts` | | | | ✓ | | | |
| `src/store/slices/useCommandSlice.ts` | | | | | ✓ | | |
| `src/search/engine.ts` | | | | | | ✓ | |
| Test files (`__tests__/`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### ⚠️ Conflicts to Resolve

**`src/background.ts`** is modified by Sprint 1 (remove SIDEBAR_TOGGLE_WINDOW handler) and Sprint 4 (remove `openExtensionTab()`). These are on different, non-overlapping lines so they can still run in parallel — but if done sequentially, S4 should run after S1.

**`src/store/slices/useTabSlice.ts`** is modified by Sprint 2 (toggleLiveGroupCollapse fix) and Sprint 3 (inline normalizeUrl replacement). These are on different methods so they can run in parallel.

**`src/store/slices/useVaultSlice.ts`** is modified by Sprint 2 (restoreFromVault refactor) and Sprint 3 (inline normalizeUrl replacement). Different methods, can run in parallel.

**`src/store/utils.ts`** is modified by Sprint 4 (debounce typing) and Sprint 5 (performSync retry fix). Different functions, can run in parallel.
