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
    expect(screen.getByText('Live Workspace')).toBeInTheDocument();
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
});
