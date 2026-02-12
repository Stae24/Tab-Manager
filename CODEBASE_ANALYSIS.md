# Opera GX Island Manager — Codebase Analysis

**Generated:** 2026-02-12  
**Scope:** Full codebase review of the Opera GX Island Manager Chrome Extension  
**Stack:** React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 4 · Zustand 5 · Vitest

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Project Structure](#3-project-structure)
4. [Key Design Patterns](#4-key-design-patterns)
5. [Strengths](#5-strengths)
6. [Areas for Improvement](#6-areas-for-improvement)
7. [Security Considerations](#7-security-considerations)
8. [Recommendations](#8-recommendations)

---

## 1. Overview

Opera GX Island Manager is a Chrome/Opera extension that provides tactical tab management through a dual-panel UI: a **Live Workspace** (real-time browser tabs) and a **Neural Vault** (persistent saved tabs). The extension runs as a sidebar panel using Manifest V3, with a background service worker coordinating tab lifecycle events and a React-based frontend for all user interactions.

### Core Capabilities

- **Dual-panel layout** — Live Workspace mirrors the browser's current tab state; Neural Vault persists saved tabs across sessions
- **Drag-and-drop orchestration** — Optimistic reordering of tabs and tab groups (Islands) with `@dnd-kit`
- **Vault sync** — Compressed, chunked storage to `chrome.storage.sync` with LZ-String compression, SHA-256 checksums, and automatic local fallback
- **Memory optimization** — Tab freezing (discarding) via the Chrome `tabs.discard` API
- **Undo/Redo** — Command pattern for reversible tab/island move operations
- **Appearance customization** — Extensive theming, density, favicon source, and UI scale settings
- **Export** — JSON, CSV, and Markdown export of workspace state

---

## 2. Architecture & Tech Stack

### Runtime Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Background Service Worker (src/background.ts)          │
│  • Listens to chrome.tabs / chrome.tabGroups events     │
│  • Sends REFRESH_TABS messages to UI                    │
│  • Handles FREEZE_TAB, island creation gating           │
│  • Cleans up orphaned vault chunks on startup           │
└──────────────────────┬──────────────────────────────────┘
                       │ chrome.runtime.onMessage
┌──────────────────────▼──────────────────────────────────┐
│  React UI (sidebar panel / index.html)                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Zustand Store (5 slices)                          │ │
│  │  TabSlice · VaultSlice · UISlice                   │ │
│  │  AppearanceSlice · CommandSlice                    │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Service Layer                                     │ │
│  │  tabService · vaultService · quotaService          │ │
│  │  settingsService                                   │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Components                                        │ │
│  │  Dashboard (DnD context) → LivePanel / VaultPanel  │ │
│  │  Island · TabCard · Sidebar · ErrorBoundary        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Chrome Storage                                         │
│  sync: vault_meta + vault_chunk_* + settings            │
│  local: vault (legacy/fallback) + vault_backup          │
└─────────────────────────────────────────────────────────┘
```

### Technology Choices

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| UI Framework | React | 19.2 | Component rendering with `React.memo` optimization |
| State Management | Zustand | 5.0 | Lightweight store with slice composition |
| Drag & Drop | @dnd-kit/core + sortable | 6.3 / 10.0 | Accessible DnD with sortable lists |
| Virtualization | @tanstack/react-virtual | 3.13 | Efficient rendering of large tab lists |
| Styling | Tailwind CSS | 4.1 | Utility-first CSS with custom Opera GX theme |
| Compression | lz-string | 1.5 | UTF-16 compression for sync storage |
| Icons | lucide-react | 0.562 | Consistent icon set |
| Build | Vite | 7.3 | Fast HMR dev server + production bundling |
| Testing | Vitest + Testing Library | 4.0 / 16.3 | Unit and component testing with jsdom |
| Language | TypeScript | 5.9 | Strict mode, no `any` policy |

### Manifest V3 Permissions

Defined in [`manifest.json`](public/manifest.json):

```
tabs, tabGroups, storage, unlimitedStorage, favicon, sidePanel
```

Plus `<all_urls>` host permission for favicon access and tab manipulation.

---

## 3. Project Structure

```
.
├── public/
│   ├── manifest.json              # MV3 extension manifest
│   └── icons/                     # Extension icons (16/48/128)
├── src/
│   ├── App.tsx                    # Root: ErrorBoundary + Dashboard
│   ├── background.ts             # Service worker: event listeners + message routing
│   ├── constants.ts              # All magic numbers centralized
│   ├── main.tsx                  # React DOM entry point
│   ├── index.css                 # Tailwind directives + custom theme
│   ├── types/
│   │   └── index.ts              # Core domain types (Tab, Island, VaultItem, etc.)
│   ├── store/
│   │   ├── useStore.ts           # Zustand store composition + init + cross-window sync
│   │   ├── types.ts              # Composite StoreState type
│   │   ├── utils.ts              # Type guards, debounce, sync helpers
│   │   ├── slices/
│   │   │   ├── useTabSlice.ts    # Live tab state + optimistic moves
│   │   │   ├── useVaultSlice.ts  # Vault CRUD + quota management
│   │   │   ├── useUISlice.ts     # Layout state (divider, panels)
│   │   │   ├── useAppearanceSlice.ts  # Theme + display settings
│   │   │   └── useCommandSlice.ts     # Undo/redo command stack
│   │   └── commands/
│   │       ├── types.ts          # Command interface
│   │       ├── MoveTabCommand.ts # Reversible tab move
│   │       └── MoveIslandCommand.ts   # Reversible island move
│   ├── services/
│   │   ├── tabService.ts         # Chrome tabs/tabGroups API wrappers with retry
│   │   ├── vaultService.ts       # Chunked sync storage with compression + verification
│   │   ├── quotaService.ts       # Storage quota monitoring + health checks
│   │   └── settingsService.ts    # Settings persistence via chrome.storage.sync
│   ├── hooks/
│   │   └── useTabSync.ts         # Background ↔ UI message bridge
│   ├── components/
│   │   ├── Dashboard.tsx         # Main layout: DnD context, LivePanel, VaultPanel
│   │   ├── Island.tsx            # Tab group component with context menu
│   │   ├── TabCard.tsx           # Individual tab card with lazy favicon loading
│   │   ├── Sidebar.tsx           # Navigation + export + undo/redo controls
│   │   ├── ErrorBoundary.tsx     # Themed crash recovery UI
│   │   ├── Favicon.tsx           # Multi-source favicon resolver
│   │   ├── ContextMenu.tsx       # Right-click context menu
│   │   ├── AppearanceSettingsPanel.tsx  # Full settings panel
│   │   ├── QuotaWarningBanner.tsx      # Storage quota warnings
│   │   └── QuotaExceededModal.tsx      # Quota exceeded action dialog
│   ├── contexts/
│   │   └── ScrollContainerContext.tsx   # Shared scroll ref for intersection observers
│   └── utils/
│       ├── chromeApi.ts          # Re-exports from tabService (facade)
│       ├── vaultStorage.ts       # Re-exports from vaultService + quotaService (facade)
│       ├── cn.ts                 # clsx + tailwind-merge + color/radius helpers
│       └── logger.ts             # Environment-aware logging (dev-only debug/info)
├── tests/
│   └── setup.ts                  # Vitest global setup
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

### Key Architectural Boundaries

| Boundary | Enforced By |
|----------|-------------|
| Chrome API isolation | All calls routed through [`src/services/tabService.ts`](src/services/tabService.ts) with retry logic |
| Storage abstraction | [`src/services/vaultService.ts`](src/services/vaultService.ts) handles chunking, compression, checksums |
| State ↔ UI separation | Zustand slices in [`src/store/slices/`](src/store/slices/) expose actions; components consume via selectors |
| ID namespacing | Live items prefixed `live-tab-*` / `live-group-*`; vault items prefixed `vault-*` |

---

## 4. Key Design Patterns

### 4.1 Slice-Based State Composition

The Zustand store in [`useStore.ts`](src/store/useStore.ts:34) composes five independent slices using `StateCreator`:

```typescript
export const useStore = create<StoreState>()((...a) => ({
  ...createTabSlice(...a),
  ...createVaultSlice(...a),
  ...createUISlice(...a),
  ...createAppearanceSlice(...a),
  ...createCommandSlice(...a),
}));
```

Each slice ([`useTabSlice.ts`](src/store/slices/useTabSlice.ts), [`useVaultSlice.ts`](src/store/slices/useVaultSlice.ts), etc.) owns its domain state and actions, while the composite [`StoreState`](src/store/types.ts:7) type ensures cross-slice access.

### 4.2 Command Pattern for Undo/Redo

Reversible operations use the Command pattern defined in [`types.ts`](src/store/commands/types.ts:1):

```typescript
export interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
  label: string;
}
```

Concrete implementations ([`MoveTabCommand`](src/store/commands/MoveTabCommand.ts:14), [`MoveIslandCommand`](src/store/commands/MoveIslandCommand.ts:12)) capture before/after state. The [`CommandSlice`](src/store/slices/useCommandSlice.ts:5) manages undo/redo stacks and triggers `syncLiveTabs()` after each operation.

### 4.3 Optimistic UI Updates

[`moveItemOptimistically()`](src/store/slices/useTabSlice.ts:25) in the TabSlice immediately reorders the local `islands` array before the Chrome API call completes. The [`isUpdating`](src/store/slices/useTabSlice.ts:12) flag and [`pendingOperations`](src/store/slices/useTabSlice.ts:15) set prevent background refresh messages from overwriting the optimistic state.

### 4.4 Chunked Compressed Storage

The vault sync system in [`vaultService.ts`](src/services/vaultService.ts) implements a sophisticated storage pipeline:

1. **Serialize** → `JSON.stringify(vault)`
2. **Compress** → `LZString.compressToUTF16(json)` ([line 172](src/services/vaultService.ts:172))
3. **Chunk** → Split into ≤8KB pieces respecting `CHROME_SYNC_ITEM_MAX_BYTES` ([line 231](src/services/vaultService.ts:231))
4. **Checksum** → SHA-256 via `crypto.subtle.digest` ([line 20](src/services/vaultService.ts:20))
5. **Atomic write** → Single `chrome.storage.sync.set()` call with meta + all chunks ([line 274](src/services/vaultService.ts:274))
6. **Verify** → Read-back verification with checksum comparison ([line 278](src/services/vaultService.ts:278))
7. **Cleanup** → Remove stale chunks only after verification passes ([line 315](src/services/vaultService.ts:315))

### 4.5 Graceful Degradation with Local Fallback

When sync storage quota is exceeded, the system automatically falls back to `chrome.storage.local`:

- [`saveVault()`](src/services/vaultService.ts:156) detects quota issues and returns `fallbackToLocal: true`
- [`loadVault()`](src/services/vaultService.ts:49) loads from backup on chunk mismatch or decompression failure
- The store [`init()`](src/store/useStore.ts:43) function chains migration → load → quota check → auto-disable sync if critical

### 4.6 Service Worker Message Bridge

The [`background.ts`](src/background.ts) service worker listens to all tab/group lifecycle events and broadcasts `REFRESH_TABS` messages. The [`useTabSync`](src/hooks/useTabSync.ts:7) hook debounces these messages and respects the `isUpdating` lock to avoid overwriting in-flight operations.

### 4.7 Retry with Exponential Backoff

The [`withRetry()`](src/services/tabService.ts:5) utility in `tabService` retries Chrome API calls that fail with transient errors (tab being dragged, not editable). The [`performSync()`](src/store/utils.ts:198) function applies the same pattern for storage sync operations.

### 4.8 Virtualized Rendering

Both the Live and Vault panels use `@tanstack/react-virtual` ([`Dashboard.tsx`](src/components/Dashboard.tsx:183)) to virtualize long tab lists, rendering only visible rows plus an overscan buffer of 10 items.

### 4.9 Proximity-Based Droppable Gaps

The [`useProximityGap`](src/components/Dashboard.tsx:60) hook creates invisible drop zones between islands that expand when the pointer approaches during a drag operation, using asymmetric detection thresholds (1rem up, 3rem down).

---

## 5. Strengths

### 5.1 Robust Storage Layer

The vault storage system is production-grade:
- **Compression** reduces sync storage usage significantly via LZ-String UTF-16 encoding
- **SHA-256 checksums** detect corruption from partial writes or sync conflicts
- **Write verification** reads back all chunks after save and validates the checksum
- **Automatic fallback** to local storage prevents data loss when sync quota is exhausted
- **Orphaned chunk cleanup** runs on both background startup ([`background.ts`](src/background.ts:10)) and store init

### 5.2 Well-Defined Type System

The [`types/index.ts`](src/types/index.ts) file provides comprehensive type definitions with discriminated unions (`LiveItem`, `VaultItem`). Type guards in [`store/utils.ts`](src/store/utils.ts:52) (`isTab()`, `isIsland()`, `isVaultItem()`, `isAppearanceSettings()`) validate data at runtime boundaries.

### 5.3 Centralized Constants

All magic numbers live in [`constants.ts`](src/constants.ts) — from Chrome API limits (`CHROME_32BIT_INT_MAX`, `CHROME_SYNC_QUOTA_BYTES`) to UI timing values (`DEBOUNCE_DEFAULT_MS`, `REFRESH_TABS_DEBOUNCE_MS`). This eliminates scattered literals and makes tuning straightforward.

### 5.4 Clean Separation of Concerns

- **Services** ([`tabService`](src/services/tabService.ts), [`vaultService`](src/services/vaultService.ts), [`quotaService`](src/services/quotaService.ts)) encapsulate all Chrome API interactions
- **Store slices** manage domain state without direct API calls
- **Components** consume state via Zustand selectors and delegate mutations to store actions
- **Facade modules** ([`chromeApi.ts`](src/utils/chromeApi.ts), [`vaultStorage.ts`](src/utils/vaultStorage.ts)) provide stable import paths

### 5.5 Defensive Chrome API Handling

[`tabService.ts`](src/services/tabService.ts) wraps every Chrome API call with:
- Retry logic for transient failures (tab being dragged/moved)
- Exponential backoff ([`TAB_ACTION_RETRY_DELAY_BASE`](src/constants.ts:32) × 2^attempt)
- Structured error logging with operation labels
- Null-safe tab validation before grouping operations

### 5.6 Thoughtful UX Patterns

- **Optimistic updates** prevent UI lag during drag operations
- **State locking** (`isUpdating`, `pendingOperations`) prevents refresh storms from overwriting user actions
- **Proximity gaps** provide intuitive drop targets without cluttering the UI
- **Error boundary** ([`ErrorBoundary.tsx`](src/components/ErrorBoundary.tsx)) provides themed crash recovery with retry/reload options
- **Quota warnings** ([`QuotaWarningBanner.tsx`](src/components/QuotaWarningBanner.tsx), [`QuotaExceededModal.tsx`](src/components/QuotaExceededModal.tsx)) proactively inform users before data loss

### 5.7 Environment-Aware Logging

The [`logger`](src/utils/logger.ts) suppresses `debug` and `info` messages in production builds while always surfacing `warn` and `error` — a simple but effective approach for extension debugging.

---

## 6. Areas for Improvement

### 6.1 Dashboard Component Size

[`Dashboard.tsx`](src/components/Dashboard.tsx) is **1,572 lines** — the largest file in the codebase. It contains:
- `useProximityGap` hook (should be in `src/hooks/`)
- `LivePanel` component (should be in `src/components/LivePanel.tsx`)
- `VaultPanel` component (should be in `src/components/VaultPanel.tsx`)
- `DroppableGap` component (should be in `src/components/DroppableGap.tsx`)
- `DashboardRow` type and row-building logic

**Impact:** Difficult to test individual panels, slower IDE performance, merge conflicts.

### 6.2 Debug Logging Left in Production Code

[`vaultService.ts`](src/services/vaultService.ts:160) contains `console.error()` and `console.trace()` calls that bypass the logger:

```typescript
console.error(`[DEBUG] saveVault CALLED: syncEnabled=${config.syncEnabled}, vaultSize=${vault.length}`);
console.trace('[DEBUG] saveVault call stack');
```

These appear at lines [160–161](src/services/vaultService.ts:160), [386–387](src/services/vaultService.ts:386), and [452–453](src/services/vaultService.ts:452). They will output to the browser console in production.

### 6.3 Empty Catch Blocks

[`MoveTabCommand.ts`](src/store/commands/MoveTabCommand.ts:25) has empty catch blocks:

```typescript
try {
  await chrome.tabs.ungroup(this.params.tabId);
} catch (e) {}
```

This violates the project's own anti-pattern rule ("Empty Catches: Swallowing Chrome API errors leads to out-of-sync UI" — [`AGENTS.md`](AGENTS.md)).

### 6.4 `as any` Usage

Despite the "No `as any`" convention, [`useStore.ts`](src/store/useStore.ts:62) uses `as any`:

```typescript
storedVaultSyncEnabled: sync.appearanceSettings && isAppearanceSettings(sync.appearanceSettings) 
  ? (sync.appearanceSettings as any).vaultSyncEnabled : undefined,
```

And [`settingsService.ts`](src/services/settingsService.ts:10):

```typescript
vaultSyncEnabled: (result.appearanceSettings as any)?.vaultSyncEnabled
```

### 6.5 Duplicated Helper Functions

[`getVaultChunkKeys()`](src/services/vaultService.ts:28) is duplicated identically in both [`vaultService.ts`](src/services/vaultService.ts:28) and [`quotaService.ts`](src/services/quotaService.ts:27). Similarly, `countOrphanedChunks()` logic is duplicated. These should be extracted to a shared storage utility.

### 6.6 Missing Test Coverage for Key Flows

While there are tests for store operations, type guards, and race conditions, several critical paths lack test coverage:
- **`vaultService.saveVault()`** — the most complex function (chunking, compression, verification)
- **`Dashboard.tsx` drag-and-drop handlers** — `handleDragEnd` cross-panel flows
- **`useTabSync` hook** — message debouncing and operation timeout behavior
- **`quotaService.getVaultQuota()`** — quota calculation accuracy

### 6.7 Inconsistent Error Handling in Store Init

The [`init()`](src/store/useStore.ts:43) function in `useStore.ts` has no top-level try/catch. If `settingsService.loadSettings()` or `vaultService.migrateFromLegacy()` throws, the entire initialization fails silently, leaving the store in a partially initialized state.

### 6.8 Direct Chrome API Calls in Commands

[`MoveTabCommand.ts`](src/store/commands/MoveTabCommand.ts:23) calls `chrome.tabs.group()` and `chrome.tabs.ungroup()` directly instead of going through `tabService`, bypassing retry logic:

```typescript
await chrome.tabs.group({ tabIds: this.params.tabId, groupId: this.params.toGroupId });
```

### 6.9 Facade Modules Add Indirection Without Value

[`chromeApi.ts`](src/utils/chromeApi.ts) and [`vaultStorage.ts`](src/utils/vaultStorage.ts) are pure re-export facades. While they provide stable import paths, they add a layer of indirection that can confuse new contributors. The services themselves are already well-organized.

### 6.10 No Input Sanitization on Vault Data

When loading vault data from `chrome.storage.sync`, the parsed JSON is cast directly to `VaultItem[]` ([`vaultService.ts`](src/services/vaultService.ts:135)):

```typescript
parsed = JSON.parse(jsonData) as VaultItem[];
```

While `Array.isArray()` is checked, individual items are not validated with `isVaultItem()` — corrupted or malicious data could propagate through the store.

---

## 7. Security Considerations

### 7.1 Broad Host Permissions

[`manifest.json`](public/manifest.json:7) requests `<all_urls>` host permission. While necessary for favicon access and cross-origin tab manipulation, this grants the extension access to all web page content. Consider documenting the justification and exploring whether `activeTab` could suffice for some operations.

### 7.2 Clipboard Access Without User Gesture Verification

[`tabService.copyTabUrl()`](src/services/tabService.ts:256) writes to the clipboard:

```typescript
await navigator.clipboard.writeText(tab.url);
```

This should always be called from a user-initiated event handler. The current call chain appears safe, but there's no explicit guard.

### 7.3 Unvalidated Storage Data

Data loaded from `chrome.storage.sync` and `chrome.storage.local` is trusted without full validation:
- [`loadVault()`](src/services/vaultService.ts:135) casts parsed JSON to `VaultItem[]` without per-item validation
- [`settingsService.loadSettings()`](src/services/settingsService.ts:7) returns raw storage data
- Cross-window sync in [`useStore.ts`](src/store/useStore.ts:148) trusts `vault_meta.timestamp` without bounds checking

A compromised or buggy sync could inject malformed data.

### 7.4 URL Handling in Favicon Resolution

[`Favicon.tsx`](src/components/Favicon.tsx:27) constructs external URLs for favicon fetching:

```typescript
return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`;
```

While `new URL()` is used for parsing, the hostname is passed directly to external services. Malicious tab URLs could potentially be used for information leakage (the extension reveals which domains the user has open to Google/DuckDuckGo favicon services).

### 7.5 No Content Security Policy

The [`manifest.json`](public/manifest.json) does not define a `content_security_policy`. While MV3 has restrictive defaults, explicitly defining a CSP would harden the extension against XSS in the sidebar panel.

### 7.6 `console.trace()` in Production

The `console.trace()` calls in [`vaultService.ts`](src/services/vaultService.ts:161) expose internal call stacks in the browser console, which could aid reverse engineering.

---

## 8. Recommendations

### High Priority

| # | Recommendation | Files Affected |
|---|---------------|----------------|
| 1 | **Remove debug `console.error`/`console.trace` calls** from vault service | [`vaultService.ts`](src/services/vaultService.ts:160) |
| 2 | **Add top-level try/catch to `init()`** with fallback to default state | [`useStore.ts`](src/store/useStore.ts:43) |
| 3 | **Validate vault items on load** using `isVaultItem()` type guard | [`vaultService.ts`](src/services/vaultService.ts:135) |
| 4 | **Route all Chrome API calls through services** — fix `MoveTabCommand` direct calls | [`MoveTabCommand.ts`](src/store/commands/MoveTabCommand.ts:23) |
| 5 | **Fix empty catch blocks** in command implementations | [`MoveTabCommand.ts`](src/store/commands/MoveTabCommand.ts:25) |

### Medium Priority

| # | Recommendation | Files Affected |
|---|---------------|----------------|
| 6 | **Extract `Dashboard.tsx` into sub-components** — `LivePanel`, `VaultPanel`, `DroppableGap` | [`Dashboard.tsx`](src/components/Dashboard.tsx) |
| 7 | **Extract `useProximityGap` to `src/hooks/`** | [`Dashboard.tsx`](src/components/Dashboard.tsx:60) |
| 8 | **Deduplicate `getVaultChunkKeys()`** into a shared storage utility | [`vaultService.ts`](src/services/vaultService.ts:28), [`quotaService.ts`](src/services/quotaService.ts:27) |
| 9 | **Eliminate `as any` casts** — use proper type narrowing after `isAppearanceSettings()` | [`useStore.ts`](src/store/useStore.ts:62), [`settingsService.ts`](src/services/settingsService.ts:10) |
| 10 | **Add explicit CSP** to `manifest.json` | [`manifest.json`](public/manifest.json) |

### Low Priority

| # | Recommendation | Files Affected |
|---|---------------|----------------|
| 11 | **Add integration tests** for `vaultService.saveVault()` chunking pipeline | [`src/services/vaultService.ts`](src/services/vaultService.ts) |
| 12 | **Add tests for `useTabSync` hook** — message debouncing, operation timeouts | [`src/hooks/useTabSync.ts`](src/hooks/useTabSync.ts) |
| 13 | **Consider removing facade modules** or documenting their purpose | [`chromeApi.ts`](src/utils/chromeApi.ts), [`vaultStorage.ts`](src/utils/vaultStorage.ts) |
| 14 | **Document favicon privacy implications** — external service requests reveal browsing domains | [`Favicon.tsx`](src/components/Favicon.tsx:27) |
| 15 | **Add bounds checking** on `vault_meta.timestamp` during cross-window sync | [`useStore.ts`](src/store/useStore.ts:149) |

### Architecture Evolution

- **Consider a message bus abstraction** between background worker and UI to replace raw `chrome.runtime.sendMessage` calls — this would simplify testing and enable typed message contracts
- **Evaluate IndexedDB** for vault storage as an alternative to the chunked sync approach — it removes the 102KB quota constraint entirely for local-only vaults
- **Add E2E tests** using Puppeteer with the Chrome extension testing API to validate the full drag-and-drop → Chrome API → UI refresh cycle

---

*This analysis covers the `src/` directory and configuration files. The `TidyTabGroups/` legacy directory was excluded per project conventions (frozen/read-only reference only).*
