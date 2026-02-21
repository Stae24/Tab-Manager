# src/utils AGENTS.md

## OVERVIEW
Chrome API wrappers, styling utilities, and logging. Re-exports from services layer for convenience.

---

## FILES

### chromeApi.ts
**STATUS**: Re-export facade only. Actual implementations in `src/services/tabService.ts`.

**Exports:** `moveIsland`, `moveTab`, `createIsland`, `ungroupTab`, `updateTabGroup`, `updateTabGroupCollapse`, `discardTab`, `discardTabs`, `closeTab`, `closeTabs`, `copyTabUrl`, `muteTab`, `unmuteTab`, `pinTab`, `unpinTab`, `duplicateTab`, `duplicateIsland`, `consolidateAndGroupTabs`

> **IMPORTANT**: Retry logic and Chrome API interactions live in `tabService.ts`, NOT here.

### cn.ts
Class name utility wrapping `clsx` + `tailwind-merge`.

```typescript
import { cn, getIslandBorderColor } from '../utils/cn';

cn('base-class', condition && 'conditional-class', overrides)
getIslandBorderColor('blue') // → '#3399ff'
```

### logger.ts
Structured logging with bracketed labels for filtering.

```typescript
import { logger } from '../utils/logger';

logger.debug('[ComponentName] Detailed info:', data);
logger.info('[ServiceName] Operation succeeded');
logger.warn('[Context] Non-critical issue:', warning);
logger.error('[Context] Failed:', error);
```

> Debug/info logs are gated by `debugMode` in appearance settings.

### browser.ts
Browser detection and capability checks for Opera GX compatibility.

**Exports:** `detectBrowser()`, `getBrowserCapabilities()`, `needsCompanionTabForSingleTabGroup()`

### vaultStorage.ts
Legacy vault storage utilities. **Superseded by** `src/services/vaultService.ts`.

---

## CONVENTIONS

| Pattern | Example |
|---------|---------|
| Re-exports OK | `chromeApi.ts` for import convenience |
| Functional purity | `cn.ts` helpers are side-effect free |
| Bracketed logging | `logger.info('[Context] Message')` |

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| `chrome.tabs.query()` directly | `tabService` via `chromeApi.ts` |
| Adding logic to `chromeApi.ts` | Implement in `tabService.ts`, re-export |
| `console.log/warn/error` | `logger.info/warn/error()` |
