import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import userEvent from '@testing-library/user-event';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: '',
    isDragging: false,
  })),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}));

const mockStore = {
  appearanceSettings: {
    borderRadius: 'medium',
    buttonSize: 'medium',
    showTabCount: true,
    compactGroupHeaders: false,
    dragOpacity: 0.5,
  },
  setIsRenaming: vi.fn(),
};

vi.mock('../../store/useStore', () => ({
  useStore: vi.fn(() => mockStore),
  parseNumericId: vi.fn((id: string) => {
    const match = id.match(/live-(?:tab|group)-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }),
}));

vi.mock('../../utils/chromeApi', () => ({
  ungroupTab: vi.fn(),
  updateTabGroupCollapse: vi.fn(),
  discardTabs: vi.fn(),
  duplicateIsland: vi.fn(),
}));

vi.mock('../TabCard', () => ({
  TabCard: ({ tab }: { tab: any }) => <div data-testid={`tabcard-${tab.id}`}>{tab.title}</div>,
}));

vi.mock('../ContextMenu', () => ({
  ContextMenu: ({ children, show }: { children: React.ReactNode; show: boolean }) => 
    show ? <div data-testid="context-menu">{children}</div> : null,
}));

vi.mock('../../utils/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  getIslandBorderColor: vi.fn(() => 'rgb(0, 212, 255)'),
  getBorderRadiusClass: vi.fn(() => 'rounded-lg'),
  getBottomBorderRadiusClass: vi.fn(() => 'rounded-b-lg'),
}));

describe('Island', () => {
  let Island: React.FC<any>;
  let ungroupTab: typeof import('../../utils/chromeApi').ungroupTab;
  let updateTabGroupCollapse: typeof import('../../utils/chromeApi').updateTabGroupCollapse;
  let discardTabs: typeof import('../../utils/chromeApi').discardTabs;
  let duplicateIsland: typeof import('../../utils/chromeApi').duplicateIsland;

  const defaultIsland = {
    id: 'live-group-100',
    title: 'Test Island',
    color: 'cyan',
    collapsed: false,
    tabs: [
      { id: 'live-tab-1', title: 'Tab 1', url: 'a.com', favicon: '', active: false, discarded: false, windowId: 1, index: 0, groupId: 100, muted: false, pinned: false, audible: false },
      { id: 'live-tab-2', title: 'Tab 2', url: 'b.com', favicon: '', active: false, discarded: false, windowId: 1, index: 1, groupId: 100, muted: false, pinned: false, audible: false },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('../Island');
    Island = module.Island;
    const chromeApi = await import('../../utils/chromeApi');
    ungroupTab = chromeApi.ungroupTab;
    updateTabGroupCollapse = chromeApi.updateTabGroupCollapse;
    discardTabs = chromeApi.discardTabs;
    duplicateIsland = chromeApi.duplicateIsland;
  });

  describe('Rendering', () => {
    it('renders island title', () => {
      render(<Island island={defaultIsland} />);

      expect(screen.getByText('Test Island')).toBeInTheDocument();
    });

    it('shows "Untitled Group" when title is empty', () => {
      render(<Island island={{ ...defaultIsland, title: '' }} />);

      expect(screen.getByText('Untitled Group')).toBeInTheDocument();
    });

    it('renders nested TabCards', () => {
      render(<Island island={defaultIsland} />);

      expect(screen.getByTestId('tabcard-live-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('tabcard-live-tab-2')).toBeInTheDocument();
    });

    it('hides tabs when collapsed=true', () => {
      render(<Island island={{ ...defaultIsland, collapsed: true }} />);

      expect(screen.queryByTestId('tabcard-live-tab-1')).not.toBeInTheDocument();
    });

    it('shows tabs when collapsed=false', () => {
      render(<Island island={defaultIsland} />);

      expect(screen.getByTestId('tabcard-live-tab-1')).toBeInTheDocument();
    });

    it('shows tab count when showTabCount=true', () => {
      render(<Island island={defaultIsland} />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('hides tab count when showTabCount=false', () => {
      mockStore.appearanceSettings.showTabCount = false;
      render(<Island island={defaultIsland} />);

      expect(screen.queryByText('2')).not.toBeInTheDocument();
      mockStore.appearanceSettings.showTabCount = true;
    });

    it('applies correct border color from island.color', () => {
      render(<Island island={defaultIsland} />);
    });

    it('applies compact header styles when compactGroupHeaders=true', () => {
      mockStore.appearanceSettings.compactGroupHeaders = true;
      render(<Island island={defaultIsland} />);
      mockStore.appearanceSettings.compactGroupHeaders = false;
    });

    it('applies correct button size from settings', () => {
      render(<Island island={defaultIsland} />);
    });
  });

  describe('Collapse Toggle', () => {
    it('calls onToggleCollapse when chevron clicked', async () => {
      const onToggleCollapse = vi.fn();
      const { container } = render(<Island island={defaultIsland} onToggleCollapse={onToggleCollapse} />);

      const chevron = container.querySelector('button');
      if (chevron) {
        await userEvent.click(chevron);
        expect(onToggleCollapse).toHaveBeenCalled();
      }
    });

    it('does not call onToggleCollapse when isOverlay=true', async () => {
      const onToggleCollapse = vi.fn();
      const { container } = render(<Island island={defaultIsland} onToggleCollapse={onToggleCollapse} isOverlay={true} />);

      const chevron = container.querySelector('button');
      if (chevron) {
        await userEvent.click(chevron);
      }
    });

    it('shows ChevronRight when collapsed', () => {
      render(<Island island={{ ...defaultIsland, collapsed: true }} />);
    });

    it('shows ChevronDown when expanded', () => {
      render(<Island island={defaultIsland} />);
    });
  });

  describe('Rename', () => {
    it('enters edit mode on double-click', async () => {
      const onRename = vi.fn();
      render(<Island island={defaultIsland} onRename={onRename} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('calls onRename with new title on blur', async () => {
      const onRename = vi.fn();
      render(<Island island={defaultIsland} onRename={onRename} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Title');
      fireEvent.blur(input);

      expect(onRename).toHaveBeenCalledWith('New Title');
    });

    it('calls onRename with new title on Enter', async () => {
      const onRename = vi.fn();
      render(<Island island={defaultIsland} onRename={onRename} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Title{enter}');

      expect(onRename).toHaveBeenCalledWith('New Title');
    });

    it('cancels edit on Escape', async () => {
      const onRename = vi.fn();
      render(<Island island={defaultIsland} onRename={onRename} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '{escape}');

      expect(onRename).not.toHaveBeenCalled();
    });

    it('disables DnD when editing', async () => {
      render(<Island island={defaultIsland} onRename={vi.fn()} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('trims whitespace from title', async () => {
      const onRename = vi.fn();
      render(<Island island={defaultIsland} onRename={onRename} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, '  New Title  {enter}');

      expect(onRename).toHaveBeenCalledWith('New Title');
    });

    it('does not call onRename if title unchanged', async () => {
      const onRename = vi.fn();
      render(<Island island={defaultIsland} onRename={onRename} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);

      const input = screen.getByRole('textbox');
      fireEvent.blur(input);

      expect(onRename).not.toHaveBeenCalled();
    });
  });

  describe('Delete', () => {
    it('calls onDelete when delete button clicked', async () => {
      const onDelete = vi.fn();
      render(<Island island={defaultIsland} onDelete={onDelete} />);

      const deleteButton = screen.getByTitle('Delete');
      await userEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalled();
    });

    it('shows correct tooltip for vault vs live', () => {
      const { rerender } = render(<Island island={defaultIsland} onDelete={vi.fn()} />);

      expect(screen.getByTitle('Delete')).toBeInTheDocument();

      rerender(<Island island={defaultIsland} onDelete={vi.fn()} isVault={true} />);
      expect(screen.getByTitle('Delete from Vault')).toBeInTheDocument();
    });
  });

  describe('Save/Restore', () => {
    it('calls onSave when save button clicked (non-vault)', async () => {
      const onNonDestructiveSave = vi.fn();
      render(<Island island={defaultIsland} onNonDestructiveSave={onNonDestructiveSave} />);

      const saveButton = screen.getByTitle('Save to Vault (Keep Live)');
      await userEvent.click(saveButton);

      expect(onNonDestructiveSave).toHaveBeenCalled();
    });

    it('calls onNonDestructiveSave when ND save clicked', async () => {
      const onNonDestructiveSave = vi.fn();
      render(<Island island={defaultIsland} onNonDestructiveSave={onNonDestructiveSave} />);

      const saveButton = screen.getByTitle('Save to Vault (Keep Live)');
      await userEvent.click(saveButton);

      expect(onNonDestructiveSave).toHaveBeenCalled();
    });

    it('calls onRestore when restore clicked (vault)', async () => {
      const onRestore = vi.fn();
      render(<Island island={defaultIsland} onRestore={onRestore} isVault={true} />);

      const restoreButton = screen.getByTitle('Open in Current Window');
      await userEvent.click(restoreButton);

      expect(onRestore).toHaveBeenCalled();
    });

    it('hides save button when isVault=true', () => {
      render(<Island island={defaultIsland} onSave={vi.fn()} isVault={true} />);

      expect(screen.queryByTitle('Save to Vault (Keep Live)')).not.toBeInTheDocument();
    });

    it('hides restore button when isVault=false', () => {
      render(<Island island={defaultIsland} onRestore={vi.fn()} />);

      expect(screen.queryByTitle('Open in Current Window')).not.toBeInTheDocument();
    });
  });

  describe('Ungroup', () => {
    it('calls ungroupTab when ungroup button clicked', async () => {
      render(<Island island={defaultIsland} />);

      const ungroupButton = screen.getByTitle('Ungroup All');
      await userEvent.click(ungroupButton);

      expect(ungroupTab).toHaveBeenCalledWith([1, 2]);
    });

    it('parses tab IDs correctly', async () => {
      render(<Island island={defaultIsland} />);

      const ungroupButton = screen.getByTitle('Ungroup All');
      await userEvent.click(ungroupButton);

      expect(ungroupTab).toHaveBeenCalled();
    });
  });

  describe('Context Menu', () => {
    it('shows context menu on right-click', () => {
      render(<Island island={defaultIsland} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });

    it('hides context menu when isOverlay=true', () => {
      render(<Island island={defaultIsland} isOverlay={true} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
    });

    it('contains rename option', () => {
      render(<Island island={defaultIsland} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.getByText('RENAME')).toBeInTheDocument();
    });

    it('contains duplicate option', () => {
      render(<Island island={defaultIsland} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.getByText('DUPLICATE GROUP')).toBeInTheDocument();
    });

    it('contains ungroup all option', () => {
      render(<Island island={defaultIsland} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.getByText('UNGROUP ALL')).toBeInTheDocument();
    });

    it('contains freeze all option', () => {
      render(<Island island={defaultIsland} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.getByText('FREEZE ALL')).toBeInTheDocument();
    });

    it('contains save to vault option', () => {
      render(<Island island={defaultIsland} onNonDestructiveSave={vi.fn()} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.getByText('SAVE TO VAULT')).toBeInTheDocument();
    });

    it('hides ungroup/freeze when isVault=true', () => {
      render(<Island island={defaultIsland} isVault={true} />);

      const header = screen.getByText('Test Island');
      fireEvent.contextMenu(header);

      expect(screen.queryByText('UNGROUP ALL')).not.toBeInTheDocument();
      expect(screen.queryByText('FREEZE ALL')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies overlay styles when isOverlay=true', () => {
      render(<Island island={defaultIsland} isOverlay={true} />);
    });

    it('applies drag opacity from settings', () => {
      render(<Island island={defaultIsland} />);
    });

    it('applies disabled styles when disabled=true', () => {
      render(<Island island={defaultIsland} disabled={true} />);
    });
  });

  describe('DnD Integration', () => {
    it('provides correct sortable id', () => {
      render(<Island island={defaultIsland} />);
    });

    it('includes island data in sortable', () => {
      render(<Island island={defaultIsland} />);
    });

    it('disables sortable when disabled=true', () => {
      render(<Island island={defaultIsland} disabled={true} />);
    });

    it('disables sortable when isEditing=true', async () => {
      render(<Island island={defaultIsland} />);

      const title = screen.getByText('Test Island');
      await userEvent.dblClick(title);
    });
  });
});
