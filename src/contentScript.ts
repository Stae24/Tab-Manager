import { AppearanceSettings } from './types';

export interface HotkeyBinding {
  code: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

export interface SidebarSettings {
  sidebarToggleHotkey: HotkeyBinding;
  managerPageHotkey: HotkeyBinding;
}

export let settings: SidebarSettings = {
  sidebarToggleHotkey: { code: 'Space', ctrl: true, meta: true, alt: false, shift: true },
  managerPageHotkey: { code: 'KeyM', ctrl: true, meta: true, alt: false, shift: true }
};

export const matchesHotkey = (event: KeyboardEvent, binding: HotkeyBinding): boolean => {
  const codeMatches = event.code === binding.code;
  const ctrlMatches = (event.ctrlKey || event.metaKey) === (binding.ctrl || binding.meta);
  const metaMatches = event.metaKey === binding.meta;
  const altMatches = event.altKey === binding.alt;
  const shiftMatches = event.shiftKey === binding.shift;

  return codeMatches && ctrlMatches && metaMatches && altMatches && shiftMatches;
};

export const handleKeyDown = (event: KeyboardEvent): void => {
  if (matchesHotkey(event, settings.sidebarToggleHotkey)) {
    event.preventDefault();
    chrome.runtime.sendMessage({
      type: 'SIDEBAR_TOGGLE_WINDOW'
    }).catch(() => { });
    return;
  }

  if (matchesHotkey(event, settings.managerPageHotkey)) {
    event.preventDefault();
    chrome.runtime.sendMessage({
      type: 'OPEN_MANAGER_PAGE'
    }).catch(() => { });
  }
};

export const isRestrictedPage = (): boolean => {
  const url = window.location.href;
  const managerUrl = chrome.runtime.getURL('index.html');
  return url === managerUrl || url.startsWith('chrome://') || url.startsWith('about:');
};

export const initialize = (): void => {
  if (isRestrictedPage()) {
    return;
  }

  // Synchronize hotkeys from storage
  chrome.storage.sync.get(['appearanceSettings']).then((result: { appearanceSettings?: AppearanceSettings }) => {
    if (result.appearanceSettings) {
      if (result.appearanceSettings.sidebarToggleHotkey) {
        settings.sidebarToggleHotkey = result.appearanceSettings.sidebarToggleHotkey;
      }
      if (result.appearanceSettings.managerPageHotkey) {
        settings.managerPageHotkey = result.appearanceSettings.managerPageHotkey;
      }
    }
  }).catch(() => { });

  document.addEventListener('keydown', handleKeyDown);
};

// Auto-initialize if not in a test environment
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  initialize();
}
