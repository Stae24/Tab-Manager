import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleKeyDown, settings, matchesHotkey, isRestrictedPage } from '../contentScript';

describe('contentScript', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default settings
        settings.sidebarToggleHotkey = { code: 'Space', ctrl: true, meta: true, alt: false, shift: true };
        settings.managerPageHotkey = { code: 'KeyM', ctrl: true, meta: true, alt: false, shift: true };
    });

    describe('matchesHotkey', () => {
        it('should match valid hotkey', () => {
            const event = new KeyboardEvent('keydown', {
                code: 'Space',
                ctrlKey: true,
                metaKey: true,
                shiftKey: true,
                altKey: false
            });
            expect(matchesHotkey(event, settings.sidebarToggleHotkey)).toBe(true);
        });

        it('should not match invalid hotkey', () => {
            const event = new KeyboardEvent('keydown', {
                code: 'KeyA',
                ctrlKey: true,
                metaKey: true,
                shiftKey: true,
                altKey: false
            });
            expect(matchesHotkey(event, settings.sidebarToggleHotkey)).toBe(false);
        });
    });

    describe('handleKeyDown', () => {
        it('should send SIDEBAR_TOGGLE_WINDOW for sidebar hotkey', () => {
            const event = new KeyboardEvent('keydown', {
                code: 'Space',
                ctrlKey: true,
                metaKey: true,
                shiftKey: true,
                altKey: false
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            handleKeyDown(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'SIDEBAR_TOGGLE_WINDOW'
            });
        });

        it('should send OPEN_MANAGER_PAGE for manager hotkey', () => {
            const event = new KeyboardEvent('keydown', {
                code: 'KeyM',
                ctrlKey: true,
                metaKey: true,
                shiftKey: true,
                altKey: false
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            handleKeyDown(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'OPEN_MANAGER_PAGE'
            });
        });

        it('should do nothing for other keys', () => {
            const event = new KeyboardEvent('keydown', {
                code: 'KeyX'
            });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            handleKeyDown(event);

            expect(preventDefaultSpy).not.toHaveBeenCalled();
            expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('isRestrictedPage', () => {
        it('should identify restricted pages', () => {
            // Mock window.location
            const originalLocation = window.location;
            delete (window as any).location;
            (window as any).location = { href: 'chrome://settings' };

            expect(isRestrictedPage()).toBe(true);

            (window as any).location = { href: 'https://google.com' };
            expect(isRestrictedPage()).toBe(false);

            (window as any).location = originalLocation;
        });
    });
});
