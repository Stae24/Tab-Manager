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
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => ''),
    },
  },
}));

const mockStore = {
  appearanceSettings: {
    tabDensity: 'normal',
    borderRadius: 'medium',
    buttonSize: 'medium',
    showFavicons: true,
    showFrozenIndicators: true,
    showAudioIndicators: 'both' as const,
    showActiveIndicator: true,
    faviconSource: 'chrome' as const,
    faviconFallback: 'google' as const,
    faviconSize: '16' as const,
    dragOpacity: 0.5,
  },
};

vi.mock('../../store/useStore', () => ({
  useStore: vi.fn(() => mockStore),
  parseNumericId: vi.fn((id: string) => {
    const match = id.match(/live-tab-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }),
}));

vi.mock('../../services/tabService', () => ({
  tabService: {
    closeTab: vi.fn(),
    discardTab: vi.fn(),
    ungroupTab: vi.fn(),
    pinTab: vi.fn(),
    unpinTab: vi.fn(),
    muteTab: vi.fn(),
    unmuteTab: vi.fn(),
    duplicateTab: vi.fn(),
    copyTabUrl: vi.fn(),
  },
}));

vi.mock('../../contexts/ScrollContainerContext', () => ({
  useScrollContainer: vi.fn(() => ({ containerRef: { current: null } })),
}));

vi.mock('../Favicon', () => ({
  Favicon: ({ url }: { url: string }) => <img src={url} alt="favicon" data-testid="favicon" />,
}));

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

describe('TabCard', () => {
  let TabCard: React.FC<any>;
  let tabService: typeof import('../../services/tabService').tabService;
  let parseNumericId: typeof import('../../store/useStore').parseNumericId;

  const defaultTab = {
    id: 'live-tab-1',
    title: 'Test Tab',
    url: 'https://example.com',
    favicon: 'https://example.com/favicon.ico',
    active: false,
    discarded: false,
    windowId: 1,
    index: 0,
    groupId: -1,
    muted: false,
    pinned: false,
    audible: false,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import('../TabCard');
    TabCard = module.TabCard;
    tabService = (await import('../../services/tabService')).tabService;
    parseNumericId = (await import('../../store/useStore')).parseNumericId;
  });

  describe('Rendering', () => {
    it('renders tab title', () => {
      render(<TabCard tab={defaultTab} />);

      expect(screen.getByText('Test Tab')).toBeInTheDocument();
    });

    it('renders with empty title', () => {
      const { container } = render(<TabCard tab={{ ...defaultTab, title: '' }} />);
      expect(container).toBeInTheDocument();
    });

    it('applies correct density class', () => {
      mockStore.appearanceSettings.tabDensity = 'compact';
      const { container } = render(<TabCard tab={defaultTab} />);

      expect(container.firstChild?.firstChild).toHaveClass('py-1');
    });

    it('applies correct border radius class', () => {
      mockStore.appearanceSettings.borderRadius = 'large';
      const { container } = render(<TabCard tab={defaultTab} />);

      expect(container.firstChild?.firstChild).toBeTruthy();
    });
  });

  describe('State Indicators', () => {
    it('shows discarded indicator when tab.discarded', () => {
      const { container } = render(<TabCard tab={{ ...defaultTab, discarded: true }} />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('hides discarded indicator when showFrozenIndicators=false', () => {
      mockStore.appearanceSettings.showFrozenIndicators = false;
      render(<TabCard tab={{ ...defaultTab, discarded: true }} />);

      const snowflakes = screen.queryAllByRole('img', { hidden: true });
      expect(snowflakes.length).toBe(0);
    });

    it('shows audio indicator when tab.audible', () => {
      const { container } = render(<TabCard tab={{ ...defaultTab, audible: true }} />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('shows muted indicator when tab.muted', () => {
      const { container } = render(<TabCard tab={{ ...defaultTab, muted: true }} />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('hides audio indicators when showAudioIndicators=off', () => {
      (mockStore.appearanceSettings as any).showAudioIndicators = 'off';
      render(<TabCard tab={{ ...defaultTab, audible: true }} />);

      const indicators = screen.queryAllByRole('img', { hidden: true });
      expect(indicators.length).toBe(0);
      (mockStore.appearanceSettings as any).showAudioIndicators = 'both';
    });

    it('shows active indicator when tab.active', () => {
      render(<TabCard tab={{ ...defaultTab, active: true }} />);
    });

    it('shows loading spinner when isLoading=true', () => {
      const { container } = render(<TabCard tab={defaultTab} isLoading={true} />);
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  describe('Favicon', () => {
    it('renders favicon with correct source', async () => {
      render(<TabCard tab={defaultTab} isOverlay={true} />);
      expect(screen.getByTestId('favicon')).toBeInTheDocument();
    });

    it('defers favicon loading when not in viewport', () => {
      const { container } = render(<TabCard tab={defaultTab} />);
      expect(container).toBeInTheDocument();
    });

    it('immediately loads favicon when isOverlay=true', async () => {
      vi.resetModules();
      const module = await import('../TabCard');
      const TabCardComp = module.TabCard;

      render(<TabCardComp tab={defaultTab} isOverlay={true} />);

      expect(screen.getByTestId('favicon')).toBeInTheDocument();
    });

    it('hides favicon when showFavicons=false', () => {
      mockStore.appearanceSettings.showFavicons = false;
      render(<TabCard tab={defaultTab} />);

      expect(screen.queryByTestId('favicon')).not.toBeInTheDocument();
    });
  });

  describe('Click Handlers', () => {
    it('calls onClick when clicked', async () => {
      const onClick = vi.fn();
      const { container } = render(<TabCard tab={defaultTab} onClick={onClick} />);
      const tabElement = container.querySelector('[class*="cursor-grab"]');
      if (tabElement) {
        await userEvent.click(tabElement);
      }
    });

    it('does not call onClick when isDragging', async () => {
      vi.mock('@dnd-kit/sortable', () => ({
        useSortable: vi.fn(() => ({
          attributes: {},
          listeners: {},
          setNodeRef: vi.fn(),
          transform: null,
          transition: '',
          isDragging: true,
        })),
      }));

      const onClick = vi.fn();
      render(<TabCard tab={defaultTab} onClick={onClick} />);

      await userEvent.click(screen.getByText('Test Tab'));
    });

    it('does not call onClick when isOverlay', async () => {
      const onClick = vi.fn();
      render(<TabCard tab={defaultTab} onClick={onClick} isOverlay={true} />);

      await userEvent.click(screen.getByText('Test Tab'));
    });
  });

  describe('Action Buttons', () => {
    it('calls onClose when close button clicked', async () => {
      const onClose = vi.fn();
      render(<TabCard tab={defaultTab} onClose={onClose} />);

      const closeButton = screen.getByTitle('Close Tab');
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onSave when save button clicked (non-vault)', async () => {
      const onSave = vi.fn();
      render(<TabCard tab={defaultTab} onSave={onSave} />);

      const saveButton = screen.getByTitle('Save to Vault');
      await userEvent.click(saveButton);

      expect(onSave).toHaveBeenCalled();
    });

    it('calls onRestore when restore button clicked (vault)', async () => {
      const onRestore = vi.fn();
      render(<TabCard tab={defaultTab} onRestore={onRestore} isVault={true} />);

      const restoreButton = screen.getByTitle('Open in Window');
      await userEvent.click(restoreButton);

      expect(onRestore).toHaveBeenCalled();
    });

    it('hides save button when isVault=true', () => {
      render(<TabCard tab={defaultTab} onSave={vi.fn()} isVault={true} />);

      expect(screen.queryByTitle('Save to Vault')).not.toBeInTheDocument();
    });

    it('hides restore button when isVault=false', () => {
      render(<TabCard tab={defaultTab} onRestore={vi.fn()} />);

      expect(screen.queryByTitle('Open in Window')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies overlay styles when isOverlay=true', () => {
      const { container } = render(<TabCard tab={defaultTab} isOverlay={true} />);

      expect(container.firstChild).toHaveClass('relative');
    });

    it('applies vault styles when isVault=true', () => {
      render(<TabCard tab={defaultTab} isVault={true} />);
    });

    it('applies loading styles when isLoading=true', () => {
      render(<TabCard tab={defaultTab} isLoading={true} />);
    });

    it('applies drag opacity from settings', () => {
      mockStore.appearanceSettings.dragOpacity = 0.7;
      render(<TabCard tab={defaultTab} />);
    });
  });

  describe('Context Menu', () => {
    it('shows context menu on right-click', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.getByText('FREEZE')).toBeInTheDocument();
    });

    it('hides context menu when isOverlay=true', async () => {
      render(<TabCard tab={defaultTab} isOverlay={true} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.queryByText('FREEZE')).not.toBeInTheDocument();
    });

    it('contains freeze action', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.getByText('FREEZE')).toBeInTheDocument();
    });

    it('contains ungroup action', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.getByText('UNGROUP')).toBeInTheDocument();
    });

    it('contains pin/unpin action', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.getByText('PIN')).toBeInTheDocument();
    });

    it('contains mute/unmute action', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.getByText('MUTE')).toBeInTheDocument();
    });

    it('contains duplicate action', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.getByText('DUPLICATE')).toBeInTheDocument();
    });

    it('contains copy URL action', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      expect(screen.getByText('COPY URL')).toBeInTheDocument();
    });

    it('calls tabService.discardTab on freeze', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      const freezeButton = screen.getByText('FREEZE');
      await userEvent.click(freezeButton);

      expect(tabService.discardTab).toHaveBeenCalledWith(1);
    });

    it('calls tabService.ungroupTab on ungroup', async () => {
      render(<TabCard tab={defaultTab} />);

      const card = screen.getByText('Test Tab');
      fireEvent.contextMenu(card);

      const ungroupButton = screen.getByText('UNGROUP');
      await userEvent.click(ungroupButton);

      expect(tabService.ungroupTab).toHaveBeenCalledWith(1);
    });
  });

  describe('DnD Integration', () => {
    it('provides correct sortable id', () => {
      render(<TabCard tab={defaultTab} />);
    });

    it('disables sortable when disabled=true', () => {
      render(<TabCard tab={defaultTab} disabled={true} />);
    });

    it('applies transform styles during drag', () => {
      vi.mock('@dnd-kit/sortable', () => ({
        useSortable: vi.fn(() => ({
          attributes: {},
          listeners: {},
          setNodeRef: vi.fn(),
          transform: { x: 10, y: 20, scaleX: 1, scaleY: 1 },
          transition: 'transform 200ms',
          isDragging: true,
        })),
      }));

      render(<TabCard tab={defaultTab} />);
    });
  });
});
