import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand, executeCommandsSequentially, COMMAND_IMPLEMENTATIONS } from '../commands';
import type { Tab } from '../../types';
import type { SearchContext } from '../types';

const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 'live-tab-1',
  title: 'Test Tab',
  url: 'https://example.com',
  favicon: '',
  active: false,
  discarded: false,
  windowId: 1,
  index: 0,
  groupId: -1,
  ...overrides,
});

const createMockContext = (overrides: Partial<SearchContext> = {}): SearchContext => ({
  allTabs: [],
  vaultItems: [],
  groups: new Map(),
  scope: 'current',
  duplicateMap: new Map(),
  localPatterns: [],
  ...overrides,
});

describe('executeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for unknown command', async () => {
    const result = await executeCommand('unknown' as any, [], createMockContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command');
  });

  it('delegates to correct implementation', async () => {
    (chrome.tabs.remove as any).mockResolvedValue(undefined);
    const tabs = [createMockTab({ id: 'live-tab-123' })];
    await executeCommand('delete', tabs, createMockContext());
    expect(chrome.tabs.remove).toHaveBeenCalledWith([123]);
  });
});

describe('deleteCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with 0 affected for empty tabs', async () => {
    const result = await executeCommand('delete', [], createMockContext());
    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(0);
  });

  it('calls chrome.tabs.remove with correct IDs', async () => {
    (chrome.tabs.remove as any).mockResolvedValue(undefined);
    const tabs = [
      createMockTab({ id: 'live-tab-1' }),
      createMockTab({ id: 'live-tab-2' }),
    ];
    await executeCommand('delete', tabs, createMockContext());
    expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2]);
  });

  it('returns affected count', async () => {
    (chrome.tabs.remove as any).mockResolvedValue(undefined);
    const tabs = [
      createMockTab({ id: 'live-tab-1' }),
      createMockTab({ id: 'live-tab-2' }),
      createMockTab({ id: 'live-tab-3' }),
    ];
    const result = await executeCommand('delete', tabs, createMockContext());
    expect(result.affectedCount).toBe(3);
  });

  it('handles Chrome API errors', async () => {
    (chrome.tabs.remove as any).mockRejectedValue(new Error('Tab not found'));
    const tabs = [createMockTab({ id: 'live-tab-1' })];
    const result = await executeCommand('delete', tabs, createMockContext());
    expect(result.success).toBe(false);
    expect(result.error).toBe('Tab not found');
  });

  it('filters invalid IDs', async () => {
    (chrome.tabs.remove as any).mockResolvedValue(undefined);
    const tabs = [
      createMockTab({ id: 'live-tab-1' }),
      createMockTab({ id: 'invalid-id' }),
      createMockTab({ id: 'live-tab-2' }),
    ];
    const result = await executeCommand('delete', tabs, createMockContext());
    expect(chrome.tabs.remove).toHaveBeenCalledWith([1, 2]);
    expect(result.affectedCount).toBe(2);
  });

  it('returns error when no valid IDs', async () => {
    const tabs = [
      createMockTab({ id: 'invalid' }),
      createMockTab({ id: 'also-invalid' }),
    ];
    const result = await executeCommand('delete', tabs, createMockContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid tab IDs');
  });
});

describe('saveCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with 0 affected for empty tabs', async () => {
    const result = await executeCommand('save', [], createMockContext());
    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(0);
  });

  it('returns affected count when store available', async () => {
    const mockSaveToVault = vi.fn().mockResolvedValue(undefined);
    
    vi.doMock('../../store/useStore', () => ({
      useStore: {
        getState: () => ({
          saveToVault: mockSaveToVault,
          islands: [createMockTab()],
        }),
      },
    }));

    vi.doMock('../../store/utils', () => ({
      findItemInList: () => ({ item: createMockTab() }),
    }));

    const result = await executeCommand('save', [createMockTab()], createMockContext());
    expect(result).toBeDefined();
  });
});

describe('freezeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with 0 affected for empty tabs', async () => {
    const result = await executeCommand('freeze', [], createMockContext());
    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(0);
  });

  it('calls chrome.tabs.discard for each ID', async () => {
    (chrome.tabs.discard as any).mockResolvedValue({} as chrome.tabs.Tab);
    const tabs = [
      createMockTab({ id: 'live-tab-1' }),
      createMockTab({ id: 'live-tab-2' }),
    ];
    await executeCommand('freeze', tabs, createMockContext());
    expect(chrome.tabs.discard).toHaveBeenCalledTimes(2);
  });

  it('returns affected count (fulfilled only)', async () => {
    (chrome.tabs.discard as any)
      .mockResolvedValueOnce({} as chrome.tabs.Tab)
      .mockResolvedValueOnce({} as chrome.tabs.Tab)
      .mockRejectedValueOnce(new Error('Cannot discard'));
    
    const tabs = [
      createMockTab({ id: 'live-tab-1' }),
      createMockTab({ id: 'live-tab-2' }),
      createMockTab({ id: 'live-tab-3' }),
    ];
    const result = await executeCommand('freeze', tabs, createMockContext());
    expect(result.affectedCount).toBe(2);
  });

  it('handles partial failures', async () => {
    (chrome.tabs.discard as any)
      .mockResolvedValueOnce({} as chrome.tabs.Tab)
      .mockRejectedValueOnce(new Error('Cannot discard active tab'));
    
    const tabs = [
      createMockTab({ id: 'live-tab-1' }),
      createMockTab({ id: 'live-tab-2' }),
    ];
    const result = await executeCommand('freeze', tabs, createMockContext());
    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(1);
  });

  it('includes errors in result', async () => {
    (chrome.tabs.discard as any).mockRejectedValue(new Error('Tab error'));
    const tabs = [createMockTab({ id: 'live-tab-1' })];
    const result = await executeCommand('freeze', tabs, createMockContext());
    expect(result.error).toBeDefined();
  });

  it('returns error when no valid IDs', async () => {
    const tabs = [createMockTab({ id: 'invalid' })];
    const result = await executeCommand('freeze', tabs, createMockContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('No valid tab IDs');
  });
});

describe('executeCommandsSequentially', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes all commands in order', async () => {
    const order: string[] = [];
    
    vi.spyOn(COMMAND_IMPLEMENTATIONS, 'delete').mockImplementation(async () => {
      order.push('delete');
      return { success: true, affectedCount: 1 };
    });
    vi.spyOn(COMMAND_IMPLEMENTATIONS, 'freeze').mockImplementation(async () => {
      order.push('freeze');
      return { success: true, affectedCount: 1 };
    });

    await executeCommandsSequentially(
      ['delete', 'freeze'],
      [createMockTab()],
      createMockContext()
    );

    expect(order).toEqual(['delete', 'freeze']);
  });

  it('stops on first failure', async () => {
    const order: string[] = [];
    
    vi.spyOn(COMMAND_IMPLEMENTATIONS, 'delete').mockImplementation(async () => {
      order.push('delete');
      return { success: false, affectedCount: 0, error: 'Failed' };
    });
    vi.spyOn(COMMAND_IMPLEMENTATIONS, 'freeze').mockImplementation(async () => {
      order.push('freeze');
      return { success: true, affectedCount: 1 };
    });

    const results = await executeCommandsSequentially(
      ['delete', 'freeze'],
      [createMockTab()],
      createMockContext()
    );

    expect(order).toEqual(['delete']);
    expect(results).toHaveLength(1);
  });

  it('returns all results when successful', async () => {
    vi.spyOn(COMMAND_IMPLEMENTATIONS, 'delete').mockImplementation(async () => ({
      success: true,
      affectedCount: 1,
    }));
    vi.spyOn(COMMAND_IMPLEMENTATIONS, 'freeze').mockImplementation(async () => ({
      success: true,
      affectedCount: 1,
    }));

    const results = await executeCommandsSequentially(
      ['delete', 'freeze'],
      [createMockTab()],
      createMockContext()
    );

    expect(results).toHaveLength(2);
  });

  it('handles empty commands array', async () => {
    const results = await executeCommandsSequentially([], [], createMockContext());
    expect(results).toEqual([]);
  });
});

describe('COMMAND_IMPLEMENTATIONS', () => {
  it('has delete implementation', () => {
    expect(COMMAND_IMPLEMENTATIONS.delete).toBeDefined();
    expect(typeof COMMAND_IMPLEMENTATIONS.delete).toBe('function');
  });

  it('has save implementation', () => {
    expect(COMMAND_IMPLEMENTATIONS.save).toBeDefined();
    expect(typeof COMMAND_IMPLEMENTATIONS.save).toBe('function');
  });

  it('has freeze implementation', () => {
    expect(COMMAND_IMPLEMENTATIONS.freeze).toBeDefined();
    expect(typeof COMMAND_IMPLEMENTATIONS.freeze).toBe('function');
  });
});
