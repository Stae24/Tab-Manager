import type { HotkeyBinding } from '../types/index';

export const matchesHotkey = (event: KeyboardEvent, binding: HotkeyBinding): boolean => {
  const codeMatches = event.code === binding.code;
  const ctrlMatches = (event.ctrlKey || event.metaKey) === (binding.ctrl || binding.meta);
  const metaMatches = event.metaKey === binding.meta;
  const altMatches = event.altKey === binding.alt;
  const shiftMatches = event.shiftKey === binding.shift;

  return codeMatches && ctrlMatches && metaMatches && altMatches && shiftMatches;
};

export const DEFAULT_SIDEBAR_TOGGLE_HOTKEY: HotkeyBinding = {
  code: 'Space', ctrl: true, meta: true, alt: false, shift: true
};

export const normalizeHotkeyFromEvent = (event: KeyboardEvent): HotkeyBinding => ({
  code: event.code,
  ctrl: event.ctrlKey || event.metaKey,
  meta: event.metaKey,
  alt: event.altKey,
  shift: event.shiftKey,
});

export const formatHotkey = (binding: HotkeyBinding): string => {
  const ua = typeof navigator !== 'undefined' ? navigator : null;
  const isMac = ua && ('userAgentData' in ua
    ? (ua as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform?.toLowerCase().startsWith('mac')
    : ua.platform?.startsWith('Mac'));
  const parts: string[] = [];

  if (binding.ctrl || binding.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (binding.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (binding.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }

  const keyMap: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Space: 'Space', Backspace: '⌫', Enter: '↵', Escape: 'Esc',
  };
  const code = binding.code;
  let key = keyMap[code];
  if (!key) {
    if (code.startsWith('Key')) key = code.slice(3);
    else if (code.startsWith('Digit')) key = code.slice(5);
    else key = code;
  }
  parts.push(key);

  return parts.join('+');
};

export const isValidHotkey = (binding: HotkeyBinding): boolean => {
  if (!binding.code) return false;
  return binding.ctrl || binding.meta || binding.alt || binding.shift;
};

export const hotkeysEqual = (a: HotkeyBinding, b: HotkeyBinding): boolean =>
  a.code === b.code && a.ctrl === b.ctrl && a.meta === b.meta && a.alt === b.alt && a.shift === b.shift;

export const hasDuplicateHotkey = (hotkey: HotkeyBinding, list: HotkeyBinding[]): boolean =>
  list.some((h) => hotkeysEqual(h, hotkey));
