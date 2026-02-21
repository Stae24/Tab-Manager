import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GripVertical } from 'lucide-react';

import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
  MeasuringStrategy,
  defaultDropAnimationSideEffects,
  Modifier
} from '@dnd-kit/core';

import {
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { Sidebar } from './Sidebar';
import { LivePanel } from './LivePanel';
import { VaultPanel } from './VaultPanel';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { QuotaExceededModal, QuotaExceededAction } from './QuotaExceededModal';
import { useStore, parseNumericId, findItemInList } from '../store/useStore';
import { cn } from '../utils/cn';
import { closeTab, createIsland } from '../utils/chromeApi';
import { Island as IslandType, Tab as TabType, UniversalId, LiveItem } from '../types/index';
import ErrorBoundary from './ErrorBoundary';
import { logger } from '../utils/logger';
import { MoveTabCommand } from '../store/commands/MoveTabCommand';
import { MoveIslandCommand } from '../store/commands/MoveIslandCommand';
import {
  DND_ACTIVATION_DISTANCE,
  DIVIDER_POSITION_MIN,
  DIVIDER_POSITION_MAX,
  POST_ISLAND_CREATION_DELAY_MS
} from '../constants';

type DragData =
  | { type: 'island'; island: IslandType }
  | { type: 'tab'; tab: TabType };

const DragOverlayContent = React.memo(({ activeItem }: { activeItem: DragData }) => {
  if (activeItem.type === 'island') {
    return <Island island={activeItem.island} isOverlay />;
  }
  return <TabCard tab={activeItem.tab} isOverlay />;
});

export const Dashboard: React.FC = () => {
  const isDarkMode = useStore(state => state.isDarkMode);
  const islands = useStore(state => state.islands);
  const vault = useStore(state => state.vault);
  const moveToVault = useStore(state => state.moveToVault);
  const saveToVault = useStore(state => state.saveToVault);
  const restoreFromVault = useStore(state => state.restoreFromVault);
  const dividerPosition = useStore(state => state.dividerPosition);
  const setDividerPosition = useStore(state => state.setDividerPosition);
  const removeFromVault = useStore(state => state.removeFromVault);
  const moveItemOptimistically = useStore(state => state.moveItemOptimistically);
  const renameGroup = useStore(state => state.renameGroup);
  const createVaultGroup = useStore(state => state.createVaultGroup);
  const toggleVaultGroupCollapse = useStore(state => state.toggleVaultGroupCollapse);
  const toggleLiveGroupCollapse = useStore(state => state.toggleLiveGroupCollapse);
  const deleteDuplicateTabs = useStore(state => state.deleteDuplicateTabs);
  const sortGroupsToTop = useStore(state => state.sortGroupsToTop);
  const sortVaultGroupsToTop = useStore(state => state.sortVaultGroupsToTop);
  const showVault = useStore(state => state.showVault);
  const isRenaming = useStore(state => state.isRenaming);
  const appearanceSettings = useStore(state => state.appearanceSettings);
  const effectiveSyncEnabled = useStore(state => state.effectiveSyncEnabled);
  const syncRecovered = useStore(state => state.syncRecovered);
  const clearSyncRecovered = useStore(state => state.clearSyncRecovered);
  const vaultQuota = useStore(state => state.vaultQuota);
  const quotaExceededPending = useStore(state => state.quotaExceededPending);
  const clearQuotaExceeded = useStore(state => state.clearQuotaExceeded);
  const setVaultSyncEnabled = useStore(state => state.setVaultSyncEnabled);
  const groupSearchResults = useStore(state => state.groupSearchResults);

  useEffect(() => {
    logger.debug('[Dashboard] Sync state:', {
      effectiveSyncEnabled,
      appearanceVaultSyncEnabled: appearanceSettings?.vaultSyncEnabled,
      vaultLength: vault?.length,
      vaultQuotaWarningLevel: vaultQuota?.warningLevel
    });
  }, [effectiveSyncEnabled, appearanceSettings?.vaultSyncEnabled, vault?.length, vaultQuota?.warningLevel]);
  const groupUngroupedTabs = useStore(state => state.groupUngroupedTabs);
  const showAppearancePanel = useStore(state => state.showAppearancePanel);
  const executeCommand = useStore(state => state.executeCommand);
  const addPendingOperation = useStore(state => state.addPendingOperation);
  const removePendingOperation = useStore(state => state.removePendingOperation);

  const [isResizing, setIsResizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const [isDraggingVaultItem, setIsDraggingVaultItem] = useState(false);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [isCreatingIsland, setIsCreatingIsland] = useState(false);
  const [creatingTabId, setCreatingTabId] = useState<UniversalId | null>(null);
  const [dragStartInfo, setDragStartInfo] = useState<{
    index: number;
    containerId: UniqueIdentifier;
    groupId: number;
    windowId: number;
  } | null>(null);

  const vaultTabCount = useMemo(() => {
    return (vault || []).reduce((acc, i) => {
      if (!i) return acc;
      if ('tabs' in i && i.tabs) return acc + i.tabs.length;
      return acc + 1;
    }, 0);
  }, [vault]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_ACTIVATION_DISTANCE }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const scaleModifier: Modifier = useCallback(({ transform }) => {
    return {
      ...transform,
      x: transform.x / appearanceSettings.uiScale,
      y: transform.y / appearanceSettings.uiScale,
    };
  }, [appearanceSettings.uiScale]);

  const handleQuotaExceededAction = useCallback(async (action: QuotaExceededAction) => {
    if (action === 'switch-local') {
      await setVaultSyncEnabled(false);
    }
    clearQuotaExceeded();
  }, [setVaultSyncEnabled, clearQuotaExceeded]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const x = e.clientX;
      const width = window.innerWidth;
      const percentage = (x / width) * 100;
      setDividerPosition(Math.max(DIVIDER_POSITION_MIN, Math.min(DIVIDER_POSITION_MAX, percentage)));
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setDividerPosition]);

  const handleTabClick = async (tabId: UniversalId) => {
    const numericId = parseNumericId(tabId);
    if (numericId !== null) {
      try {
        await chrome.tabs.update(numericId, { active: true });
      } catch (e) {
        logger.error('[Dashboard] Failed to activate tab:', e);
      }
    }
  };

  const handleCloseTab = async (tabId: UniversalId) => {
    const numericId = parseNumericId(tabId);
    if (numericId !== null) {
      await closeTab(numericId);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveItem(data);

    const { islands, vault } = useStore.getState();
    const found = findItemInList(islands, event.active.id) || findItemInList(vault, event.active.id);
    if (found) {
      const { item, index, containerId } = found;
    const isIslandItem = 'tabs' in item;
      setDragStartInfo({
        index,
        containerId,
        groupId: isIslandItem ? -1 : (item as TabType).groupId ?? -1,
        windowId: isIslandItem
          ? ((item as IslandType).tabs[0]?.windowId ?? -1)
          : (item as TabType).windowId ?? -1
      });

      // Add to pending operations to block background sync during drag
      const numericId = parseNumericId(event.active.id);
      if (numericId !== null) {
        addPendingOperation(numericId);
      }
    }

    const isGroup = data && 'island' in data && data.type === 'island';
    setIsDraggingGroup(!!isGroup);

    const isVault = event.active.id.toString().startsWith('vault-') ||
      (data?.type === 'island' && data.island.id.toString().startsWith('vault-')) ||
      (data?.type === 'tab' && data.tab.id.toString().startsWith('vault-'));

    setIsDraggingVaultItem(isVault);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    if (overId === 'create-island-dropzone') return;

    moveItemOptimistically(activeId, overId);

  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id;
    const numericActiveId = parseNumericId(activeId);

    // Ensure we clean up pending operation on drag end
    const cleanupPendingOperation = () => {
      if (numericActiveId !== null) {
        removePendingOperation(numericActiveId);
      }
    };

    setActiveItem(null);
    setIsDraggingVaultItem(false);
    setIsDraggingGroup(false);

    if (!over) {
      cleanupPendingOperation();
      return;
    }

    const overId = over.id;

    const { islands: finalIslands, vault: finalVault } = useStore.getState();

    const activeIdStr = activeId.toString();
    const overIdStr = overId.toString();
    const isVaultSource = activeIdStr.startsWith('vault-');

    const isVaultTarget = overIdStr === 'vault-dropzone' || overIdStr === 'vault-bottom' || overIdStr.startsWith('vault-');

    if (isVaultSource && isVaultTarget) {
      await useStore.getState().reorderVault(finalVault);
      cleanupPendingOperation();
      return;
    }

    if (!isVaultSource && isVaultTarget) {
      if (activeId) {
        await moveToVault(activeId);
      }
      cleanupPendingOperation();
      return;
    }


    if (overIdStr === 'create-island-dropzone' && !isVaultSource) {
      const resolveTabId = (): number | null => {
        if (typeof activeId === 'number' && activeId > 0) return activeId;
        if (typeof activeId === 'string') {
          const numeric = parseNumericId(activeId);
          if (numeric !== null) return numeric;
        }
        const data = event.active.data?.current as DragData | undefined;
        if (data?.type === 'tab' && data.tab?.id) return parseNumericId(data.tab.id);
        if (activeItem?.type === 'tab' && activeItem.tab?.id) return parseNumericId(activeItem.tab.id);
        return null;
      };

      const tabId = resolveTabId();

      if (!tabId) {
        logger.error(`[FAILED] Could not resolve Tab ID. Received ID: ${activeId}, Data:`, event.active.data?.current);
        cleanupPendingOperation();
        return;
      }

      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.pinned) {
          logger.warn('[ISLAND] Cannot create island from pinned tab');
          cleanupPendingOperation();
          return;
        }

        setIsCreatingIsland(true);
        setCreatingTabId(tabId);

        await chrome.runtime.sendMessage({ type: 'START_ISLAND_CREATION' });

        logger.debug(`[ISLAND] Creating island for tab: ${tabId}`);

        const groupId = await createIsland([tabId], undefined, 'blue' as chrome.tabGroups.Color);

        if (groupId) {
          logger.info(`[SUCCESS] Created island ${groupId} for tab: ${tabId}`);
        } else {
          logger.error(`[FAILED] createIsland returned null for tab: ${tabId}`);
        }

        await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });

        await new Promise(r => setTimeout(r, POST_ISLAND_CREATION_DELAY_MS));
      } catch (e) {
        logger.error('[ISLAND] Tab no longer exists or access denied', e);
        await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });
      } finally {
        setIsCreatingIsland(false);
        setCreatingTabId(null);
      }
      cleanupPendingOperation();
      return;
    }

    if (!isVaultSource && !isVaultTarget && overIdStr !== 'create-island-dropzone') {
      setIsLoading(true);

      try {
        let browserIndex = 0;
        let targetItem: LiveItem | null = null;
        let targetIslandId: UniversalId | null = null;
        let isMovingGroup = false;

        for (const item of finalIslands) {
          if (String(item.id) === String(activeId)) {
            targetItem = item;
            isMovingGroup = 'tabs' in item;
            break;
          }
          if ('tabs' in item && item.tabs) {
            const nested = item.tabs?.find((t: TabType) => String(t.id) === String(activeId));
            if (nested) {
              targetItem = nested;
              targetIslandId = item.id;
              browserIndex += item.tabs?.indexOf(nested) ?? 0;
              break;
            }
            browserIndex += item.tabs?.length ?? 0;
          } else {
            browserIndex += 1;
          }
        }

        if (!targetItem) {
          cleanupPendingOperation();
          return;
        }

        if (isMovingGroup) {
          const numericGroupId = parseNumericId(targetItem.id);
          if (numericGroupId !== null && dragStartInfo) {
            addPendingOperation(numericGroupId);
            const command = new MoveIslandCommand({
              islandId: numericGroupId,
              fromIndex: dragStartInfo.index,
              toIndex: browserIndex,
              fromWindowId: dragStartInfo.windowId,
              toWindowId: dragStartInfo.windowId
            });
            await executeCommand(command);
          }
        } else {
          const tabId = parseNumericId(activeId);
          if (tabId !== null && dragStartInfo) {
            addPendingOperation(tabId);
            const toGroupId = targetIslandId ? parseNumericId(targetIslandId) : -1;
            const command = new MoveTabCommand({
              tabId,
              fromIndex: dragStartInfo.index,
              toIndex: browserIndex,
              fromGroupId: dragStartInfo.groupId,
              toGroupId: toGroupId ?? -1,
              fromWindowId: dragStartInfo.windowId,
              toWindowId: dragStartInfo.windowId
            });
            await executeCommand(command);
          }
        }

      } finally {
        setIsLoading(false);
      }
      cleanupPendingOperation();
      return;
    }


    if (isVaultSource && !isVaultTarget) {
      setIsLoading(true);

      try {
        if (activeId) {
          await restoreFromVault(activeId);
        }
      } finally {
        setIsLoading(false);
      }
      cleanupPendingOperation();
      return;
    }

    // Fallback cleanup for any other exit paths
    cleanupPendingOperation();
  };

  return (
    <div
      id="dashboard-container"
      className={cn('flex flex-col select-none overflow-hidden fixed top-0 left-0 z-0 bg-[#050505] text-white', isDarkMode ? 'dark' : 'light')}
      style={{
        transform: `scale(${appearanceSettings.uiScale})`,
        transformOrigin: 'top left',
        width: `${100 / appearanceSettings.uiScale}%`,
        height: `${100 / appearanceSettings.uiScale}%`
      }}
    >
      <Sidebar />
      <ErrorBoundary name="Tactical Interface">
        <DndContext
          sensors={isRenaming ? [] : sensors}
          collisionDetection={closestCorners}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          modifiers={[scaleModifier]}
        >
          <div className="flex flex-1 overflow-hidden relative overscroll-none">
            <LivePanel
              dividerPosition={dividerPosition}
              islands={islands}
              handleTabClick={handleTabClick}
              moveToVault={moveToVault}
              saveToVault={saveToVault}
              closeTab={handleCloseTab}
              onRenameGroup={renameGroup}
              onToggleCollapse={toggleLiveGroupCollapse}
              isDraggingGroup={isDraggingGroup}
              groupSearchResults={groupSearchResults}
              groupUngroupedTabs={groupUngroupedTabs}
              deleteDuplicateTabs={deleteDuplicateTabs}
              sortGroupsToTop={sortGroupsToTop}
              showVault={showVault}
              isCreatingIsland={isCreatingIsland}
              creatingTabId={creatingTabId}
              vaultItems={vault}
            />
            {showVault && (
              <>
                <div
                  onMouseDown={showAppearancePanel ? undefined : handleMouseDown}
                  className={cn(
                    "w-1 bg-gx-gray/30 hover:bg-gx-accent cursor-col-resize transition-all flex items-center justify-center z-50 flex-shrink-0 relative",
                    showAppearancePanel && "pointer-events-none opacity-0"
                  )}
                >
                  <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
                  <GripVertical className="w-4 h-4 text-gx-gray group-hover:text-white transition-colors" />
                </div>
                <VaultPanel
                  dividerPosition={dividerPosition}
                  vault={vault}
                  removeFromVault={removeFromVault}
                  isDraggingLiveItem={!isDraggingVaultItem && activeItem !== null}
                  createVaultGroup={createVaultGroup}
                  onRenameGroup={renameGroup}
                  onToggleCollapse={toggleVaultGroupCollapse}
                  sortVaultGroupsToTop={sortVaultGroupsToTop}
                  restoreFromVault={restoreFromVault}
                  vaultQuota={vaultQuota}
                  effectiveSyncEnabled={effectiveSyncEnabled}
                  syncRecovered={syncRecovered}
                  onClearSyncRecovered={clearSyncRecovered}
                  vaultTabCount={vaultTabCount}
                />
              </>
            )}
          </div>
          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.1' } } }) }}>
            {activeItem ? <DragOverlayContent activeItem={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      </ErrorBoundary>

      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gx-gray z-[1000] overflow-hidden">
          <div className="h-full w-1/3 bg-gx-accent animate-loading-slide" />
        </div>
      )}
      <QuotaExceededModal
        isOpen={!!quotaExceededPending}
        bytesUsed={quotaExceededPending?.bytesUsed ?? 0}
        bytesAvailable={quotaExceededPending?.bytesAvailable ?? 0}
        onAction={handleQuotaExceededAction}
      />
    </div>
  );
};
