# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-28T15:15:00Z
**Project:** Opera GX Island Manager (Chrome Extension)
**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Zustand 5, Vitest

## OVERVIEW
Tactical tab management with a dual-panel UI (Live Workspace vs. Neural Vault). Features optimistic drag-and-drop, state locking, and memory optimization (tab freezing).

## STRUCTURE
```
.
├── src/
│   ├── components/    # UI & DnD orchestration
│   ├── store/         # State engine & persistence
│   ├── hooks/         # Sync & lifecycle hooks
│   ├── utils/         # Chrome API wrappers & styling helpers
│   └── background.ts  # Extension service worker
└── TidyTabGroups/     # [LEGACY] Reference only
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Reordering Logic | `src/store/useStore.ts` | `moveItemOptimistically` is the core engine |
| Drag Lifecycle | `src/components/Dashboard.tsx` | `handleDragEnd` handles cross-panel flows |
| Chrome API Calls | `src/utils/chromeApi.ts` | Async wrappers with retry logic |
| Persistence | `src/store/useStore.ts` | debounced `chrome.storage` sync |
| Tab Syncing | `src/hooks/useTabSync.ts` | Bridges background messages to UI |

## CONVENTIONS
- **ID Namespacing**: Live (`live-tab-*`, `live-group-*`) vs. Vault (`vault-*`).
- **State Locking**: Always use `isUpdating` flag during Chrome API operations.
- **Async API**: Never call `chrome.*` directly; use `src/utils/chromeApi.ts` wrappers.
- **Strict Typing**: No `as any`, no `@ts-ignore`. Respect all union types.

## ANTI-PATTERNS (THIS PROJECT)
- **Direct API Calls**: Bypasses retry logic and error logging.
- **Empty Catches**: Swallowing Chrome API errors leads to out-of-sync UI.
- **Loose Equality**: Use `String(id) === String(otherId)` for mixed numeric/string IDs.
- **Storage Quotas**: Avoid frequent writes to `chrome.storage.sync` for large arrays.

## COMMANDS
```bash
npm run dev      # Vite dev server
npm run build    # Production build: tsc && vite build
npm run test     # Run all tests (vitest)
npx vitest -t "test name"  # Run specific test
```

## LEGACY REFERENCE: TidyTabGroups/
The `TidyTabGroups/` directory houses the legacy codebase. It is preserved strictly as a behavioral blueprint.
**STATUS**: Frozen/Read-Only. Do not modify or import into `src/`.
See [TidyTabGroups/AGENTS.md](./TidyTabGroups/AGENTS.md) for full restrictions and reference protocol.

## NOTES
- **Pinned Tabs**: Restricted from groups by Chrome; handled in `createIsland`.
- **Opera GX**: Single-tab groups require a companion tab; automated in `chromeApi.ts`.
