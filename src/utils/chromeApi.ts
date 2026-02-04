import { tabService } from '../services/tabService';

export const {
  moveIsland,
  moveTab,
  createIsland,
  ungroupTab,
  updateTabGroup,
  updateTabGroupCollapse,
  discardTab,
  discardTabs,
  closeTab,
  closeTabs,
  copyTabUrl,
  muteTab,
  unmuteTab,
  pinTab,
  unpinTab,
  duplicateTab,
  duplicateIsland,
  consolidateAndGroupTabs
} = tabService;
