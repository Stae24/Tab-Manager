# Test Coverage Improvement Overview

## Executive Summary

This document outlines a comprehensive plan to improve test coverage from the current overall average of ~62% to a minimum of 70% across all areas. The plan prioritizes high-impact, high-value tests while minimizing effort on low-risk code paths.

## Current Coverage Summary

| Area | Current Coverage | Target Coverage | Priority |
|------|-----------------|-----------------|----------|
| src/components | 50.9% | 70% | **HIGH** |
| src/store | 62.38% | 70% | **HIGH** |
| src/search/filters | 62.19% | 70% | MEDIUM |
| src/utils | 64.06% | 70% | MEDIUM |
| src/hooks | 69.69% | 70% | LOW |
| src/contexts | 60% | 70% | LOW |
| src/services | 80.42% | 85% | MAINTAIN |

## Priority Ranking

### Phase 1: Critical Path (High Impact, High Priority)

1. **AppearanceSettingsPanel.tsx (28.16%)** - Largest component with extensive UI logic
2. **Dashboard.tsx (38.92%)** - Core orchestration component with DnD logic
3. **useStore.ts (43.93%)** - Central state management initialization

### Phase 2: Important Components (Medium-High Priority)

4. **QuotaExceededModal.tsx (20%)** - User-facing error handling
5. **CompressionWarning.tsx (0%)** - User notification component
6. **Sidebar.tsx (54.8%)** - Navigation component
7. **TabCard.tsx (51.32%)** - Core tab display component

### Phase 3: Supporting Components (Medium Priority)

8. **VaultPanel.tsx (64%)** - Vault management UI
9. **LivePanel.tsx (61.3%)** - Live tabs panel
10. **Island.tsx (62.74%)** - Group display component
11. **SearchBar/index.tsx (49.18%)** - Search functionality

### Phase 4: Utilities and Hooks (Lower Priority)

12. **browser.ts (44.11%)** - Browser detection utilities
13. **cn.ts (42.85%)** - Styling utilities
14. **useProximityGap.ts (69.69%)** - DnD proximity detection
15. **useUISlice.ts (56.25%)** - UI state slice

### Phase 5: Search Filters (Lower Priority)

16. **search/filters/index.ts (62.19%)** - Search filter functions

## Implementation Strategy

### Approach

1. **Focus on Behavior, Not Lines**: Test user-facing behavior rather than implementation details
2. **Use Existing Patterns**: Follow established test patterns from existing test files
3. **Mock External Dependencies**: Chrome APIs, DnD kit, and other external libraries
4. **Test Edge Cases**: Focus on error handling, boundary conditions, and user interactions

### Test File Organization

```
src/
├── components/__tests__/
│   ├── AppearanceSettingsPanel.test.tsx    # NEW
│   ├── CompressionWarning.test.tsx         # NEW
│   ├── QuotaExceededModal.test.tsx         # NEW
│   ├── Dashboard.test.tsx                  # EXPAND
│   ├── Sidebar.test.tsx                    # EXPAND
│   └── [existing tests]
├── store/__tests__/
│   ├── useStore.init.test.ts               # NEW - initialization tests
│   └── [existing tests]
├── utils/__tests__/
│   ├── browser.test.ts                     # EXPAND
│   └── cn.test.ts                          # EXPAND
└── search/filters/__tests__/
    └── filters.test.ts                     # EXPAND
```

## Detailed Plans

- **[coverage-components.md](./coverage-components.md)** - Components test plan
- **[coverage-store.md](./coverage-store.md)** - Store and slices test plan
- **[coverage-services.md](./coverage-services.md)** - Services test plan
- **[coverage-utils-hooks.md](./coverage-utils-hooks.md)** - Utils, hooks, contexts, and filters test plan

## Estimated Test Count by Area

| Area | Current Tests | Tests to Add | Total Target |
|------|--------------|--------------|--------------|
| Components | ~45 | ~35 | ~80 |
| Store | ~25 | ~15 | ~40 |
| Services | ~30 | ~10 | ~40 |
| Utils/Hooks | ~15 | ~12 | ~27 |
| **Total** | ~115 | ~72 | ~187 |

## Key Testing Patterns

### Component Testing Pattern

```typescript
describe('ComponentName', () => {
  // 1. Setup mocks
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 2. Render tests
  it('should render with default props', () => { /* ... */ });

  // 3. Interaction tests
  it('should handle user interaction', () => { /* ... */ });

  // 4. State change tests
  it('should update state on action', () => { /* ... */ });

  // 5. Edge case tests
  it('should handle edge case', () => { /* ... */ });
});
```

### Store Testing Pattern

```typescript
describe('StoreFunction', () => {
  it('should initialize with correct defaults', () => { /* ... */ });
  it('should handle async operations', async () => { /* ... */ });
  it('should recover from errors', async () => { /* ... */ });
});
```

## Success Criteria

- [ ] All areas reach minimum 70% coverage
- [ ] No regression in existing tests
- [ ] All new tests follow project conventions
- [ ] CI/CD pipeline passes with new tests
- [ ] Test execution time remains under 30 seconds

## Notes

- External dependencies (dnd-kit packages) are excluded from coverage requirements
- Focus on meaningful tests, not just coverage numbers
- Prioritize tests that catch real bugs over tests that just cover lines
