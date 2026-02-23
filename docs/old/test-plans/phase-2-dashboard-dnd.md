# Phase 2: Dashboard DnD Tests

**Target Coverage:** 70%+
**Estimated Tests:** ~150
**Priority:** HIGH
**Duration:** ~3-4 hours

---

## Overview

The Dashboard component orchestrates all drag-and-drop interactions. Current tests in `Dashboard.dnd.test.tsx` are **empty stubs** - they render components but make no assertions. This phase fills those stubs with real tests.

Current coverage:
- `Dashboard.tsx`: 37.5%
- `LivePanel.tsx`: 46.42%
- `VaultPanel.tsx`: 64%

---

## Files to Modify

```
src/components/__tests__/
├── Dashboard.dnd.test.tsx    # Fill empty stubs
├── Dashboard.test.tsx        # Create if missing (unit tests)
├── LivePanel.test.tsx        # Expand existing
└── VaultPanel.test.tsx       # Expand existing
```

---

## Part 1: Fix `Dashboard.dnd.test.tsx`

### Current Problem

Lines 189-259 contain empty test bodies:

```typescript
it('drag tab within Live panel reorders correctly', () => {
  render(<Dashboard />);
  // NO ASSERTIONS
});
```

### Required Changes

#### Test Utilities Setup

```typescript
import { fireEvent, waitFor, act } from '@testing-library/react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';

// Helper to simulate drag
const simulateDrag = async (
  activeId: string,
  overId: string,
  context: ReturnType<typeof render>
) => {
  const dndContext = context.getByTestId('dnd-context');
  
  // Trigger internal DndContext events
  act(() => {
    // Find the DndContext's onDragEnd handler and call it
    // This requires exposing the handler or using a different approach
  });
};
```

### Test Suite: Basic Rendering

| Test | Current | Required Assertions |
|------|---------|---------------------|
| renders without crashing | ✓ | Keep |
| renders Live Panel | ✓ | Keep |
| renders Vault Panel when showVault is true | ✓ | Keep |
| hides Vault Panel when showVault is false | ✓ | Keep |
| renders Create Zone | ✓ | Keep |
| **NEW:** shows divider when showVault is true | Missing | Divider element present |
| **NEW:** hides divider when showVault is false | Missing | Divider not in DOM |
| **NEW:** applies dark mode class | Missing | Check `dark` class on container |

### Test Suite: Drag Operations

#### Test: `drag tab within Live panel reorders correctly`

```typescript
it('drag tab within Live panel reorders correctly', async () => {
  const mockIslands = [
    { id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com' },
    { id: 'live-tab-2', title: 'Tab 2', url: 'https://b.com' },
  ];
  mockStore.islands = mockIslands;
  
  render(<Dashboard />);
  
  // Simulate drag from tab-1 to position after tab-2
  // Verify moveItemOptimistically called with ('live-tab-1', 'live-gap-2')
  await waitFor(() => {
    expect(mockStore.moveItemOptimistically).toHaveBeenCalledWith(
      'live-tab-1',
      'live-gap-2'
    );
  });
});
```

#### Test: `drag island within Live panel reorders correctly`

```typescript
it('drag island within Live panel reorders correctly', async () => {
  const mockIslands = [
    { id: 'live-group-1', title: 'Group A', tabs: [{ id: 'live-tab-1' }] },
    { id: 'live-group-2', title: 'Group B', tabs: [{ id: 'live-tab-2' }] },
  ];
  mockStore.islands = mockIslands;
  
  render(<Dashboard />);
  
  // Simulate island reorder
  await waitFor(() => {
    expect(mockStore.moveItemOptimistically).toHaveBeenCalledWith(
      'live-group-1',
      expect.stringContaining('live-gap-')
    );
  });
});
```

#### Test: `drag tab from Live to Vault triggers moveToVault`

```typescript
it('drag tab from Live to Vault triggers moveToVault', async () => {
  mockStore.islands = [{ id: 'live-tab-1', title: 'Tab 1' }];
  mockStore.vault = [];
  mockStore.showVault = true;
  
  render(<Dashboard />);
  
  // Simulate drag to vault-dropzone
  // Verify moveToVault called
  await waitFor(() => {
    expect(mockStore.moveToVault).toHaveBeenCalledWith('live-tab-1');
  });
});
```

#### Test: `drag island from Live to Vault archives all tabs`

```typescript
it('drag island from Live to Vault archives all tabs', async () => {
  mockStore.islands = [
    { id: 'live-group-1', title: 'Group', tabs: [
      { id: 'live-tab-1' },
      { id: 'live-tab-2' },
    ]},
  ];
  
  render(<Dashboard />);
  
  // Simulate drag island to vault
  await waitFor(() => {
    expect(mockStore.moveToVault).toHaveBeenCalledWith('live-group-1');
  });
});
```

#### Test: `drag tab from Vault to Live triggers restoreFromVault`

```typescript
it('drag tab from Vault to Live triggers restoreFromVault', async () => {
  mockStore.vault = [{ id: 'vault-tab-1-123', title: 'Archived Tab' }];
  mockStore.islands = [];
  
  render(<Dashboard />);
  
  // Simulate drag from vault to live-panel-dropzone
  await waitFor(() => {
    expect(mockStore.restoreFromVault).toHaveBeenCalledWith('vault-tab-1-123');
  });
});
```

#### Test: `drag island from Vault to Live restores all tabs`

```typescript
it('drag island from Vault to Live restores all tabs', async () => {
  mockStore.vault = [
    { id: 'vault-group-1-123', title: 'Archived Group', tabs: [
      { id: 'vault-tab-1-123' },
      { id: 'vault-tab-2-123' },
    ]},
  ];
  
  render(<Dashboard />);
  
  await waitFor(() => {
    expect(mockStore.restoreFromVault).toHaveBeenCalled();
  });
});
```

#### Test: `drag tab to create zone triggers createIsland`

```typescript
it('drag tab to create zone triggers createIsland', async () => {
  mockStore.islands = [{ id: 'live-tab-1', title: 'Tab 1' }];
  
  render(<Dashboard />);
  
  // Simulate drag to create-zone
  await waitFor(() => {
    expect(mockStore.createIsland).toHaveBeenCalled();
  });
});
```

#### Test: `drag disabled during isUpdating lock`

```typescript
it('drag disabled during isUpdating lock', async () => {
  mockStore.isUpdating = true;
  
  render(<Dashboard />);
  
  // Attempt drag - should be blocked
  // Verify no moveItemOptimistically call
  expect(mockStore.moveItemOptimistically).not.toHaveBeenCalled();
});
```

### Test Suite: State Management

#### Test: `optimistic update applied immediately on drag start`

```typescript
it('optimistic update applied immediately on drag start', async () => {
  mockStore.islands = [
    { id: 'live-tab-1' },
    { id: 'live-tab-2' },
  ];
  
  render(<Dashboard />);
  
  // Start drag
  // Verify state updates before Chrome API call
  expect(mockStore.moveItemOptimistically).toHaveBeenCalled();
});
```

#### Test: `syncLiveTabs called on drag end`

```typescript
it('syncLiveTabs called on drag end', async () => {
  render(<Dashboard />);
  
  // Complete a drag operation
  await waitFor(() => {
    expect(mockStore.syncLiveTabs).toHaveBeenCalled();
  });
});
```

#### Test: `cross-panel drag blocked when showVault=false`

```typescript
it('cross-panel drag blocked when showVault=false', async () => {
  mockStore.showVault = false;
  mockStore.islands = [{ id: 'live-tab-1' }];
  
  render(<Dashboard />);
  
  // Vault dropzone should not exist
  expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
});
```

### Test Suite: Visual Feedback

#### Test: `drag overlay shows correct preview`

```typescript
it('drag overlay shows correct preview', async () => {
  mockStore.islands = [{ id: 'live-tab-1', title: 'My Tab' }];
  
  render(<Dashboard />);
  
  // Start drag
  // Verify drag overlay contains tab preview
  await waitFor(() => {
    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay).toHaveTextContent('My Tab');
  });
});
```

#### Test: `keyboard drag works with space/arrow keys`

```typescript
it('keyboard drag works with space/arrow keys', async () => {
  mockStore.islands = [
    { id: 'live-tab-1' },
    { id: 'live-tab-2' },
  ];
  
  render(<Dashboard />);
  
  // Focus on tab, press Space to start drag
  // Press ArrowDown to move
  // Press Space to drop
  
  await waitFor(() => {
    expect(mockStore.moveItemOptimistically).toHaveBeenCalled();
  });
});
```

### Test Suite: Panel Interactions

#### Test: `updates divider position on drag`

```typescript
it('updates divider position on drag', async () => {
  render(<Dashboard />);
  
  // Find divider
  const divider = screen.getByRole('separator');
  
  // Simulate drag
  fireEvent.mouseDown(divider);
  fireEvent.mouseMove(window, { clientX: 500 });
  fireEvent.mouseUp(window);
  
  expect(mockStore.setDividerPosition).toHaveBeenCalled();
});
```

#### Test: `persists divider position to settings`

```typescript
it('persists divider position to settings', async () => {
  render(<Dashboard />);
  
  // Drag divider
  // Verify settingsService.saveSettings called
  
  await waitFor(() => {
    // Check if settings were saved (may be debounced)
  });
});
```

---

## Part 2: Expand `LivePanel.test.tsx`

### Missing Coverage Areas

| Lines | Feature | Tests Needed |
|-------|---------|--------------|
| 94-113 | Search integration | Query changes, results display |
| 123 | Creating island indicator | Visual state |
| 134-148 | Action buttons | Delete duplicates, sort groups |
| 169-180 | Divider width | Responsive width calculation |
| 202-213 | Empty state | No tabs message |
| 258-307 | Group actions | Collapse/expand all |
| 535-562 | Scroll to creating tab | Auto-scroll behavior |

### New Tests

```typescript
describe('LivePanel - Search Integration', () => {
  it('updates search query on input change', async () => {
    render(<LivePanel {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tabs...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    expect(mockSetSearchQuery).toHaveBeenCalledWith('test query');
  });

  it('shows search results when isSearching is true', () => {
    mockStore.isSearching = true;
    mockStore.searchResults = [{ id: 'live-tab-1', title: 'Match' }];
    
    render(<LivePanel {...defaultProps} />);
    
    // Verify search results rendered
  });

  it('clears search on escape key', async () => {
    render(<LivePanel {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search tabs...');
    fireEvent.keyDown(searchInput, { key: 'Escape' });
    
    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
  });
});

describe('LivePanel - Empty State', () => {
  it('shows empty state when no tabs', () => {
    render(<LivePanel {...defaultProps} islands={[]} />);
    
    expect(screen.getByText(/no tabs/i)).toBeInTheDocument();
  });

  it('shows helpful message in empty state', () => {
    render(<LivePanel {...defaultProps} islands={[]} />);
    
    expect(screen.getByText(/open some tabs/i)).toBeInTheDocument();
  });
});

describe('LivePanel - Group Actions', () => {
  it('collapses all groups', async () => {
    const islands = [
      { id: 'live-group-1', tabs: [], collapsed: false },
      { id: 'live-group-2', tabs: [], collapsed: false },
    ];
    
    render(<LivePanel {...defaultProps} islands={islands} />);
    
    const collapseAllBtn = screen.getByTitle('Collapse All');
    fireEvent.click(collapseAllBtn);
    
    // Verify toggleLiveGroupCollapse called for each
  });

  it('expands all groups', async () => {
    const islands = [
      { id: 'live-group-1', tabs: [], collapsed: true },
      { id: 'live-group-2', tabs: [], collapsed: true },
    ];
    
    render(<LivePanel {...defaultProps} islands={islands} />);
    
    const expandAllBtn = screen.getByTitle('Expand All');
    fireEvent.click(expandAllBtn);
  });
});

describe('LivePanel - Virtual List', () => {
  it('renders virtualized list for many items', () => {
    const manyIslands = Array.from({ length: 100 }, (_, i) => ({
      id: `live-tab-${i}`,
      title: `Tab ${i}`,
    }));
    
    render(<LivePanel {...defaultProps} islands={manyIslands} />);
    
    // Verify virtualizer was used (not all 100 rendered)
  });
});

describe('LivePanel - Scroll Behavior', () => {
  it('scrolls to creating tab', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    
    render(
      <LivePanel 
        {...defaultProps} 
        isCreatingIsland={true}
        creatingTabId="live-tab-50"
      />
    );
    
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});
```

---

## Part 3: Expand `VaultPanel.test.tsx`

### Missing Coverage Areas

| Lines | Feature | Tests Needed |
|-------|---------|--------------|
| 74-76 | Empty state | No vault items |
| 100 | Quota display | Percentage shown |
| 109-111 | Sync toggle | Enable/disable sync |
| 146-158 | Group actions | Sort, collapse |
| 248-249 | Drag handling | Restore from vault |

### New Tests

```typescript
describe('VaultPanel - Empty State', () => {
  it('shows empty state when vault is empty', () => {
    render(<VaultPanel {...defaultProps} vault={[]} />);
    
    expect(screen.getByText(/vault is empty/i)).toBeInTheDocument();
  });
});

describe('VaultPanel - Quota Display', () => {
  it('shows quota percentage', () => {
    const quota = { used: 50000, total: 100000, percentage: 0.5 };
    
    render(<VaultPanel {...defaultProps} vaultQuota={quota} />);
    
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('shows warning at 80% quota', () => {
    const quota = { used: 80000, total: 100000, percentage: 0.8, warningLevel: 'warning' };
    
    render(<VaultPanel {...defaultProps} vaultQuota={quota} />);
    
    expect(screen.getByText(/warning/i)).toBeInTheDocument();
  });

  it('shows critical at 95% quota', () => {
    const quota = { used: 95000, total: 100000, percentage: 0.95, warningLevel: 'critical' };
    
    render(<VaultPanel {...defaultProps} vaultQuota={quota} />);
    
    expect(screen.getByText(/critical/i)).toBeInTheDocument();
  });
});

describe('VaultPanel - Sync Toggle', () => {
  it('calls setVaultSyncEnabled when toggled', async () => {
    render(<VaultPanel {...defaultProps} effectiveSyncEnabled={true} />);
    
    const syncToggle = screen.getByRole('switch', { name: /sync/i });
    fireEvent.click(syncToggle);
    
    expect(mockSetVaultSyncEnabled).toHaveBeenCalledWith(false);
  });
});

describe('VaultPanel - Restore Actions', () => {
  it('restores item on double-click', async () => {
    const vaultItem = { id: 'vault-tab-1', title: 'Archived', url: 'https://example.com' };
    
    render(<VaultPanel {...defaultProps} vault={[vaultItem]} />);
    
    const item = screen.getByText('Archived');
    fireEvent.doubleClick(item);
    
    expect(mockRestoreFromVault).toHaveBeenCalledWith('vault-tab-1');
  });
});

describe('VaultPanel - Sort Groups', () => {
  it('sorts groups to top', async () => {
    render(<VaultPanel {...defaultProps} />);
    
    const sortBtn = screen.getByTitle(/sort groups/i);
    fireEvent.click(sortBtn);
    
    expect(mockSortVaultGroupsToTop).toHaveBeenCalled();
  });
});
```

---

## Part 4: Create `Dashboard.test.tsx` (Unit Tests)

### New File: `src/components/__tests__/Dashboard.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Focus on non-DnD unit tests here

describe('Dashboard - Unit Tests', () => {
  describe('Panel Visibility', () => {
    it('shows only Live panel when showVault is false', () => {
      mockStore.showVault = false;
      render(<Dashboard />);
      
      expect(screen.getByTestId('live-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('vault-panel')).not.toBeInTheDocument();
    });

    it('shows both panels when showVault is true', () => {
      mockStore.showVault = true;
      render(<Dashboard />);
      
      expect(screen.getByTestId('live-panel')).toBeInTheDocument();
      expect(screen.getByTestId('vault-panel')).toBeInTheDocument();
    });
  });

  describe('Divider', () => {
    it('renders divider between panels', () => {
      mockStore.showVault = true;
      render(<Dashboard />);
      
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('applies divider position to panel widths', () => {
      mockStore.showVault = true;
      mockStore.dividerPosition = 60;
      render(<Dashboard />);
      
      const livePanel = screen.getByTestId('live-panel');
      expect(livePanel).toHaveStyle({ width: '60%' });
    });
  });

  describe('Settings Panel', () => {
    it('shows settings panel when showAppearancePanel is true', () => {
      mockStore.showAppearancePanel = true;
      render(<Dashboard />);
      
      expect(screen.getByTestId('appearance-settings')).toBeInTheDocument();
    });

    it('hides settings panel by default', () => {
      mockStore.showAppearancePanel = false;
      render(<Dashboard />);
      
      expect(screen.queryByTestId('appearance-settings')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      mockStore.isLoading = true;
      render(<Dashboard />);
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });
  });

  describe('Quota Modal', () => {
    it('shows quota exceeded modal when pending', () => {
      mockStore.quotaExceededPending = { success: false, error: 'QUOTA_EXCEEDED' };
      render(<Dashboard />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Undo/Redo', () => {
    it('enables undo button when canUndo is true', () => {
      mockStore.canUndo = true;
      render(<Dashboard />);
      
      const undoBtn = screen.getByTitle('Undo');
      expect(undoBtn).not.toBeDisabled();
    });

    it('enables redo button when canRedo is true', () => {
      mockStore.canRedo = true;
      render(<Dashboard />);
      
      const redoBtn = screen.getByTitle('Redo');
      expect(redoBtn).not.toBeDisabled();
    });

    it('calls undo on button click', async () => {
      mockStore.canUndo = true;
      render(<Dashboard />);
      
      const undoBtn = screen.getByTitle('Undo');
      fireEvent.click(undoBtn);
      
      expect(mockStore.undo).toHaveBeenCalled();
    });
  });

  describe('Theme', () => {
    it('applies dark mode class when isDarkMode is true', () => {
      mockStore.isDarkMode = true;
      render(<Dashboard />);
      
      const container = screen.getByTestId('dashboard-container');
      expect(container).toHaveClass('dark');
    });

    it('applies light mode by default', () => {
      mockStore.isDarkMode = false;
      render(<Dashboard />);
      
      const container = screen.getByTestId('dashboard-container');
      expect(container).not.toHaveClass('dark');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('triggers undo on Ctrl+Z', async () => {
      mockStore.canUndo = true;
      render(<Dashboard />);
      
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      
      expect(mockStore.undo).toHaveBeenCalled();
    });

    it('triggers redo on Ctrl+Shift+Z', async () => {
      mockStore.canRedo = true;
      render(<Dashboard />);
      
      fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
      
      expect(mockStore.redo).toHaveBeenCalled();
    });

    it('triggers redo on Ctrl+Y', async () => {
      mockStore.canRedo = true;
      render(<Dashboard />);
      
      fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
      
      expect(mockStore.redo).toHaveBeenCalled();
    });
  });
});
```

---

## Verification Commands

```bash
# Run component tests
npx vitest run src/components/__tests__

# Coverage for components
npx vitest run --coverage src/components

# Specific files
npx vitest run src/components/__tests__/Dashboard.dnd.test.tsx
npx vitest run src/components/__tests__/LivePanel.test.tsx
npx vitest run src/components/__tests__/VaultPanel.test.tsx
```

---

## Success Criteria

- [ ] No empty test bodies in `Dashboard.dnd.test.tsx`
- [ ] All drag scenarios have assertions
- [ ] `Dashboard.tsx` coverage >= 70%
- [ ] `LivePanel.tsx` coverage >= 70%
- [ ] `VaultPanel.tsx` coverage >= 80%
- [ ] Search integration tested
- [ ] Empty states tested
- [ ] Keyboard shortcuts tested
