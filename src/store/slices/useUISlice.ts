import { StateCreator } from 'zustand';
import { syncSettings } from '../utils';

export interface UISlice {
  dividerPosition: number;
  showVault: boolean;
  isRenaming: boolean;
  showAppearancePanel: boolean;
  settingsPanelWidth: number;
  setDividerPosition: (pos: number) => void;
  setShowVault: (show: boolean) => void;
  setIsRenaming: (val: boolean) => void;
  setShowAppearancePanel: (show: boolean) => void;
  setSettingsPanelWidth: (width: number) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  dividerPosition: 50,
  showVault: true,
  isRenaming: false,
  showAppearancePanel: false,
  settingsPanelWidth: 480,

  setDividerPosition: (dividerPosition) => {
    set({ dividerPosition });
    syncSettings({ dividerPosition });
  },

  setShowVault: (showVault) => {
    set({ showVault });
    syncSettings({ showVault });
  },

  setIsRenaming: (isRenaming) => set({ isRenaming }),

  setShowAppearancePanel: (showAppearancePanel) => set({ showAppearancePanel }),

  setSettingsPanelWidth: (width) => {
    const clampedWidth = Math.max(320, Math.min(800, width));
    set({ settingsPanelWidth: clampedWidth });
    syncSettings({ settingsPanelWidth: clampedWidth });
  },
});
