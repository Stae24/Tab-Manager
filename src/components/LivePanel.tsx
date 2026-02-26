import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FolderOpen, ChevronUp, ChevronDown, Group, LayoutGrid, CopyX, Search } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SearchBar } from './SearchBar';
import { SearchHelp } from './SearchBar/SearchHelp';
import { SearchResultList } from './SearchResultList';
import { VirtualizedLiveList } from './VirtualizedLiveList';
import { cn } from '../utils/cn';
import { logger } from '../utils/logger';
import { needsCompanionTabForSingleTabGroup, detectSidebarContext } from '../utils/browser';
import { Island as IslandType, Tab as TabType, UniversalId, DashboardRow } from '../types';
import {
  VIRTUAL_ROW_ESTIMATE_SIZE,
  VIRTUAL_ROW_OVERSCAN,
  CLEANUP_ANIMATION_DELAY_MS,
  SEARCH_DEBOUNCE_MS,
  SIDEBAR_PANEL_PADDING_DEFAULT,
  MANAGER_PANEL_PADDING_DEFAULT
} from '../constants';
import { search, searchAndExecute, parseQuery, isSearchActive, hasCommands } from '../search';
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
  onDeleteIsland?: (id: UniversalId) => void;
  isDraggingGroup?: boolean;
  isDraggingVaultItem?: boolean;
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
  onDeleteIsland,
  isDraggingGroup,
  isDraggingVaultItem,
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
  const searchPromiseRef = useRef<Promise<void> | null>(null);
  const searchGenRef = useRef(0);

  const searchScope = useStore((s) => s.searchScope);
  const setSearchScope = useStore((s) => s.setSearchScope);
  const searchResults = useStore((s) => s.searchResults);
  const setSearchResults = useStore((s) => s.setSearchResults);
  const isSearching = useStore((s) => s.isSearching);
  const setIsSearching = useStore((s) => s.setIsSearching);
  const parsedQuery = useStore((s) => s.parsedQuery);
  const setParsedQuery = useStore((s) => s.setParsedQuery);

  const syncLiveTabs = useStore((s) => s.syncLiveTabs);
  const searchDebounce = useStore((s) => s.appearanceSettings.searchDebounce);
  const sidebarPanelPadding = useStore((s) => s.appearanceSettings.sidebarPanelPadding);
  const managerPanelPadding = useStore((s) => s.appearanceSettings.managerPanelPadding);

  const [isSidebar, setIsSidebar] = useState<boolean | null>(null);

  useEffect(() => {
    detectSidebarContext().then(setIsSidebar);
  }, []);

  const horizontalPadding = isSidebar === null
    ? SIDEBAR_PANEL_PADDING_DEFAULT
    : (isSidebar ? (sidebarPanelPadding ?? SIDEBAR_PANEL_PADDING_DEFAULT) : (managerPanelPadding ?? MANAGER_PANEL_PADDING_DEFAULT));

  const runSearch = useCallback(async (query: string) => {
    const currentGen = ++searchGenRef.current;
    const parsed = parseQuery(query);
    setParsedQuery(parsed);

    if (!isSearchActive(parsed)) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchPromise = (async () => {
        const result = await search(query, {
          scope: searchScope,
          vaultItems,
        });
        if (currentGen !== searchGenRef.current) return;
        setSearchResults(result.results);
      })();
      searchPromiseRef.current = searchPromise;
      await searchPromise;
      if (currentGen !== searchGenRef.current) return;
    } catch (error) {
      logger.error('LivePanel', 'Search failed:', error);
      setSearchResults([]);
    } finally {
      if (currentGen === searchGenRef.current) {
        setIsSearching(false);
      }
    }
  }, [searchScope, vaultItems, setSearchResults, setIsSearching, setParsedQuery]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      runSearch(searchQuery);
    }, searchDebounce ?? SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, runSearch, searchDebounce]);

  const handleExecuteCommands = useCallback(async () => {
    if (!parsedQuery || !hasCommands(parsedQuery) || searchResults.length === 0) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (searchPromiseRef.current) {
      await searchPromiseRef.current;
    }

    const currentState = useStore.getState();
    const currentParsedQuery = currentState.parsedQuery;
    const currentSearchResults = currentState.searchResults;

    if (!currentParsedQuery || !hasCommands(currentParsedQuery) || currentSearchResults.length === 0) return;

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
      logger.error('LivePanel', 'Command execution failed:', error);
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

  const handleToggleAll = useCallback(async (targetCollapsed: boolean) => {
    (islands || []).forEach(island => {
      if (island && 'tabs' in island && island.collapsed !== targetCollapsed) {
        onToggleCollapse(island.id);
      }
    });
  }, [islands, onToggleCollapse]);

  const handleDeleteDuplicates = async () => {
    setIsCleaning(true);
    await deleteDuplicateTabs();
    setTimeout(() => setIsCleaning(false), CLEANUP_ANIMATION_DELAY_MS);
  };

  const handleGroupResults = async () => {
    logger.debug('LivePanel', 'Grouping search results...');
    try {
      await groupSearchResults(displayTabs);
      setSearchQuery('');
    } catch (error) {
      logger.error('LivePanel', 'Failed to group search results:', error);
    }
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
      <div className="flex flex-col border-b border-gx-gray flex-shrink-0 bg-gx-gray/80 backdrop-blur-md z-20">
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-gx-accent shadow-[0_0_8px_rgba(127,34,254,0.5)]" />
            <h2 className="text-sm font-bold tracking-widest uppercase italic">Live Workspace</h2>
          </div>
          <div className="flex items-center gap-3 flex-1 ml-4 justify-end">
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
                  onClick={() => handleToggleAll(true)}
                  title="Collapse All"
                  className="p-1 hover:bg-gx-accent/20 hover:text-gx-accent rounded transition-all group"
                >
                  <ChevronUp size={14} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                <button
                  onClick={() => handleToggleAll(false)}
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
                    ? "opacity-30 grayscale"
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
              {searchQuery ? displayTabs.length : (islands || []).reduce((acc, i) => acc + (i && 'tabs' in i && i.tabs ? i.tabs.length : 1), 0)}
            </span>
          </div>
        </div>

        {searchQuery && (
          <div key="search-mode-header" className="px-4 py-2 bg-gradient-to-r from-gx-accent/5 via-gx-accent/10 to-gx-accent/5 border-t border-gx-accent/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-2.5 h-2.5 text-gx-accent" />
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
                  "disabled:opacity-30 disabled:grayscale"
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
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 scroll-smooth overscroll-none scrollbar-hide"
        style={{ paddingLeft: `${horizontalPadding}px`, paddingRight: `${horizontalPadding}px`, paddingTop: '1rem', paddingBottom: '1rem' }}
      >
        {searchQuery ? (
          <SearchResultList
            isSearching={isSearching}
            displayTabs={displayTabs}
            searchQuery={searchQuery}
            searchVirtualizer={searchVirtualizer}
            handleTabClick={handleTabClick}
            saveToVault={saveToVault}
            isCreatingIsland={isCreatingIsland}
            creatingTabId={creatingTabId}
          />
        ) : (
          <VirtualizedLiveList
            islands={islands}
            rowItems={rowItems}
            virtualizer={virtualizer}
            handleTabClick={handleTabClick}
            moveToVault={moveToVault}
            saveToVault={saveToVault}
            closeTab={closeTab}
            onRenameGroup={onRenameGroup}
            onToggleCollapse={onToggleCollapse}
            onDeleteIsland={onDeleteIsland}
            isDraggingGroup={isDraggingGroup}
            isDraggingVaultItem={isDraggingVaultItem}
            isCreatingIsland={isCreatingIsland}
            creatingTabId={creatingTabId}
            searchQuery={searchQuery}
            setCreateRef={setCreateRef}
            setBottomRef={setBottomRef}
            isCreateOver={isCreateOver}
          />
        )}
      </div>

      <SearchHelp isOpen={showSearchHelp} onClose={() => setShowSearchHelp(false)} />
    </div>
  );
};
