import React, { useEffect, useRef, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Virtualizer } from '@tanstack/react-virtual';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { DroppableGap } from './DroppableGap';
import { cn } from '../utils/cn';
import { VIRTUAL_ROW_GAP_PX, VIRTUAL_ROW_ESTIMATE_SIZE } from '../constants';
import { Island as IslandType, Tab as TabType, UniversalId, DashboardRow } from '../types';
import { logger } from '../utils/logger';

const DEBUG_VIRTUALIZATION = true;

interface DebugInfo {
    totalSize: number;
    containerHeight: number | undefined;
    dropzoneTop: number | undefined;
    scrollHeight: number | undefined;
    clientHeight: number | undefined;
    rowItemsCount: number;
    measuredSizes: string;
    estimatedSize: number;
    itemCount: number;
    lastItemEnd: number;
}

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
    const dropzoneRef = useRef<HTMLDivElement>(null);
    const virtualizedContainerRef = useRef<HTMLDivElement>(null);
    const [debugInfo, setDebugInfo] = useState<DebugInfo>({
        totalSize: 0,
        containerHeight: 0,
        dropzoneTop: 0,
        scrollHeight: 0,
        clientHeight: 0,
        rowItemsCount: 0,
        measuredSizes: '',
        estimatedSize: 0,
        itemCount: 0,
        lastItemEnd: 0,
    });

    useEffect(() => {
        if (!DEBUG_VIRTUALIZATION) return;
        
        const logDebug = () => {
            const totalSize = virtualizer.getTotalSize();
            const containerHeight = virtualizedContainerRef.current?.offsetHeight;
            const dropzoneTop = dropzoneRef.current?.offsetTop;
            const scrollElement = virtualizer.scrollElement;
            const scrollHeight = scrollElement?.scrollHeight;
            const clientHeight = scrollElement?.clientHeight;
            
            const virtualItems = virtualizer.getVirtualItems();
            const measuredSizes = virtualItems.slice(0, 5).map(item => 
                `[${item.index}: ${item.size}px @ ${item.start}]`
            ).join(' ');
            const lastItem = virtualItems[virtualItems.length - 1];
            
            setDebugInfo({
                totalSize,
                containerHeight,
                dropzoneTop,
                scrollHeight,
                clientHeight,
                rowItemsCount: rowItems.length,
                measuredSizes,
                estimatedSize: VIRTUAL_ROW_ESTIMATE_SIZE,
                itemCount: virtualItems.length,
                lastItemEnd: lastItem ? lastItem.end : 0,
            });
            
            console.group('[VirtualizedLiveList Debug]');
            console.log('rowItems count:', rowItems.length);
            console.log('virtualItems count:', virtualItems.length);
            console.log('virtualizer.getTotalSize():', totalSize);
            console.log('last item end:', lastItem?.end);
            console.log('virtualized container height:', containerHeight);
            console.log('dropzone offsetTop:', dropzoneTop);
            console.log('scrollElement scrollHeight:', scrollHeight);
            console.log('scrollElement clientHeight:', clientHeight);
            console.log('scrollElement scrollTop:', scrollElement?.scrollTop);
            console.log('first 5 items:', virtualItems.slice(0, 5).map(i => ({ index: i.index, size: i.size, start: i.start })));
            console.groupEnd();
        };
        
        logDebug();
        const interval = setInterval(logDebug, 2000);
        return () => clearInterval(interval);
    }, [virtualizer, rowItems.length]);

    return (
        <>
            <SortableContext items={(islands || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div
                    ref={virtualizedContainerRef}
                    className={cn("relative shrink-0", DEBUG_VIRTUALIZATION && "border-2 border-red-500 border-dashed")}
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
                ref={(el) => {
                    dropzoneRef.current = el;
                    setCreateRef(el);
                }}
                id="new-island-dropzone"
                className={cn(
                    "p-10 border-2 border-dashed border-gx-gray/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group flex-shrink-0 cursor-pointer",
                    DEBUG_VIRTUALIZATION && "border-green-500 bg-green-500/10",
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

            {DEBUG_VIRTUALIZATION && (
                <div className="fixed bottom-4 right-4 bg-black/90 text-white text-xs font-mono p-4 rounded-lg border border-yellow-500 z-50 max-w-sm">
                    <div className="text-yellow-400 font-bold mb-2">Debug Info</div>
                    <div>rowItems: {debugInfo.rowItemsCount}</div>
                    <div>virtualItems: {debugInfo.itemCount}</div>
                    <div>estimated size: {debugInfo.estimatedSize}px</div>
                    <div className="border-t border-white/20 my-1 pt-1">
                        <div className="text-cyan-400">totalSize: {debugInfo.totalSize}px</div>
                        <div>lastItemEnd: {debugInfo.lastItemEnd}px</div>
                        <div>container h: {debugInfo.containerHeight}px</div>
                    </div>
                    <div className="border-t border-white/20 my-1 pt-1">
                        <div>dropzone top: {debugInfo.dropzoneTop}px</div>
                        <div>scroll h: {debugInfo.scrollHeight}px</div>
                        <div>client h: {debugInfo.clientHeight}px</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/20 text-[10px]">
                        <div className="text-yellow-400">First 5 items:</div>
                        <div className="text-green-400 truncate">{debugInfo.measuredSizes}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/20 text-[10px]">
                        <div className="text-yellow-400">Problem Check:</div>
                        <div className={debugInfo.totalSize !== debugInfo.lastItemEnd ? "text-red-400" : "text-green-400"}>
                            totalSize {debugInfo.totalSize === debugInfo.lastItemEnd ? '==' : '!='} lastItemEnd
                        </div>
                        <div className={(debugInfo.dropzoneTop ?? 0) < (debugInfo.totalSize + 96) ? "text-red-400" : "text-green-400"}>
                            dropzoneTop {debugInfo.dropzoneTop && debugInfo.dropzoneTop >= debugInfo.totalSize + 96 ? '>=' : '<'} totalSize+96
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
