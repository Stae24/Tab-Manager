import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GripVertical, Plus, FolderOpen, Save, Loader2, ChevronUp, ChevronDown, Search, ChevronDown as SortDown, X, ChevronUp as SortUp, Trash2, LayoutGrid, Group } from 'lucide-react';

import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDndContext,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  UniqueIdentifier,
  MeasuringStrategy,
  defaultDropAnimationSideEffects,
  Active,
  Modifier
} from '@dnd-kit/core';

import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { Sidebar } from './Sidebar';
import { ScrollContainerProvider } from '../contexts/ScrollContainerContext';

import { QuotaWarningBanner } from './QuotaWarningBanner';
import { QuotaExceededModal, QuotaExceededAction } from './QuotaExceededModal';
import { useStore, parseNumericId, findItemInList } from '../store/useStore';
import { cn } from '../utils/cn';
import { closeTab, moveIsland, createIsland } from '../utils/chromeApi';
import { Island as IslandType, Tab as TabType, VaultQuotaInfo, UniversalId, LiveItem } from '../types/index';
import ErrorBoundary from './ErrorBoundary';
import { logger } from '../utils/logger';
import { MoveTabCommand } from '../store/commands/MoveTabCommand';
import { MoveIslandCommand } from '../store/commands/MoveIslandCommand';
import {
  BASE_FONT_SIZE,
  DND_ACTIVATION_DISTANCE,
  DIVIDER_POSITION_MIN,
  DIVIDER_POSITION_MAX,
  POST_ISLAND_CREATION_DELAY_MS,
  VIRTUAL_ROW_ESTIMATE_SIZE,
  VIRTUAL_ROW_OVERSCAN,
  VIRTUAL_ROW_GAP_PX,
  CLEANUP_ANIMATION_DELAY_MS
} from '../constants';



// Proximity tracking hook for droppable gaps
export const useProximityGap = (gapId: string, active: Active | null, isDraggingGroup?: boolean) => {

  const { setNodeRef, isOver } = useDroppable({ id: gapId });
  const gapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const handlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  useEffect(() => {
    const cleanup = () => {
      if (handlerRef.current) {
        document.removeEventListener('pointermove', handlerRef.current);
        handlerRef.current = null;
      }
    };

    if (!active || !gapRef.current || isDraggingGroup) {
      setExpanded(false);
      cleanup();
      return cleanup;
    }

    // Track pointer movement for proximity detection
    // Uses fixed reference point to prevent jitter when gap expands/contracts
    const handlePointerMove = (e: PointerEvent) => {
      if (!gapRef.current) return;

      const gapRect = gapRef.current.getBoundingClientRect();
      const baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_FONT_SIZE;
      const pointerY = e.clientY;

      // Distance from gap's current top (fixed reference for this frame)
      const distance = pointerY - gapRect.top;

      // Asymmetric detection from fixed reference point
      // Upward: 1rem buffer above gap
      // Downward: 3rem buffer below gap (accounts for expanded height + buffer)
      const expandUp = distance < 0 && Math.abs(distance) < 1 * baseRem;
      const expandDown = distance >= 0 && distance < 3 * baseRem;
      const isWithinHorizontal = e.clientX >= gapRect.left && e.clientX <= gapRect.right;

      setExpanded((expandUp || expandDown) && isWithinHorizontal);
    };

    cleanup();
    handlerRef.current = handlePointerMove;
    document.addEventListener('pointermove', handlePointerMove);

    return cleanup;
  }, [active, isDraggingGroup]);

  return { setNodeRef, gapRef, isOver, expanded };
};

type DashboardRow =
  | { type: 'gap'; id: string; index: number }
  | { type: 'item'; id: UniversalId; item: IslandType | TabType };

const LivePanel: React.FC<{

  dividerPosition: number,
  islands: (IslandType | TabType)[],
  handleTabClick: (id: UniversalId) => void,
  moveToVault: (id: UniversalId) => void,
  saveToVault: (island: IslandType | TabType) => void,
  closeTab: (id: UniversalId) => void,
  onRenameGroup: (id: UniversalId, title: string) => void,
  onToggleCollapse: (id: UniversalId) => void,
  isDraggingGroup?: boolean,
  searchQuery: string,
  setSearchQuery: (query: string) => void,
  sortOption: 'browser-order' | 'alpha-title' | 'alpha-url',
  setSortOption: (option: 'browser-order' | 'alpha-title' | 'alpha-url') => void,
  filteredTabs: TabType[],
  groupSearchResults: (tabs: TabType[]) => Promise<void>,
  groupUngroupedTabs: () => Promise<void>,
  deleteDuplicateTabs: () => Promise<void>,
  sortGroupsToTop: () => Promise<void>,
  showVault: boolean,
  isCreatingIsland: boolean,
  creatingTabId: UniversalId | null
}> = ({ dividerPosition, islands, handleTabClick, moveToVault, saveToVault, closeTab, onRenameGroup, onToggleCollapse, isDraggingGroup, searchQuery, setSearchQuery, sortOption, setSortOption, filteredTabs, groupSearchResults, groupUngroupedTabs, deleteDuplicateTabs, sortGroupsToTop, showVault, isCreatingIsland, creatingTabId }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'live-panel-dropzone',
  });

  const { setNodeRef: setCreateRef, isOver: isCreateOver } = useDroppable({
    id: 'create-island-dropzone',
  });

  const { setNodeRef: setBottomRef } = useDroppable({
    id: 'live-bottom',
  });

  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalCount = useMemo(() => {
    if (searchQuery) return filteredTabs.length;
    return (islands || []).reduce((acc, i) => {
      if (!i) return acc;
      if ('tabs' in i && i.tabs) return acc + i.tabs.length;
      return acc + 1;
    }, 0);
  }, [searchQuery, filteredTabs, islands]);

  const rowItems = useMemo(() => {
    if (searchQuery) return [];
    const rows: DashboardRow[] = [];
    (islands || []).forEach((item: IslandType | TabType, index: number) => {
      const isCurrentIsland = item && 'tabs' in item;
      const prevItem = islands?.[index - 1];
      const isPrevIsland = prevItem && 'tabs' in prevItem;
      const showGap = isCurrentIsland && isPrevIsland;

      if (showGap) {
        rows.push({ type: 'gap', id: `live-gap-${index}`, index });
      }
      rows.push({ type: 'item', id: item.id, item });
    });
    return rows;
  }, [islands, searchQuery]);

  const virtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE_SIZE,
    getItemKey: (index) => rowItems[index].id,
    overscan: VIRTUAL_ROW_OVERSCAN,
  });

  const searchVirtualizer = useVirtualizer({
    count: searchQuery ? filteredTabs.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE_SIZE,
    getItemKey: (index) => filteredTabs[index].id,
    overscan: VIRTUAL_ROW_OVERSCAN,
  });

  const renderSearchList = () => {
    if (filteredTabs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-600 opacity-40">
          <Search size={48} className="mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">
            No tabs found<br />
            for "{searchQuery}"
          </p>
        </div>
      );
    }

    return (
      <div
        key="search-results-list"
        className="search-mode-enter relative"
        style={{ height: `${searchVirtualizer.getTotalSize()}px`, width: '100%' }}
      >
        {searchVirtualizer.getVirtualItems().map((virtualRow) => {
          const tab = filteredTabs[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={searchVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: `${VIRTUAL_ROW_GAP_PX}px`,
              }}
              className="search-mode-enter"
            >
              <TabCard
                tab={tab}
                onClick={() => handleTabClick(tab.id)}
                onSave={() => saveToVault(tab)}
                disabled={!!searchQuery}
                isLoading={isCreatingIsland && creatingTabId === tab.id}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderLiveList = () => {
    return (
      <>
        <SortableContext items={(islands || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
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
                    <DroppableGap index={row.index} />
                  ) : (
                    row.item && 'tabs' in row.item ? (
                      <Island
                        island={row.item as IslandType}
                        onTabClick={(tab) => handleTabClick(tab.id)}
                        onNonDestructiveSave={() => saveToVault(row.item)}
                        onSave={() => moveToVault(row.item.id)}
                        onDelete={() => (row.item as IslandType).tabs?.forEach((t: TabType) => closeTab(t.id))}
                        onRename={(title) => onRenameGroup(row.item.id, title)}
                        onToggleCollapse={() => onToggleCollapse(row.item.id)}
                        onTabSave={(tab) => saveToVault(tab)}
                        onTabClose={(id) => closeTab(id as number)}
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
                    )
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
            !isCreatingIsland && isCreateOver && !isDraggingGroup && "border-gx-accent bg-gx-accent/10",
            !isCreatingIsland && !isCreateOver && "hover:border-gx-accent/50 hover:bg-gx-accent/5",
            isDraggingGroup && "opacity-30 cursor-not-allowed grayscale"
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

  const ungroupedCount = useMemo(() => {
    const restrictedPatterns = ['about:', 'chrome-extension:'];
    return (islands || []).filter((item): item is TabType => {
      if ('tabs' in item || item.pinned) return false;
      return !restrictedPatterns.some(p => item.url?.startsWith(p));
    }).length;
  }, [islands]);

  // Droppable gap component for between items

  const DroppableGap: React.FC<{ index: number; isLast?: boolean }> = ({ index, isLast }) => {
    const { active } = useDndContext();
    const { setNodeRef, gapRef, isOver, expanded } = useProximityGap(
      `live-gap-${index}`,
      active,
      isDraggingGroup
    );

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          gapRef.current = node;
        }}
        className={cn(
          "w-full rounded transition-all duration-200 ease-out pointer-events-none",
          // Default state: nearly invisible
          !expanded && "h-px min-h-[1px]",
          // Expanded state - matches tab card height (rem scales with zoom)
          expanded && "h-[2.375rem]",
          // Visual feedback when expanded and over
          isOver && expanded && "bg-gx-accent/20"
        )}
      />
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSortDropdown(false);
    if (showSortDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSortDropdown]);

  // Handle ESC key to clear search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, setSearchQuery]);

  const handleCollapseAll = async () => {
    // Collapse all Live groups using the same toggle handler
    const groupIds = (islands || []).filter(i => i && 'tabs' in i).map(i => i.id);
    for (const id of groupIds) {
      // Get current collapsed state from islands
      const island = islands.find(i => String(i.id) === String(id));
      // Only collapse if currently expanded
      if (island && 'collapsed' in island && !island.collapsed) {
        onToggleCollapse(id);
      }
    }
  };

  const handleExpandAll = async () => {
    // Expand all Live groups using the same toggle handler
    const groupIds = (islands || []).filter(i => i && 'tabs' in i).map(i => i.id);
    for (const id of groupIds) {
      // Get current collapsed state from islands
      const island = islands.find(i => String(i.id) === String(id));
      // Only expand if currently collapsed
      if (island && 'collapsed' in island && island.collapsed) {
        onToggleCollapse(id);
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleDeleteDuplicates = async () => {
    setIsCleaning(true);
    await deleteDuplicateTabs();
    setTimeout(() => setIsCleaning(false), CLEANUP_ANIMATION_DELAY_MS);
  };

  const handleGroupResults = () => {
    logger.debug('[Dashboard] Grouping search results...');
    groupSearchResults(filteredTabs);
    setSearchQuery('');
  };

  const sortOptions = [
    { value: 'browser-order' as const, label: 'Browser Order' },
    { value: 'alpha-title' as const, label: 'Alphabetical (Title)' },
    { value: 'alpha-url' as const, label: 'Alphabetical (URL)' },
  ];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full overflow-hidden transition-colors duration-200 border-r border-gx-gray",
        isOver && "bg-gx-accent/5"
      )}
      style={{ width: showVault ? `${dividerPosition}%` : '100%' }}
    >
      <div className="flex flex-col border-b border-gx-gray flex-shrink-0 bg-gx-dark/80 backdrop-blur-md z-20">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-gx-accent shadow-[0_0_8px_rgba(127,34,254,0.5)]" />
            <h2 className="text-sm font-bold tracking-widest uppercase italic">Live Workspace</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative group">
              <div className={cn(
                "flex items-center bg-gx-gray/80 rounded-lg border transition-all duration-300",
                "border-white/5 shadow-inner",
                searchQuery ? "border-gx-accent/30 ring-1 ring-gx-accent/10 shadow-[0_0_12px_rgba(127,34,254,0.15)]" : "group-hover:border-gx-accent/20",
                "group-focus-within:border-gx-accent/40 group-focus-within:ring-1 group-focus-within:ring-gx-accent/20"
              )}>
                <div className="pl-2.5 pr-1.5 py-1.5">
                  <Search className={cn(
                    "w-3.5 h-3.5 transition-colors",
                    searchQuery ? "text-gx-accent" : "text-gray-500 group-focus-within:text-gx-accent"
                  )} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchQuery ? '' : 'Search tabs...'}
                  className={cn(
                    "bg-transparent text-xs outline-none transition-all duration-300",
                    "text-white placeholder-gray-600",
                    searchQuery ? "w-32" : "w-24"
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="px-1.5 py-1.5 hover:bg-gx-red/20 rounded-r transition-all"
                    title="Clear search"
                  >
                    <X size={12} className="text-gray-500 hover:text-gx-red" />
                  </button>
                )}
              </div>
            </div>

            {/* Sort Dropdown (only visible in search mode) */}
            {searchQuery && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortDropdown(!showSortDropdown);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gx-gray/80 rounded-lg border border-white/5 hover:border-gx-accent/30 transition-all text-[10px] font-bold tracking-wider text-gray-400 hover:text-gx-accent"
                >
                  {sortOptions.find(o => o.value === sortOption)?.label || 'Sort'}
                  <SortDown size={10} className={cn("transition-transform", showSortDropdown && "rotate-180")} />
                </button>
                {showSortDropdown && (
                  <div
                    className="absolute top-full right-0 mt-1 bg-gx-gray border border-gx-accent/20 rounded-lg shadow-xl overflow-hidden z-50 min-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortOption(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-[10px] font-bold text-left transition-all",
                          "hover:bg-gx-accent/20",
                          sortOption === option.value
                            ? "text-gx-accent bg-gx-accent/10"
                            : "text-gray-400 hover:text-gray-200"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collapse/Expand All (hidden in search mode) */}
            {!searchQuery && (
              <div className="flex items-center bg-gx-gray/80 rounded-lg p-0.5 border border-white/5 shadow-inner">
                <button
                  onClick={handleCollapseAll}
                  title="Collapse All"
                  className="p-1 hover:bg-gx-accent/20 hover:text-gx-accent rounded transition-all group"
                >
                  <ChevronUp size={14} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                <button
                  onClick={handleExpandAll}
                  title="Expand All"
                  className="p-1 hover:bg-gx-accent/20 hover:text-gx-accent rounded transition-all group"
                >
                  <ChevronDown size={14} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            )}

            {!searchQuery && (
              <button
                onClick={sortGroupsToTop}
                title="Sort Groups to Top"
                className="p-1.5 bg-gx-gray/80 rounded-lg border border-white/5 hover:border-gx-accent/30 hover:bg-gx-accent/10 transition-all group shadow-inner"
              >
                <LayoutGrid size={14} className="text-gray-400 group-hover:text-gx-accent transition-colors" />
              </button>
            )}

            {/* Delete Duplicate Tabs (hidden in search mode) */}
            {!searchQuery && (
              <button
                onClick={handleDeleteDuplicates}
                title="Delete Duplicates"
                className={cn(
                  "p-1.5 bg-gx-gray/80 rounded-lg border border-white/5 shadow-inner",
                  "transition-all group relative overflow-hidden",
                  isCleaning && "animate-pulse-glow",
                  !isCleaning && "hover:bg-gx-red/20 hover:border-gx-red/30"
                )}
              >
                <Trash2 size={14} className={cn(
                  "transition-colors",
                  isCleaning ? "text-gx-red" : "text-gray-400 hover:text-gx-red"
                )} />
                {isCleaning && (
                  <div className="absolute inset-0 bg-gradient-to-r from-gx-red/10 via-gx-red/20 to-gx-red/10 animate-pulse" />
                )}
              </button>
            )}

            {!searchQuery && (
              <button
                onClick={groupUngroupedTabs}
                disabled={ungroupedCount < 2}
                title={ungroupedCount < 2 ? "Not enough ungrouped tabs to group" : `Group ${ungroupedCount} ungrouped tabs`}
                className={cn(
                  "p-1.5 bg-gx-gray/80 rounded-lg border border-white/5 shadow-inner transition-all group",
                  ungroupedCount < 2
                    ? "opacity-30 cursor-not-allowed grayscale"
                    : "hover:border-gx-accent/30 hover:bg-gx-accent/10"
                )}
              >
                <Group size={14} className={cn(
                  "transition-colors",
                  ungroupedCount < 2 ? "text-gray-600" : "text-gray-400 group-hover:text-gx-accent"
                )} />
              </button>
            )}

            {/* Total count */}
            <span className="text-[10px] text-gray-500 font-black tracking-tighter bg-gx-gray/50 px-2 py-0.5 rounded border border-white/5">
              {searchQuery ? `${filteredTabs.length}` : (islands || []).reduce((acc, i) => acc + (i && 'tabs' in i && i.tabs ? i.tabs.length : 1), 0)}
            </span>
          </div>
        </div>

        {/* Search Mode Header (only visible when searching) */}
        {searchQuery && (
          <div key="search-mode-header" className="px-4 py-2 bg-gradient-to-r from-gx-accent/5 via-gx-accent/10 to-gx-accent/5 border-t border-gx-accent/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search size={10} className="text-gx-accent" />
              <span className="text-[10px] font-bold text-gx-accent tracking-wider uppercase">
                Search Mode
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-500 font-medium">
                {filteredTabs.length} {filteredTabs.length === 1 ? 'tab' : 'tabs'} found
              </span>
              <button
                onClick={handleGroupResults}
                disabled={filteredTabs.filter(t => !t.pinned).length < 2}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded border transition-all duration-300",
                  "text-[10px] font-bold uppercase tracking-wider",
                  "bg-gx-accent/20 border-gx-accent/30 text-gx-accent hover:bg-gx-accent/40",
                  "disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale"
                )}
                title="Group search results"
              >
                <Group size={10} />
                Group Results
              </button>
              <span className="text-[10px] text-gray-600 font-black tracking-tighter bg-gx-gray/50 px-1.5 py-0.5 rounded border border-white/5">
                Press ESC to clear
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 scroll-smooth overscroll-none scrollbar-hide"
      >
        {searchQuery ? (
          <div
            key="search-results-list"
            className="search-mode-enter relative"
            style={{ height: `${searchVirtualizer.getTotalSize()}px`, width: '100%' }}
          >
            {filteredTabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-600 opacity-40">
                <Search size={48} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">
                  No tabs found<br />
                  for "{searchQuery}"
                </p>
              </div>
            ) : (
              searchVirtualizer.getVirtualItems().map((virtualRow) => {
                const tab = filteredTabs[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={searchVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: `${VIRTUAL_ROW_GAP_PX}px`,
                    }}
                    className="search-mode-enter"
                  >
                    <TabCard
                      tab={tab}
                      onClick={() => handleTabClick(tab.id)}
                      onSave={() => saveToVault(tab)}
                      disabled={!!searchQuery}
                      isLoading={isCreatingIsland && creatingTabId === tab.id}
                    />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <>
            <SortableContext items={(islands || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
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
                        <DroppableGap index={row.index} />
                      ) : (
                        row.item && 'tabs' in row.item ? (
                          <Island
                            island={row.item as IslandType}
                            onTabClick={(tab) => handleTabClick(tab.id)}
                            onNonDestructiveSave={() => saveToVault(row.item)}
                            onSave={() => moveToVault(row.item.id)}
                            onDelete={() => (row.item as IslandType).tabs?.forEach((t: TabType) => closeTab(t.id))}
                            onRename={(title) => onRenameGroup(row.item.id, title)}
                            onToggleCollapse={() => onToggleCollapse(row.item.id)}
                            onTabSave={(tab) => saveToVault(tab)}
                            onTabClose={(id) => closeTab(id as number)}
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
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </SortableContext>


            {/* Invisible Drop Zone for Appending */}
            <div
              ref={setBottomRef}
              className="h-24 w-full"
            />

            <div
              ref={setCreateRef}
              id="new-island-dropzone"
              className={cn(
                "p-10 border-2 border-dashed border-gx-gray/50 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group flex-shrink-0 cursor-pointer",
                // Loading state - cyan/blue neon pulse
                isCreatingIsland && "border-gx-cyan bg-gx-cyan/5 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse-glow",
                // Hover/over state - accent color
                !isCreatingIsland && isCreateOver && !isDraggingGroup && "border-gx-accent bg-gx-accent/10",
                // Normal hover state
                !isCreatingIsland && !isCreateOver && "hover:border-gx-accent/50 hover:bg-gx-accent/5",
                // Disabled for groups
                isDraggingGroup && "opacity-30 cursor-not-allowed grayscale"
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
        )}
      </div>
    </div>
  );
};

const VaultPanel: React.FC<{
  dividerPosition: number,
  vault: (IslandType | TabType)[],
  removeFromVault: (id: UniversalId) => void,
  isDraggingLiveItem: boolean,
  createVaultGroup: () => void,
  onRenameGroup: (id: UniversalId, title: string) => void,
  onToggleCollapse: (id: UniversalId) => void,
  sortVaultGroupsToTop: () => Promise<void>,
  restoreFromVault: (id: UniversalId) => void,
  vaultQuota: VaultQuotaInfo | null,
  vaultSyncEnabled: boolean,
  onManageStorage?: () => void
}> = ({ dividerPosition, vault, removeFromVault, isDraggingLiveItem, createVaultGroup, onRenameGroup, onToggleCollapse, sortVaultGroupsToTop, restoreFromVault, vaultQuota, vaultSyncEnabled, onManageStorage }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'vault-dropzone',
  });

  const { setNodeRef: setBottomRef } = useDroppable({
    id: 'vault-bottom',
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLocalStorageWarning, setShowLocalStorageWarning] = useState(true);

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

  // Droppable gap component for between two islands

  const DroppableGap: React.FC<{ index: number }> = ({ index }) => {
    const { active } = useDndContext();
    const { setNodeRef, gapRef, isOver, expanded } = useProximityGap(`vault-gap-${index}`, active, false);

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          gapRef.current = node;
        }}
        className={cn(
          "w-full rounded transition-all duration-200 ease-out",
          // Default state: nearly invisible
          !expanded && "h-px min-h-[1px]",
          // Expanded state - matches tab card height (rem scales with zoom)
          expanded && "h-[2.375rem]"
        )}
      />
    );
  };

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
                  <DroppableGap index={row.index} />
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
          <span className="text-[10px] text-gray-500 font-black tracking-tighter bg-gx-gray/50 px-2 py-0.5 rounded border border-white/5">{(vault || []).length} ARCHIVED</span>
        </div>
      </div>

      {!vaultSyncEnabled && (vault || []).length > 0 && showLocalStorageWarning && (
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

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 scroll-smooth overscroll-none"
      >
        <ScrollContainerProvider containerRef={scrollRef}>
          {vaultQuota && vaultQuota.warningLevel !== 'none' && (
            <QuotaWarningBanner
              warningLevel={vaultQuota.warningLevel}
              percentage={vaultQuota.percentage}
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
  const vaultQuota = useStore(state => state.vaultQuota);
  const quotaExceededPending = useStore(state => state.quotaExceededPending);
  const clearQuotaExceeded = useStore(state => state.clearQuotaExceeded);
  const setVaultSyncEnabled = useStore(state => state.setVaultSyncEnabled);
  const groupSearchResults = useStore(state => state.groupSearchResults);
  const groupUngroupedTabs = useStore(state => state.groupUngroupedTabs);
  const showAppearancePanel = useStore(state => state.showAppearancePanel);
  const executeCommand = useStore(state => state.executeCommand);
  const addPendingOperation = useStore(state => state.addPendingOperation);

  const [isResizing, setIsResizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const [isDraggingVaultItem, setIsDraggingVaultItem] = useState(false);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'browser-order' | 'alpha-title' | 'alpha-url'>('browser-order');
  const [isCreatingIsland, setIsCreatingIsland] = useState(false);
  const [creatingTabId, setCreatingTabId] = useState<UniversalId | null>(null);
  const [dragStartInfo, setDragStartInfo] = useState<{
    index: number;
    containerId: UniqueIdentifier;
    groupId: number;
    windowId: number;
  } | null>(null);
  const lastFilteredTabsRef = useRef<TabType[]>([]);

  // Flatten all tabs from islands and standalone tabs for search mode
  const allTabs = useMemo(() => {
    const tabs: TabType[] = [];
    (islands || []).forEach((item: LiveItem) => {
      if (item && 'tabs' in item && item.tabs) {
        // It's an Island - extract all tabs
        // We use the direct tab references to maintain stability
        tabs.push(...item.tabs);
      } else if (item) {
        // It's a standalone Tab
        tabs.push(item as TabType);
      }
    });
    return tabs;
  }, [islands]);

  // Filter and sort tabs for search mode
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const filtered = allTabs.filter(tab => {
      const query = searchQuery.toLowerCase();
      return (
        tab.title?.toLowerCase().includes(query) ||
        tab.url?.toLowerCase().includes(query)
      );
    });

    // Sort based on selected option
    switch (sortOption) {
      case 'alpha-title':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'alpha-url':
        filtered.sort((a, b) => (a.url || '').localeCompare(b.url || ''));
        break;
      case 'browser-order':
      default:
        filtered.sort((a, b) => (a.index || 0) - (b.index || 0));
        break;
    }

    // Stabilize reference if content hasn't changed to prevent entrance animation re-triggering
    const isIdentical =
      filtered.length === lastFilteredTabsRef.current.length &&
      filtered.every((tab, i) => {
        const prev = lastFilteredTabsRef.current[i];
        return tab.id === prev.id &&
          tab.title === prev.title &&
          tab.url === prev.url &&
          tab.active === prev.active &&
          tab.discarded === prev.discarded;
      });

    if (isIdentical) {
      return lastFilteredTabsRef.current;
    }

    lastFilteredTabsRef.current = filtered;
    return filtered;
  }, [searchQuery, allTabs, sortOption]);

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

  const handleTabClick = (tabId: UniversalId) => {
    const numericId = parseNumericId(tabId);
    if (numericId !== null) {
      chrome.tabs.update(numericId, { active: true });
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
      setDragStartInfo({
        index,
        containerId,
        groupId: (item as TabType).groupId ?? -1,
        windowId: (item as TabType).windowId ?? -1
      });
    }

    const isGroup = data && 'island' in data && data.type === 'island';
    setIsDraggingGroup(!!isGroup);

    // Check if dragging a Vault item (id starts with 'vault-')
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

    // Skip optimistic UI updates if hovering over the creation zone
    // This prevents glitches and ensures handleDragEnd receives the correct event data
    if (overId === 'create-island-dropzone') return;

    moveItemOptimistically(activeId, overId);

  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setIsDraggingVaultItem(false);
    setIsDraggingGroup(false);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // We MUST use the latest state from the store after optimistic moves
    const { islands: finalIslands, vault: finalVault } = useStore.getState();

    // Identify Source and Target
    const activeIdStr = activeId.toString();
    const overIdStr = overId.toString();
    const isVaultSource = activeIdStr.startsWith('vault-');

    // Target is Vault if dropzone OR if the ID starts with 'vault-'
    // This covers all Vault items and the dropzone
    const isVaultTarget = overIdStr === 'vault-dropzone' || overIdStr === 'vault-bottom' || overIdStr.startsWith('vault-');

    // SCENARIO 1: Internal Vault Move (Sort)
    if (isVaultSource && isVaultTarget) {
      await useStore.getState().reorderVault(finalVault);
      return;
    }

    // SCENARIO 2: Archive (Live -> Vault)
    if (!isVaultSource && isVaultTarget) {
      // Find item in islands to get ID, or just use activeId
      // Note: activeId is enough for moveToVault

      if (activeId) {
        await moveToVault(activeId);
      }
      return;
    }


    // SCENARIO 5: Create New Group from Tab (Live -> Create Zone)
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
        return;
      }

      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.pinned) {
          logger.warn('[ISLAND] Cannot create island from pinned tab');
          return;
        }

        // Set island creation state (lightweight, just for UI indicators)
        setIsCreatingIsland(true);
        setCreatingTabId(tabId);

        // Signal background to defer refreshes during group creation
        await chrome.runtime.sendMessage({ type: 'START_ISLAND_CREATION' });

        logger.debug(`[ISLAND] Creating island for tab: ${tabId}`);

        // Call createIsland with no title to ensure it remains "Untitled"
        const groupId = await createIsland([tabId], undefined, 'blue' as chrome.tabGroups.Color);

        if (groupId) {
          logger.info(`[SUCCESS] Created island ${groupId} for tab: ${tabId}`);
        } else {
          logger.error(`[FAILED] createIsland returned null for tab: ${tabId}`);
        }

        // Signal end of island creation to background (triggers refresh)
        await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });

        // Brief delay for visual feedback completion (ensures pulse completes before refresh)
        await new Promise(r => setTimeout(r, POST_ISLAND_CREATION_DELAY_MS));
      } catch (e) {
        logger.error('[ISLAND] Tab no longer exists or access denied', e);
        await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });
      } finally {
        setIsCreatingIsland(false);
        setCreatingTabId(null);
      }
      return;
    }

    // SCENARIO 3: Internal Live Move (Sort) OR Restore (Vault -> Live)
    // Skip if it was the Create Dropzone (handled in SCENARIO 5)
    if (!isVaultSource && !isVaultTarget && overIdStr !== 'create-island-dropzone') {
      // Show loading overlay for complex moves only
      setIsLoading(true);

      try {
        // Internal Live Move
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

        if (!targetItem) return;

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
      return;
    }


    // SCENARIO 4: Restore (Vault -> Live)
    // (isVaultSource && !isVaultTarget)
    if (isVaultSource && !isVaultTarget) {
      setIsLoading(true);

      try {
        if (activeId) {
          await restoreFromVault(activeId);
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }
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
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortOption={sortOption}
              setSortOption={setSortOption}
              filteredTabs={filteredTabs}
              groupSearchResults={groupSearchResults}
              groupUngroupedTabs={groupUngroupedTabs}
              deleteDuplicateTabs={deleteDuplicateTabs}
              sortGroupsToTop={sortGroupsToTop}
              showVault={showVault}
              isCreatingIsland={isCreatingIsland}
              creatingTabId={creatingTabId}
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
                  vaultSyncEnabled={appearanceSettings.vaultSyncEnabled}
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
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[1000]">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-gx-accent/20 animate-pulse" />
              <Loader2 className="w-12 h-12 text-gx-accent animate-spin relative z-10" />
            </div>
            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-gx-accent animate-pulse">Syncing Reality</span>
          </div>
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
