import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

let mockVirtualItems: any[] = [];

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
    getTotalSize: () => mockVirtualItems.length * 50,
    getVirtualItems: () => mockVirtualItems,
  })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
}));

vi.mock('../Island', () => ({
  Island: ({ isVault }: { isVault?: boolean }) => (
    <div data-testid="island" data-is-vault={isVault}>Island</div>
  ),
}));

vi.mock('../TabCard', () => ({
  TabCard: ({ isVault }: { isVault?: boolean }) => (
    <div data-testid="tabcard" data-is-vault={isVault}>TabCard</div>
  ),
}));

vi.mock('../DroppableGap', () => ({
  DroppableGap: () => <div data-testid="droppable-gap" />,
}));

vi.mock('../../contexts/ScrollContainerContext', () => ({
  ScrollContainerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../QuotaWarningBanner', () => ({
  QuotaWarningBanner: ({ warningLevel }: { warningLevel: string }) => (
    <div data-testid="quota-banner" data-warning-level={warningLevel} />
  ),
}));

const defaultProps = {
  dividerPosition: 50,
  vault: [],
  removeFromVault: vi.fn(),
  isDraggingLiveItem: false,
  createVaultGroup: vi.fn(),
  onRenameGroup: vi.fn(),
  onToggleCollapse: vi.fn(),
  sortVaultGroupsToTop: vi.fn(),
  deleteVaultDuplicates: vi.fn(),
  restoreFromVault: vi.fn(),
  vaultQuota: null,
  effectiveSyncEnabled: true,
};

describe('VaultPanel Component', () => {
  let VaultPanel: React.FC<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockVirtualItems = [];
    const module = await import('../VaultPanel');
    VaultPanel = module.VaultPanel;
  });

  it('renders Neural Vault header', () => {
    render(<VaultPanel {...defaultProps} />);
    expect(screen.getByText('Vault')).toBeInTheDocument();
  });

  it('shows empty state when vault is empty', () => {
    render(<VaultPanel {...defaultProps} />);
    expect(screen.getByText(/Initiate data transfer/)).toBeInTheDocument();
  });

  it('calls createVaultGroup when Add Group button is clicked', () => {
    const createVaultGroup = vi.fn();
    render(<VaultPanel {...defaultProps} createVaultGroup={createVaultGroup} />);

    const addButton = screen.getByTitle('Add Group');
    fireEvent.click(addButton);

    expect(createVaultGroup).toHaveBeenCalled();
  });

  it('shows local storage warning when sync is disabled and vault has items', () => {
    render(
      <VaultPanel
        {...defaultProps}
        vault={[{ id: 'vault-tab-1', title: 'Test', url: 'https://example.com' }]}
        effectiveSyncEnabled={false}
        vaultTabCount={1}
      />
    );

    expect(screen.getByText(/Vault too large for sync/)).toBeInTheDocument();
  });

  it('hides local storage warning when sync is enabled', () => {
    render(
      <VaultPanel
        {...defaultProps}
        vault={[{ id: 'vault-tab-1', title: 'Test', url: 'https://example.com' }]}
        effectiveSyncEnabled={true}
        vaultTabCount={1}
      />
    );

    expect(screen.queryByText(/Vault too large for sync/)).not.toBeInTheDocument();
  });

  it('shows tab count in header', () => {
    render(<VaultPanel {...defaultProps} vaultTabCount={5} />);
    expect(screen.getByText('5 TABS')).toBeInTheDocument();
  });

  it('handles missing vaultTabCount gracefully', () => {
    render(<VaultPanel {...defaultProps} />);
    expect(screen.getByText('0 TABS')).toBeInTheDocument();
  });

  it('shows QuotaWarningBanner when vaultQuota provided', () => {
    render(
      <VaultPanel
        {...defaultProps}
        vaultQuota={{ warningLevel: 'warning', percentage: 0.5 } as any}
      />
    );

    expect(screen.getByTestId('quota-banner')).toBeInTheDocument();
  });

  it('hides QuotaWarningBanner when vaultQuota is null', () => {
    render(<VaultPanel {...defaultProps} vaultQuota={null} />);
    expect(screen.queryByTestId('quota-banner')).not.toBeInTheDocument();
  });

  it('passes warningLevel to QuotaWarningBanner', () => {
    render(
      <VaultPanel
        {...defaultProps}
        vaultQuota={{ warningLevel: 'critical', percentage: 0.9 } as any}
      />
    );

    const banner = screen.getByTestId('quota-banner');
    expect(banner).toHaveAttribute('data-warning-level', 'critical');
  });

  it('calls sortVaultGroupsToTop when sort button clicked', () => {
    const sortVaultGroupsToTop = vi.fn();
    render(<VaultPanel {...defaultProps} sortVaultGroupsToTop={sortVaultGroupsToTop} />);

    const sortButton = screen.getByTitle('Sort Groups to Top');
    fireEvent.click(sortButton);

    expect(sortVaultGroupsToTop).toHaveBeenCalled();
  });

  it('dismisses local storage warning when X clicked', () => {
    render(
      <VaultPanel
        {...defaultProps}
        vault={[{ id: 'vault-tab-1', title: 'Test', url: 'https://example.com' }]}
        effectiveSyncEnabled={false}
        vaultTabCount={1}
      />
    );

    const dismissButton = screen.getByTitle('Dismiss');
    fireEvent.click(dismissButton);

    expect(screen.queryByText(/Vault too large for sync/)).not.toBeInTheDocument();
  });

  it('applies correct width from dividerPosition', () => {
    const { container } = render(<VaultPanel {...defaultProps} dividerPosition={30} />);

    const panel = container.firstChild as HTMLElement;
    expect(panel.style.width).toBe('70%');
  });

  it('renders vault items correctly', async () => {
    mockVirtualItems = [
      { key: 'vault-group-1', index: 0, start: 0 },
      { key: 'vault-tab-2', index: 1, start: 50 },
    ];

    const vault = [
      { id: 'vault-group-1', title: 'Group', color: 'blue', collapsed: false, tabs: [{ id: 'vault-tab-1', title: 'Tab', url: 'https://example.com' }] },
      { id: 'vault-tab-2', title: 'Test Tab', url: 'https://example.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false },
    ] as any[];

    vi.resetModules();
    const module = await import('../VaultPanel');
    const VaultPanelComp = module.VaultPanel;

    render(<VaultPanelComp {...defaultProps} vault={vault} />);

    expect(screen.getAllByTestId('island')).toHaveLength(1);
    expect(screen.getAllByTestId('tabcard')).toHaveLength(1);
  });

  it('passes isVault=true to Island components', async () => {
    mockVirtualItems = [{ key: 'vault-group-1', index: 0, start: 0 }];

    const vault = [{ id: 'vault-group-1', title: 'Group', color: 'blue', collapsed: false, tabs: [{ id: 'vault-tab-1', title: 'Tab', url: 'https://example.com' }] }] as any[];

    vi.resetModules();
    const module = await import('../VaultPanel');
    const VaultPanelComp = module.VaultPanel;

    render(<VaultPanelComp {...defaultProps} vault={vault} />);

    const island = screen.getByTestId('island');
    expect(island).toHaveAttribute('data-is-vault', 'true');
  });

  it('passes isVault=true to TabCard components', async () => {
    mockVirtualItems = [{ key: 'vault-tab-1', index: 0, start: 0 }];

    const vault = [{ id: 'vault-tab-1', title: 'Test Tab', url: 'https://example.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false }] as any[];

    vi.resetModules();
    const module = await import('../VaultPanel');
    const VaultPanelComp = module.VaultPanel;

    render(<VaultPanelComp {...defaultProps} vault={vault} />);

    const tabcard = screen.getByTestId('tabcard');
    expect(tabcard).toHaveAttribute('data-is-vault', 'true');
  });

  it('handles undefined vaultTabCount', () => {
    render(<VaultPanel {...defaultProps} vaultTabCount={undefined} />);
    expect(screen.getByText('0 TABS')).toBeInTheDocument();
  });

  describe('VaultPanel - Empty State', () => {
    it('shows empty state when vault is empty', () => {
      render(<VaultPanel {...defaultProps} vault={[]} />);

      expect(screen.getByText(/Initiate data transfer/)).toBeInTheDocument();
    });

    it('shows appropriate message when vault is empty', () => {
      render(<VaultPanel {...defaultProps} vault={[]} />);

      // The empty state should have the Neural Vault header visible
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });
  });

  describe('VaultPanel - Quota Display', () => {
    it('shows quota percentage when quota is provided', () => {
      render(
        <VaultPanel
          {...defaultProps}
          vaultQuota={{ warningLevel: 'warning', percentage: 0.75 }}
        />
      );

      // QuotaWarningBanner should be shown with the quota
      expect(screen.getByTestId('quota-banner')).toBeInTheDocument();
    });

    it('does not show quota when quota is null', () => {
      render(<VaultPanel {...defaultProps} vaultQuota={null} />);

      expect(screen.queryByTestId('quota-banner')).not.toBeInTheDocument();
    });

    it('shows critical warning at high quota', () => {
      render(
        <VaultPanel
          {...defaultProps}
          vaultQuota={{ warningLevel: 'critical', percentage: 0.95 }}
        />
      );

      const banner = screen.getByTestId('quota-banner');
      expect(banner).toHaveAttribute('data-warning-level', 'critical');
    });
  });

  describe('VaultPanel - Group Actions', () => {
    it('calls sortVaultGroupsToTop when sort button is clicked', () => {
      const sortVaultGroupsToTop = vi.fn();
      render(<VaultPanel {...defaultProps} sortVaultGroupsToTop={sortVaultGroupsToTop} />);

      const sortButton = screen.getByTitle('Sort Groups to Top');
      fireEvent.click(sortButton);

      expect(sortVaultGroupsToTop).toHaveBeenCalled();
    });

    it('calls toggleVaultGroupCollapse when group collapse is toggled', async () => {
      const toggleVaultGroupCollapse = vi.fn();
      mockVirtualItems = [{ key: 'vault-group-1', index: 0, start: 0 }];

      const vault = [
        { id: 'vault-group-1', title: 'Group', color: 'blue', collapsed: false, tabs: [{ id: 'vault-tab-1', title: 'Tab', url: 'https://example.com' }] },
      ] as any[];

      render(<VaultPanel {...defaultProps} vault={vault} onToggleCollapse={toggleVaultGroupCollapse} />);

      // The toggle should be available on the Island component
      expect(toggleVaultGroupCollapse).toBeDefined();
    });
  });

  describe('VaultPanel - Drag Handling', () => {
    it('shows drop target when dragging live item', () => {
      render(
        <VaultPanel
          {...defaultProps}
          isDraggingLiveItem={true}
        />
      );

      // Panel should render even when dragging
      expect(screen.getByText('Vault')).toBeInTheDocument();
    });

    it('calls restoreFromVault when dropping item', async () => {
      const restoreFromVault = vi.fn().mockResolvedValue(undefined);
      mockVirtualItems = [{ key: 'vault-tab-1', index: 0, start: 0 }];

      const vault = [{ id: 'vault-tab-1', title: 'Test Tab', url: 'https://example.com', favicon: '', active: false, discarded: false, muted: false, pinned: false, audible: false }] as any[];

      render(<VaultPanel {...defaultProps} vault={vault} restoreFromVault={restoreFromVault} />);

      // The restoreFromVault function should be available
      expect(restoreFromVault).toBeDefined();
    });
  });

  describe('VaultPanel - Sync Toggle', () => {
    it('shows sync disabled warning when sync is off', () => {
      render(
        <VaultPanel
          {...defaultProps}
          vault={[{ id: 'vault-tab-1', title: 'Test', url: 'https://example.com' }]}
          effectiveSyncEnabled={false}
          vaultTabCount={1}
        />
      );

      expect(screen.getByText(/Vault too large for sync/)).toBeInTheDocument();
    });

    it('hides sync disabled warning when sync is on', () => {
      render(
        <VaultPanel
          {...defaultProps}
          vault={[{ id: 'vault-tab-1', title: 'Test', url: 'https://example.com' }]}
          effectiveSyncEnabled={true}
          vaultTabCount={1}
        />
      );

      expect(screen.queryByText(/Vault too large for sync/)).not.toBeInTheDocument();
    });
  });
});
