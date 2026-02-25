import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sidebarService, setupSidebarMessageListener } from '../sidebarService';
import { logger } from '../../utils/logger';

// Mock logger to avoid console noise
vi.mock('../../utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    },
    setDebugMode: vi.fn()
}));

vi.mock('../../store/utils', () => ({
    mergeAppearanceSettings: vi.fn((settings) => ({ ...defaultAppearanceSettings, ...settings })),
    defaultAppearanceSettings: {
        toolbarClickAction: 'toggle-sidebar',
        focusExistingTab: true
    }
}));

import { defaultAppearanceSettings } from '../../store/utils';

describe('sidebarService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks for chrome API
        (chrome.tabs.query as any).mockResolvedValue([]);
        (chrome.tabs.create as any).mockResolvedValue({ id: 99 });
        (chrome.tabs.update as any).mockResolvedValue({});
        (chrome.windows.update as any).mockResolvedValue({});
        (chrome.storage.sync.get as any).mockResolvedValue({});
        (chrome.storage.session.get as any).mockResolvedValue({});
        (chrome.storage.session.set as any).mockResolvedValue(undefined);
        (chrome.sidePanel.open as any).mockResolvedValue(undefined);
        (chrome.contextMenus.create as any).mockResolvedValue(undefined);
        (chrome.contextMenus.removeAll as any).mockResolvedValue(undefined);
        (chrome.contextMenus.update as any).mockResolvedValue(undefined);
    });

    describe('loadSettings', () => {
        it('should return default settings if storage is empty', async () => {
            (chrome.storage.sync.get as any).mockResolvedValue({});
            const settings = await sidebarService.loadSettings();
            expect(settings.toolbarClickAction).toBe('toggle-sidebar');
        });

        it('should merge saved settings with defaults', async () => {
            (chrome.storage.sync.get as any).mockResolvedValue({
                appearanceSettings: { theme: 'dark' }
            });
            const settings = await sidebarService.loadSettings();
            expect(settings.theme).toBe('dark');
            expect(settings.toolbarClickAction).toBe('toggle-sidebar'); // Default
        });
    });

    describe('sticky state management', () => {
        it('should get window sticky state', async () => {
            (chrome.storage.session.get as any).mockResolvedValue({ sidebarStickyState: { 10: true } });
            const state = await sidebarService.getWindowStickyState(10);
            expect(state).toBe(true);
        });

        it('should set window sticky state', async () => {
            (chrome.storage.session.get as any).mockResolvedValue({ sidebarStickyState: { 5: false } });
            await sidebarService.setWindowStickyState(10, true);
            expect(chrome.storage.session.set).toHaveBeenCalledWith({
                sidebarStickyState: { 5: false, 10: true }
            });
        });

        it('should toggle window sticky state', async () => {
            (chrome.storage.session.get as any).mockResolvedValue({ sidebarStickyState: { 10: false } });
            const newState = await sidebarService.toggleWindowStickyState(10);
            expect(newState).toBe(true);
            expect(chrome.storage.session.set).toHaveBeenCalledWith({
                sidebarStickyState: { 10: true }
            });
        });
    });

    describe('handleToolbarClick', () => {
        it('should open sidePanel when action is toggle-sidebar', async () => {
            (chrome.storage.sync.get as any).mockResolvedValue({
                appearanceSettings: { toolbarClickAction: 'toggle-sidebar' }
            });
            (chrome.tabs.query as any).mockResolvedValue([{ id: 1, windowId: 10, url: 'https://example.com' }]);

            await sidebarService.handleToolbarClick(10);

            expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 10 });
        });

        it('should open manager page when action is open-manager-page', async () => {
            (chrome.storage.sync.get as any).mockResolvedValue({
                appearanceSettings: { toolbarClickAction: 'open-manager-page', focusExistingTab: false }
            });
            (chrome.tabs.query as any).mockImplementation((query: any) => {
                if (query.active) return Promise.resolve([{ id: 1, windowId: 10, url: 'https://example.com' }]);
                return Promise.resolve([]);
            });

            await sidebarService.handleToolbarClick(10);

            expect(chrome.tabs.create).toHaveBeenCalled();
        });

        it('should open manager page when on restricted URL', async () => {
            (chrome.storage.sync.get as any).mockResolvedValue({
                appearanceSettings: { focusExistingTab: false }
            });
            (chrome.tabs.query as any).mockImplementation((query: any) => {
                if (query.active) return Promise.resolve([{ id: 1, windowId: 10, url: 'chrome://settings' }]);
                return Promise.resolve([]);
            });

            await sidebarService.handleToolbarClick(10);

            expect(chrome.tabs.create).toHaveBeenCalled();
        });
    });

    describe('openManagerPage', () => {
        it('should create a new tab if no manager page exists', async () => {
            (chrome.tabs.query as any).mockResolvedValue([]);
            await sidebarService.openManagerPage();
            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: expect.stringContaining('index.html')
            });
        });

        it('should focus existing tab if settings allow', async () => {
            (chrome.storage.sync.get as any).mockResolvedValue({
                appearanceSettings: { focusExistingTab: true }
            });
            (chrome.tabs.query as any).mockResolvedValue([{ id: 101, windowId: 2, url: 'index.html' }]);

            await sidebarService.openManagerPage();

            expect(chrome.tabs.update).toHaveBeenCalledWith(101, { active: true });
            expect(chrome.windows.update).toHaveBeenCalledWith(2, { focused: true });
        });
    });

    describe('Context Menus', () => {
        it('should setup context menus', async () => {
            await sidebarService.setupContextMenus();
            expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
            expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'toggle-sidebar' }));
        });

        it('should handle context menu click: toggle-sidebar', async () => {
            await sidebarService.handleContextMenuClick({ menuItemId: 'toggle-sidebar' }, { windowId: 10 } as any);
            expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 10 });
        });

        it('should handle context menu click: updateToolbarClickAction', async () => {
            await sidebarService.handleContextMenuClick({ menuItemId: 'toolbar-click-toggle-sidebar' }, { windowId: 10 } as any);
            expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({
                appearanceSettings: expect.objectContaining({ toolbarClickAction: 'toggle-sidebar' })
            }));
        });
    });

    describe('setupSidebarMessageListener', () => {
        it('should handle SIDEBAR_TOGGLE_WINDOW', async () => {
            const sendResponse = vi.fn();

            const handled = setupSidebarMessageListener(
                { type: 'SIDEBAR_TOGGLE_WINDOW', windowId: 10 },
                {} as any,
                sendResponse
            );

            expect(handled).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 10)); // Allow promise processing
            expect(chrome.sidePanel.open).toHaveBeenCalledWith({ windowId: 10 });
            expect(sendResponse).toHaveBeenCalledWith({ success: true, isOpen: true });
        });

        it('should handle SIDEBAR_GET_STICKY_STATE', async () => {
            const sendResponse = vi.fn();
            (chrome.storage.session.get as any).mockResolvedValue({ sidebarStickyState: { 10: true } });

            const handled = setupSidebarMessageListener(
                { type: 'SIDEBAR_GET_STICKY_STATE', windowId: 10 },
                {} as any,
                sendResponse
            );

            expect(handled).toBe(true);
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(sendResponse).toHaveBeenCalledWith({ success: true, isSticky: true });
        });
    });

    describe('Helper Functions', () => {
        it('isManagerPage should identify extension URL', () => {
            const managerUrl = chrome.runtime.getURL('index.html');
            expect(sidebarService.isManagerPage(managerUrl)).toBe(true);
            expect(sidebarService.isManagerPage(managerUrl + '?query=1')).toBe(true);
            expect(sidebarService.isManagerPage('https://google.com')).toBe(false);
        });

        it('isRestrictedUrl should identify restricted browser pages', () => {
            expect(sidebarService.isRestrictedUrl('chrome://extensions')).toBe(true);
            expect(sidebarService.isRestrictedUrl('about:blank')).toBe(true);
            expect(sidebarService.isRestrictedUrl('chrome-extension://other/abc')).toBe(true);
        });
    });
});
