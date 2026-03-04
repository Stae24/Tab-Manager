import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppearanceSettingsPanel } from '../AppearanceSettingsPanel';
import { useStore, defaultAppearanceSettings } from '../../store/useStore';

vi.mock('../../store/useStore', () => ({
    useStore: vi.fn(),
    defaultAppearanceSettings: {
        theme: 'system',
        themeElements: { background: true, panels: true, text: true, accent: 'theme' },
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
        dragOpacity: 0.8,
        loadingSpinnerStyle: 'pulse',
        menuPosition: 'left',
        vaultSyncEnabled: true,
        faviconSource: 'google',
        faviconFallback: 'duckduckgo',
        faviconSize: '32',
        sortGroupsByCount: true,
        sortVaultGroupsByCount: true,
        autoPinTabManager: true,
        focusExistingTab: true,
        toolbarClickAction: 'toggle-sidebar',
        sidebarLayoutMode: 'overlay',
        sidebarDockSide: 'left',
        sidebarWidthPx: 300,
        sidebarWidthMaxPct: 40,
        sidebarToggleHotkey: { code: 'Space', ctrl: true, meta: true, alt: false, shift: true },
        managerPageHotkey: { code: 'KeyM', ctrl: true, meta: true, alt: false, shift: true },
        debugMode: false,
    }
}));

describe('AppearanceSettingsPanel', () => {
    const mockSetAppearanceSettings = vi.fn();
    const mockSetSettingsPanelWidth = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockImplementation((selector: any) => {
            const state = {
                appearanceSettings: defaultAppearanceSettings,
                setAppearanceSettings: mockSetAppearanceSettings,
                vaultQuota: { used: 0, total: 100 },
                setVaultSyncEnabled: vi.fn(),
                settingsPanelWidth: 400,
                setSettingsPanelWidth: mockSetSettingsPanelWidth,
            };
            return selector(state);
        });
    });

    it('should render when open', () => {
        render(<AppearanceSettingsPanel isOpen={true} onClose={mockOnClose} />);
        expect(screen.getByPlaceholderText(/search settings/i)).toBeTruthy();
        expect(screen.getByText(/appearance/i)).toBeTruthy();
    });

    it('should not render when closed', () => {
        const { container } = render(<AppearanceSettingsPanel isOpen={false} onClose={mockOnClose} />);
        expect(container.firstChild).toBeNull();
    });

    it('should switch tabs', () => {
        render(<AppearanceSettingsPanel isOpen={true} onClose={mockOnClose} />);

        const layoutBtn = screen.getByRole('button', { name: /layout/i });
        fireEvent.click(layoutBtn);

        expect(screen.getByText(/ui scale/i)).toBeTruthy();
    });

    it('should update theme setting', () => {
        render(<AppearanceSettingsPanel isOpen={true} onClose={mockOnClose} />);

        fireEvent.click(screen.getByText(/color themes/i));

        const darkModeOption = screen.getByText(/dark mode/i);
        fireEvent.click(darkModeOption);

        expect(mockSetAppearanceSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    });

    it('should handle search filtering', () => {
        render(<AppearanceSettingsPanel isOpen={true} onClose={mockOnClose} />);

        const searchInput = screen.getByPlaceholderText(/search settings/i);
        fireEvent.change(searchInput, { target: { value: 'Appearance' } });

        const appearanceButtons = screen.getAllByRole('button', { name: /appearance/i });
        fireEvent.click(appearanceButtons[0]);

        expect(screen.getByText(/color themes/i)).toBeDefined();

        fireEvent.change(searchInput, { target: { value: 'NonExistentSetting' } });
        expect(screen.queryByText(/color themes/i)).toBeNull();
    });

    it('should handle closing', () => {
        vi.useFakeTimers();
        try {
            render(<AppearanceSettingsPanel isOpen={true} onClose={mockOnClose} />);

            const closeBtn = screen.getAllByRole('button').find(b => b.querySelector('svg.lucide-x'));
            expect(closeBtn).toBeDefined();
            if (closeBtn) fireEvent.click(closeBtn);

            act(() => {
                vi.advanceTimersByTime(300);
            });

            expect(mockOnClose).toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
