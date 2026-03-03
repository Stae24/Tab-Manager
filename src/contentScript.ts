import { AppearanceSettings } from './types';
import { HotkeyBinding, matchesHotkey, DEFAULT_SIDEBAR_TOGGLE_HOTKEY } from './utils/hotkeys';

export type { HotkeyBinding };
export { matchesHotkey };

export interface SidebarSettings {
  sidebarToggleHotkey: HotkeyBinding;
  managerPageHotkey: HotkeyBinding;
}

export const settings: SidebarSettings = {
  sidebarToggleHotkey: { ...DEFAULT_SIDEBAR_TOGGLE_HOTKEY },
  managerPageHotkey: { code: 'KeyM', ctrl: true, meta: true, alt: false, shift: true }
};

export const handleKeyDown = (event: KeyboardEvent): void => {
  if (matchesHotkey(event, settings.sidebarToggleHotkey)) {
    event.preventDefault();
    chrome.runtime.sendMessage({
      type: 'SIDEBAR_TOGGLE_WINDOW'
    }).catch((err) => { console.debug("sendMessage SIDEBAR_TOGGLE_WINDOW", err); });
    return;
  }

  if (matchesHotkey(event, settings.managerPageHotkey)) {
    event.preventDefault();
    chrome.runtime.sendMessage({
      type: 'OPEN_MANAGER_PAGE'
    }).catch((err) => { console.debug("sendMessage OPEN_MANAGER_PAGE", err); });
  }
};

export const isRestrictedPage = (): boolean => {
  const url = window.location.href;
  const managerUrl = chrome.runtime.getURL('index.html');
  return url.startsWith(managerUrl) || url.startsWith('chrome://') || url.startsWith('about:');
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

// Auto-initialize by default
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  initialize();
}
