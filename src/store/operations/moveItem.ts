import { UniqueIdentifier } from '@dnd-kit/core';
import { Island, Tab, LiveItem, VaultItem } from '../../types/index';
import { findItemInList, cloneWithDeepGroups } from '../utils';

export interface FoundItem {
  item: LiveItem | VaultItem | Tab;
  index: number;
  containerId: UniqueIdentifier;
}

export interface MoveTarget {
  targetContainerId: UniqueIdentifier;
  targetIndex: number;
}

export interface MoveResult {
  newIslands: LiveItem[];
  newVault: VaultItem[];
  isLive: boolean;
}

export function isItemInList(
  list: (LiveItem | VaultItem)[],
  id: UniqueIdentifier
): boolean {
  return list.some((i) => {
    if (!i) return false;
    if (String(i.id) === String(id)) return true;
    if ('tabs' in i && i.tabs) {
      return i.tabs.some((t: Tab) => t && String(t.id) === String(id));
    }
    return false;
  });
}

export function determineTargetPanel(
  overId: UniqueIdentifier,
  over: FoundItem | null,
  islands: LiveItem[],
  vault: VaultItem[],
  activeInLive: boolean
): boolean | null {
  if (overId === 'live-panel-dropzone' || overId === 'live-bottom') return true;
  if (overId === 'vault-dropzone' || overId === 'vault-bottom') return false;

  const overIdStr = String(overId);
  if (overIdStr.startsWith('live-gap-')) return true;
  if (overIdStr.startsWith('vault-gap-')) return false;

  if (over) {
    if (isItemInList(islands, overId)) return true;
    if (isItemInList(vault, overId)) return false;
  }

  return activeInLive;
}

export function calculateMoveTarget(
  active: FoundItem,
  over: FoundItem | null,
  overId: UniqueIdentifier,
  islands: LiveItem[],
  vault: VaultItem[],
  activeInLive: boolean
): MoveTarget | null {
  let targetContainerId: UniqueIdentifier = 'root';
  let targetIndex = -1;

  const isActiveGroup = active.item && 'tabs' in active.item;

  if (['live-panel-dropzone', 'live-bottom', 'vault-dropzone', 'vault-bottom'].includes(String(overId))) {
    targetIndex = activeInLive ? islands.length : vault.length;
    return { targetContainerId, targetIndex };
  }

  if (String(overId).startsWith('live-gap-') || String(overId).startsWith('vault-gap-')) {
    const gapIndex = parseInt(String(overId).split('-')[2], 10);
    targetIndex = isNaN(gapIndex) ? (activeInLive ? islands.length : vault.length) : gapIndex;
    return { targetContainerId, targetIndex };
  }

  if (!over) return null;

  targetContainerId = over.containerId;
  targetIndex = over.index;

  if (over.item && 'tabs' in over.item && !isActiveGroup) {
    if (active.containerId === over.item.id) {
      targetContainerId = 'root';
      targetIndex = over.index;
    } else if ((over.item as Island).collapsed) {
      targetContainerId = 'root';
      targetIndex = over.index;
    } else {
      targetContainerId = over.item.id;
      targetIndex = 0;
    }
  }

  if (isActiveGroup && targetContainerId !== 'root') {
    const currentRoot = activeInLive ? islands : vault;
    const parentGroupIndex = currentRoot.findIndex(
      (i) => String(i.id) === String(targetContainerId)
    );

    if (parentGroupIndex !== -1) {
      targetContainerId = 'root';
      targetIndex = parentGroupIndex;
    } else {
      return null;
    }
  }

  if (active.containerId !== targetContainerId && over.item && !('tabs' in over.item)) {
    const targetGroup = (activeInLive ? islands : vault).find(
      (i) => String(i.id) === String(targetContainerId)
    );
    if (
      targetGroup &&
      'tabs' in targetGroup &&
      targetGroup.tabs &&
      targetIndex === targetGroup.tabs.length - 1
    ) {
      targetIndex = targetIndex + 1;
    }
  }

  return { targetContainerId, targetIndex };
}

export function getTargetList<T extends LiveItem | VaultItem>(
  root: T[],
  containerId: UniqueIdentifier
): (T | Tab)[] | null {
  if (containerId === 'root') return root;
  const cIdStr = String(containerId);
  const group = root.find((i) => i && String(i.id) === cIdStr);
  if (group && 'tabs' in group && Array.isArray(group.tabs)) return group.tabs;
  return null;
}

export function applyOptimisticMove(
  islands: LiveItem[],
  vault: VaultItem[],
  active: FoundItem,
  target: MoveTarget,
  activeId: UniqueIdentifier,
  activeInLive: boolean
): MoveResult | null {
  const newIslands = activeInLive ? cloneWithDeepGroups(islands) : [...islands];
  const newVault = activeInLive ? [...vault] : cloneWithDeepGroups(vault);
  const rootList = activeInLive ? newIslands : newVault;

  const sourceArr = getTargetList(rootList, active.containerId);
  const targetArr = getTargetList(rootList, target.targetContainerId);

  if (!sourceArr || !targetArr) return null;

  const sourceItem = sourceArr[active.index];

  let resolvedIndex = active.index;
  if (!sourceItem || String(sourceItem.id) !== String(activeId)) {
    const correctIndex = sourceArr.findIndex(
      (item) => String((item as LiveItem | VaultItem).id) === String(activeId)
    );
    if (correctIndex === -1) return null;
    resolvedIndex = correctIndex;
  }

  const [movedItem] = sourceArr.splice(resolvedIndex, 1);
  if (!movedItem) return null;

  const safeTargetIndex = Math.max(0, Math.min(Number(target.targetIndex), targetArr.length));
  targetArr.splice(safeTargetIndex, 0, movedItem);

  return {
    newIslands,
    newVault,
    isLive: activeInLive,
  };
}

export function prepareOptimisticMove(
  islands: LiveItem[],
  vault: VaultItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier
): { result: MoveResult; active: FoundItem } | null {
  if (activeId === overId) return null;

  const active = findItemInList(islands, activeId) || findItemInList(vault, activeId);
  const over = findItemInList(islands, overId) || findItemInList(vault, overId);

  if (!active) return null;

  const activeInLive = !!findItemInList(islands, activeId);
  const targetIsLive = determineTargetPanel(overId, over, islands, vault, activeInLive);

  if (targetIsLive !== activeInLive) return null;

  const target = calculateMoveTarget(active, over, overId, islands, vault, activeInLive);

  if (!target || target.targetIndex === -1) return null;
  if (active.containerId === target.targetContainerId && active.index === target.targetIndex) {
    return null;
  }

  const result = applyOptimisticMove(
    islands,
    vault,
    active,
    target,
    activeId,
    activeInLive
  );

  if (!result) return null;

  return { result, active };
}
