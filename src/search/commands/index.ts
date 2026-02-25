import { Tab } from '../../types/index';
import { CommandType, CommandFunction, CommandResult, SearchContext } from '../types';
import { parseNumericId } from '../../store/utils';

const deleteCommand: CommandFunction = async (
  tabs: Tab[],
  _context: SearchContext
): Promise<CommandResult> => {
  if (tabs.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const tabIds = tabs
    .map((tab) => parseNumericId(tab.id))
    .filter((id): id is number => id !== null);

  if (tabIds.length === 0) {
    return { success: false, affectedCount: 0, error: 'No valid tab IDs found' };
  }

  try {
    await chrome.tabs.remove(tabIds);
    return { success: true, affectedCount: tabIds.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, affectedCount: 0, error: msg };
  }
};

const saveCommand: CommandFunction = async (
  tabs: Tab[],
  context: SearchContext
): Promise<CommandResult> => {
  if (tabs.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  try {
    const { useStore } = await import('../../store/useStore');
    const { findItemInList } = await import('../../store/utils');
    const store = useStore.getState();

    let savedCount = 0;
    for (const tab of tabs) {
      const found = findItemInList(store.islands, tab.id);
      if (found && found.item) {
        await store.saveToVault(found.item);
        savedCount++;
      }
    }

    return { success: true, affectedCount: savedCount };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, affectedCount: 0, error: msg };
  }
};

const freezeCommand: CommandFunction = async (
  tabs: Tab[],
  _context: SearchContext
): Promise<CommandResult> => {
  if (tabs.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const tabIds = tabs
    .map((tab) => parseNumericId(tab.id))
    .filter((id): id is number => id !== null);

  if (tabIds.length === 0) {
    return { success: false, affectedCount: 0, error: 'No valid tab IDs found' };
  }

  const results = await Promise.allSettled(tabIds.map((id) => chrome.tabs.discard(id)));
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  const affectedCount = fulfilled.length;
  const errors = rejected.map((r) => r.status === 'rejected' ? r.reason : '').filter(Boolean);

  return {
    success: affectedCount > 0,
    affectedCount,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
};

const groupCommand: CommandFunction = async (
  tabs: Tab[],
  _context: SearchContext
): Promise<CommandResult> => {
  if (tabs.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const tabIds = tabs
    .map((tab) => parseNumericId(tab.id))
    .filter((id): id is number => id !== null);

  if (tabIds.length < 2) {
    return { success: false, affectedCount: 0, error: 'Need at least 2 tabs to group' };
  }

  try {
    const { tabService } = await import('../../services/tabService');
    await tabService.consolidateAndGroupTabs(tabIds, { color: 'random' });
    return { success: true, affectedCount: tabIds.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, affectedCount: 0, error: msg };
  }
};

const ungroupCommand: CommandFunction = async (
  tabs: Tab[],
  _context: SearchContext
): Promise<CommandResult> => {
  if (tabs.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const tabIds = tabs
    .map((tab) => parseNumericId(tab.id))
    .filter((id): id is number => id !== null);

  if (tabIds.length === 0) {
    return { success: false, affectedCount: 0, error: 'No valid tab IDs found' };
  }

  try {
    const { ungroupTab } = await import('../../utils/chromeApi');
    await ungroupTab(tabIds);
    return { success: true, affectedCount: tabIds.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, affectedCount: 0, error: msg };
  }
};

export const COMMAND_IMPLEMENTATIONS: Record<CommandType, CommandFunction> = {
  delete: deleteCommand,
  save: saveCommand,
  freeze: freezeCommand,
  group: groupCommand,
  ungroup: ungroupCommand,
};

export async function executeCommand(
  command: CommandType,
  tabs: Tab[],
  context: SearchContext
): Promise<CommandResult> {
  const impl = COMMAND_IMPLEMENTATIONS[command];
  if (!impl) {
    return { success: false, affectedCount: 0, error: `Unknown command: ${command}` };
  }
  return impl(tabs, context);
}

export async function executeCommandsSequentially(
  commands: CommandType[],
  tabs: Tab[],
  context: SearchContext
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (const command of commands) {
    const result = await executeCommand(command, tabs, context);
    results.push(result);

    if (!result.success) {
      break;
    }
  }

  return results;
}
