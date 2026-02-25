interface HotkeyBinding {
  code: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

interface SidebarSettings {
  sidebarLayoutMode: 'overlay' | 'push';
  sidebarDockSide: 'left' | 'right';
  sidebarWidthPx: number;
  sidebarToggleHotkey: HotkeyBinding;
  managerPageHotkey: HotkeyBinding;
}

const SIDEBAR_MIN_WIDTH = 300;
const SIDEBAR_MAX_WIDTH = 800;

let sidebarContainer: HTMLElement | null = null;
let sidebarIframe: HTMLIFrameElement | null = null;
let resizeHandle: HTMLElement | null = null;
let isSidebarOpen = false;
let settings: SidebarSettings = {
  sidebarLayoutMode: 'overlay',
  sidebarDockSide: 'right',
  sidebarWidthPx: 420,
  sidebarToggleHotkey: { code: 'Space', ctrl: true, meta: true, alt: false, shift: true },
  managerPageHotkey: { code: 'KeyM', ctrl: true, meta: true, alt: false, shift: true }
};

const matchesHotkey = (event: KeyboardEvent, binding: HotkeyBinding): boolean => {
  const codeMatches = event.code === binding.code;
  const ctrlMatches = (event.ctrlKey || event.metaKey) === (binding.ctrl || binding.meta);
  const metaMatches = event.metaKey === binding.meta;
  const altMatches = event.altKey === binding.alt;
  const shiftMatches = event.shiftKey === binding.shift;

  return codeMatches && ctrlMatches && metaMatches && altMatches && shiftMatches;
};

const createSidebar = (): void => {
  if (sidebarContainer) return;

  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'island-manager-sidebar';
  sidebarContainer.style.cssText = `
    position: fixed;
    top: 0;
    ${settings.sidebarDockSide === 'left' ? 'left: 0;' : 'right: 0;'}
    width: ${settings.sidebarWidthPx}px;
    height: 100vh;
    z-index: 2147483647;
    transform: translateX(${settings.sidebarDockSide === 'left' ? '-100%' : '100%'});
    transition: transform 0.3s ease;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  `;

  const shadowRoot = sidebarContainer.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: #1a1a2e;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    }
    .resize-handle {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: ew-resize;
      background: transparent;
      transition: background 0.2s;
    }
    .resize-handle:hover {
      background: rgba(127, 34, 254, 0.3);
    }
    .resize-handle.${settings.sidebarDockSide === 'left' ? 'right' : 'left'} {
      ${settings.sidebarDockSide === 'left' ? 'right: -3px;' : 'left: -3px;'}
    }
  `;
  shadowRoot.appendChild(style);

  sidebarIframe = document.createElement('iframe');
  sidebarIframe.src = chrome.runtime.getURL('index.html');
  sidebarIframe.style.cssText = 'width: 100%; height: 100%; border: none;';
  shadowRoot.appendChild(sidebarIframe);

  resizeHandle = document.createElement('div');
  resizeHandle.className = `resize-handle ${settings.sidebarDockSide === 'left' ? 'right' : 'left'}`;
  shadowRoot.appendChild(resizeHandle);

  document.body.appendChild(sidebarContainer);

  setupResizeHandler();
};

const setupResizeHandler = (): void => {
  if (!resizeHandle || !sidebarContainer) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const onMouseMove = (e: MouseEvent): void => {
    if (!isResizing) return;

    const delta = settings.sidebarDockSide === 'left'
      ? e.clientX - startX
      : startX - e.clientX;

    let newWidth = startWidth + delta;
    newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth));

    settings.sidebarWidthPx = newWidth;
    if (sidebarContainer) {
      sidebarContainer.style.width = `${newWidth}px`;
    }
  };

  const onMouseUp = (): void => {
    if (!isResizing) return;
    isResizing = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    persistSettings();
  };

  resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = settings.sidebarWidthPx;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  });
};

const openSidebar = (): void => {
  if (!sidebarContainer) {
    createSidebar();
  }

  isSidebarOpen = true;

  if (settings.sidebarLayoutMode === 'push') {
    document.body.style.marginLeft = settings.sidebarDockSide === 'left'
      ? `${settings.sidebarWidthPx}px`
      : '0';
    document.body.style.marginRight = settings.sidebarDockSide === 'right'
      ? `${settings.sidebarWidthPx}px`
      : '0';
    document.body.style.transition = 'margin 0.3s ease';
  }

  if (sidebarContainer) {
    sidebarContainer.style.transform = 'translateX(0)';
  }
};

const closeSidebar = (): void => {
  if (!sidebarContainer) return;

  isSidebarOpen = false;

  if (settings.sidebarLayoutMode === 'push') {
    document.body.style.marginLeft = '0';
    document.body.style.marginRight = '0';
  }

  sidebarContainer.style.transform = settings.sidebarDockSide === 'left'
    ? 'translateX(-100%)'
    : 'translateX(100%)';
};

const toggleSidebar = (): void => {
  if (isSidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
};

const persistSettings = (): void => {
  chrome.runtime.sendMessage({
    type: 'SIDEBAR_SETTINGS_UPDATE',
    settings: {
      sidebarLayoutMode: settings.sidebarLayoutMode,
      sidebarDockSide: settings.sidebarDockSide,
      sidebarWidthPx: settings.sidebarWidthPx
    }
  }).catch(() => {});
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (matchesHotkey(event, settings.sidebarToggleHotkey)) {
    event.preventDefault();
    const windowId = window.top?.chrome?.runtime?.connect ? undefined : undefined;
    chrome.runtime.sendMessage({
      type: 'SIDEBAR_TOGGLE_WINDOW',
      windowId: windowId
    }).catch(() => {});
    return;
  }

  if (matchesHotkey(event, settings.managerPageHotkey)) {
    event.preventDefault();
    chrome.runtime.sendMessage({
      type: 'OPEN_MANAGER_PAGE'
    }).catch(() => {});
  }
};

const handleMessage = (message: { type: string; isOpen?: boolean; settings?: Partial<SidebarSettings> }): void => {
  if (message.type === 'SIDEBAR_SET_WINDOW_OPEN') {
    if (message.isOpen) {
      openSidebar();
    } else {
      closeSidebar();
    }
  }

  if (message.type === 'SIDEBAR_SETTINGS_SYNC' && message.settings) {
    if (message.settings.sidebarLayoutMode) {
      settings.sidebarLayoutMode = message.settings.sidebarLayoutMode;
    }
    if (message.settings.sidebarDockSide) {
      settings.sidebarDockSide = message.settings.sidebarDockSide;
      if (sidebarContainer) {
        sidebarContainer.style.left = settings.sidebarDockSide === 'left' ? '0' : 'auto';
        sidebarContainer.style.right = settings.sidebarDockSide === 'right' ? '0' : 'auto';
        sidebarContainer.style.transform = settings.sidebarDockSide === 'left'
          ? (isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)')
          : (isSidebarOpen ? 'translateX(0)' : 'translateX(100%)');
      }
    }
    if (message.settings.sidebarWidthPx) {
      settings.sidebarWidthPx = message.settings.sidebarWidthPx;
      if (sidebarContainer) {
        sidebarContainer.style.width = `${settings.sidebarWidthPx}px`;
      }
    }
  }
};

const initialize = (): void => {
  if (isRestrictedPage()) {
    return;
  }

  createSidebar();

  chrome.runtime.sendMessage({
    type: 'SIDEBAR_SYNC_REQUEST'
  }).then((response: { isOpen?: boolean } | undefined) => {
    if (response?.isOpen) {
      openSidebar();
    }
  }).catch(() => {});

  chrome.runtime.onMessage.addListener((message) => {
    handleMessage(message);
  });

  document.addEventListener('keydown', handleKeyDown);
};

const isRestrictedPage = (): boolean => {
  const url = window.location.href;
  const managerUrl = chrome.runtime.getURL('index.html');
  return url === managerUrl || url.startsWith('chrome://') || url.startsWith('about:');
};

initialize();
