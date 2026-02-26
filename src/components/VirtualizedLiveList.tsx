import React from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Virtualizer } from '@tanstack/react-virtual';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { DroppableGap } from './DroppableGap';
import { cn } from '../utils/cn';
import { VIRTUAL_ROW_GAP_PX } from '../constants';
import { Island as IslandType, Tab as TabType, UniversalId, DashboardRow } from '../types';

interface VirtualizedLiveListProps {
    islands: (IslandType | TabType)[];
    rowItems: DashboardRow[];
    virtualizer: Virtualizer<HTMLDivElement, Element>;
    handleTabClick: (id: UniversalId) => void;
    moveToVault: (id: UniversalId) => void;
    saveToVault: (island: IslandType | TabType) => void;
    closeTab: (id: UniversalId) => void;
    onRenameGroup: (id: UniversalId, title: string) => void;
    onToggleCollapse: (id: UniversalId) => void;
    onDeleteIsland?: (id: UniversalId) => void;
    isDraggingGroup?: boolean;
    isDraggingVaultItem?: boolean;
    isCreatingIsland: boolean;
    creatingTabId: UniversalId | null;
    searchQuery: string;
    setCreateRef: (element: HTMLElement | null) => void;
    setBottomRef: (element: HTMLElement | null) => void;
    isCreateOver: boolean;
}

export const VirtualizedLiveList: React.FC<VirtualizedLiveListProps> = ({
    islands,
    rowItems,
    virtualizer,
    handleTabClick,
    moveToVault,
    saveToVault,
    closeTab,
    onRenameGroup,
    onToggleCollapse,
    onDeleteIsland,
    isDraggingGroup,
    isDraggingVaultItem,
    isCreatingIsland,
    creatingTabId,
    searchQuery,
    setCreateRef,
    setBottomRef,
    isCreateOver,
}) => {
    return (
        <>
            <SortableContext items={(islands || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div
                    className="relative"
                    style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%' }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rowItems[virtualRow.index];
                        if (!row) return null;

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
                                    ...(row.type !== 'gap' && { paddingBottom: `${VIRTUAL_ROW_GAP_PX}px` }),
                                }}
                            >
                                {row.type === 'gap' ? (
                                    <DroppableGap index={row.index} panelType="live" isDraggingGroup={isDraggingGroup} />
                                ) : !row.item ? (
                                    null
                                ) : 'tabs' in row.item ? (
                                    <Island
                                        island={row.item as IslandType}
                                        onTabClick={(tab) => handleTabClick(tab.id)}
                                        onNonDestructiveSave={() => saveToVault(row.item)}
                                        onSave={() => moveToVault(row.item.id)}
                                        onDelete={() => onDeleteIsland ? onDeleteIsland(row.item.id) : (row.item as IslandType).tabs?.forEach((t: TabType) => closeTab(t.id))}
                                        onRename={(title) => onRenameGroup(row.item.id, title)}
                                        onToggleCollapse={() => onToggleCollapse(row.item.id)}
                                        onTabSave={(tab) => saveToVault(tab)}
                                        onTabClose={(id) => closeTab(id)}
                                        disabled={!!searchQuery}
                                    />
                                ) : (
                                    <TabCard
                                        tab={row.item as TabType}
                                        onClick={() => handleTabClick(row.item.id)}
                                        onSave={() => saveToVault(row.item)}
                                        onClose={() => closeTab(row.item.id)}
                                        disabled={!!searchQuery}
                                        isLoading={isCreatingIsland && creatingTabId === row.item.id}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </SortableContext>

            <div
                ref={setBottomRef}
                className="h-24 w-full"
            />

            <div
                ref={setCreateRef}
                id="new-island-dropzone"
                className={cn(
                    "p-10 border-2 border-dashed border-gx-gray/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group flex-shrink-0 cursor-pointer",
                    isCreatingIsland && "border-gx-cyan bg-gx-cyan/5 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse-glow",
                    !isCreatingIsland && isCreateOver && !isDraggingGroup && !isDraggingVaultItem && "border-gx-accent bg-gx-accent/10",
                    !isCreatingIsland && !isCreateOver && !(isDraggingGroup || isDraggingVaultItem) && "hover:border-gx-accent/50 hover:bg-gx-accent/5",
                    (isDraggingGroup || isDraggingVaultItem) && "opacity-30 cursor-not-allowed grayscale"
                )}
            >
                <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isCreatingIsland
                        ? "bg-gx-cyan/20 animate-spin-slow"
                        : "bg-gx-gray group-hover:bg-gx-accent/20"
                )}>
                    {isCreatingIsland ? (
                        <Loader2 className="w-5 h-5 text-gx-cyan" />
                    ) : (
                        <Plus className="w-5 h-5 text-gray-500 group-hover:text-gx-accent transition-colors" />
                    )}
                </div>
                <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
                    isCreatingIsland
                        ? "text-gx-cyan animate-pulse"
                        : "text-gray-500 group-hover:text-gray-400"
                )}>
                    {isCreatingIsland ? "Creating Island..." : "Tactical Island creation"}
                </span>
            </div>
        </>
    );
};
