# Components Test Coverage Plan

## Overview

This plan covers test improvements for all components in `src/components/`. Current overall coverage: **50.9%**, target: **70%**.

---

## 1. AppearanceSettingsPanel.tsx

**Current Coverage:** 28.16%  
**Target Coverage:** 70%  
**Uncovered Lines:** 93-566, 593, 612, 629-1167

### Component Analysis

This is a large settings panel component with:
- Multiple sub-components (ToggleSwitch, SliderControl, DropdownSelect, ColorPalette, CollapsibleSection)
- Tab navigation (display, tabs, groups, vault, general, dev)
- Search functionality
- Panel resizing
- Settings persistence

### Test Cases Needed

#### Sub-component Tests

```typescript
// ToggleSwitch tests
describe('ToggleSwitch', () => {
  it('should render with label and description', () => {});
  it('should toggle on click', () => {});
  it('should apply checked styles', () => {});
  it('should apply unchecked styles', () => {});
});

// SliderControl tests
describe('SliderControl', () => {
  it('should render with label and display value', () => {});
  it('should call onChange when value changes', () => {});
  it('should calculate percentage correctly', () => {});
  it('should respect min/max/step constraints', () => {});
});

// DropdownSelect tests
describe('DropdownSelect', () => {
  it('should render with selected option', () => {});
  it('should open dropdown on click', () => {});
  it('should close dropdown on outside click', () => {});
  it('should call onChange when option selected', () => {});
  it('should update position on scroll', () => {});
  it('should update position on resize', () => {});
  it('should render with portal', () => {});
});

// ColorPalette tests
describe('ColorPalette', () => {
  it('should render all color options', () => {});
  it('should highlight selected color', () => {});
  it('should call onChange on color click', () => {});
});

// CollapsibleSection tests
describe('CollapsibleSection', () => {
  it('should render collapsed by default', () => {});
  it('should expand on toggle click', () => {});
  it('should show children when expanded', () => {});
});
```

#### Main Component Tests

```typescript
describe('AppearanceSettingsPanel', () => {
  // Rendering
  it('should render when isOpen is true', () => {});
  it('should not render when isOpen is false', () => {});
  it('should render all tab buttons', () => {});
  
  // Tab Navigation
  it('should switch to display tab on click', () => {});
  it('should switch to tabs tab on click', () => {});
  it('should switch to groups tab on click', () => {});
  it('should switch to vault tab on click', () => {});
  it('should switch to general tab on click', () => {});
  it('should switch to dev tab on click', () => {});
  
  // Search
  it('should filter settings by search query', () => {});
  it('should clear search on X button click', () => {});
  
  // Panel Resizing
  it('should start resize on mousedown', () => {});
  it('should update width on mousemove', () => {});
  it('should end resize on mouseup', () => {});
  it('should clamp width to min/max bounds', () => {});
  it('should fit panel to window on open', () => {});
  it('should adjust panel on window resize', () => {});
  
  // Close Behavior
  it('should close on backdrop click', () => {});
  it('should close on X button click', () => {});
  it('should apply closing animation', () => {});
  
  // Settings Persistence
  it('should load settings from store', () => {});
  it('should save settings on change', () => {});
  it('should update store on setting change', () => {});
  
  // Responsive Behavior
  it('should wrap tabs on narrow panel', () => {});
  it('should show labels on wide panel', () => {});
});
```

### Mock Setup

```typescript
// Mock store
const mockStore = {
  appearanceSettings: defaultAppearanceSettings,
  setAppearanceSettings: vi.fn(),
  vaultQuota: { used: 0, total: 102400, percentage: 0 },
  setVaultSyncEnabled: vi.fn(),
  settingsPanelWidth: 400,
  setSettingsPanelWidth: vi.fn(),
};

vi.mock('../store/useStore', () => ({
  useStore: vi.fn((selector) => selector(mockStore)),
  defaultAppearanceSettings,
}));

// Mock portal
vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (children: React.ReactNode) => children,
}));

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 });
Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });
```

### Dependencies

- `../store/useStore` - Settings state
- `../constants` - UI constants
- `../utils/cn` - Class name utility

---

## 2. CompressionWarning.tsx

**Current Coverage:** 0%  
**Target Coverage:** 70%  
**Uncovered Lines:** 11-18

### Component Analysis

Simple warning banner that displays compression tier information.

### Test Cases Needed

```typescript
describe('CompressionWarning', () => {
  it('should return null for full tier', () => {
    render(<CompressionWarning tier="full" onDismiss={vi.fn()} />);
    expect(screen.queryByText(/removed/)).not.toBeInTheDocument();
  });

  it('should show minimal tier message', () => {
    render(<CompressionWarning tier="minimal" onDismiss={vi.fn()} />);
    expect(screen.getByText(/Some visual data removed/)).toBeInTheDocument();
  });

  it('should show partial tier message', () => {
    render(<CompressionWarning tier="partial" onDismiss={vi.fn()} />);
    expect(screen.getByText(/Favicons removed/)).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button clicked', async () => {
    const onDismiss = vi.fn();
    render(<CompressionWarning tier="partial" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

### Mock Setup

```typescript
// No special mocks needed - pure presentational component
```

---

## 3. Dashboard.tsx

**Current Coverage:** 38.92%  
**Target Coverage:** 70%  
**Uncovered Lines:** 131-222, 226-234, 239-430

### Component Analysis

Core orchestration component handling:
- DnD context setup
- Panel resizing
- Tab/group operations
- Vault operations
- Island creation

### Test Cases Needed

```typescript
describe('Dashboard', () => {
  // Rendering
  it('should render LivePanel and VaultPanel', () => {});
  it('should render Sidebar', () => {});
  it('should apply dark mode class', () => {});
  
  // Panel Resizing
  it('should start resize on divider mousedown', () => {});
  it('should update divider position on mousemove', () => {});
  it('should stop resize on mouseup', () => {});
  it('should clamp divider position to bounds', () => {});
  
  // Tab Operations
  it('should activate tab on click', async () => {});
  it('should close tab on close button', async () => {});
  it('should handle tab click error gracefully', async () => {});
  
  // DnD - Drag Start
  it('should set active item on drag start', () => {});
  it('should detect vault item drag', () => {});
  it('should detect group drag', () => {});
  it('should add pending operation on drag start', () => {});
  
  // DnD - Drag Over
  it('should move item optimistically on drag over', () => {});
  it('should skip create-island dropzone on drag over', () => {});
  
  // DnD - Drag End - Vault Operations
  it('should move to vault on vault drop', async () => {});
  it('should reorder vault items on vault-to-vault drop', async () => {});
  it('should restore from vault on live drop', async () => {});
  
  // DnD - Drag End - Island Creation
  it('should create island from tab on dropzone', async () => {});
  it('should reject pinned tab for island creation', async () => {});
  it('should handle island creation error', async () => {});
  
  // DnD - Drag End - Live Operations
  it('should execute MoveTabCommand on live drop', async () => {});
  it('should execute MoveIslandCommand on group drop', async () => {});
  
  // Quota Handling
  it('should handle quota exceeded action', async () => {});
  it('should switch to local storage on quota action', async () => {});
  
  // Compression Warning
  it('should show compression warning when needed', () => {});
  it('should dismiss compression warning', () => {});
});
```

### Mock Setup

```typescript
// Mock DnD kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => children,
  closestCorners: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  DragOverlay: ({ children }: any) => children,
  defaultDropAnimationSideEffects: vi.fn(),
  MeasuringStrategy: {},
}));

vi.mock('@dnd-kit/sortable', () => ({
  sortableKeyboardCoordinates: vi.fn(),
}));

// Mock chrome API
const chromeMock = {
  tabs: {
    update: vi.fn(),
    get: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', chromeMock);

// Mock store
const mockStore = {
  islands: [],
  vault: [],
  isDarkMode: true,
  // ... other store properties
};
```

### Dependencies

- `@dnd-kit/core` - DnD orchestration
- `@dnd-kit/sortable` - Sortable utilities
- `../store/useStore` - State management
- `../utils/chromeApi` - Chrome API wrappers
- `../store/commands/*` - Command pattern

---

## 4. QuotaExceededModal.tsx

**Current Coverage:** 20%  
**Target Coverage:** 70%  
**Uncovered Lines:** 21-104

### Component Analysis

Modal displayed when sync storage quota is exceeded. Shows options to switch to local storage or free space.

### Test Cases Needed

```typescript
describe('QuotaExceededModal', () => {
  // Rendering
  it('should not render when closed', () => {
    render(<QuotaExceededModal isOpen={false} bytesUsed={50000} bytesAvailable={-1000} onAction={vi.fn()} />);
    expect(screen.queryByText('Sync Storage Full')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<QuotaExceededModal isOpen={true} bytesUsed={50000} bytesAvailable={-1000} onAction={vi.fn()} />);
    expect(screen.getByText('Sync Storage Full')).toBeInTheDocument();
  });

  // Byte Formatting
  it('should format bytes under 1KB correctly', () => {
    render(<QuotaExceededModal isOpen={true} bytesUsed={500} bytesAvailable={-100} onAction={vi.fn()} />);
    expect(screen.getByText(/500 B/)).toBeInTheDocument();
  });

  it('should format bytes over 1KB correctly', () => {
    render(<QuotaExceededModal isOpen={true} bytesUsed={50000} bytesAvailable={-1000} onAction={vi.fn()} />);
    expect(screen.getByText(/48.8 KB/)).toBeInTheDocument();
  });

  // Actions
  it('should call onAction with switch-local on button click', async () => {
    const onAction = vi.fn();
    render(<QuotaExceededModal isOpen={true} bytesUsed={50000} bytesAvailable={-1000} onAction={onAction} />);
    await userEvent.click(screen.getByText('Switch to Local Storage'));
    expect(onAction).toHaveBeenCalledWith('switch-local');
  });

  it('should call onAction with free-space on button click', async () => {
    const onAction = vi.fn();
    render(<QuotaExceededModal isOpen={true} bytesUsed={50000} bytesAvailable={-1000} onAction={onAction} />);
    await userEvent.click(screen.getByText('Free Up Space'));
    expect(onAction).toHaveBeenCalledWith('free-space');
  });

  it('should call onAction with cancel on button click', async () => {
    const onAction = vi.fn();
    render(<QuotaExceededModal isOpen={true} bytesUsed={50000} bytesAvailable={-1000} onAction={onAction} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(onAction).toHaveBeenCalledWith('cancel');
  });

  // Styling
  it('should have correct modal styling', () => {
    const { container } = render(<QuotaExceededModal isOpen={true} bytesUsed={50000} bytesAvailable={-1000} onAction={vi.fn()} />);
    expect(container.querySelector('.bg-gx-gray')).toBeInTheDocument();
  });
});
```

### Mock Setup

```typescript
// No special mocks needed - pure presentational component
```

---

## 5. Sidebar.tsx

**Current Coverage:** 54.8%  
**Target Coverage:** 70%  
**Uncovered Lines:** 89-99, 136-189, 219, 232-257

### Component Analysis

Navigation sidebar with:
- Vault toggle
- Settings button
- Search functionality
- Keyboard shortcuts

### Test Cases Needed

```typescript
describe('Sidebar', () => {
  // Rendering
  it('should render vault toggle button', () => {});
  it('should render settings button', () => {});
  it('should render search button', () => {});
  
  // Vault Toggle
  it('should toggle vault visibility', async () => {});
  it('should show active state when vault visible', () => {});
  
  // Settings
  it('should open settings panel on click', async () => {});
  
  // Search
  it('should open search on click', async () => {});
  it('should open search on keyboard shortcut', async () => {});
  it('should close search on escape', async () => {});
  
  // Keyboard Shortcuts
  it('should handle keyboard shortcuts', async () => {});
  it('should prevent default on shortcut', async () => {});
  
  // Appearance
  it('should apply custom styles from settings', () => {});
  it('should show tooltips on hover', async () => {});
});
```

### Mock Setup

```typescript
const mockStore = {
  showVault: true,
  setShowVault: vi.fn(),
  showAppearancePanel: false,
  setShowAppearancePanel: vi.fn(),
  appearanceSettings: defaultAppearanceSettings,
};

vi.mock('../store/useStore', () => ({
  useStore: vi.fn((selector) => selector(mockStore)),
}));
```

---

## 6. TabCard.tsx

**Current Coverage:** 51.32%  
**Target Coverage:** 70%  
**Uncovered Lines:** 6, 171, 260-288, 316-374

### Component Analysis

Tab card component with:
- Favicon display
- Audio/frozen indicators
- Context menu
- DnD integration
- Click/double-click handlers

### Test Cases Needed

```typescript
describe('TabCard', () => {
  // Existing tests cover basic rendering - need to add:
  
  // Context Menu
  it('should open context menu on right click', async () => {});
  it('should close context menu on outside click', async () => {});
  it('should show all menu options', async () => {});
  
  // Menu Actions
  it('should close tab on menu action', async () => {});
  it('should discard tab on menu action', async () => {});
  it('should pin/unpin tab on menu action', async () => {});
  it('should mute/unmute tab on menu action', async () => {});
  it('should duplicate tab on menu action', async () => {});
  it('should copy URL on menu action', async () => {});
  it('should ungroup tab on menu action', async () => {});
  
  // Double Click
  it('should toggle collapse on double click for grouped tab', async () => {});
  
  // Audio Indicator
  it('should show audio indicator when audible', () => {});
  it('should show muted indicator when muted', () => {});
  it('should toggle mute on audio button click', async () => {});
  
  // Frozen State
  it('should show frozen indicator when discarded', () => {});
  it('should have reduced opacity when frozen', () => {});
  
  // Active State
  it('should highlight active tab', () => {});
  
  // DnD Overlay
  it('should render as overlay with isOverlay prop', () => {});
  it('should apply drag styles when dragging', () => {});
});
```

### Mock Setup

```typescript
// See existing TabCard.test.tsx for patterns
// Need to add context menu mocks
vi.mock('./ContextMenu', () => ({
  ContextMenu: ({ isOpen, items }: any) => 
    isOpen ? <div data-testid="context-menu">{items.length} items</div> : null,
}));
```

---

## 7. VaultPanel.tsx

**Current Coverage:** 64%  
**Target Coverage:** 70%  
**Uncovered Lines:** 79-111, 146-158, 248-249

### Component Analysis

Vault panel with:
- Vault item list
- Group management
- Drag and drop
- Search integration

### Test Cases Needed

```typescript
describe('VaultPanel', () => {
  // Existing tests cover basic rendering - need to add:
  
  // Empty State
  it('should show empty state when vault is empty', () => {});
  it('should show helpful message in empty state', () => {});
  
  // Group Operations
  it('should create new group', async () => {});
  it('should rename group', async () => {});
  it('should delete group', async () => {});
  it('should toggle group collapse', async () => {});
  
  // Item Operations
  it('should restore item from vault', async () => {});
  it('should delete item from vault', async () => {});
  it('should show item count per group', () => {});
  
  // Drag and Drop
  it('should accept dropped items', async () => {});
  it('should show drop indicator', () => {});
  
  // Search
  it('should filter items by search query', () => {});
  it('should highlight matching text', () => {});
});
```

---

## 8. LivePanel.tsx

**Current Coverage:** 61.3%  
**Target Coverage:** 70%  
**Uncovered Lines:** 7, 327-364, 440, 535-562

### Component Analysis

Live panel with:
- Island/tab list
- Group operations
- Drag and drop
- Context menu

### Test Cases Needed

```typescript
describe('LivePanel', () => {
  // Existing tests cover basic rendering - need to add:
  
  // Group Operations
  it('should create new group from ungrouped tabs', async () => {});
  it('should rename group', async () => {});
  it('should ungroup all tabs', async () => {});
  it('should toggle group collapse', async () => {});
  it('should sort groups to top', async () => {});
  
  // Tab Operations
  it('should close all tabs in group', async () => {});
  it('should delete duplicate tabs', async () => {});
  
  // Drag and Drop
  it('should show create island dropzone', () => {});
  it('should accept dropped items', async () => {});
  
  // Context Menu
  it('should show group context menu', async () => {});
  it('should show tab context menu', async () => {});
  
  // Search
  it('should filter items by search', () => {});
  it('should show search results count', () => {});
});
```

---

## 9. Island.tsx

**Current Coverage:** 62.74%  
**Target Coverage:** 70%  
**Uncovered Lines:** 294-332, 354-359, 383-385

### Component Analysis

Island (group) component with:
- Tab list
- Collapse/expand
- Rename functionality
- Color indicator

### Test Cases Needed

```typescript
describe('Island', () => {
  // Existing tests cover basic rendering - need to add:
  
  // Rename
  it('should enter rename mode on double click', async () => {});
  it('should save rename on enter', async () => {});
  it('should cancel rename on escape', async () => {});
  it('should save rename on blur', async () => {});
  
  // Collapse
  it('should toggle collapse on click', async () => {});
  it('should show collapsed state', () => {});
  it('should show expanded state', () => {});
  
  // Color
  it('should display group color', () => {});
  it('should apply color to border', () => {});
  
  // Tab Count
  it('should show tab count', () => {});
  it('should show frozen count', () => {});
  
  // DnD
  it('should be draggable', () => {});
  it('should accept dropped tabs', async () => {});
  it('should render as overlay', () => {});
});
```

---

## 10. SearchBar/index.tsx

**Current Coverage:** 49.18%  
**Target Coverage:** 70%  
**Uncovered Lines:** 4, 173, 200, 206, 306-321

### Component Analysis

Search bar with:
- Query input
- Scope toggle
- Help display
- Keyboard navigation

### Test Cases Needed

```typescript
describe('SearchBar', () => {
  // Existing tests cover basic functionality - need to add:
  
  // Scope Toggle
  it('should toggle search scope', async () => {});
  it('should show current scope', () => {});
  
  // Help
  it('should show help on button click', async () => {});
  it('should show help on ? key', async () => {});
  it('should hide help on escape', async () => {});
  
  // Keyboard Navigation
  it('should navigate results with arrow keys', async () => {});
  it('should select result on enter', async () => {});
  it('should close on escape', async () => {});
  
  // Results Display
  it('should show results dropdown', () => {});
  it('should show no results message', () => {});
  it('should highlight matching text', () => {});
  
  // Clear
  it('should clear input on X click', async () => {});
  it('should clear on escape when empty', async () => {});
});
```

---

## Implementation Order

1. **CompressionWarning.tsx** - Smallest, easiest to complete
2. **QuotaExceededModal.tsx** - Small, self-contained
3. **AppearanceSettingsPanel.tsx** - Large but critical
4. **Dashboard.tsx** - Core component
5. **Sidebar.tsx** - Medium complexity
6. **TabCard.tsx** - Expand existing tests
7. **VaultPanel.tsx** - Expand existing tests
8. **LivePanel.tsx** - Expand existing tests
9. **Island.tsx** - Expand existing tests
10. **SearchBar/index.tsx** - Expand existing tests

## Test File Locations

All component tests should be placed in `src/components/__tests__/`:
- `AppearanceSettingsPanel.test.tsx` (NEW)
- `CompressionWarning.test.tsx` (NEW)
- `QuotaExceededModal.test.tsx` (NEW)
- `Dashboard.test.tsx` (EXPAND existing `Dashboard.dnd.test.tsx`)
- `Sidebar.test.tsx` (EXPAND existing)
- `TabCard.test.tsx` (EXPAND existing)
- `VaultPanel.test.tsx` (EXPAND existing)
- `LivePanel.test.tsx` (EXPAND existing)
- `Island.test.tsx` (EXPAND existing)
- `SearchBar.test.tsx` (EXPAND existing)
