import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { useStore } from '../../store/useStore';
import React from 'react';

vi.mock('../../store/useStore', () => ({
  useStore: vi.fn(),
}));

describe('Sidebar Export Revocation', () => {
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
    }));
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('revokes the blob URL after 1000ms', async () => {
    render(<Sidebar />);
    
    const exportButton = screen.getByText(/Export/i);
    fireEvent.click(exportButton);
    
    const jsonButton = screen.getByText('JSON');
    fireEvent.click(jsonButton);
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
