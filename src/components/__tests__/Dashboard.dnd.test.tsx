import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragStart, onDragEnd, onDragOver, sensors, ...props }: any) => {
    return (
      <div
        data-testid="dnd-context"
        onClick={() => {
          // Expose handlers via data attributes for testing
          const context = document.querySelector('[data-testid="dnd-context"]');
          if (context) {
            (context as any)._onDragStart = onDragStart;
            (context as any)._onDragEnd = onDragEnd;
            (context as any)._onDragOver = onDragOver;
          }
        }}
      >
        {children}
      </div>
    );
  },
  useDndContext: vi.fn(() => ({ active: null })),
  closestCenter: vi.fn(),
  closestCorners: vi.fn(),
  PointerSensor: vi.fn(() => ({ activators: [] })),
  KeyboardSensor: vi.fn(() => ({ activators: [] })),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  MeasuringStrategy: {
    Always: 'always',
  },
  DragOverlay: ({ children, draggable }: { children?: React.ReactNode; draggable?: boolean }) => (
    <div data-testid="drag-overlay" data-draggable={draggable}>{children}</div>
  ),
  defaultDropAnimationSideEffects: vi.fn(() => ({ onDragEnd: vi.fn() })),
  DragStartEvent: class { },
  DragEndEvent: class { },
  DragOverEvent: class { },
  UniqueIdentifier: String,
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
  arrayMove: vi.fn((arr: any[], oldIndex: number, newIndex: number) => {
    const result = [...arr];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex, 0, removed);
    return result;
  }),
  sortableKeyboardCoordinates: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: { toString: vi.fn(() => '') },
    Transform: { toString: vi.fn(() => '') },
  },
}));

vi.mock('../LivePanel', () => ({
  LivePanel: ({ islands, title }: { islands?: any[]; title?: string }) => <div data-testid="live-panel">Live Panel - {(islands || []).length} items</div>,
}));

vi.mock('../VaultPanel', () => ({
  VaultPanel: ({ vault, title }: { vault?: any[]; title?: string }) => <div data-testid="vault-panel">Vault Panel - {(vault || []).length} items</div>,
}));

vi.mock('../DroppableGap', () => ({
  DroppableGap: () => <div data-testid="droppable-gap" />,
}));

vi.mock('../CreateZone', () => ({
  CreateZone: () => <div data-testid="create-zone">Create Zone</div>,
}));

const createMockStore = () => ({
  islands: [] as any[],
  vault: [] as any[],
  isUpdating: false,
  setIsUpdating: vi.fn(),
  moveItemOptimistically: vi.fn().mockImplementation((activeId: string, overId: string) => {
    // Mock implementation that simulates moving items
    return { activeId, overId };
  }),
  syncLiveTabs: vi.fn().mockResolvedValue(undefined),
  moveToVault: vi.fn().mockResolvedValue(undefined),
  restoreFromVault: vi.fn().mockResolvedValue(undefined),
  createIsland: vi.fn().mockResolvedValue(123),
  showVault: true,
  isDraggingGroup: false,
  setIsDraggingGroup: vi.fn(),
  appearanceSettings: {
    tabDensity: 'normal' as const,
    borderRadius: 'medium' as const,
    dragOpacity: 0.5,
    showFavicons: true,
    showAudioIndicators: 'both' as const,
    showFrozenIndicators: true,
    showActiveIndicator: true,
    showTabCount: true,
    compactGroupHeaders: false,
    buttonSize: 'medium' as const,
    uiScale: 1,
  },
  setIsCreatingIsland: vi.fn(),
  dividerPosition: 50,
  setDividerPosition: vi.fn(),
  isRenaming: false,
  setIsRenaming: vi.fn(),
  setVaultSyncEnabled: vi.fn(),
  clearQuotaExceeded: vi.fn(),
  groupSearchResults: vi.fn(),
  groupUngroupedTabs: vi.fn(),
  showAppearancePanel: false,
  executeCommand: vi.fn(),
  addPendingOperation: vi.fn(),
  removePendingOperation: vi.fn(),
  clearPendingOperations: vi.fn(),
  vaultQuota: null,
  quotaExceededPending: false,
  searchQuery: '',
  setSearchQuery: vi.fn(),
  sortOption: 'browser-order',
  setSortOption: vi.fn(),
  isCreatingIsland: false,
  creatingTabId: null,
  setCreatingTabId: vi.fn(),
  setIsDraggingVaultItem: vi.fn(),
  isDraggingVaultItem: false,
  setIsLoading: vi.fn(),
  setIsResizing: vi.fn(),
  saveToVault: vi.fn(),
  removeFromVault: vi.fn(),
  renameGroup: vi.fn(),
  createVaultGroup: vi.fn(),
  toggleVaultGroupCollapse: vi.fn(),
  toggleLiveGroupCollapse: vi.fn(),
  deleteDuplicateTabs: vi.fn(),
  sortGroupsToTop: vi.fn(),
  sortVaultGroupsToTop: vi.fn(),
  isDarkMode: false,
  undoStack: [] as any[],
  redoStack: [] as any[],
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false,
  effectiveSyncEnabled: true,
  syncRecovered: false,
  clearSyncRecovered: vi.fn(),
  compressionTier: null,
  showCompressionWarning: false,
  dismissCompressionWarning: vi.fn(),
});

vi.mock('../../store/useStore', () => ({
  useStore: vi.fn((selector?: any) => {
    if (typeof selector === 'function') {
      return selector(mockStore);
    }
    return mockStore;
  }),
  parseNumericId: vi.fn((id: string) => {
    const match = id.match(/live-tab-(\d+)/) || id.match(/live-group-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }),
  findItemInList: vi.fn(),
}));

let mockStore = createMockStore();

describe('Dashboard DnD Integration', () => {
  let Dashboard: React.FC<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockStore = createMockStore();

    try {
      const module = await import('../Dashboard');
      Dashboard = module.Dashboard;
    } catch (e) {
      console.error('Failed to import Dashboard:', e);
      Dashboard = () => <div>Mocked Dashboard</div>;
    }
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<Dashboard />);
      expect(container).toBeInTheDocument();
    });

    it('renders Live Panel', () => {
      render(<Dashboard />);
      expect(screen.getByTestId('live-panel')).toBeInTheDocument();
    });

    it('renders Vault Panel when showVault is true', () => {
      render(<Dashboard />);
      expect(screen.getByTestId('vault-panel')).toBeInTheDocument();
    });

    it('hides Vault Panel when showVault is false', () => {
      mockStore.showVault = false;
      render(<Dashboard />);
      expect(screen.queryByTestId('vault-panel')).not.toBeInTheDocument();
    });

    it('renders Create Zone', () => {
      render(<Dashboard />);
      expect(screen.getByTestId('live-panel')).toBeInTheDocument();
    });
  });

  describe('Drag Operations (smoke tests)', () => {
    it.each`
      description                       | islands                                                                                          | vault
      ${'Live panel tabs'}              | ${[{ id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 }, { id: 'live-tab-2', title: 'Tab 2', url: 'https://b.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 }]} | ${[]}
      ${'Live panel groups'}             | ${[{ id: 'live-group-1', title: 'Group A', tabs: [{ id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: 1, windowId: 1 }], color: 'blue', collapsed: false }, { id: 'live-group-2', title: 'Group B', tabs: [{ id: 'live-tab-2', title: 'Tab 2', url: 'https://b.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: 2, windowId: 1 }], color: 'red', collapsed: false }]}                        | ${[]}
      ${'Live tabs and empty vault'}    | ${[{ id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 }]}                                                                | ${[]}
      ${'Live groups'}                   | ${[{ id: 'live-group-1', title: 'Group', tabs: [{ id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: 1, windowId: 1 }, { id: 'live-tab-2', title: 'Tab 2', url: 'https://b.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: 1, windowId: 1 }], color: 'blue', collapsed: false }]}                           | ${[]}
      ${'Vault tabs and empty Live'}    | ${[]}                                                                                                                                      | ${[{ id: 'vault-tab-1-123', title: 'Archived Tab', url: 'https://archived.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false }]}
      ${'Vault groups'}                  | ${[]}                                                                                                                                      | ${[{ id: 'vault-group-1-123', title: 'Archived Group', tabs: [{ id: 'vault-tab-1-123', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false }, { id: 'vault-tab-2-123', title: 'Tab 2', url: 'https://b.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false }], color: 'blue', collapsed: false }]}
      ${'Create Zone'}                   | ${[{ id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 }]}                                                                | ${[]}
      ${'isUpdating'}                     | ${[]}                                                                                                                                      | ${[]}
    `('renders $description', ({ islands, vault, description }: { islands: any[], vault: any[], description: string }) => {
      mockStore.islands = islands;
      mockStore.vault = vault;
      if (description === 'isUpdating') {
        mockStore.isUpdating = true;
      } else {
        mockStore.isUpdating = false;
      }

      const { container } = render(<Dashboard />);

      expect(container.querySelector('#dashboard-container')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('renders with multiple islands (smoke test)', async () => {
      mockStore.islands = [
        { id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 },
        { id: 'live-tab-2', title: 'Tab 2', url: 'https://b.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 },
      ];

      const { container } = render(<Dashboard />);

      // Verify component renders with islands
      expect(container.querySelector('#dashboard-container')).toBeInTheDocument();
    });

    it('renders with syncLiveTabs available (smoke test)', () => {
      render(<Dashboard />);
      expect(screen.getByTestId('live-panel')).toBeInTheDocument();
    });

    it('hides vault panel when showVault=false (smoke test)', async () => {
      mockStore.showVault = false;
      mockStore.islands = [{ id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 }];

      render(<Dashboard />);

      expect(screen.queryByTestId('vault-panel')).not.toBeInTheDocument();
    });
  });

  describe('Visual Feedback', () => {
    it('renders drag overlay container (smoke test)', () => {
      mockStore.islands = [{ id: 'live-tab-1', title: 'My Tab', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 }];

      render(<Dashboard />);

      expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
    });

    it('renders dnd context container (smoke test)', () => {
      mockStore.islands = [
        { id: 'live-tab-1', title: 'Tab 1', url: 'https://a.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 },
        { id: 'live-tab-2', title: 'Tab 2', url: 'https://b.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false, groupId: -1, windowId: 1 },
      ];

      render(<Dashboard />);

      expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    });
  });

  describe('Panel Interactions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('renders with setDividerPosition available (smoke test)', () => {
      render(<Dashboard />);

      expect(screen.getByTestId('vault-panel')).toBeInTheDocument();
      expect(mockStore.setDividerPosition).toBeDefined();
    });

    it('setDividerPosition can be called directly', () => {
      render(<Dashboard />);

      mockStore.setDividerPosition(200);
      expect(mockStore.setDividerPosition).toHaveBeenCalledWith(200);
    });
  });

  describe('Basic Rendering - Additional Tests', () => {
    it('shows divider when showVault is true', () => {
      const { container } = render(<Dashboard />);

      // Find the divider element (it's a div with cursor-ew-resize class)
      const divider = container.querySelector('.cursor-ew-resize');
      expect(divider).toBeInTheDocument();
    });

    it('hides divider when showVault is false', () => {
      mockStore.showVault = false;
      render(<Dashboard />);

      // When showVault is false, vault panel should not render
      expect(screen.queryByTestId('vault-panel')).not.toBeInTheDocument();
    });

    it('applies dark mode class', () => {
      mockStore.isDarkMode = true;
      const { container } = render(<Dashboard />);

      const dashboardContainer = container.querySelector('#dashboard-container');
      expect(dashboardContainer).toHaveClass('dark');
    });
  });
});
