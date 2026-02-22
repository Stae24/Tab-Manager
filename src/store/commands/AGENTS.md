# src/store/commands AGENTS.md

## OVERVIEW
Command pattern implementation for undo/redo functionality. Each command encapsulates a reversible operation.

---

## FILES

### types.ts
Command interface definition.

```typescript
interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
  label: string;
}
```

### MoveTabCommand.ts
Records tab relocation with position, window, and group context.

```typescript
interface MoveTabParams {
  tabId: number;
  fromIndex: number;
  toIndex: number;
  fromGroupId: number;
  toGroupId: number;
  fromWindowId: number;
  toWindowId: number;
}

class MoveTabCommand implements Command {
  constructor(private params: MoveTabParams, public label = 'Move Tab') {}
  async execute() { /* move to new position and group */ }
  async undo() { /* restore to original position and group */ }
}
```

### MoveIslandCommand.ts
Records group relocation.

```typescript
interface MoveIslandParams {
  groupId: number;
  fromIndex: number;
  toIndex: number;
  windowId: number;
}

class MoveIslandCommand implements Command {
  async execute() { /* move group to new index */ }
  async undo() { /* restore group position */ }
}
```

---

## USAGE

```typescript
import { MoveTabCommand } from './MoveTabCommand';
import { useStore } from '../useStore';

// Execute with automatic history tracking
const executeCommand = useStore.getState().executeCommand;
executeCommand(new MoveTabCommand(params));

// Undo/Redo
const { undo, redo } = useStore.getState();
await undo();  // Reverts last command
await redo();  // Re-applies last undone command
```

---

## CREATING NEW COMMANDS

1. Create file: `src/store/commands/YourCommand.ts`
2. Implement `Command` interface:

```typescript
import { Command } from './types';
import { logger } from '../../utils/logger';

export class YourCommand implements Command {
  constructor(
    private params: YourParams,
    public label = 'Your Action'
  ) {}

  async execute() {
    logger.info('[YourCommand] Executing');
    // Perform the action
  }

  async undo() {
    logger.info('[YourCommand] Undoing');
    // Reverse the action
  }
}
```

---

## CONVENTIONS

| Pattern | Example |
|---------|---------|
| Async operations | All execute/undo are `async` |
| Error logging | `logger.error('[Command] Failed:', error)` |
| Descriptive labels | `label: 'Move Tab'` for UI display |

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Sync operations | All commands are async |
| Missing undo | Must implement both methods |
| Direct state mutation | Use store actions |
| Skipping history | Always use `executeCommand()` |
