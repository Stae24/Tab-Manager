# Opera GX Island Manager — Comprehensive Codebase Analysis

> **Generated:** 2026-02-12  
> **Codebase Size:** ~10,375 lines across 50+ source files (including ~2,974 lines of tests)  
> **Stack:** React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 4 · Zustand 5 · Vitest

---

## Table of Contents

1. [TL;DR](#tldr)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Project Structure](#project-structure)
4. [Key Design Patterns](#key-design-patterns)
5. [Strengths](#strengths)
6. [Areas for Improvement](#areas-for-improvement)
7. [Security Considerations](#security-considerations)
8. [Prioritized Recommendations](#prioritized-recommendations)

---

## TL;DR

Opera GX Island Manager is a **Chrome Manifest V3 extension** that provides tactical tab management through a dual-panel UI: a **Live Workspace** (real-time browser tabs) and a **Neural Vault** (persistent tab archive). The extension features optimistic drag-and-drop reordering via `@dnd-kit`, a Zustand-based state engine with slice architecture, LZ-string compressed chunked storage for cross-device sync, and a Command pattern for undo/redo operations. The codebase is well-structured with strong type safety, comprehensive error handling, and ~2,974 lines of test coverage. Key areas for improvement include reducing the 1,572-line `Dashboard.tsx` monolith, removing leftover debug statements in production code, and addressing empty catch blocks in the Command pattern.

---

## Architecture & Tech Stack

### Runtime Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
│                                                         │
│  ┌──────────────┐    messages     ┌──────────────────┐  │
│  │  background   │◄──────────────►│   UI (React)     │  │
│  │  service      │                │                  │  │
│  │  worker       │  chrome.tabs   │  ┌────────────┐  │  │
│  │              ├───events───────►│  │ useTabSync │  │  │
│  └──────────────┘                │  └─────┬──────┘  │  │
│                                  │        │         │  │
│  ┌──────────────┐                │  ┌─────▼──────┐  │  │
│  │ chrome.      │◄───────────────│  │  Zustand   │  │  │
│  │ storage.sync │  chunked       │  │  Store     │  │  │
│  │ storage.local│  vault data    │  │  (5 slices)│  │  │
│  └──────────────┘                │  └────────────┘  │  │
│                                  └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2.3 | UI framework |
| `zustand` | ^5.0.9 | State management (slice-based) |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop orchestration |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable list primitives |
| `@tanstack/react-virtual` | ^3.13.18 | Virtualized list rendering |
| `lz-string` | ^1.5.0 | LZ compression for vault sync |
| `lucide-react` | ^0.562.0 | Icon library |
| `clsx` + `tailwind-merge` | latest | Conditional class composition |

### Build Configuration

- **Vite 7** with dual entry points: `index.html` (UI) and `src/background.ts` (service worker)
- **TypeScript** in strict mode with `bundler` module resolution
- **Tailwind CSS 4** with PostCSS, dark mode via `class` strategy
- **Vitest** with jsdom environment and global test setup

---

## Project Structure

```
.
├── public/
│   ├── manifest.json          # MV3 manifest (tabs, tabGroups, storage, sidePanel)
│   └── icons/                 # Extension icons (16, 48, 128)
├── src/
│   ├── main.tsx               # React entry point (StrictMode)
│   ├── App.tsx                # Root component (useTabSync + ErrorBoundary)
│   ├── background.ts          # Service worker (event listeners, island creation lock)
│   ├── constants.ts           # 53 named constants (quotas, timings, UI bounds)
│   ├── index.css              # Tailwind imports + custom animations
│   │
│   ├── types/
│   │   └── index.ts           # Core domain types (Tab, Island, VaultItem, AppearanceSettings)
│   │
│   ├── store/
│   │   ├── useStore.ts        # Zustand store composition + init() bootstrap
│   │   ├── types.ts           # StoreState = TabSlice & VaultSlice & UISlice & ...
│   │   ├── utils.ts           # Type guards, debounce, sync helpers, defaults
│   │   ├── slices/
│   │   │   ├── useTabSlice.ts       # Live tab state, optimistic moves, dedup, sort
│   │   │   ├── useVaultSlice.ts     # Vault CRUD, quota checks, sync toggle
│   │   │   ├── useUISlice.ts        # Divider, vault visibility, settings panel
│   │   │   ├── useAppearanceSlice.ts # Theme, density, favicon, UI preferences
│   │   │   └── useCommandSlice.ts   # Undo/redo stack (Command pattern)
│   │   └── commands/
│   │       ├── types.ts             # Command interface
│   │       ├── MoveTabCommand.ts    # Tab move with undo
│   │       └── MoveIslandCommand.ts # Group move with undo
│   │
│   ├── services/
│   │   ├── tabService.ts      # Chrome tabs/tabGroups API wrappers with retry
│   │   ├── vaultService.ts    # Chunked vault storage (save, load, migrate, toggle)
│   │   ├── quotaService.ts    # Quota monitoring, orphan cleanup, health reports
│   │   └── settingsService.ts # Settings persistence via chrome.storage.sync
│   │
│   ├── hooks/
│   │   └── useTabSync.ts      # Background ↔ UI message bridge with debounce
│   │
│   ├── components/
│   │   ├── Dashboard.tsx       # Main dual-panel layout (1,572 lines)
│   │   ├── Island.tsx          # Tab group component with context menu
│   │   ├── TabCard.tsx         # Individual tab card with lazy favicon loading
│   │   ├── Sidebar.tsx         # Top toolbar (export, theme, undo/redo)
│   │   ├── Favicon.tsx         # Multi-source favicon with fallback chain
│   │   ├── ContextMenu.tsx     # Portal-based right-click menu
│   │   ├── ErrorBoundary.tsx   # Themed error boundary with retry/reload
│   │   ├── AppearanceSettingsPanel.tsx  # Full settings panel
│   │   ├── QuotaWarningBanner.tsx       # Storage quota warning
│   │   └── QuotaExceededModal.tsx       # Quota exceeded action dialog
│   │
│   ├── contexts/
│   │   └── ScrollContainerContext.tsx  # Shared scroll ref for IntersectionObserver
│   │
│   └── utils/
│       ├── chromeApi.ts        # Re-exports from tabService (facade)
│       ├── vaultStorage.ts     # Re-exports from vaultService/quotaService (facade)
│       ├── logger.ts           # Dev-only logger (debug/info suppressed in prod)
│       └── cn.ts               # Tailwind class merger + color/radius helpers
│
└── tests/
    └── setup.ts               # Chrome API mock for vitest
```

---

## Key Design Patterns

### 1. Chunked Storage with LZ Compression

The vault storage system in [`vaultService.ts`](src/services/vaultService.ts:156) works around Chrome's `sync` storage limits (102,400 bytes total, 8,192 bytes per item) by:

1. **Serializing** vault items to JSON
2. **Compressing** with LZ-string's UTF-16 encoding
3. **Chunking** the compressed string into ~3,500-character segments
4. **Writing** a `vault_meta` key with checksum, chunk count, and chunk keys
5. **Verifying** the write by reading back and recomputing the SHA-256 checksum

```typescript
// From src/services/vaultService.ts:255-262
const meta: VaultMeta = {
  version: STORAGE_VERSION,
  chunkCount: chunks.length,
  chunkKeys,
  checksum,
  timestamp: Date.now(),
  compressed: true
};
```

The system includes automatic **fallback to local storage** when sync quota is exceeded, with a safety margin of 2,048 bytes ([`VAULT_QUOTA_SAFETY_MARGIN_BYTES`](src/constants.ts:11)).

### 2. Command Pattern for Undo/Redo

Tab and island moves are wrapped in [`Command`](src/store/commands/types.ts:1) objects that capture before/after state:

```typescript
// From src/store/commands/types.ts
export interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
  label: string;
}
```

Two concrete implementations exist:
- [`MoveTabCommand`](src/store/commands/MoveTabCommand.ts:14) — captures tab position, group, and window
- [`MoveIslandCommand`](src/store/commands/MoveIslandCommand.ts:12) — captures group position and window

The [`useCommandSlice`](src/store/slices/useCommandSlice.ts:13) maintains dual stacks and triggers `syncLiveTabs()` after undo/redo.

### 3. Optimistic UI Updates with RAF Batching

The [`moveItemOptimistically`](src/store/slices/useTabSlice.ts:140) function uses `requestAnimationFrame` to batch rapid drag events:

```typescript
// From src/store/slices/useTabSlice.ts:140-280
moveItemOptimistically: (() => {
  let pendingId: UniqueIdentifier | null = null;
  let pendingOverId: UniqueIdentifier | null = null;
  let updateScheduled = false;

  return (activeId, overId) => {
    pendingId = activeId;
    pendingOverId = overId;
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(() => { /* ... apply move ... */ });
  };
})(),
```

This closure-based approach coalesces multiple `onDragOver` events into a single state update per frame.

### 4. Zustand Slice Architecture

The store is composed from five independent slices merged at creation:

```typescript
// From src/store/useStore.ts:34-40
export const useStore = create<StoreState>()((...a) => ({
  ...createTabSlice(...a),
  ...createVaultSlice(...a),
  ...createUISlice(...a),
  ...createAppearanceSlice(...a),
  ...createCommandSlice(...a),
}));
```

Each slice is typed with `StateCreator<StoreState, [], [], SliceType>`, enabling cross-slice access via `get()`.

### 5. ID Namespacing Convention

Items are prefixed to distinguish their origin:
- **Live tabs:** `live-tab-{chromeTabId}`
- **Live groups:** `live-group-{chromeGroupId}`
- **Vault items:** `vault-{originalId}-{timestamp}`

The [`parseNumericId`](src/store/utils.ts:22) function extracts Chrome's numeric ID from these prefixed strings, with validation against the 32-bit signed integer limit.

### 6. Service Worker Event Coordination

The [`background.ts`](src/background.ts:1) service worker uses an `islandCreationInProgress` flag to defer `REFRESH_TABS` messages during group creation, preventing UI flicker:

```typescript
// From src/background.ts:43-55
let islandCreationInProgress = false;

function notifyUI() {
  if (islandCreationInProgress) {
    setTimeout(() => {
      if (!islandCreationInProgress) {
        chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {});
      }
    }, ISLAND_CREATION_REFRESH_DELAY_MS);
    return;
  }
  chrome.runtime.sendMessage({ type: 'REFRESH_TABS' }).catch(() => {});
}
```

### 7. Virtualized Rendering

Both panels use `@tanstack/react-virtual` for efficient rendering of large tab lists, with configurable overscan ([`VIRTUAL_ROW_OVERSCAN = 10`](src/constants.ts:40)) and estimated row sizes.

### 8. Multi-Source Favicon with Fallback Chain

The [`Favicon`](src/components/Favicon.tsx:104) component implements a tiered loading strategy:
1. Primary source (configurable: Google, DuckDuckGo, Chrome, icon-horse)
2. Fallback source on error
3. Globe icon placeholder

Combined with `IntersectionObserver`-based lazy loading in [`TabCard`](src/components/TabCard.tsx:81) and data-saver detection.

---

## Strengths

### ✅ Robust Type System
- **Strict TypeScript** with no `any` casts in core logic (only in test setup and one logger line)
- Comprehensive type guards ([`isTab`](src/store/utils.ts:52), [`isIsland`](src/store/utils.ts:68), [`isVaultItem`](src/store/utils.ts:81), [`isAppearanceSettings`](src/store/utils.ts:95)) validate data at storage boundaries
- Union type `UniversalId = number | string` properly handles Chrome's numeric IDs and vault's string IDs

### ✅ Defensive Storage Layer
- SHA-256 checksum verification on vault load and save ([`computeChecksum`](src/services/vaultService.ts:20))
- Automatic fallback from sync → local storage with user notification
- Orphaned chunk cleanup on startup ([`cleanupOrphanedChunks`](src/services/quotaService.ts:113))
- Local backup maintained alongside sync storage
- Quota pre-check before vault writes ([`checkQuotaBeforeSave`](src/store/slices/useVaultSlice.ts:19))

### ✅ Well-Organized Constants
- All magic numbers extracted to [`constants.ts`](src/constants.ts:1) (53 named constants)
- Clear naming convention: `CHROME_SYNC_QUOTA_BYTES`, `VAULT_CHUNK_SIZE`, `DND_ACTIVATION_DISTANCE`
- Separate timing constants for debounce, retry, and animation delays

### ✅ Chrome API Resilience
- [`withRetry`](src/services/tabService.ts:5) wrapper with exponential backoff for transient Chrome API errors
- Specific error message matching for retryable conditions (dragging, moving, editable)
- Graceful degradation when tabs no longer exist

### ✅ Performance Optimizations
- `requestAnimationFrame` batching for drag events
- `React.memo` on `Island` and `TabCard` components
- Virtualized lists with configurable overscan
- `IntersectionObserver`-based lazy favicon loading with priority queuing
- Data-saver mode detection to skip favicon loading
- Reference stabilization for filtered tabs to prevent re-render cascades

### ✅ Comprehensive Test Suite
- **2,974 lines** across 17 test files
- Coverage includes: race conditions, storage consistency, type guards, command pattern, Chrome API wrappers, vault storage, error cases, background worker, DnD scaling, and component rendering
- Proper Chrome API mocking in [`tests/setup.ts`](tests/setup.ts:1)

### ✅ Clean Service Layer Separation
- `tabService` — Chrome tabs/tabGroups operations
- `vaultService` — Chunked storage read/write/migrate
- `quotaService` — Storage monitoring and health
- `settingsService` — Cross-window settings sync

### ✅ Thoughtful UX Details
- Proximity-based droppable gaps ([`useProximityGap`](src/components/Dashboard.tsx:60)) with asymmetric detection zones
- Island creation lock prevents UI flicker during group operations
- Pending operation tracking with timeout-based cleanup ([`useTabSync`](src/hooks/useTabSync.ts:76))
- Context menus rendered via React Portal to escape CSS transforms
- UI scale modifier for DnD coordinates ([`scaleModifier`](src/components/Dashboard.tsx:1186))

---

## Areas for Improvement

### 🔴 Critical

#### 1. Dashboard.tsx is a 1,572-line monolith
**File:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:1)

The `Dashboard.tsx` file contains:
- `LivePanel` component (lines 117–815)
- `VaultPanel` component (lines 817–1040)
- `DragOverlayContent` component (line 1046)
- `Dashboard` orchestrator (lines 1053–1572)
- `useProximityGap` hook (lines 60–111)
- `DroppableGap` component (defined twice — lines 358 and 881)

**Impact:** Difficult to test individual panels, high cognitive load, merge conflicts likely.

**Recommendation:** Extract `LivePanel`, `VaultPanel`, `useProximityGap`, and `DroppableGap` into separate files.

#### 2. Debug Statements Left in Production Code
**File:** [`src/services/vaultService.ts`](src/services/vaultService.ts:160)

```typescript
// Line 160-161
console.error(`[DEBUG] saveVault CALLED: syncEnabled=${config.syncEnabled}, vaultSize=${vault.length}`);
console.trace('[DEBUG] saveVault call stack');
```

Also at lines 386-387 (`migrateFromLegacy`) and 452-453 (`toggleSyncMode`). These `console.error` + `console.trace` calls bypass the logger's dev-only filtering and will appear in production.

**Impact:** Noisy console output for end users, potential performance impact from `console.trace`.

#### 3. Empty Catch Blocks in MoveTabCommand
**File:** [`src/store/commands/MoveTabCommand.ts`](src/store/commands/MoveTabCommand.ts:26)

```typescript
// Lines 26-28
try {
  await chrome.tabs.ungroup(this.params.tabId);
} catch (e) {}
```

Same pattern at line 37. Silently swallowing errors during undo/redo can leave the UI out of sync with Chrome's actual tab state.

### 🟡 Moderate

#### 4. `as any` Cast in settingsService
**File:** [`src/services/settingsService.ts`](src/services/settingsService.ts:10)

```typescript
vaultSyncEnabled: (result.appearanceSettings as any)?.vaultSyncEnabled
```

This bypasses the type system. The `isAppearanceSettings` guard should be used instead.

#### 5. `as any` Cast in Store Init Logging
**File:** [`src/store/useStore.ts`](src/store/useStore.ts:62)

```typescript
storedVaultSyncEnabled: sync.appearanceSettings && isAppearanceSettings(sync.appearanceSettings)
  ? (sync.appearanceSettings as any).vaultSyncEnabled : undefined,
```

After the `isAppearanceSettings` guard passes, the cast is unnecessary — TypeScript should narrow the type.

#### 6. Duplicated `DroppableGap` Component
**File:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:358) and [line 881](src/components/Dashboard.tsx:881)

`DroppableGap` is defined as a nested component inside both `LivePanel` and `VaultPanel` with nearly identical logic. This violates DRY and means bug fixes must be applied twice.

#### 7. Duplicated `getVaultChunkKeys` Function
**Files:** [`src/services/vaultService.ts`](src/services/vaultService.ts:28) and [`src/services/quotaService.ts`](src/services/quotaService.ts:27)

The same function is implemented independently in both services. Changes to chunk key logic must be synchronized manually.

#### 8. Duplicated Render Logic in LivePanel
**File:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:199)

`renderSearchList()` (line 199) and the inline search rendering (line 666) contain nearly identical JSX for search results. The `renderSearchList` function appears to be dead code since the inline version at line 666 is what's actually rendered.

#### 9. No Undo Stack Size Limit
**File:** [`src/store/slices/useCommandSlice.ts`](src/store/slices/useCommandSlice.ts:17)

```typescript
executeCommand: async (command: Command) => {
  await command.execute();
  set((state) => ({
    undoStack: [...state.undoStack, command],
    redoStack: [],
  }));
},
```

The undo stack grows unboundedly. In a long session with many drag operations, this could consume significant memory.

#### 10. Missing `displayName` on Memoized Components
**Files:** [`src/components/Island.tsx`](src/components/Island.tsx:30), [`src/components/TabCard.tsx`](src/components/TabCard.tsx:32)

`React.memo` wrapping anonymous arrow functions makes React DevTools debugging harder. Adding `displayName` or using named function expressions would improve developer experience.

#### 11. Loose Equality in moveItemOptimistically
**File:** [`src/store/slices/useTabSlice.ts`](src/store/slices/useTabSlice.ts:173)

```typescript
const activeInLive = islands.some((i: LiveItem) =>
  i && (i.id == activeIdVal || ('tabs' in i && i.tabs?.some((t: Tab) => t && t.id == activeIdVal)))
);
```

Uses `==` (loose equality) for ID comparison. While the project's AGENTS.md recommends `String(id) === String(otherId)`, this code uses `==` which can produce unexpected coercions between numbers and strings.

### 🟢 Minor

#### 12. `@ts-ignore` in Test Setup
**File:** [`tests/setup.ts`](tests/setup.ts:53)

```typescript
// @ts-ignore
global.chrome = chromeMock as any;
```

Could be replaced with a proper type declaration file for the test environment.

#### 13. Unused `renderSearchList` and `renderLiveList` Functions
**File:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:199)

The `renderSearchList()` and `renderLiveList()` methods defined in `LivePanel` appear to be dead code — the actual rendering happens inline in the JSX return statement (lines 666–811).

#### 14. Missing Error Boundary Around Vault Panel
**File:** [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx:1484)

The `LivePanel` is wrapped in an `ErrorBoundary` (via the `Tactical Interface` boundary), but the `VaultPanel` shares the same boundary. A vault-specific error shouldn't crash the live workspace.

#### 15. `postcss.config.js` Uses Legacy Format
**File:** [`postcss.config.js`](postcss.config.js) — Tailwind CSS 4 uses `@tailwindcss/postcss` but the config may need updating for the v4 plugin API.

---

## Security Considerations

### 1. `<all_urls>` Host Permission
**File:** [`public/manifest.json`](public/manifest.json:8)

```json
"host_permissions": ["<all_urls>"]
```

This grants the extension access to all websites. While needed for favicon access and tab URL reading, it's the broadest possible permission. Consider whether more specific patterns would suffice.

### 2. Clipboard Access Without Permission
**File:** [`src/services/tabService.ts`](src/services/tabService.ts:258)

```typescript
await navigator.clipboard.writeText(tab.url);
```

Uses the Clipboard API directly. This works in extension contexts but could fail silently in certain security contexts. No error handling is present.

### 3. URL Handling in Vault Restore
**File:** [`src/store/slices/useVaultSlice.ts`](src/store/slices/useVaultSlice.ts:389)

```typescript
await chrome.tabs.create({ url: t.url, active: false, index: insertionIndex + newIds.length });
```

Vault items store arbitrary URLs that are later opened via `chrome.tabs.create`. While Chrome itself validates URLs, there's no application-level sanitization of stored URLs before restoration.

### 4. `JSON.parse` on Decompressed Data
**File:** [`src/services/vaultService.ts`](src/services/vaultService.ts:135)

```typescript
parsed = JSON.parse(jsonData) as VaultItem[];
```

The checksum verification before this point mitigates tampering, but the `as VaultItem[]` cast means corrupted-but-valid JSON could bypass type checking. The `isVaultItems` guard should be applied to the parsed result.

### 5. `unlimitedStorage` Permission
**File:** [`public/manifest.json`](public/manifest.json:6)

The `unlimitedStorage` permission is declared but the codebase primarily uses `chrome.storage.sync` (which has hard limits regardless). This permission mainly affects `chrome.storage.local`, which is used as a fallback. Consider documenting why this is needed.

---

## Prioritized Recommendations

### P0 — Fix Before Next Release

| # | Issue | Action | Files |
|---|-------|--------|-------|
| 1 | Debug statements in production | Remove all `console.error('[DEBUG]')` and `console.trace` calls; use `logger` instead | [`vaultService.ts:160-161, 386-387, 452-453`](src/services/vaultService.ts:160) |
| 2 | Empty catch blocks | Add `logger.warn` in catch blocks for `chrome.tabs.ungroup` failures | [`MoveTabCommand.ts:26-28, 37`](src/store/commands/MoveTabCommand.ts:26) |
| 3 | `as any` casts | Replace with proper type narrowing after guards | [`settingsService.ts:10`](src/services/settingsService.ts:10), [`useStore.ts:62`](src/store/useStore.ts:62) |

### P1 — Next Sprint

| # | Issue | Action | Files |
|---|-------|--------|-------|
| 4 | Dashboard monolith | Extract `LivePanel`, `VaultPanel`, `DroppableGap`, `useProximityGap` into separate files | [`Dashboard.tsx`](src/components/Dashboard.tsx:1) |
| 5 | Duplicated `getVaultChunkKeys` | Extract to a shared module (e.g., `src/services/storageKeys.ts`) | [`vaultService.ts:28`](src/services/vaultService.ts:28), [`quotaService.ts:27`](src/services/quotaService.ts:27) |
| 6 | Duplicated `DroppableGap` | Extract to `src/components/DroppableGap.tsx` | [`Dashboard.tsx:358, 881`](src/components/Dashboard.tsx:358) |
| 7 | Dead code cleanup | Remove unused `renderSearchList()` and `renderLiveList()` methods | [`Dashboard.tsx:199, 249`](src/components/Dashboard.tsx:199) |
| 8 | Loose equality | Replace `==` with `String(id) === String(otherId)` per project conventions | [`useTabSlice.ts:173`](src/store/slices/useTabSlice.ts:173) |

### P2 — Backlog

| # | Issue | Action | Files |
|---|-------|--------|-------|
| 9 | Undo stack unbounded | Add a max stack size (e.g., 50) with FIFO eviction | [`useCommandSlice.ts:17`](src/store/slices/useCommandSlice.ts:17) |
| 10 | Vault restore URL validation | Add URL sanitization before `chrome.tabs.create` | [`useVaultSlice.ts:389`](src/store/slices/useVaultSlice.ts:389) |
| 11 | Parsed vault data validation | Apply `isVaultItems` guard after `JSON.parse` in `loadVault` | [`vaultService.ts:135`](src/services/vaultService.ts:135) |
| 12 | Separate error boundaries | Wrap `VaultPanel` in its own `ErrorBoundary` | [`Dashboard.tsx:1484`](src/components/Dashboard.tsx:1484) |
| 13 | Component `displayName` | Add `displayName` to `React.memo` components | [`Island.tsx:30`](src/components/Island.tsx:30), [`TabCard.tsx:32`](src/components/TabCard.tsx:32) |
| 14 | Clipboard error handling | Add try/catch around `navigator.clipboard.writeText` | [`tabService.ts:258`](src/services/tabService.ts:258) |
| 15 | Test setup typing | Create a `chrome.d.ts` declaration file for test mocks | [`tests/setup.ts:53`](tests/setup.ts:53) |
| 16 | Host permissions | Audit whether `<all_urls>` can be narrowed | [`manifest.json:8`](public/manifest.json:8) |

---

*This analysis covers the `src/` directory. The `TidyTabGroups/` legacy directory is excluded per project conventions (frozen/read-only reference).*
