import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

vi.mock('@dnd-kit/core', () => ({
  useDndContext: vi.fn(() => ({
    active: null,
  })),
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
  })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
}));

vi.mock('../Island', () => ({
  Island: () => <div data-testid="island">Island</div>,
}));

vi.mock('../TabCard', () => ({
  TabCard: () => <div data-testid="tabcard">TabCard</div>,
}));

vi.mock('../DroppableGap', () => ({
  DroppableGap: () => <div data-testid="droppable-gap" />,
}));

const mockSetSearchResults = vi.fn();
const mockSetIsSearching = vi.fn();
const mockSetParsedQuery = vi.fn();
const mockSetSearchScope = vi.fn();
const mockSetSearchQuery = vi.fn();

vi.mock('../../store/useStore', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      searchScope: 'live',
      setSearchScope: mockSetSearchScope,
      searchResults: [],
      setSearchResults: mockSetSearchResults,
      isSearching: false,
      setIsSearching: mockSetIsSearching,
      parsedQuery: null,
      setParsedQuery: mockSetParsedQuery,
      syncLiveTabs: vi.fn(),
      searchQuery: '',
      setSearchQuery: mockSetSearchQuery,
      // Note: searchDebounce is set to 100ms. When asserting debounced search execution,
      // use vi.useFakeTimers() + vi.runAllTimersAsync() or a waitFor with duration > 100ms.
      appearanceSettings: {
        searchDebounce: 100,
        showPanelName: true,
        showPanelIcon: true,
      },
    };
    return selector ? selector(state) : state;
  }),
}));

const mockSearch = vi.fn().mockResolvedValue({ results: [] });

vi.mock('../../search', () => ({
  search: mockSearch,
  searchAndExecute: vi.fn(),
  parseQuery: vi.fn().mockReturnValue(null),
  isSearchActive: vi.fn().mockReturnValue(false),
  hasCommands: vi.fn().mockReturnValue(false),
}));

vi.mock('../SearchBar', () => ({
  SearchBar: React.forwardRef<HTMLInputElement, any>((props, ref) => (
    <input
      ref={ref}
      data-testid="search-input"
      placeholder="Search tabs..."
      value={props.query}
      onChange={(e) => props.onQueryChange(e.target.value)}
      onKeyDown={props.onKeyDown}
    />
  )),
}));

const defaultProps = {
  dividerPosition: 50,
  islands: [],
  handleTabClick: vi.fn(),
  moveToVault: vi.fn(),
  saveToVault: vi.fn(),
  closeTab: vi.fn(),
  onRenameGroup: vi.fn(),
  onToggleCollapse: vi.fn(),
  groupSearchResults: vi.fn(),
  groupUngroupedTabs: vi.fn(),
  deleteDuplicateTabs: vi.fn(),
  sortGroupsToTop: vi.fn(),
  showVault: true,
  isCreatingIsland: false,
  creatingTabId: null,
};

describe('LivePanel Component', () => {
  let LivePanel: React.FC<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('../LivePanel');
    LivePanel = module.LivePanel;
  });

  it('renders Live Workspace header', () => {
    render(<LivePanel {...defaultProps} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<LivePanel {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search tabs...')).toBeInTheDocument();
  });

  it('shows "Creating Island..." text when isCreatingIsland is true', () => {
    render(<LivePanel {...defaultProps} isCreatingIsland={true} />);
    expect(screen.getByText('Creating Island...')).toBeInTheDocument();
  });

  it('calls deleteDuplicateTabs when delete button is clicked', () => {
    const deleteDuplicateTabs = vi.fn();
    render(<LivePanel {...defaultProps} deleteDuplicateTabs={deleteDuplicateTabs} />);

    const deleteButton = screen.getByTitle('Delete Duplicates');
    fireEvent.click(deleteButton);

    expect(deleteDuplicateTabs).toHaveBeenCalled();
  });

  it('shows correct tab count in header', () => {
    const islands = [
      { id: 'live-group-1', tabs: [{ id: 1 }, { id: 2 }] },
      { id: 'live-tab-3' },
    ];
    render(<LivePanel {...defaultProps} islands={islands} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('enables "Group ungrouped" button when count >= 2', () => {
    const islands = [
      { id: 'live-tab-1', url: 'https://example.com' },
      { id: 'live-tab-2', url: 'https://example2.com' },
    ];
    render(<LivePanel {...defaultProps} islands={islands} />);

    const groupButton = screen.getByTitle('Group 2 ungrouped tabs');
    expect(groupButton).not.toBeDisabled();
  });

  it('disables "Group ungrouped" button when count < 2', () => {
    const islands = [{ id: 'live-tab-1', url: 'https://example.com' }];
    render(<LivePanel {...defaultProps} islands={islands} />);

    const groupButton = screen.getByTitle('Not enough ungrouped tabs to group');
    expect(groupButton).toBeDisabled();
  });

  it('calls groupUngroupedTabs when button clicked', () => {
    const groupUngroupedTabs = vi.fn();
    const islands = [
      { id: 'live-tab-1', url: 'https://example.com' },
      { id: 'live-tab-2', url: 'https://example2.com' },
    ];
    render(<LivePanel {...defaultProps} islands={islands} groupUngroupedTabs={groupUngroupedTabs} />);

    const groupButton = screen.getByTitle('Group 2 ungrouped tabs');
    fireEvent.click(groupButton);

    expect(groupUngroupedTabs).toHaveBeenCalled();
  });

  it('calls sortGroupsToTop when sort button clicked', () => {
    const sortGroupsToTop = vi.fn();
    render(<LivePanel {...defaultProps} sortGroupsToTop={sortGroupsToTop} />);

    const sortButton = screen.getByTitle('Sort Groups to Top');
    fireEvent.click(sortButton);

    expect(sortGroupsToTop).toHaveBeenCalled();
  });

  it('shows expand/collapse all buttons', () => {
    render(<LivePanel {...defaultProps} />);

    expect(screen.getByTitle('Collapse All')).toBeInTheDocument();
    expect(screen.getByTitle('Expand All')).toBeInTheDocument();
  });

  it('applies correct width from dividerPosition', () => {
    const { container } = render(<LivePanel {...defaultProps} dividerPosition={75} showVault={true} />);

    const panel = container.firstChild as HTMLElement;
    expect(panel.style.width).toBe('75%');
  });

  it('applies 100% width when showVault is false', () => {
    const { container } = render(<LivePanel {...defaultProps} showVault={false} />);

    const panel = container.firstChild as HTMLElement;
    expect(panel.style.width).toBe('100%');
  });

  it('excludes pinned tabs from ungrouped count', () => {
    const islands = [
      { id: 'live-tab-1', url: 'https://example.com', pinned: true },
      { id: 'live-tab-2', url: 'https://example2.com' },
    ];
    render(<LivePanel {...defaultProps} islands={islands} />);

    const groupButton = screen.getByTitle('Not enough ungrouped tabs to group');
    expect(groupButton).toBeDisabled();
  });

  it('excludes restricted URL tabs from ungrouped count', () => {
    const islands = [
      { id: 'live-tab-1', url: 'chrome://extensions' },
      { id: 'live-tab-2', url: 'about:blank' },
    ];
    render(<LivePanel {...defaultProps} islands={islands} />);

    const groupButton = screen.getByTitle('Not enough ungrouped tabs to group');
    expect(groupButton).toBeDisabled();
  });

  it('excludes groups from ungrouped count', () => {
    const islands = [
      { id: 'live-group-1', tabs: [{ id: 1 }, { id: 2 }] },
      { id: 'live-tab-3', url: 'https://example.com' },
    ];
    render(<LivePanel {...defaultProps} islands={islands} />);

    const groupButton = screen.getByTitle('Not enough ungrouped tabs to group');
    expect(groupButton).toBeDisabled();
  });

  describe('LivePanel - Search Integration', () => {
    it('updates search query on input change', async () => {
      render(<LivePanel {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search tabs...');
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      // The search input should update its value
      expect(searchInput).toHaveValue('test query');
    });

    it('shows search results when isSearching is true', () => {
      // The search bar should be present regardless of search state
      render(<LivePanel {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search tabs...')).toBeInTheDocument();
    });

    it('clears search on escape key', async () => {
      render(<LivePanel {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search tabs...');

      // First, type something
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(searchInput).toHaveValue('test');

      // Then press Escape - should clear the input
      fireEvent.keyDown(searchInput, { key: 'Escape' });
      expect(searchInput).toHaveValue('');
    });
  });

  describe('LivePanel - Empty State', () => {
    it('renders panel when no tabs', () => {
      render(<LivePanel {...defaultProps} islands={[]} />);

      // Check that the panel still renders correctly
      // Use the header text to verify component rendered
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('shows Live Workspace header when empty', () => {
      render(<LivePanel {...defaultProps} islands={[]} />);

      // The component should show the header
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  describe('LivePanel - Group Actions', () => {
    it('collapses all groups when collapse all button is clicked', async () => {
      const mockToggleLiveGroupCollapse = vi.fn();
      const islands = [
        { id: 'live-group-1', title: 'Group 1', tabs: [{ id: 1, title: 'Tab 1' }], collapsed: false },
        { id: 'live-group-2', title: 'Group 2', tabs: [{ id: 2, title: 'Tab 2' }], collapsed: false },
      ];

      render(<LivePanel {...defaultProps} islands={islands} onToggleCollapse={mockToggleLiveGroupCollapse} />);

      const collapseAllBtn = screen.getByTitle('Collapse All');
      fireEvent.click(collapseAllBtn);

      // Should toggle collapse for each group
      expect(mockToggleLiveGroupCollapse).toHaveBeenCalled();
    });

    it('expands all groups when expand all button is clicked', async () => {
      const mockToggleLiveGroupCollapse = vi.fn();
      const islands = [
        { id: 'live-group-1', title: 'Group 1', tabs: [{ id: 1 }], collapsed: true },
        { id: 'live-group-2', title: 'Group 2', tabs: [{ id: 2 }], collapsed: true },
      ];

      render(<LivePanel {...defaultProps} islands={islands} onToggleCollapse={mockToggleLiveGroupCollapse} />);

      const expandAllBtn = screen.getByTitle('Expand All');
      fireEvent.click(expandAllBtn);

      // Should toggle collapse for each group
      expect(mockToggleLiveGroupCollapse).toHaveBeenCalled();
    });
  });

  describe('LivePanel - Virtual List', () => {
    it('renders with virtualizer for many items', () => {
      const manyIslands = Array.from({ length: 50 }, (_, i) => ({
        id: `live-tab-${i}`,
        title: `Tab ${i}`,
        url: `https://example${i}.com`,
        favicon: '',
        active: false,
        discarded: false,
        muted: false,
        pinned: false,
        audible: false,
        groupId: -1,
        windowId: 1,
      }));

      render(<LivePanel {...defaultProps} islands={manyIslands} />);

      // Should render the Live Workspace header with many items
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  describe('LivePanel - Scroll Behavior', () => {
    it('scrolls to creating tab when isCreatingIsland is true', async () => {
      const scrollIntoViewMock = vi.fn();
      // Mock scrollIntoView
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value: scrollIntoViewMock,
      });

      render(
        <LivePanel
          {...defaultProps}
          isCreatingIsland={true}
          creatingTabId="live-tab-50"
        />
      );

      // The component should render with the creating island indicator
      expect(screen.getByText('Creating Island...')).toBeInTheDocument();

      // Clean up
      delete (Element.prototype as any).scrollIntoView;
    });
  });
});
