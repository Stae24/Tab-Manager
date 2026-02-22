# PROJECT KNOWLEDGE BASE

**Project:** Opera GX Island Manager (Chrome Extension)
**Stack:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4, Zustand 5, Vitest

## OVERVIEW
Tactical tab management with dual-panel UI (Live Workspace vs. Neural Vault). Features optimistic drag-and-drop, state locking, and memory optimization (tab freezing).

---

## COMMANDS

```bash
npm run dev                    # Vite dev server with hot reload
npm run build                  # Production build: tsc && vite build
npm run test                   # Run all tests once (vitest run)
npm run test:watch             # Run tests in watch mode
npx vitest -t "test name"      # Run specific test by name pattern
npm run bench                  # Run benchmarks
npm run bench:search           # Run search-specific benchmarks
```

---

## PROJECT STRUCTURE

```
src/
├── components/     # UI & DnD orchestration
├── store/          # Zustand state engine (slices/, commands/)
├── services/       # Chrome API wrappers with retry logic
├── hooks/          # React hooks (useTabSync, useProximityGap)
├── utils/          # Re-exports, styling (cn), logging
├── types/          # TypeScript interfaces and types
├── search/         # Search functionality with benchmarks
├── constants.ts    # All magic numbers and strings
└── background.ts   # Extension service worker
```

---

## CODE STYLE

### Imports (ordered top to bottom)
1. React and React hooks
2. External packages (zustand, lucide-react, @dnd-kit/*)
3. Internal services and utilities
4. Types and interfaces
5. Constants

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { SomeIcon } from 'lucide-react';
import { tabService } from '../services/tabService';
import { logger } from '../utils/logger';
import type { Tab, Island } from '../types/index';
import { MAX_SYNC_RETRIES } from '../constants';
```

### TypeScript Rules
- **STRICT MODE**: No `as any`, no `@ts-ignore`, no `@ts-expect-error`
- Use `type` for unions/primitives, `interface` for objects
- Explicit return types for exported functions
- Use `unknown` instead of `any` for catch blocks, then narrow
- Mixed numeric/string IDs: compare with `String(a) === String(b)`

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TabCard.tsx`, `LivePanel.tsx` |
| Hooks | camelCase with `use` prefix | `useTabSync.ts` |
| Services | camelCase with `Service` suffix | `tabService.ts` |
| Zustand slices | `create*Slice` | `createTabSlice()` |
| Commands | PascalCase + `Command` | `MoveTabCommand.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_SYNC_RETRIES` |
| Type guards | `is*` prefix | `isTab()`, `isIsland()` |

### React Components
- Functional components only with explicit `React.FC` type
- Memoize callbacks with `useCallback`, derived data with `useMemo`
- Destructure store selectors at component top

```typescript
export const Dashboard: React.FC = () => {
  const islands = useStore(state => state.islands);
  const moveItem = useStore(state => state.moveItemOptimistically);
  const handleDragEnd = useCallback((event: DragEndEvent) => { }, [dependencies]);
  return (/* JSX */);
};
```

### State Management (Zustand)
- Access store via selectors: `useStore(state => state.field)`
- Inside effects: `useStore.getState().method()`
- Always use `isUpdating` flag during async Chrome API operations

---

## ERROR HANDLING

### Logging
Use `logger` utility with bracketed context labels:

```typescript
import { logger } from '../utils/logger';
logger.debug('[ComponentName] Detailed info:', data);
logger.info('[ServiceName] Operation succeeded');
logger.warn('[Context] Non-critical issue:', warning);
logger.error('[Context] Failed:', error);
```

### Chrome API Calls
- **NEVER** call `chrome.*` directly - use service layer (`src/services/`)
- All services implement retry logic with exponential backoff
- Never use empty catch blocks - always log errors

---

## TESTING

### Test File Location
- Unit tests: `src/**/__tests__/*.test.ts` (co-located with source)
- Setup file: `tests/setup.ts` (global Chrome API mocks)

### Test Structure
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('FeatureName', () => {
  beforeEach(() => { /* Setup */ });
  afterEach(() => { vi.clearAllMocks(); });
  it('should do something specific', async () => {
    // Arrange, Act, Assert
  });
});
```

---

## KEY PATTERNS

### ID Namespacing
- Live items: `live-tab-123`, `live-group-456`
- Vault items: `vault-789`
- Use `parseNumericId()` to strip prefix before Chrome API calls

### Command Pattern (Undo/Redo)
```typescript
class MoveTabCommand implements Command {
  async execute() { /* do the move */ }
  async undo() { /* reverse the move */ }
}
executeCommand(new MoveTabCommand(params));
```

### Constants
All magic numbers in `src/constants.ts`:

```typescript
export const MAX_SYNC_RETRIES = 3;
export const DND_ACTIVATION_DISTANCE = 8;
```

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| `chrome.tabs.query()` directly | `tabService.getLiveTabsAndGroups()` |
| `as any` / `@ts-ignore` | Proper typing or `unknown` with narrowing |
| Empty catch blocks | Log error with context |
| `console.log/warn/error` | `logger.info/warn/error()` |
| `==` for ID comparison | `String(a) === String(b)` |
| Direct `islands.push()` | Create new array for immutability |
| Inline magic numbers | Import from `constants.ts` |

---

## LEGACY REFERENCE: TidyTabGroups/

The `TidyTabGroups/` directory contains frozen legacy code for behavioral reference only.
- **STATUS**: Read-only. Do not modify or import.

---

## OPERA GX / CHROME NOTES

- **Pinned tabs**: Cannot be in groups; handled in `createIsland`
- **Single-tab groups**: Opera GX requires companion tab; automated in `tabService.ts`
- **Storage quotas**: `chrome.storage.sync` has 100KB limit; vault falls back to local
