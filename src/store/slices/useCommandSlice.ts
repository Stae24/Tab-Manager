import { StateCreator } from 'zustand';
import { Command } from '../commands/types';
import { StoreState } from '../types';

export interface CommandSlice {
  undoStack: Command[];
  redoStack: Command[];
  executeCommand: (command: Command) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export const createCommandSlice: StateCreator<StoreState, [], [], CommandSlice> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  executeCommand: async (command: Command) => {
    await command.execute();
    set((state: StoreState) => ({
      undoStack: [...state.undoStack, command],
      redoStack: [],
    }));
  },

  undo: async () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;

    const command = undoStack[undoStack.length - 1];
    await command.undo();

    set((state: StoreState) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [command, ...state.redoStack],
    }));
    
    await get().syncLiveTabs();
  },

  redo: async () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;

    const command = redoStack[0];
    await command.execute();

    set((state: StoreState) => ({
      undoStack: [...state.undoStack, command],
      redoStack: state.redoStack.slice(1),
    }));
    
    await get().syncLiveTabs();
  },
});
