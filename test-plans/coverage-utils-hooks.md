# Utils, Hooks, Contexts, and Filters Test Coverage Plan

## Overview

This plan covers test improvements for:
- `src/utils/` - Current coverage: **64.06%**, target: **70%**
- `src/hooks/` - Current coverage: **69.69%**, target: **70%**
- `src/contexts/` - Current coverage: **60%**, target: **70%**
- `src/search/filters/` - Current coverage: **62.19%**, target: **70%**

---

## 1. browser.ts

**Current Coverage:** 44.11%  
**Target Coverage:** 70%  
**Uncovered Lines:** 24-25, 45, 58, 65-86

### File Analysis

Browser detection and capabilities utilities:
- `detectBrowser()` - Detects browser vendor
- `initBrowserCapabilities()` - Initialize and cache capabilities
- `getBrowserCapabilities()` - Get cached capabilities
- `getCachedCapabilities()` - Return cached value
- `resetCapabilitiesCache()` - Clear cache
- `needsCompanionTabForSingleTabGroup()` - Opera-specific check

### Uncovered Code Analysis

| Lines | Function | Description |
|-------|----------|-------------|
| 24-25 | `detectBrowser` | Brave API check and catch block |
| 45 | `initBrowserCapabilities` | Cache hit return path |
| 58 | `initBrowserCapabilities` | Brave detection log |
| 65-86 | `getBrowserCapabilities`, `getCachedCapabilities`, `resetCapabilitiesCache`, `needsCompanionTabForSingleTabGroup` | Utility functions |

### Test Cases Needed

```typescript
// src/utils/__tests__/browser.test.ts

describe('browser utilities', () => {
  beforeEach(() => {
    resetCapabilitiesCache();
  });

  describe('detectBrowser', () => {
    it('should detect Brave via API', async () => {
      const nav = navigator as any;
      nav.brave = { isBrave: () => Promise.resolve(true) };
      
      const result = await detectBrowser();
      
      expect(result).toBe('brave');
    });

    it('should handle Brave API error gracefully', async () => {
      const nav = navigator as any;
      nav.brave = { isBrave: () => Promise.reject(new Error('Not available')) };
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      
      const result = await detectBrowser();
      
      expect(result).toBe('chrome');
    });

    it('should detect Edge', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Edg/120.0.0.0',
        configurable: true,
      });
      
      const result = await detectBrowser();
      
      expect(result).toBe('edge');
    });

    it('should detect Opera', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 OPR/120.0.0.0',
        configurable: true,
      });
      
      const result = await detectBrowser();
      
      expect(result).toBe('opera');
    });

    it('should detect Firefox', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Firefox/120.0',
        configurable: true,
      });
      
      const result = await detectBrowser();
      
      expect(result).toBe('firefox');
    });

    it('should detect Chrome', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      
      const result = await detectBrowser();
      
      expect(result).toBe('chrome');
    });

    it('should default to chrome for unknown', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Unknown/1.0',
        configurable: true,
      });
      
      const result = await detectBrowser();
      
      expect(result).toBe('chrome');
    });
  });

  describe('initBrowserCapabilities', () => {
    it('should return cached capabilities on second call', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      
      const result1 = await initBrowserCapabilities();
      const result2 = await initBrowserCapabilities();
      
      expect(result1).toBe(result2);
    });

    it('should set supportsGroupCollapse to false for Firefox', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Firefox/120.0',
        configurable: true,
      });
      
      const result = await initBrowserCapabilities();
      
      expect(result).toBe(false);
    });

    it('should set supportsGroupCollapse to true for Chrome', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      
      const result = await initBrowserCapabilities();
      
      expect(result).toBe(true);
    });

    it('should set supportsSingleTabGroups to false for Opera', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 OPR/120.0.0.0',
        configurable: true,
      });
      
      await initBrowserCapabilities();
      const caps = getCachedCapabilities();
      
      expect(caps?.supportsSingleTabGroups).toBe(false);
    });

    it('should log Brave detection', async () => {
      const nav = navigator as any;
      nav.brave = { isBrave: () => Promise.resolve(true) };
      
      await initBrowserCapabilities();
      
      expect(logger.info).toHaveBeenCalledWith(
        '[initBrowserCapabilities] Brave detected - visual refresh workaround enabled'
      );
    });
  });

  describe('getBrowserCapabilities', () => {
    it('should return capabilities after initialization', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      
      const caps = await getBrowserCapabilities();
      
      expect(caps.vendor).toBe('chrome');
      expect(caps.supportsGroupCollapse).toBe(true);
      expect(caps.supportsSingleTabGroups).toBe(true);
    });

    it('should initialize if not cached', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      
      expect(getCachedCapabilities()).toBeNull();
      
      const caps = await getBrowserCapabilities();
      
      expect(caps).not.toBeNull();
    });
  });

  describe('getCachedCapabilities', () => {
    it('should return null when not initialized', () => {
      expect(getCachedCapabilities()).toBeNull();
    });

    it('should return capabilities after initialization', async () => {
      await initBrowserCapabilities();
      
      expect(getCachedCapabilities()).not.toBeNull();
    });
  });

  describe('resetCapabilitiesCache', () => {
    it('should clear cached capabilities', async () => {
      await initBrowserCapabilities();
      expect(getCachedCapabilities()).not.toBeNull();
      
      resetCapabilitiesCache();
      
      expect(getCachedCapabilities()).toBeNull();
    });
  });

  describe('needsCompanionTabForSingleTabGroup', () => {
    it('should return true for Opera', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 OPR/120.0.0.0',
        configurable: true,
      });
      
      await initBrowserCapabilities();
      
      expect(needsCompanionTabForSingleTabGroup()).toBe(true);
    });

    it('should return false for Chrome', async () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 Chrome/120.0.0.0',
        configurable: true,
      });
      
      await initBrowserCapabilities();
      
      expect(needsCompanionTabForSingleTabGroup()).toBe(false);
    });

    it('should return false when not initialized', () => {
      expect(needsCompanionTabForSingleTabGroup()).toBe(false);
    });
  });
});
```

### Mock Setup

```typescript
// Mock logger
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock navigator
const mockUserAgent = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
};
```

---

## 2. cn.ts

**Current Coverage:** 42.85%  
**Target Coverage:** 70%  
**Uncovered Lines:** 9-20, 35-42

### File Analysis

Styling utility functions:
- `cn()` - Class name merger (already tested)
- `getIslandBorderColor()` - Map color name to hex
- `getBorderRadiusClass()` - Map radius name to Tailwind class
- `getBottomBorderRadiusClass()` - Map radius name to bottom-only class

### Test Cases Needed

```typescript
// src/utils/__tests__/cn.test.ts (expand existing)

describe('cn utilities', () => {
  describe('getIslandBorderColor', () => {
    it('should return correct hex for grey', () => {
      expect(getIslandBorderColor('grey')).toBe('#737373');
    });

    it('should return correct hex for blue', () => {
      expect(getIslandBorderColor('blue')).toBe('#3b82f6');
    });

    it('should return correct hex for red', () => {
      expect(getIslandBorderColor('red')).toBe('#ef4444');
    });

    it('should return correct hex for yellow', () => {
      expect(getIslandBorderColor('yellow')).toBe('#eab308');
    });

    it('should return correct hex for green', () => {
      expect(getIslandBorderColor('green')).toBe('#22c55e');
    });

    it('should return correct hex for pink', () => {
      expect(getIslandBorderColor('pink')).toBe('#ec4899');
    });

    it('should return correct hex for purple', () => {
      expect(getIslandBorderColor('purple')).toBe('#a855f7');
    });

    it('should return correct hex for cyan', () => {
      expect(getIslandBorderColor('cyan')).toBe('#06b6d4');
    });

    it('should return correct hex for orange', () => {
      expect(getIslandBorderColor('orange')).toBe('#f97316');
    });

    it('should return default grey for unknown color', () => {
      expect(getIslandBorderColor('unknown')).toBe('#737373');
    });

    it('should return default grey for empty string', () => {
      expect(getIslandBorderColor('')).toBe('#737373');
    });
  });

  describe('getBorderRadiusClass', () => {
    it('should return none class', () => {
      expect(getBorderRadiusClass('none')).toBe('rounded-none');
    });

    it('should return small class', () => {
      expect(getBorderRadiusClass('small')).toBe('rounded-sm');
    });

    it('should return medium class', () => {
      expect(getBorderRadiusClass('medium')).toBe('rounded-lg');
    });

    it('should return large class', () => {
      expect(getBorderRadiusClass('large')).toBe('rounded-xl');
    });

    it('should return full class', () => {
      expect(getBorderRadiusClass('full')).toBe('rounded-2xl');
    });

    it('should return default medium for unknown', () => {
      expect(getBorderRadiusClass('unknown')).toBe('rounded-lg');
    });
  });

  describe('getBottomBorderRadiusClass', () => {
    it('should return none class', () => {
      expect(getBottomBorderRadiusClass('none')).toBe('rounded-b-none');
    });

    it('should return small class', () => {
      expect(getBottomBorderRadiusClass('small')).toBe('rounded-b-sm');
    });

    it('should return medium class', () => {
      expect(getBottomBorderRadiusClass('medium')).toBe('rounded-b-lg');
    });

    it('should return large class', () => {
      expect(getBottomBorderRadiusClass('large')).toBe('rounded-b-xl');
    });

    it('should return full class', () => {
      expect(getBottomBorderRadiusClass('full')).toBe('rounded-b-2xl');
    });

    it('should return default medium for unknown', () => {
      expect(getBottomBorderRadiusClass('unknown')).toBe('rounded-b-lg');
    });
  });
});
```

---

## 3. useProximityGap.ts

**Current Coverage:** 69.69%  
**Target Coverage:** 70%  
**Uncovered Lines:** 31-43

### File Analysis

Hook for detecting proximity gaps during drag operations.

### Test Cases Needed

```typescript
// src/hooks/__tests__/useProximityGap.test.ts (expand existing)

describe('useProximityGap', () => {
  // Existing tests cover basic functionality - need to add:

  it('should detect gap at start of list', () => {
    // Test gap detection at index 0
  });

  it('should detect gap at end of list', () => {
    // Test gap detection at last index
  });

  it('should detect gap between items', () => {
    // Test gap detection between items
  });

  it('should return null when no gap detected', () => {
    // Test no gap case
  });

  it('should handle empty list', () => {
    // Test empty items array
  });

  it('should handle single item list', () => {
    // Test single item
  });

  it('should respect threshold distance', () => {
    // Test threshold parameter
  });
});
```

---

## 4. ScrollContainerContext.tsx

**Current Coverage:** 60%  
**Target Coverage:** 70%  
**Uncovered Lines:** 15

### File Analysis

Context for scroll container reference.

### Test Cases Needed

```typescript
// src/contexts/__tests__/ScrollContainerContext.test.tsx

import { render, screen } from '@testing-library/react';
import React from 'react';
import { useScrollContainer, ScrollContainerProvider } from '../ScrollContainerContext';

describe('ScrollContainerContext', () => {
  it('should provide container ref', () => {
    const TestComponent = () => {
      const { containerRef } = useScrollContainer();
      return <div ref={containerRef} data-testid="container">Test</div>;
    };

    render(
      <ScrollContainerProvider>
        <TestComponent />
      </ScrollContainerProvider>
    );

    expect(screen.getByTestId('container')).toBeInTheDocument();
  });

  it('should throw error when used outside provider', () => {
    const TestComponent = () => {
      useScrollContainer();
      return null;
    };

    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<TestComponent />)).toThrow(
      'useScrollContainer must be used within a ScrollContainerProvider'
    );
    
    spy.mockRestore();
  });

  it('should maintain ref across re-renders', () => {
    const refValues: React.RefObject<HTMLDivElement | null>[] = [];
    
    const TestComponent = () => {
      const { containerRef } = useScrollContainer();
      refValues.push(containerRef);
      return <div ref={containerRef}>Test</div>;
    };

    const { rerender } = render(
      <ScrollContainerProvider>
        <TestComponent />
      </ScrollContainerProvider>
    );

    rerender(
      <ScrollContainerProvider>
        <TestComponent />
      </ScrollContainerProvider>
    );

    // All refs should be the same object
    expect(refValues[0]).toBe(refValues[1]);
  });
});
```

---

## 5. search/filters/index.ts

**Current Coverage:** 62.19%  
**Target Coverage:** 70%  
**Uncovered Lines:** 37, 62, 76, 87-94, 100-107

### File Analysis

Search filter functions for bang commands.

### Uncovered Code Analysis

| Lines | Filter | Description |
|-------|--------|-------------|
| 37 | `frozenFilter` | Frozen tab check |
| 62 | `duplicateFilter` | Duplicate detection |
| 76 | `ipFilter` | IP address URL check |
| 87-94 | `groupnameFilter` | Group name matching |
| 100-107 | `groupcolorFilter` | Group color matching |

### Test Cases Needed

```typescript
// src/search/__tests__/filters.test.ts (expand existing)

describe('search filters', () => {
  // Existing tests cover some filters - need to add:

  describe('frozenFilter', () => {
    it('should return true for frozen tab', () => {
      const tab = { discarded: true } as Tab;
      const context = {} as SearchContext;
      
      expect(frozenFilter(tab, context)).toBe(true);
    });

    it('should return false for active tab', () => {
      const tab = { discarded: false } as Tab;
      const context = {} as SearchContext;
      
      expect(frozenFilter(tab, context)).toBe(false);
    });
  });

  describe('duplicateFilter', () => {
    it('should return true for duplicate tab', () => {
      const tab = { url: 'https://example.com' } as Tab;
      const duplicateMap = new Map([['https://example.com', [1, 2]]]);
      const context = { duplicateMap } as SearchContext;
      
      expect(duplicateFilter(tab, context)).toBe(true);
    });

    it('should return false for unique tab', () => {
      const tab = { url: 'https://unique.com' } as Tab;
      const duplicateMap = new Map();
      const context = { duplicateMap } as SearchContext;
      
      expect(duplicateFilter(tab, context)).toBe(false);
    });
  });

  describe('ipFilter', () => {
    it('should return true for IP address URL', () => {
      const tab = { url: 'http://192.168.1.1/page' } as Tab;
      const context = {} as SearchContext;
      
      expect(ipFilter(tab, context)).toBe(true);
    });

    it('should return false for domain URL', () => {
      const tab = { url: 'https://example.com' } as Tab;
      const context = {} as SearchContext;
      
      expect(ipFilter(tab, context)).toBe(false);
    });

    it('should return false for invalid URL', () => {
      const tab = { url: 'not-a-url' } as Tab;
      const context = {} as SearchContext;
      
      expect(ipFilter(tab, context)).toBe(false);
    });

    it('should return false for tab without URL', () => {
      const tab = {} as Tab;
      const context = {} as SearchContext;
      
      expect(ipFilter(tab, context)).toBe(false);
    });
  });

  describe('groupnameFilter', () => {
    it('should return true for matching group name', () => {
      const tab = { groupId: 1 } as Tab;
      const groups = new Map([[1, { title: 'Work Tabs' }]]);
      const context = { groups } as SearchContext;
      
      expect(groupnameFilter(tab, context, 'work')).toBe(true);
    });

    it('should return false for non-matching group name', () => {
      const tab = { groupId: 1 } as Tab;
      const groups = new Map([[1, { title: 'Work Tabs' }]]);
      const context = { groups } as SearchContext;
      
      expect(groupnameFilter(tab, context, 'personal')).toBe(false);
    });

    it('should return false for ungrouped tab', () => {
      const tab = { groupId: -1 } as Tab;
      const groups = new Map();
      const context = { groups } as SearchContext;
      
      expect(groupnameFilter(tab, context, 'work')).toBe(false);
    });

    it('should return false for unknown group', () => {
      const tab = { groupId: 999 } as Tab;
      const groups = new Map([[1, { title: 'Work' }]]);
      const context = { groups } as SearchContext;
      
      expect(groupnameFilter(tab, context, 'work')).toBe(false);
    });

    it('should handle group without title', () => {
      const tab = { groupId: 1 } as Tab;
      const groups = new Map([[1, { title: undefined }]]);
      const context = { groups } as SearchContext;
      
      expect(groupnameFilter(tab, context, 'work')).toBe(false);
    });
  });

  describe('groupcolorFilter', () => {
    it('should return true for matching group color', () => {
      const tab = { groupId: 1 } as Tab;
      const groups = new Map([[1, { color: 'blue' }]]);
      const context = { groups } as SearchContext;
      
      expect(groupcolorFilter(tab, context, 'blue')).toBe(true);
    });

    it('should return false for non-matching group color', () => {
      const tab = { groupId: 1 } as Tab;
      const groups = new Map([[1, { color: 'blue' }]]);
      const context = { groups } as SearchContext;
      
      expect(groupcolorFilter(tab, context, 'red')).toBe(false);
    });

    it('should return false for ungrouped tab', () => {
      const tab = { groupId: -1 } as Tab;
      const groups = new Map();
      const context = { groups } as SearchContext;
      
      expect(groupcolorFilter(tab, context, 'blue')).toBe(false);
    });

    it('should return false for unknown group', () => {
      const tab = { groupId: 999 } as Tab;
      const groups = new Map([[1, { color: 'blue' }]]);
      const context = { groups } as SearchContext;
      
      expect(groupcolorFilter(tab, context, 'blue')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const tab = { groupId: 1 } as Tab;
      const groups = new Map([[1, { color: 'BLUE' }]]);
      const context = { groups } as SearchContext;
      
      expect(groupcolorFilter(tab, context, 'blue')).toBe(true);
    });
  });
});
```

---

## Implementation Order

1. **browser.ts** - Most uncovered lines, critical for browser-specific behavior
2. **cn.ts** - Simple utility functions, quick wins
3. **search/filters/index.ts** - Important for search functionality
4. **useProximityGap.ts** - Single uncovered block
5. **ScrollContainerContext.tsx** - Simple context test

## Test File Locations

- `src/utils/__tests__/browser.test.ts` (NEW)
- `src/utils/__tests__/cn.test.ts` (EXPAND)
- `src/hooks/__tests__/useProximityGap.test.ts` (EXPAND)
- `src/contexts/__tests__/ScrollContainerContext.test.tsx` (NEW)
- `src/search/__tests__/filters.test.ts` (EXPAND)

## Dependencies

- `vitest` - Test framework
- `@testing-library/react` - React testing utilities
- `../utils/logger` - Logger mock
