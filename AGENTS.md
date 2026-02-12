# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-12T12:00:00Z
**Commit:** f8d71ff
**Branch:** main
**Project:** Opera GX Island Manager (Chrome Extension)
**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Zustand 5, Vitest

## OVERVIEW
Tactical tab management with a dual-panel UI (Live Workspace vs. Neural Vault). Features optimistic drag-and-drop, state locking, and memory optimization (tab freezing).

## STRUCTURE
```
.
├── src/
│   ├── components/    # UI & DnD orchestration
│   ├── store/         # State engine, slices, commands
│   ├── services/      # Chrome API wrappers with retry logic
│   ├── hooks/         # Sync & lifecycle hooks
│   ├── utils/         # Re-exports, styling, logging
│   └── background.ts  # Extension service worker
└── TidyTabGroups/     # [LEGACY] Reference only
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Reordering Logic | `src/store/useStore.ts` | `moveItemOptimistically` is the core engine |
| Drag Lifecycle | `src/components/Dashboard.tsx` | `handleDragEnd` handles cross-panel flows |
| Chrome API Calls | `src/services/tabService.ts` | Async wrappers with retry logic |
| Vault Storage | `src/services/vaultService.ts` | Compression, chunking, checksum verify |
| Persistence | `src/store/useStore.ts` | Debounced `chrome.storage` sync |
| Tab Syncing | `src/hooks/useTabSync.ts` | Bridges background messages to UI |
| Undo/Redo | `src/store/commands/` | MoveTabCommand, MoveIslandCommand |

## CONVENTIONS
- **ID Namespacing**: Live (`live-tab-*`, `live-group-*`) vs. Vault (`vault-*`).
- **State Locking**: Always use `isUpdating` flag during Chrome API operations.
- **Async API**: Never call `chrome.*` directly; use `src/services/*.ts` wrappers.
- **Strict Typing**: No `as any`, no `@ts-ignore`. Respect all union types.
- **Command Pattern**: Use `executeCommand()` for reversible operations (undo/redo).

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
- **Opera GX**: Single-tab groups require a companion tab; automated in `tabService.ts`.
- **Vault Sync**: Auto-disables when `chrome.storage.sync` quota exceeded; falls back to local.
