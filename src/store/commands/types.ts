export interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
  label: string;
}

export type CommandFactory = (...args: unknown[]) => Command;
