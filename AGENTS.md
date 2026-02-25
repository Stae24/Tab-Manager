# Agent Directives

## Tooling
- Use `rg` instead of `grep`
- DO NOT RUN `npm run dev`
- Test: `npm run test`
- Output only failed tests: `npm run test:fail-only`
- Build: `npm run build`
- Benchmarks: `npm run bench`
- **ALWAYS MINIMIZE TOKEN NOISE**: if a tool output is large, ALWAYS use filtering or sampling (e.g., `rg`, `head`, `tail`) to extract only the relevant lines.

## Verification Loop

Before finishing any task, check for any failing tests:
```bash
npm run test:fail-only
```
It will output nothing if there are no failing tests.
Never run the full test command unless you have to.
If tests fail, fix the code and re-run until passing.
Then run `npm run build` to ensure the code compiles.

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
