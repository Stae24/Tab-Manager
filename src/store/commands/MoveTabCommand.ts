import { Command } from './types';
import { tabService } from '../../services/tabService';

export interface MoveTabParams {
  tabId: number;
  fromIndex: number;
  toIndex: number;
  fromGroupId: number;
  toGroupId: number;
  fromWindowId: number;
  toWindowId: number;
}

export class MoveTabCommand implements Command {
  constructor(
    private params: MoveTabParams,
    public label: string = 'Move Tab'
  ) {}

  async execute() {
    await tabService.moveTab(this.params.tabId, this.params.toIndex, this.params.toWindowId);
    if (this.params.toGroupId !== -1) {
      await chrome.tabs.group({ tabIds: this.params.tabId, groupId: this.params.toGroupId });
    } else {
      try {
        await chrome.tabs.ungroup(this.params.tabId);
      } catch (e) {}
    }
  }

  async undo() {
    await tabService.moveTab(this.params.tabId, this.params.fromIndex, this.params.fromWindowId);
    if (this.params.fromGroupId !== -1) {
      await chrome.tabs.group({ tabIds: this.params.tabId, groupId: this.params.fromGroupId });
    } else {
      try {
        await chrome.tabs.ungroup(this.params.tabId);
      } catch (e) {}
    }
  }
}
