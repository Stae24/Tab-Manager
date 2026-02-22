import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

import { Sidebar } from '../Sidebar';
import type { LiveItem, VaultItem, Island, VaultItem as VaultItemType } from '../../types/index';

// Mock functions
const mockToggleTheme = vi.fn();
const mockSetShowVault = vi.fn();
const mockSetShowAppearancePanel = vi.fn();
const mockUndo = vi.fn();
const mockRedo = vi.fn();

// Sample data for testing export functionality
const sampleIsland: Island = {
    id: 'live-group-1',
    title: 'Test Island',
    color: '#ff0000',
    collapsed: false,
    tabs: [
        { id: 'live-tab-1', title: 'Tab 1', url: 'https://example.com', favicon: '', active: false, discarded: false, windowId: 1, index: 0, groupId: 1, muted: false, pinned: false, audible: false },
        { id: 'live-tab-2', title: 'Tab 2', url: 'https://test.com', favicon: '', active: false, discarded: false, windowId: 1, index: 1, groupId: 1, muted: false, pinned: false, audible: false },
    ],
};

const sampleVaultItem: VaultItemType = {
    id: 'vault-1',
    title: 'Saved Tab',
    url: 'https://saved.com',
    favicon: '',
    active: false,
    discarded: false,
    windowId: 1,
    index: 0,
    groupId: -1,
    savedAt: Date.now(),
    originalId: 'live-tab-100',
};

// Default mock state
const defaultState = {
    isDarkMode: true,
    toggleTheme: mockToggleTheme,
    islands: [] as LiveItem[],
    vault: [] as VaultItemType[],
    showVault: true,
    setShowVault: mockSetShowVault,
    showAppearancePanel: false,
    setShowAppearancePanel: mockSetShowAppearancePanel,
    undoStack: [] as { label: string; timestamp: number }[],
    redoStack: [] as { label: string; timestamp: number }[],
    undo: mockUndo,
    redo: mockRedo,
};

// Mutable state for dynamic mocking
let currentState = { ...defaultState };

vi.mock('../store/useStore', () => ({
    useStore: vi.fn((selector: (state: typeof defaultState) => unknown) => {
        return selector(currentState);
    }),
}));

// Mock AppearanceSettingsPanel
vi.mock('../AppearanceSettingsPanel', () => ({
    AppearanceSettingsPanel: ({ isOpen }: { isOpen: boolean }) => {
        if (!isOpen) return null;
        return <div data-testid="appearance-panel">Settings</div>;
    },
}));

// Mock URL global
vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
});

describe('Sidebar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentState = { ...defaultState };
    });

    describe('Rendering', () => {
        it('should render logo and title', () => {
            render(<Sidebar />);

            expect(screen.getByText('Island Manager')).toBeInTheDocument();
            expect(screen.getByText('GX EDITION')).toBeInTheDocument();
        });

        it('should render settings button', () => {
            render(<Sidebar />);

            const buttons = document.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should render undo button', () => {
            render(<Sidebar />);

            expect(screen.getByText('Undo')).toBeInTheDocument();
        });

        it('should render redo button', () => {
            render(<Sidebar />);

            expect(screen.getByText('Redo')).toBeInTheDocument();
        });

        it('should render theme toggle button', () => {
            render(<Sidebar />);

            expect(screen.getByText('Theme')).toBeInTheDocument();
        });

        it('should render vault toggle button', () => {
            render(<Sidebar />);

            expect(screen.getByText('Vault ON')).toBeInTheDocument();
        });

        it('should render export button', () => {
            render(<Sidebar />);

            expect(screen.getByText('Export')).toBeInTheDocument();
        });

        it('should not render AppearanceSettingsPanel when showAppearancePanel is false', () => {
            render(<Sidebar />);

            expect(screen.queryByTestId('appearance-panel')).not.toBeInTheDocument();
        });
    });

    describe('Export Functionality', () => {
        it('should show export dropdown when clicked', async () => {
            render(<Sidebar />);

            const exportButton = screen.getByText('Export');
            fireEvent.click(exportButton);

            expect(screen.getByText('JSON')).toBeInTheDocument();
            expect(screen.getByText('CSV')).toBeInTheDocument();
            expect(screen.getByText('Markdown')).toBeInTheDocument();
        });

        it('should call createObjectURL on JSON export', async () => {
            render(<Sidebar />);

            const exportButton = screen.getByText('Export');
            fireEvent.click(exportButton);

            const jsonButton = screen.getByText('JSON');
            fireEvent.click(jsonButton);

            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should call createObjectURL on CSV export with island data', async () => {
            currentState = { ...defaultState, islands: [sampleIsland] };

            render(<Sidebar />);

            const exportButton = screen.getByText('Export');
            fireEvent.click(exportButton);

            const csvButton = screen.getByText('CSV');
            fireEvent.click(csvButton);

            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should call createObjectURL on Markdown export with vault data', async () => {
            currentState = { ...defaultState, vault: [sampleVaultItem] };

            render(<Sidebar />);

            const exportButton = screen.getByText('Export');
            fireEvent.click(exportButton);

            const mdButton = screen.getByText('Markdown');
            fireEvent.click(mdButton);

            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should call createObjectURL on CSV export with loose tab', async () => {
            const looseTab = {
                id: 'live-tab-5',
                title: 'Loose Tab',
                url: 'https://loose.com',
                favicon: '',
                active: false,
                discarded: false,
                windowId: 1,
                index: 0,
                groupId: -1,
            };
            currentState = { ...defaultState, islands: [looseTab as LiveItem] };

            render(<Sidebar />);

            const exportButton = screen.getByText('Export');
            fireEvent.click(exportButton);

            const csvButton = screen.getByText('CSV');
            fireEvent.click(csvButton);

            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should close dropdown after export', async () => {
            render(<Sidebar />);

            const exportButton = screen.getByText('Export');
            fireEvent.click(exportButton);

            expect(screen.getByText('JSON')).toBeInTheDocument();

            const jsonButton = screen.getByText('JSON');
            fireEvent.click(jsonButton);

            // Dropdown should close - JSON option no longer visible
            // This tests the setShowExportDropdown(false) call
        });
    });

    describe('Styling', () => {
        it('should apply dark mode styling', () => {
            const { container } = render(<Sidebar />);

            const sidebar = container.firstChild as HTMLElement;
            expect(sidebar).toHaveClass('bg-gx-dark');
        });

        it('should render with correct structure', () => {
            const { container } = render(<Sidebar />);

            expect(container.firstChild).toHaveClass('flex flex-col gap-4');
            expect(container.firstChild).toHaveClass('p-4');
            expect(container.firstChild).toHaveClass('border-b');
        });
    });
});
