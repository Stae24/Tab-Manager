import { describe, it, expect, vi } from 'vitest';
import {
    normalizeHotkeyFromEvent,
    matchesHotkey,
    formatHotkey,
    isValidHotkey,
    hotkeysEqual,
    hasDuplicateHotkey
} from '../hotkeys';

describe('hotkeys util', () => {
    describe('normalizeHotkeyFromEvent', () => {
        it('should normalize basic key', () => {
            const event = { code: 'KeyA', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent;
            expect(normalizeHotkeyFromEvent(event)).toEqual({
                code: 'KeyA',
                ctrl: true,
                meta: false,
                alt: false,
                shift: false
            });
        });

        it('should treat metaKey as ctrl in normalization', () => {
            const event = { code: 'KeyS', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false } as KeyboardEvent;
            expect(normalizeHotkeyFromEvent(event)).toEqual({
                code: 'KeyS',
                ctrl: true,
                meta: true,
                alt: false,
                shift: false
            });
        });
    });

    describe('matchesHotkey', () => {
        it('should return true for exact match', () => {
            const event = { code: 'KeyA', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent;
            const binding = { code: 'KeyA', ctrl: true, meta: false, alt: false, shift: false };
            expect(matchesHotkey(event, binding)).toBe(true);
        });

        it('should return false for code mismatch', () => {
            const event = { code: 'KeyB', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent;
            const binding = { code: 'KeyA', ctrl: true, meta: false, alt: false, shift: false };
            expect(matchesHotkey(event, binding)).toBe(false);
        });

        it('should handle combined ctrl/meta matches', () => {
            const event = { code: 'Space', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false } as KeyboardEvent;
            const binding = { code: 'Space', ctrl: true, meta: true, alt: false, shift: false };
            expect(matchesHotkey(event, binding)).toBe(true);
        });
    });

    describe('formatHotkey', () => {
        it('should format non-Mac hotkey', () => {
            vi.stubGlobal('navigator', { platform: 'Win32' });
            const binding = { code: 'KeyS', ctrl: true, meta: false, alt: true, shift: true };
            expect(formatHotkey(binding)).toBe('Ctrl+Alt+Shift+S');
        });

        it('should format Mac hotkey', () => {
            vi.stubGlobal('navigator', { platform: 'MacIntel' });
            const binding = { code: 'KeyS', ctrl: true, meta: true, alt: true, shift: true };
            expect(formatHotkey(binding)).toBe('⌘+⌥+⇧+S');
            vi.unstubAllGlobals();
        });

        it('should handle special keys', () => {
            const binding = { code: 'ArrowUp', ctrl: true, meta: false, alt: false, shift: false };
            expect(formatHotkey(binding)).toContain('↑');

            const digitBinding = { code: 'Digit1', ctrl: true, meta: false, alt: false, shift: false };
            expect(formatHotkey(digitBinding)).toContain('1');
        });
    });

    describe('isValidHotkey', () => {
        it('should be valid if at least one modifier is present', () => {
            expect(isValidHotkey({ code: 'KeyA', ctrl: true, meta: false, alt: false, shift: false })).toBe(true);
            expect(isValidHotkey({ code: 'KeyA', ctrl: false, meta: false, alt: false, shift: false })).toBe(false);
        });
    });

    describe('hotkeysEqual', () => {
        it('should identify identical hotkeys', () => {
            const a = { code: 'KeyS', ctrl: true, meta: false, alt: false, shift: false };
            const b = { code: 'KeyS', ctrl: true, meta: false, alt: false, shift: false };
            expect(hotkeysEqual(a, b)).toBe(true);
        });
    });

    describe('hasDuplicateHotkey', () => {
        it('should find duplicates in a list', () => {
            const list = [
                { code: 'KeyS', ctrl: true, meta: false, alt: false, shift: false },
                { code: 'KeyM', ctrl: true, meta: false, alt: false, shift: false }
            ];
            const dup = { code: 'KeyS', ctrl: true, meta: false, alt: false, shift: false };
            expect(hasDuplicateHotkey(dup, list)).toBe(true);
        });
    });
});
