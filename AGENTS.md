# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-07T13:30:00Z
**Project:** Opera GX Island Manager (Chrome Extension)

## OVERVIEW
Tactical tab management extension featuring a dual-panel dashboard (Live vs. Vault) with optimistic drag-and-drop, state locking, and memory optimization.

## STRUCTURE
```
.
├── src/
│   ├── components/    # Tactical UI components (Dashboard, Island, Sidebar, TabCard)
│   ├── store/         # Zustand state with recursive move engine and storage sync
│   ├── utils/         # Chrome API wrappers and styling utilities
│   ├── hooks/         # Browser event listeners and sync logic
│   └── background.ts  # Extension service worker (Events & Discard logic)
├── TidyTabGroups/     # [LEGACY/REFERENCE] Unrelated project codebase
└── dist/              # Built extension output
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Drag Logic | `src/store/useStore.ts` | `moveItemOptimistically` is the core recursive engine |
| UI Layout | `src/components/Dashboard.tsx` | Main DndContext and panel orchestration |
| Chrome API | `src/utils/chromeApi.ts` | Wrappers for tabs/groups/windows |
| Sync Logic | `src/hooks/useTabSync.ts` | Handles `REFRESH_TABS` messages |

## CODE MAP
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `useStore` | Hook | `src/store/useStore.ts` | Central state for Islands, Vault, and UI locks |
| `moveItemOptimistically` | Function | `src/store/useStore.ts` | Recursive DND update engine with ID namespacing |
| `Dashboard` | Component | `src/components/Dashboard.tsx` | Root UI containing Live and Vault panels |
| `background.ts` | Script | `src/background.ts` | Event bus for tab/group changes |

## CONVENTIONS
- **Recursive IDs**: Items entering the Vault MUST be prefixed with `vault-`.
- **State Locking**: Use `isUpdating` lock during manual reordering to prevent browser snap-back.
- **Tailwind v4**: Uses modern `@import "tailwindcss"` syntax; keep CSS variables in sync.
- **Chrome API**: Always use async/await wrappers in `chromeApi.ts` instead of direct calls.

## ANTI-PATTERNS (THIS PROJECT)
- **Empty Catches**: NEVER use `catch(e) {}` in Dashboard or Store logic.
- **Loose Equality**: ALWAYS use `===` for ID comparisons (mixing string/number IDs).
- **Type Casting**: Avoid `as any` in store logic; use proper union types for Tab \| Island.
- **Sync Quotas**: NEVER write to `chrome.storage.sync` more than once per user action (use local for Vault).

## UNIQUE STYLES
- **GX Theme**: Gaming aesthetic with pulse-glow animations and neon border mapping.
- **Optimistic UI**: Immediate local state updates followed by background browser reconciliation.

## COMMANDS
```bash
npm run dev      # Start Vite dev server
npm run build    # Production build (Vite + Background bundle)
```

## NOTES
- **Pinned Tabs**: Chrome restricts moving pinned tabs into Tab Islands.
- **Discarded Tabs**: Visually indicated as "frozen" to represent memory optimization.
- **TidyTabGroups**: This directory is a reference copy of an unrelated project. Do not modify.
