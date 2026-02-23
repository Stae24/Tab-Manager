# Agent Directives

## Tooling

- Dev server: `npm run dev`
- Build: `npm run build`
- Tests: `npm test` or `npm run test:watch`
- Benchmarks: `npm run bench` or `npm run bench:search`

## Verification Loop

Before finishing any task, run tests:
```bash
npm run test
```
If tests fail, fix the code and re-run until passing.

## TypeScript

- No `as any`, no `@ts-ignore`, no `@ts-expect-error`
- Use `unknown` for catch blocks, then narrow

## ID Namespacing

- Live tabs: `live-tab-{numericId}`
- Live groups: `live-group-{numericId}`
- Vault items: `vault-{uuid}`
- Use `parseNumericId()` to strip prefix before Chrome API calls
- Compare IDs: `String(a) === String(b)`

## Chrome API

NEVER call `chrome.*` directly. Use services in `src/services/`:
- `tabService` for tabs/groups
- `vaultService` for vault persistence
- `settingsService` for preferences

## Logging

Use `logger` utility with bracketed context:
```typescript
logger.info('[ComponentName] Action succeeded');
logger.warn('[Service] Non-critical issue:', warning);
logger.error('[Service] Failed:', error);
```

## State Locking

Always lock during async Chrome operations:
```typescript
setIsUpdating(true);
try {
  await tabService.moveTab(...);
} finally {
  setIsUpdating(false);
}
```
