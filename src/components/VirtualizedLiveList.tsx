import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Virtualizer } from '@tanstack/react-virtual';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { DroppableGap } from './DroppableGap';
import { cn } from '../utils/cn';
import { VIRTUAL_ROW_GAP_PX } from '../constants';
import { Island as IslandType, Tab as TabType, LiveItem, UniversalId, DashboardRow } from '../types';

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
    isBottomOver?: boolean;
    showDebugOverlays?: boolean;
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
    isBottomOver,
    showDebugOverlays,
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [bottomNode, setBottomNode] = useState<HTMLElement | null>(null);
    const [isShortContent, setIsShortContent] = useState(false);
    const [dropzoneRect, setDropzoneRect] = useState<DOMRect | null>(null);

    const setBottomRefWithTracking = useCallback((node: HTMLElement | null) => {
        setBottomNode(node);
        setBottomRef(node);
    }, [setBottomRef]);

    useEffect(() => {
        if (!bottomNode) return;

        const updateRect = () => setDropzoneRect(bottomNode.getBoundingClientRect());
        updateRect();

        const observer = new ResizeObserver(updateRect);
        observer.observe(bottomNode);
        window.addEventListener('scroll', updateRect, true);

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [bottomNode]);

    useEffect(() => {
        const checkContentHeight = () => {
            const wrapper = wrapperRef.current;
            if (!wrapper) return;

            const parent = wrapper.parentElement;
            if (!parent) return;

            const containerHeight = parent.clientHeight;
            const contentHeight = virtualizer.getTotalSize();
            const dropzoneHeight = 120;

            setIsShortContent(contentHeight + dropzoneHeight < containerHeight);
        };

        checkContentHeight();

        const resizeObserver = new ResizeObserver(checkContentHeight);
        const wrapper = wrapperRef.current;
        if (wrapper?.parentElement) {
            resizeObserver.observe(wrapper.parentElement);
        }

        return () => resizeObserver.disconnect();
    }, [virtualizer, rowItems.length]);

    return (
        <div ref={wrapperRef} className="flex flex-col min-h-full">
            <SortableContext items={(islands || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div
                    className="relative shrink-0"
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
                                        onNonDestructiveSave={() => saveToVault(row.item as LiveItem)}
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
                                        onSave={() => saveToVault(row.item as LiveItem)}
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

            {/* Visual spacer - outer wrapper */}
            <div
                className={cn(
                    "w-full flex items-center justify-center transition-colors min-h-24",
                    showDebugOverlays && [
                        "border-2 border-dashed",
                        isBottomOver
                            ? "border-yellow-500 bg-yellow-500/30"
                            : "border-red-500/50 bg-red-500/10"
                    ],
                    isShortContent ? "flex-1" : "h-24"
                )}
            >
                {/* Actual dnd-kit dropzone - inner element */}
                <div
                    ref={setBottomRefWithTracking}
                    className={cn(
                        "w-full h-full transition-colors",
                        showDebugOverlays && [
                            "border-2 border-dashed",
                            isBottomOver
                                ? "border-yellow-400 bg-yellow-400/20"
                                : "border-blue-500/50 bg-blue-500/10"
                        ]
                    )}
                />
            </div>

            {/* Debug overlay showing actual dnd-kit detection area */}
            {showDebugOverlays && dropzoneRect && (
                <div
                    className={cn(
                        "fixed border-2 pointer-events-none z-[9999] transition-colors",
                        isBottomOver
                            ? "border-yellow-500 bg-yellow-500/30"
                            : "border-green-500 bg-green-500/20"
                    )}
                    style={{
                        top: dropzoneRect.top,
                        left: dropzoneRect.left,
                        width: dropzoneRect.width,
                        height: dropzoneRect.height,
                    }}
                >
                    <span className={cn(
                        "absolute top-0 left-0 text-black text-[10px] px-1 font-bold transition-colors",
                        isBottomOver ? "bg-yellow-500" : "bg-green-500"
                    )}>
                        {isBottomOver ? "HOVERED!" : "dnd-kit area"}
                    </span>
                </div>
            )}

            <div
                ref={setCreateRef}
                id="new-island-dropzone"
                className={cn(
                    "p-10 border-2 border-dashed border-gx-gray/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group flex-shrink-0 cursor-pointer",
                    isShortContent && "mt-auto",
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
        </div>
    );
};
