import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const defaultProps = {
  dividerPosition: 50,
  islands: [],
  handleTabClick: vi.fn(),
  moveToVault: vi.fn(),
  saveToVault: vi.fn(),
  closeTab: vi.fn(),
  onRenameGroup: vi.fn(),
  onToggleCollapse: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  sortOption: 'browser-order' as const,
  setSortOption: vi.fn(),
  filteredTabs: [],
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

  it('calls setSearchQuery when typing in search', () => {
    const setSearchQuery = vi.fn();
    render(<LivePanel {...defaultProps} setSearchQuery={setSearchQuery} />);

    const searchInput = screen.getByPlaceholderText('Search tabs...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });

    expect(setSearchQuery).toHaveBeenCalledWith('test query');
  });

  it('shows "Creating Island..." text when isCreatingIsland is true', () => {
    render(<LivePanel {...defaultProps} isCreatingIsland={true} />);
    expect(screen.getByText('Creating Island...')).toBeInTheDocument();
  });

  it('shows search mode header when searchQuery is not empty', () => {
    render(<LivePanel {...defaultProps} searchQuery="test" />);
    expect(screen.getByText('Search Mode')).toBeInTheDocument();
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

  it('shows "No tabs found" when search has no results', () => {
    render(<LivePanel {...defaultProps} searchQuery="nonexistent" filteredTabs={[]} />);

    expect(screen.getByText(/No tabs found/)).toBeInTheDocument();
  });

  it('shows correct search result count', () => {
    const filteredTabs = [
      { id: 'live-tab-1', title: 'Test 1' },
      { id: 'live-tab-2', title: 'Test 2' },
    ];
    render(<LivePanel {...defaultProps} searchQuery="test" filteredTabs={filteredTabs} />);

    expect(screen.getByText('2 tabs found')).toBeInTheDocument();
  });

  it('clears search on Escape key', () => {
    const setSearchQuery = vi.fn();
    render(<LivePanel {...defaultProps} searchQuery="test" setSearchQuery={setSearchQuery} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(setSearchQuery).toHaveBeenCalledWith('');
  });

  it('does not clear search on other keys', () => {
    const setSearchQuery = vi.fn();
    render(<LivePanel {...defaultProps} searchQuery="test" setSearchQuery={setSearchQuery} />);

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(setSearchQuery).not.toHaveBeenCalled();
  });

  it('shows sort dropdown in search mode', () => {
    render(<LivePanel {...defaultProps} searchQuery="test" />);

    expect(screen.getByText('Browser Order')).toBeInTheDocument();
  });

  it('changes sort option when dropdown item selected', () => {
    const setSortOption = vi.fn();
    render(<LivePanel {...defaultProps} searchQuery="test" setSortOption={setSortOption} />);

    const sortButton = screen.getByText('Browser Order');
    fireEvent.click(sortButton);

    const alphaOption = screen.getByText('Alphabetical (Title)');
    fireEvent.click(alphaOption);

    expect(setSortOption).toHaveBeenCalledWith('alpha-title');
  });

  it('calls groupSearchResults when "Group Results" clicked', async () => {
    const groupSearchResults = vi.fn().mockResolvedValue(undefined);
    const setSearchQuery = vi.fn();
    const filteredTabs = [
      { id: 'live-tab-1', title: 'Test 1', pinned: false },
      { id: 'live-tab-2', title: 'Test 2', pinned: false },
    ];
    render(<LivePanel {...defaultProps} searchQuery="test" filteredTabs={filteredTabs} groupSearchResults={groupSearchResults} setSearchQuery={setSearchQuery} />);

    const groupButton = screen.getByText('Group Results');
    fireEvent.click(groupButton);

    await waitFor(() => {
      expect(groupSearchResults).toHaveBeenCalledWith(filteredTabs);
    });
  });

  it('disables "Group Results" when < 2 non-pinned tabs', () => {
    const filteredTabs = [{ id: 'live-tab-1', title: 'Test 1', pinned: false }];
    render(<LivePanel {...defaultProps} searchQuery="test" filteredTabs={filteredTabs} />);

    const groupButton = screen.getByText('Group Results');
    expect(groupButton).toBeDisabled();
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
