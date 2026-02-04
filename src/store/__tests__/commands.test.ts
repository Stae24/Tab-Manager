import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../useStore';
import { MoveTabCommand } from '../commands/MoveTabCommand';
import { MoveIslandCommand } from '../commands/MoveIslandCommand';
import { tabService } from '../../services/tabService';

vi.mock('../../services/tabService', () => ({
  tabService: {
    moveTab: vi.fn(),
    moveIsland: vi.fn(),
    getLiveTabsAndGroups: vi.fn().mockResolvedValue([]),
  }
}));

const mockChrome = {
  tabs: {
    move: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
  },
  tabGroups: {
    move: vi.fn(),
    update: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
  },
  runtime: {
    lastError: null
  }
};

Object.defineProperty(globalThis, 'chrome', {
  value: mockChrome,
  writable: true,
  configurable: true,
});

describe('Command Pattern Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      undoStack: [],
      redoStack: [],
      islands: [],
      vault: [],
      syncLiveTabs: vi.fn().mockResolvedValue(undefined),
    });
  });

  describe('MoveTabCommand', () => {
    it('executes and undos a tab move', async () => {
      const params = {
        tabId: 1,
        fromIndex: 0,
        toIndex: 5,
        fromGroupId: -1,
        toGroupId: 10,
        fromWindowId: 1,
        toWindowId: 1
      };

      const command = new MoveTabCommand(params);

      await command.execute();
      expect(tabService.moveTab).toHaveBeenCalledWith(1, 5, 1);
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: 1, groupId: 10 });

      await command.undo();
      expect(tabService.moveTab).toHaveBeenCalledWith(1, 0, 1);
      expect(mockChrome.tabs.ungroup).toHaveBeenCalledWith(1);
    });

    it('handles ungrouping correctly during execute and undo', async () => {
        const params = {
          tabId: 1,
          fromIndex: 0,
          toIndex: 5,
          fromGroupId: 10,
          toGroupId: -1,
          fromWindowId: 1,
          toWindowId: 1
        };
  
        const command = new MoveTabCommand(params);
  
        await command.execute();
        expect(tabService.moveTab).toHaveBeenCalledWith(1, 5, 1);
        expect(mockChrome.tabs.ungroup).toHaveBeenCalledWith(1);
  
        await command.undo();
        expect(tabService.moveTab).toHaveBeenCalledWith(1, 0, 1);
        expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: 1, groupId: 10 });
      });

    it('handles moving between two different groups', async () => {
      const params = {
        tabId: 1,
        fromIndex: 0,
        toIndex: 5,
        fromGroupId: 10,
        toGroupId: 20,
        fromWindowId: 1,
        toWindowId: 1
      };

      const command = new MoveTabCommand(params);

      await command.execute();
      expect(tabService.moveTab).toHaveBeenCalledWith(1, 5, 1);
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: 1, groupId: 20 });

      await command.undo();
      expect(tabService.moveTab).toHaveBeenCalledWith(1, 0, 1);
      expect(mockChrome.tabs.group).toHaveBeenCalledWith({ tabIds: 1, groupId: 10 });
    });
  });

  describe('MoveIslandCommand', () => {
    it('executes and undos an island move', async () => {
      const params = {
        islandId: 100,
        fromIndex: 0,
        toIndex: 2,
        fromWindowId: 1,
        toWindowId: 1
      };

      const command = new MoveIslandCommand(params);

      await command.execute();
      expect(tabService.moveIsland).toHaveBeenCalledWith(100, 2, 1);

      await command.undo();
      expect(tabService.moveIsland).toHaveBeenCalledWith(100, 0, 1);
    });
  });

  describe('Store Integration (CommandSlice)', () => {
    it('manages undo and redo stacks correctly', async () => {
      const params = {
        tabId: 1,
        fromIndex: 0,
        toIndex: 5,
        fromGroupId: -1,
        toGroupId: -1,
        fromWindowId: 1,
        toWindowId: 1
      };

      const command = new MoveTabCommand(params);
      const store = useStore.getState();

      expect(useStore.getState().undoStack).toHaveLength(0);
      expect(useStore.getState().redoStack).toHaveLength(0);

      await store.executeCommand(command);
      expect(useStore.getState().undoStack).toHaveLength(1);
      expect(useStore.getState().redoStack).toHaveLength(0);
      expect(tabService.moveTab).toHaveBeenCalledWith(1, 5, 1);

      await useStore.getState().undo();
      expect(useStore.getState().undoStack).toHaveLength(0);
      expect(useStore.getState().redoStack).toHaveLength(1);
      expect(tabService.moveTab).toHaveBeenCalledWith(1, 0, 1);
      expect(useStore.getState().syncLiveTabs).toHaveBeenCalled();

      await useStore.getState().redo();
      expect(useStore.getState().undoStack).toHaveLength(1);
      expect(useStore.getState().redoStack).toHaveLength(0);
      expect(tabService.moveTab).toHaveBeenCalledTimes(3);
      expect(useStore.getState().syncLiveTabs).toHaveBeenCalledTimes(2);
    });

    it('clears redo stack on new command execution', async () => {
        const cmd1 = new MoveTabCommand({ tabId: 1, fromIndex: 0, toIndex: 1, fromGroupId: -1, toGroupId: -1, fromWindowId: 1, toWindowId: 1 });
        const cmd2 = new MoveTabCommand({ tabId: 2, fromIndex: 0, toIndex: 1, fromGroupId: -1, toGroupId: -1, fromWindowId: 1, toWindowId: 1 });
        
        const store = useStore.getState();

        await store.executeCommand(cmd1);
        await store.undo();
        expect(useStore.getState().redoStack).toHaveLength(1);

         await store.executeCommand(cmd2);
         expect(useStore.getState().redoStack).toHaveLength(0);
         expect(useStore.getState().undoStack).toHaveLength(1);
     });

    it('does nothing when undo/redo stacks are empty', async () => {
        const store = useStore.getState();
        
        await store.undo();
        expect(tabService.moveTab).not.toHaveBeenCalled();

        await store.redo();
        expect(tabService.moveTab).not.toHaveBeenCalled();
    });
  });
});
