# src/utils AGENTS.md

## OVERVIEW
Chrome API wrappers, styling utilities, and logging. Re-exports from services layer for convenience.

## chromeApi.ts
**STATUS**: Re-export facade only. Actual implementations in `src/services/tabService.ts`.

Exports: `moveIsland`, `moveTab`, `createIsland`, `ungroupTab`, `updateTabGroup`, `updateTabGroupCollapse`, `discardTab`, `discardTabs`, `closeTab`, `closeTabs`, `copyTabUrl`, `muteTab`, `unmuteTab`, `pinTab`, `unpinTab`, `duplicateTab`, `duplicateIsland`, `consolidateAndGroupTabs`

**IMPORTANT**: The retry logic, Opera GX hacks, and Chrome API interactions live in `tabService.ts`, NOT here.

## cn.ts
Class name utility wrapping `clsx` + `tailwind-merge`. Single source of truth for conditional Tailwind classes.

```typescript
cn('base-class', condition && 'conditional-class', overrides)
```

Also exports `getIslandBorderColor(color)`: Maps internal color names → Chrome TabGroupColor hex codes.

## logger.ts
Structured logging with bracketed labels for filtering.

```typescript
logger.info('[ComponentName] Message:', data)
logger.error('[ServiceName] Error:', error)
```

## vaultStorage.ts
Legacy vault storage utilities. Now superseded by `src/services/vaultService.ts`.

## CONVENTIONS
- **Re-exports OK**: `chromeApi.ts` exists for import convenience from services
- **Functional purity**: `cn.ts` and styling helpers should be side-effect free
- **Bracketed logging**: Always use `[ContextName]` prefix for grep-ability

## ANTI-PATTERNS
- **Direct chrome.* calls**: Use service layer instead
- **Implementing in chromeApi.ts**: Add to tabService, re-export here
- **Console.log**: Use `logger.info/debug/error/warn` instead
