import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useStore } from '../../store/useStore';
import React from 'react';

vi.mock('../../store/useStore', () => ({
  useStore: vi.fn(),
}));

describe('Sidebar Export', () => {
  const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
  const mockRevokeObjectURL = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });
    
    const mockAnchor = {
      click: vi.fn(),
      href: '',
      download: '',
    };
    
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') return mockAnchor as any;
      return originalCreateElement(tagName as any);
    });

    const mockAppearanceSettings = {
      theme: 'system',
      uiScale: 1,
      settingsScale: 1,
      tabDensity: 'normal',
      animationIntensity: 'full',
      showFavicons: true,
      showAudioIndicators: 'both',
      showFrozenIndicators: true,
      showActiveIndicator: true,
      showTabCount: true,
      accentColor: 'gx-accent',
      borderRadius: 'medium',
      compactGroupHeaders: false,
      buttonSize: 'medium',
      iconPack: 'gx',
      customFontFamily: undefined,
      dragOpacity: 0.5,
      loadingSpinnerStyle: 'pulse',
      menuPosition: 'left',
      vaultSyncEnabled: true,
      faviconSource: 'google',
      faviconFallback: 'duckduckgo',
      faviconSize: '32',
      sortGroupsByCount: true,
      sortVaultGroupsByCount: true,
    };

    (useStore as any).mockImplementation((selector: any) => selector({
      isDarkMode: true,
      toggleTheme: vi.fn(),
      islands: [],
      vault: [],
      showVault: true,
      setShowVault: vi.fn(),
      showAppearancePanel: false,
      setShowAppearancePanel: vi.fn(),
      appearanceSettings: mockAppearanceSettings,
      undoStack: [],
      redoStack: [],
      undo: vi.fn(),
      redo: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates blob URL for export without revocation (relies on GC)', async () => {
    render(<Sidebar />);
    
    const exportButton = screen.getByText(/Export/i);
    fireEvent.click(exportButton);
    
    const jsonButton = screen.getByText('JSON');
    fireEvent.click(jsonButton);
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
  });
});
