# tests AGENTS.md

## OVERVIEW
Test setup and conventions for Vitest. Contains global Chrome API mocks and test utilities.

---

## FILES

### setup.ts
Global mocks applied before all tests. Runs once per test run.

**Chrome API Mock:**
```typescript
// Structure of global chrome mock
chrome.storage.sync.{get, set, remove, clear, getBytesInUse}
chrome.storage.local.{get, set, remove, clear, getBytesInUse}
chrome.storage.onChanged.{addListener, removeListener}
chrome.tabs.{query, create, remove, discard, onCreated, onRemoved, onUpdated, onMoved}
chrome.tabGroups.{query, onCreated, onUpdated, onRemoved, onMoved}
chrome.runtime.{sendMessage, onMessage}
chrome.windows.WINDOW_ID_CURRENT
```

**matchMedia Mock:**
- Required for theme detection in component tests
- Returns `matches: false` by default

---

## OVERRIDING MOCKS

In individual tests, override specific Chrome API responses:

```typescript
import { vi } from 'vitest';

beforeEach(() => {
  vi.mocked(chrome.tabs.query).mockResolvedValue([
    { id: 1, title: 'Test Tab', url: 'https://example.com' }
  ]);
});
```

---

## BENCHMARKS

Located in `src/**/__tests__/benchmark/*.bench.ts`.

```bash
npm run bench            # Run all benchmarks
npm run bench:search     # Run search benchmarks only
```

**Writing Benchmarks:**
```typescript
import { bench, describe } from 'vitest';

describe('FeatureName', () => {
  bench('operation name', () => {
    // Code to benchmark
  });
});
```

---

## TESTING-LIBRARY

For React component tests:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('renders correctly', () => {
  render(<Component />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});

it('handles click', async () => {
  const user = userEvent.setup();
  render(<Component />);
  await user.click(screen.getByRole('button'));
});
```

---

## SPECIAL EXCEPTION

The `@ts-ignore` in setup.ts is acceptable for the chrome mock assignment:

```typescript
// @ts-ignore
global.chrome = chromeMock as any;
```

This is the ONLY place `@ts-ignore` is allowed. All source code must be strict.
