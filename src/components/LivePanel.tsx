import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, FolderOpen, Loader2, ChevronUp, ChevronDown, Search, Group, LayoutGrid, CopyX } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { DroppableGap } from './DroppableGap';
import { SearchBar } from './SearchBar';
import { SearchHelp } from './SearchBar/SearchHelp';
import { cn } from '../utils/cn';
import { logger } from '../utils/logger';
import { needsCompanionTabForSingleTabGroup } from '../utils/browser';
import { Island as IslandType, Tab as TabType, UniversalId, DashboardRow } from '../types';
import {
  VIRTUAL_ROW_ESTIMATE_SIZE,
  VIRTUAL_ROW_OVERSCAN,
  VIRTUAL_ROW_GAP_PX,
  CLEANUP_ANIMATION_DELAY_MS
} from '../constants';
import { search, searchAndExecute, parseQuery, isSearchActive, hasCommands } from '../search';
import type { SearchResult, ParsedQuery } from '../search';
import { useStore } from '../store/useStore';

interface LivePanelProps {
  dividerPosition: number;
  islands: (IslandType | TabType)[];
  handleTabClick: (id: UniversalId) => void;
  moveToVault: (id: UniversalId) => void;
  saveToVault: (island: IslandType | TabType) => void;
  closeTab: (id: UniversalId) => void;
  onRenameGroup: (id: UniversalId, title: string) => void;
  onToggleCollapse: (id: UniversalId) => void;
  isDraggingGroup?: boolean;
  groupSearchResults: (tabs: TabType[]) => Promise<void>;
  groupUngroupedTabs: () => Promise<void>;
  deleteDuplicateTabs: () => Promise<void>;
  sortGroupsToTop: () => Promise<void>;
  showVault: boolean;
  isCreatingIsland: boolean;
  creatingTabId: UniversalId | null;
  vaultItems?: ReturnType<typeof useStore.getState>['vault'];
}

export const LivePanel: React.FC<LivePanelProps> = ({
  dividerPosition,
  islands,
  handleTabClick,
  moveToVault,
  saveToVault,
  closeTab,
  onRenameGroup,
  onToggleCollapse,
  isDraggingGroup,
  groupSearchResults,
  groupUngroupedTabs,
  deleteDuplicateTabs,
  sortGroupsToTop,
  showVault,
  isCreatingIsland,
  creatingTabId,
  vaultItems = [],
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

  const [isCleaning, setIsCleaning] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchScope = useStore((s) => s.searchScope);
  const setSearchScope = useStore((s) => s.setSearchScope);
  const searchResults = useStore((s) => s.searchResults);
  const setSearchResults = useStore((s) => s.setSearchResults);
  const isSearching = useStore((s) => s.isSearching);
  const setIsSearching = useStore((s) => s.setIsSearching);
  const parsedQuery = useStore((s) => s.parsedQuery);
  const setParsedQuery = useStore((s) => s.setParsedQuery);

  const syncLiveTabs = useStore((s) => s.syncLiveTabs);

  const runSearch = useCallback(async (query: string) => {
    const parsed = parseQuery(query);
    setParsedQuery(parsed);

    if (!isSearchActive(parsed)) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await search(query, {
        scope: searchScope,
        vaultItems,
      });
      setSearchResults(result.results);
    } catch (error) {
      logger.error('[LivePanel] Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchScope, vaultItems, setSearchResults, setIsSearching, setParsedQuery]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
    }, 150);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, runSearch]);

  const handleExecuteCommands = useCallback(async () => {
    if (!parsedQuery || !hasCommands(parsedQuery) || searchResults.length === 0) return;

    setIsSearching(true);
    try {
      await searchAndExecute(searchQuery, {
        scope: searchScope,
        vaultItems,
      });
      setSearchQuery('');
      setSearchResults([]);
      await syncLiveTabs();
    } catch (error) {
      logger.error('[LivePanel] Command execution failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [parsedQuery, searchResults, searchQuery, searchScope, vaultItems, setSearchQuery, setSearchResults, setIsSearching, syncLiveTabs]);

  const displayTabs = useMemo(() => {
    if (searchQuery && searchResults.length > 0) {
      return searchResults.map((r) => r.tab);
    }
    return [];
  }, [searchQuery, searchResults]);

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
    count: searchQuery ? displayTabs.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATE_SIZE,
    getItemKey: (index) => displayTabs[index].id,
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !searchQuery) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

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

  const handleDeleteDuplicates = async () => {
    setIsCleaning(true);
    await deleteDuplicateTabs();
    setTimeout(() => setIsCleaning(false), CLEANUP_ANIMATION_DELAY_MS);
  };

  const handleGroupResults = async () => {
    logger.debug('[Dashboard] Grouping search results...');
    try {
      await groupSearchResults(displayTabs);
      setSearchQuery('');
    } catch (error) {
      logger.error('[Dashboard] Failed to group search results:', error);
    }
  };

  const renderSearchResults = () => {
    if (isSearching) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-600 opacity-40">
          <Loader2 size={32} className="mb-4 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">
            Searching...
          </p>
        </div>
      );
    }

    if (displayTabs.length === 0) {
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
          const tab = displayTabs[virtualRow.index];
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
            <SearchBar
              ref={searchInputRef}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              scope={searchScope}
              onScopeChange={setSearchScope}
              onExecute={handleExecuteCommands}
              onHelp={() => setShowSearchHelp(true)}
              resultCount={displayTabs.length}
              isSearching={isSearching}
            />

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
                <LayoutGrid className="w-3.5 h-3.5 text-gray-400 group-hover:text-gx-accent transition-colors" />
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
                <CopyX size={14} className={cn(
                  "transition-transform",
                  isCleaning ? "text-gx-red" : "text-gray-400 group-hover:text-gx-red"
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
              {searchQuery ? `${displayTabs.length}` : (islands || []).reduce((acc, i) => acc + (i && 'tabs' in i && i.tabs ? i.tabs.length : 1), 0)}
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
                {displayTabs.length} {displayTabs.length === 1 ? 'tab' : 'tabs'} found
              </span>
              <button
                onClick={handleGroupResults}
                disabled={needsCompanionTabForSingleTabGroup()
                  ? displayTabs.filter(t => !t.pinned).length < 2
                  : displayTabs.filter(t => !t.pinned).length === 0}
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

      <SearchHelp isOpen={showSearchHelp} onClose={() => setShowSearchHelp(false)} />
    </div>
  );
};
