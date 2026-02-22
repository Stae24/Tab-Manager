# Test Coverage Improvement Plan

**Project:** Opera GX Island Manager
**Goal:** Improve test coverage from ~60% to 80%+

---

## Current Coverage Summary

| Category | Current | Target |
|----------|---------|--------|
| **Overall** | 59.72% | 80%+ |
| Store Slices | 31% | 80%+ |
| Components | 48% | 70%+ |
| Services | 78% | 90%+ |
| Background | 41% | 75%+ |

---

## Phase Overview

| Phase | Focus | Priority | Est. Time | Tests | Target Coverage |
|-------|-------|----------|-----------|-------|-----------------|
| [Phase 1](./phase-1-store-slices.md) | Store Slices | CRITICAL | 4-6 hrs | ~400 | 80%+ |
| [Phase 2](./phase-2-dashboard-dnd.md) | Dashboard DnD | HIGH | 3-4 hrs | ~150 | 70%+ |
| [Phase 3](./phase-3-service-edge-cases.md) | Service Edge Cases | MEDIUM-HIGH | 2-3 hrs | ~100 | 90%+ |
| [Phase 4](./phase-4-background-script.md) | Background Script | MEDIUM | 2 hrs | ~80 | 75%+ |

---

## Priority Order

```
Phase 1 (Store Slices) ─────► Highest impact, core business logic
       │
       ▼
Phase 2 (Dashboard DnD) ─────► User-facing critical path
       │
       ▼
Phase 3 (Services) ──────────► Production stability
       │
       ▼
Phase 4 (Background) ────────► Extension lifecycle
```

---

## Quick Reference

### Run All Tests
```bash
npm run test
```

### Run with Coverage
```bash
npm run test -- --coverage
```

### Run Specific Phase
```bash
# Phase 1
npx vitest run src/store/slices/__tests__

# Phase 2
npx vitest run src/components/__tests__

# Phase 3
npx vitest run src/services/__tests__

# Phase 4
npx vitest run src/__tests__/background.test.ts
```

---

## Files to Create/Modify

### New Files (Phase 1)
```
src/store/slices/__tests__/
├── useTabSlice.test.ts    # ~200 tests
└── useVaultSlice.test.ts  # ~200 tests
```

### Modified Files (Phase 2)
```
src/components/__tests__/
├── Dashboard.dnd.test.tsx  # Fill empty stubs
├── Dashboard.test.tsx      # Create new (unit tests)
├── LivePanel.test.tsx      # Expand
└── VaultPanel.test.tsx     # Expand
```

### Modified Files (Phase 3)
```
src/services/__tests__/
├── tabService.test.ts      # Add retry/compression tests
├── vaultService.test.ts    # Add chunking/checksum tests
└── quotaService.test.ts    # Add edge case tests
```

### Modified Files (Phase 4)
```
src/__tests__/
└── background.test.ts      # Add event handler tests
```

---

## Success Metrics

### After Phase 1
- [x] `useTabSlice.ts` >= 80%
- [x] `useVaultSlice.ts` >= 80%
- [x] All `moveItemOptimistically` branches tested
- [x] All quota-related branches tested

### After Phase 2
- [x] `Dashboard.tsx` >= 70%
- [x] `LivePanel.tsx` >= 70%
- [x] `VaultPanel.tsx` >= 80%
- [x] No empty test bodies

### After Phase 3
- [x] `tabService.ts` >= 90%
- [x] `vaultService.ts` >= 90%
- [x] `quotaService.ts` >= 95%
- [x] Retry logic fully tested

### After Phase 4
- [x] `background.ts` >= 75%
- [x] All event handlers tested
- [x] All message types tested

---

## Agent Handoff Instructions

Each phase file is self-contained and can be handed to an agent for implementation:

1. **Read the phase file completely** - Contains all test cases, setup, and assertions
2. **Create/modify the specified files** - File paths are provided
3. **Run verification commands** - Ensure tests pass and coverage targets met
4. **Follow code style** - See `AGENTS.md` for project conventions

### Example Handoff Prompt
```
Implement Phase 1 of the test coverage improvement plan.

Read: test-plans/phase-1-store-slices.md

Create:
- src/store/slices/__tests__/useTabSlice.test.ts
- src/store/slices/__tests__/useVaultSlice.test.ts

Follow the test cases specified in the plan. Run `npx vitest run src/store/slices/__tests__` to verify.
```

---

## Notes

- **Code Style**: Follow AGENTS.md conventions (no `as any`, use `unknown` for catch blocks)
- **Mocking**: Use `vi.mock()` at file top, `vi.fn()` for functions
- **Async**: Use `async/await` with `waitFor` for async assertions
- **Coverage**: Run `--coverage` flag to verify targets

---

## Troubleshooting

### Tests Fail Due to Import Order
- Ensure mocks are defined BEFORE imports
- Use `vi.resetModules()` in `beforeEach`

### Chrome API Mocks Not Working
- Check `tests/setup.ts` for base mocks
- Extend in individual test files as needed

### Coverage Not Improving
- Check `uncovered line #s` in coverage report
- Focus on branches, not just statements

### Type Errors in Tests
- Use `vi.fn<ReturnType, Args>()` for typed mocks
- Import types from `../../types/index`
