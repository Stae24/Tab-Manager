import { Command } from './types';
import { tabService } from '../../services/tabService';

export interface MoveIslandParams {
  islandId: number;
  fromIndex: number;
  toIndex: number;
  fromWindowId: number;
  toWindowId: number;
}

export class MoveIslandCommand implements Command {
  constructor(
    private params: MoveIslandParams,
    public label: string = 'Move Island'
  ) {}

  async execute() {
    await tabService.moveIsland(this.params.islandId, this.params.toIndex, this.params.toWindowId);
  }

  async undo() {
    await tabService.moveIsland(this.params.islandId, this.params.fromIndex, this.params.fromWindowId);
  }
}
