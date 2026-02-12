import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Save, LayoutGrid, X } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { DroppableGap } from './DroppableGap';
import { QuotaWarningBanner } from './QuotaWarningBanner';
import { ScrollContainerProvider } from '../contexts/ScrollContainerContext';
import { cn } from '../utils/cn';
import { logger } from '../utils/logger';
import { Island as IslandType, Tab as TabType, UniversalId, VaultQuotaInfo, DashboardRow } from '../types';
import { VIRTUAL_ROW_ESTIMATE_SIZE, VIRTUAL_ROW_OVERSCAN, VIRTUAL_ROW_GAP_PX } from '../constants';

interface VaultPanelProps {
  dividerPosition: number;
  vault: (IslandType | TabType)[];
  removeFromVault: (id: UniversalId) => void;
  isDraggingLiveItem: boolean;
  createVaultGroup: () => void;
  onRenameGroup: (id: UniversalId, title: string) => void;
  onToggleCollapse: (id: UniversalId) => void;
  sortVaultGroupsToTop: () => Promise<void>;
  restoreFromVault: (id: UniversalId) => void;
  vaultQuota: VaultQuotaInfo | null;
  effectiveSyncEnabled: boolean;
  syncRecovered?: boolean;
  onClearSyncRecovered?: () => void;
  vaultTabCount?: number;
  onManageStorage?: () => void;
}

export const VaultPanel: React.FC<VaultPanelProps> = ({
  dividerPosition,
  vault,
  removeFromVault,
  isDraggingLiveItem,
  createVaultGroup,
  onRenameGroup,
  onToggleCollapse,
  sortVaultGroupsToTop,
  restoreFromVault,
  vaultQuota,
  effectiveSyncEnabled,
  syncRecovered,
  onClearSyncRecovered,
  vaultTabCount,
  onManageStorage
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'vault-dropzone',
  });

  const { setNodeRef: setBottomRef } = useDroppable({
    id: 'vault-bottom',
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLocalStorageWarning, setShowLocalStorageWarning] = useState(true);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(true);

  useEffect(() => {
    logger.debug('[VaultPanel] Banner state:', {
      effectiveSyncEnabled,
      vaultTabCount,
      showLocalStorageWarning,
      bannerWouldShow: effectiveSyncEnabled === false && (vaultTabCount || 0) > 0 && showLocalStorageWarning,
      condition1: effectiveSyncEnabled === false,
      condition2: (vaultTabCount || 0) > 0,
      condition3: showLocalStorageWarning
    });
  }, [effectiveSyncEnabled, vaultTabCount, showLocalStorageWarning]);

  const rowItems = useMemo(() => {
    const rows: DashboardRow[] = [];
    (vault || []).forEach((item: IslandType | TabType, index: number) => {
      const isCurrentIsland = 'tabs' in item;
      const prevItem = vault?.[index - 1];
      const isPrevIsland = prevItem && 'tabs' in prevItem;
      const showGap = isCurrentIsland && isPrevIsland;

      if (showGap) {
        rows.push({ type: 'gap', id: `vault-gap-${index}`, index });
      }
      rows.push({ type: 'item', id: item.id, item });
    });
    return rows;
  }, [vault]);

  const virtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE_SIZE,
    getItemKey: (index) => rowItems[index].id,
    overscan: VIRTUAL_ROW_OVERSCAN,
  });

  const renderVaultList = () => {
    return (
      <SortableContext items={(vault || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div
          className="relative"
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%' }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rowItems[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: `${VIRTUAL_ROW_GAP_PX}px`,
                }}
              >
                {row.type === 'gap' ? (
                  <DroppableGap index={row.index} panelType="vault" />
                ) : (
                  'tabs' in row.item ? (
                    <Island
                      island={row.item as IslandType}
                      isVault={true}
                      onRestore={() => restoreFromVault(row.item.id)}
                      onDelete={() => removeFromVault(row.item.id)}
                      onRename={(title) => onRenameGroup(row.item.id, title)}
                      onToggleCollapse={() => onToggleCollapse(row.item.id)}
                      onTabRestore={(tab) => restoreFromVault(tab.id)}
                      onTabClose={(id) => removeFromVault(id)}
                    />
                  ) : (
                    <TabCard
                      tab={row.item as TabType}
                      isVault={true}
                      onRestore={() => restoreFromVault(row.item.id)}
                      onClose={() => removeFromVault(row.item.id)}
                    />
                  )
                )}
              </div>
            );
          })}
        </div>
      </SortableContext>
    );
  };

  const renderEmptyState = () => {
    if ((vault || []).length !== 0) return null;
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-20 group">
        <Save size={64} className="group-hover:scale-110 transition-transform duration-500" />
        <p className="text-[10px] font-black mt-6 italic uppercase tracking-[0.3em] text-center leading-loose">
          Initiate data transfer<br />to secure items
        </p>
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      id="vault-dropzone"
      className={cn(
        "flex flex-col h-full overflow-hidden bg-gx-dark/60 relative transition-all duration-300",
        isOver && isDraggingLiveItem && "bg-gx-red/5 ring-4 ring-inset ring-gx-red/10"
      )}
      style={{ width: `${100 - dividerPosition}%` }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gx-gray flex-shrink-0 bg-gx-dark/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <Save className="w-4 h-4 text-gx-red shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <h2 className="text-sm font-bold tracking-widest uppercase italic text-gx-red">Neural Vault</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sortVaultGroupsToTop}
            title="Sort Groups to Top"
            className="p-1 hover:bg-gx-red/20 hover:text-gx-red rounded transition-all group"
          >
            <LayoutGrid size={14} className="group-hover:scale-110 transition-transform" />
          </button>
          <button onClick={createVaultGroup} title="Add Group" className="p-1 hover:bg-gx-red/20 hover:text-gx-red rounded transition-all">
            <Plus className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-gray-500 font-black tracking-tighter bg-gx-gray/50 px-2 py-0.5 rounded border border-white/5">{vaultTabCount ?? 0} TABS</span>
        </div>
      </div>

      {effectiveSyncEnabled === false && (vaultTabCount || 0) > 0 && showLocalStorageWarning && (
        <div className="bg-gx-red/20 border-b border-gx-red/30 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gx-red">
            ⚠️ Vault too large for sync. Using local storage. Clear vault and re-enable sync in settings to retry.
          </span>
          <button
            onClick={() => setShowLocalStorageWarning(false)}
            className="text-gx-red hover:text-white transition-colors p-1"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {syncRecovered && showRecoveryBanner && (
        <div className="bg-green-500/20 border-b border-green-500/30 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-green-400">
            ✅ Sync data repaired from backup. Your vault is now syncing across devices.
          </span>
          <button
            onClick={() => {
              setShowRecoveryBanner(false);
              onClearSyncRecovered?.();
            }}
            className="text-green-400 hover:text-white transition-colors p-1"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 scroll-smooth overscroll-none"
      >
        <ScrollContainerProvider containerRef={scrollRef}>
          {vaultQuota && (
            <QuotaWarningBanner
              warningLevel={vaultQuota.warningLevel}
              percentage={vaultQuota.percentage}
              syncEnabled={!!effectiveSyncEnabled}
              onManageStorage={onManageStorage}
            />
          )}

          {renderVaultList()}
          {renderEmptyState()}

          <div
            ref={setBottomRef}
            className="h-24 w-full"
          />
        </ScrollContainerProvider>
      </div>

    </div>
  );
};
