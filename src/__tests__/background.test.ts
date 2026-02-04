import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAddListener = vi.fn();
const mockRemoveListener = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    onMessage: {
      addListener: mockAddListener,
      removeListener: mockRemoveListener,
    },
    onSuspend: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn().mockReturnValue(Promise.resolve()),
  },
  action: {
    onClicked: { addListener: vi.fn() },
  },
  tabs: {
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onMoved: { addListener: vi.fn() },
    create: vi.fn(),
    discard: vi.fn(),
  },
  tabGroups: {
    onCreated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onMoved: { addListener: vi.fn() },
  },
});

describe('Background Script Listener Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should register a named message listener and remove it on suspend', async () => {
    await import('../background');

    expect(mockAddListener).toHaveBeenCalled();
    const registeredListener = mockAddListener.mock.calls[0][0];
    expect(typeof registeredListener).toBe('function');
    expect(registeredListener.name).toBe('messageListener');

    expect(chrome.runtime.onSuspend.addListener).toHaveBeenCalled();
    const suspendCallback = (chrome.runtime.onSuspend.addListener as any).mock.calls[0][0];
    expect(typeof suspendCallback).toBe('function');

    suspendCallback();

    expect(mockRemoveListener).toHaveBeenCalledWith(registeredListener);
  });

  it('messageListener should handle START_ISLAND_CREATION', async () => {
    const { messageListener } = await import('../background');
    const sendResponse = vi.fn();

    messageListener({ type: 'START_ISLAND_CREATION' }, {} as any, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('messageListener should handle FREEZE_TAB', async () => {
    const { messageListener } = await import('../background');
    const sendResponse = vi.fn();
    (chrome.tabs.discard as any).mockResolvedValue({ id: 1 });

    const result = messageListener({ type: 'FREEZE_TAB', tabId: 1 }, {} as any, sendResponse);
    
    expect(result).toBe(true);
    
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });
});
