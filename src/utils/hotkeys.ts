import { HotkeyBinding } from '../types/index';

export const normalizeHotkeyFromEvent = (event: KeyboardEvent): HotkeyBinding => {
  return {
    code: event.code,
    ctrl: event.ctrlKey || event.metaKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey
  };
};

export const matchesHotkey = (event: KeyboardEvent, binding: HotkeyBinding): boolean => {
  const codeMatches = event.code === binding.code;
  const ctrlMatches = (event.ctrlKey || event.metaKey) === (binding.ctrl || binding.meta);
  const metaMatches = event.metaKey === binding.meta;
  const altMatches = event.altKey === binding.alt;
  const shiftMatches = event.shiftKey === binding.shift;

  return codeMatches && ctrlMatches && metaMatches && altMatches && shiftMatches;
};

export const formatHotkey = (binding: HotkeyBinding): string => {
  const parts: string[] = [];

  if (binding.ctrl || binding.meta) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (binding.alt) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }
  if (binding.shift) {
    parts.push(navigator.platform.includes('Mac') ? '⇧' : 'Shift');
  }

  let key = binding.code;
  if (key.startsWith('Key')) {
    key = key.slice(3);
  } else if (key.startsWith('Digit')) {
    key = key.slice(5);
  } else if (key === 'Space') {
    key = 'Space';
  } else if (key === 'ArrowUp') {
    key = '↑';
  } else if (key === 'ArrowDown') {
    key = '↓';
  } else if (key === 'ArrowLeft') {
    key = '←';
  } else if (key === 'ArrowRight') {
    key = '→';
  }

  parts.push(key);

  return parts.join('+');
};

export const isValidHotkey = (binding: HotkeyBinding): boolean => {
  return !!binding.code && (binding.ctrl || binding.meta || binding.alt || binding.shift);
};

export const hotkeysEqual = (a: HotkeyBinding, b: HotkeyBinding): boolean => {
  return (
    a.code === b.code &&
    a.ctrl === b.ctrl &&
    a.meta === b.meta &&
    a.alt === b.alt &&
    a.shift === b.shift
  );
};

export const hasDuplicateHotkey = (
  newBinding: HotkeyBinding,
  existingBindings: HotkeyBinding[]
): boolean => {
  return existingBindings.some(existing => hotkeysEqual(newBinding, existing));
};
