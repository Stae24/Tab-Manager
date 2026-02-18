import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, FolderOpen, Loader2, ChevronUp, ChevronDown, Search, ChevronDown as SortDown, X, Trash2, LayoutGrid, Group } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { DroppableGap } from './DroppableGap';
import { cn } from '../utils/cn';
import { logger } from '../utils/logger';
import { Island as IslandType, Tab as TabType, UniversalId, DashboardRow } from '../types';
import {
  VIRTUAL_ROW_ESTIMATE_SIZE,
  VIRTUAL_ROW_OVERSCAN,
  VIRTUAL_ROW_GAP_PX,
  CLEANUP_ANIMATION_DELAY_MS
} from '../constants';

interface LivePanelProps {
  dividerPosition: number;
  islands: (IslandType | TabType)[];
  supportsGroupCollapse: boolean | null;
  handleTabClick: (id: UniversalId) => void;
  moveToVault: (id: UniversalId) => void;
  saveToVault: (island: IslandType | TabType) => void;
  closeTab: (id: UniversalId) => void;
  onRenameGroup: (id: UniversalId, title: string) => void;
  onToggleCollapse: (id: UniversalId) => void;
  isDraggingGroup?: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortOption: 'browser-order' | 'alpha-title' | 'alpha-url';
  setSortOption: (option: 'browser-order' | 'alpha-title' | 'alpha-url') => void;
  filteredTabs: TabType[];
  groupSearchResults: (tabs: TabType[]) => Promise<void>;
  groupUngroupedTabs: () => Promise<void>;
  deleteDuplicateTabs: () => Promise<void>;
  sortGroupsToTop: () => Promise<void>;
  showVault: boolean;
  isCreatingIsland: boolean;
  creatingTabId: UniversalId | null;
}

export const LivePanel: React.FC<LivePanelProps> = ({
  dividerPosition,
  islands,
  supportsGroupCollapse,
  handleTabClick,
  moveToVault,
  saveToVault,
  closeTab,
  onRenameGroup,
  onToggleCollapse,
  isDraggingGroup,
  searchQuery,
  setSearchQuery,
  sortOption,
  setSortOption,
  filteredTabs,
  groupSearchResults,
  groupUngroupedTabs,
  deleteDuplicateTabs,
  sortGroupsToTop,
  showVault,
  isCreatingIsland,
  creatingTabId
}) => {
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

  const ungroupedCount = useMemo(() => {
    const restrictedPatterns = ['about:', 'chrome-extension:'];
    return (islands || []).filter((item): item is TabType => {
      if ('tabs' in item || item.pinned) return false;
      return !restrictedPatterns.some(p => item.url?.startsWith(p));
    }).length;
  }, [islands]);

  useEffect(() => {
    const handleClickOutside = () => setShowSortDropdown(false);
    if (showSortDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSortDropdown]);

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
    const groupIds = (islands || []).filter(i => i && 'tabs' in i).map(i => i.id);
    for (const id of groupIds) {
      const island = islands.find(i => String(i.id) === String(id));
      if (island && 'collapsed' in island && !island.collapsed) {
        onToggleCollapse(id);
      }
    }
  };

  const handleExpandAll = async () => {
    const groupIds = (islands || []).filter(i => i && 'tabs' in i).map(i => i.id);
    for (const id of groupIds) {
      const island = islands.find(i => String(i.id) === String(id));
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

  const handleGroupResults = async () => {
    logger.debug('[Dashboard] Grouping search results...');
    try {
      await groupSearchResults(filteredTabs);
      setSearchQuery('');
    } catch (error) {
      logger.error('[Dashboard] Failed to group search results:', error);
    }
  };

  const sortOptions = [
    { value: 'browser-order' as const, label: 'Browser Order' },
    { value: 'alpha-title' as const, label: 'Alphabetical (Title)' },
    { value: 'alpha-url' as const, label: 'Alphabetical (URL)' },
  ];

  const renderSearchResults = () => {
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
                    <DroppableGap index={row.index} panelType="live" isDraggingGroup={isDraggingGroup} />
                  ) : (
                    row.item && 'tabs' in row.item ? (
                      <Island
                        island={row.item as IslandType}
                        supportsGroupCollapse={supportsGroupCollapse}
                        onTabClick={(tab) => handleTabClick(tab.id)}
                        onNonDestructiveSave={() => saveToVault(row.item)}
                        onSave={() => moveToVault(row.item.id)}
                        onDelete={() => (row.item as IslandType).tabs?.forEach((t: TabType) => closeTab(t.id))}
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

            <span className="text-[10px] text-gray-500 font-black tracking-tighter bg-gx-gray/50 px-2 py-0.5 rounded border border-white/5">
              {searchQuery ? `${filteredTabs.length}` : (islands || []).reduce((acc, i) => acc + (i && 'tabs' in i && i.tabs ? i.tabs.length : 1), 0)}
            </span>
          </div>
        </div>

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
        {searchQuery ? renderSearchResults() : renderLiveList()}
      </div>
    </div>
  );
};
