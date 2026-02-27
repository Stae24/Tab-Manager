import { vi } from 'vitest';

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1, focused: true }),
    move: vi.fn().mockResolvedValue([{ id: 1 }]),
    remove: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue({ id: 1 }),
    group: vi.fn().mockResolvedValue({ id: 1 }),
    ungroup: vi.fn().mockResolvedValue(undefined),
    onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabGroups: {
    query: vi.fn(),
    onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    getURL: vi.fn((path: string) => `chrome-extension://abc123/${path}`),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  action: {
    onClicked: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  commands: {
    onCommand: { addListener: vi.fn(), removeListener: vi.fn() },
    getAll: vi.fn().mockResolvedValue([]),
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
    setOptions: vi.fn().mockResolvedValue(undefined),
    getOptions: vi.fn().mockResolvedValue({}),
    setPanelBehavior: vi.fn().mockResolvedValue(undefined),
    getPanelBehavior: vi.fn().mockResolvedValue({}),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    onClicked: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
    update: vi.fn().mockResolvedValue({ id: 1, focused: true, type: 'normal', state: 'normal' }),
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

// @ts-ignore
global.chrome = chromeMock as any;

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;
