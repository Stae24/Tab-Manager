import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GripVertical, Plus, FolderOpen, Save, Loader2, ChevronUp, ChevronDown, Search, ChevronDown as SortDown, X, ChevronUp as SortUp, Trash2, LayoutGrid } from 'lucide-react';
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
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { Island } from './Island';
import { TabCard } from './TabCard';
import { Sidebar } from './Sidebar';
import { QuotaWarningBanner } from './QuotaWarningBanner';
import { QuotaExceededModal, QuotaExceededAction } from './QuotaExceededModal';
import { useStore, parseNumericId } from '../store/useStore';
import { cn } from '../utils/cn';
import { closeTab, moveIsland, createIsland } from '../utils/chromeApi';
import { Island as IslandType, Tab as TabType, VaultQuotaInfo } from '../types/index';

// Proximity tracking hook for droppable gaps
const useProximityGap = (gapId: string, active: any, isDraggingGroup?: boolean) => {
  const { setNodeRef, isOver } = useDroppable({ id: gapId });
  const gapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!active || !gapRef.current || isDraggingGroup) {
      setExpanded(false);
      return;
    }

    // Track pointer movement for proximity detection
    // Uses fixed reference point to prevent jitter when gap expands/contracts
    const handlePointerMove = (e: PointerEvent) => {
      if (!gapRef.current) return;

      const gapRect = gapRef.current.getBoundingClientRect();
      const baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
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

    document.addEventListener('pointermove', handlePointerMove);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
    };
  }, [active, isDraggingGroup]);

  return { setNodeRef, gapRef, isOver, expanded };
};

const LivePanel: React.FC<{
  dividerPosition: number,
  islands: any[],
  handleTabClick: (id: number | string) => void,
  moveToVault: (id: number | string) => void,
  saveToVault: (island: any) => void,
  closeTab: (id: number | string) => void,
  onRenameGroup: (id: number | string, title: string) => void,
  onToggleCollapse: (id: number | string) => void,
  isDraggingGroup?: boolean,
  searchQuery: string,
  setSearchQuery: (query: string) => void,
  sortOption: 'browser-order' | 'alpha-title' | 'alpha-url',
  setSortOption: (option: 'browser-order' | 'alpha-title' | 'alpha-url') => void,
  filteredTabs: any[],
  deleteDuplicateTabs: () => Promise<void>,
  sortGroupsToTop: () => Promise<void>,
  showVault: boolean,
  isCreatingIsland: boolean,
  creatingTabId: number | string | null
}> = ({ dividerPosition, islands, handleTabClick, moveToVault, saveToVault, closeTab, onRenameGroup, onToggleCollapse, isDraggingGroup, searchQuery, setSearchQuery, sortOption, setSortOption, filteredTabs, deleteDuplicateTabs, sortGroupsToTop, showVault, isCreatingIsland, creatingTabId }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'live-panel-dropzone',
  });

  const { setNodeRef: setCreateRef, isOver: isCreateOver } = useDroppable({
    id: 'create-island-dropzone',
  });

  const { setNodeRef: setBottomRef, isOver: isBottomOver } = useDroppable({
    id: 'live-bottom',
  });

  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

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
      if (island && !island.collapsed) {
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
      if (island && island.collapsed) {
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
    setTimeout(() => setIsCleaning(false), 500);
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

            {/* Total count */}
            <span className="text-[10px] text-gray-500 font-black tracking-tighter bg-gx-gray/50 px-2 py-0.5 rounded border border-white/5">
              {searchQuery ? `${filteredTabs.length}` : (islands || []).reduce((acc, i: any) => acc + (i && i.tabs ? i.tabs.length : 1), 0)}
            </span>
          </div>
        </div>

        {/* Search Mode Header (only visible when searching) */}
        {searchQuery && (
          <div className="px-4 py-2 bg-gradient-to-r from-gx-accent/5 via-gx-accent/10 to-gx-accent/5 border-t border-gx-accent/10 flex items-center justify-between animate-pulse-glow">
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
              <span className="text-[10px] text-gray-600 font-black tracking-tighter bg-gx-gray/50 px-1.5 py-0.5 rounded border border-white/5">
                Press ESC to clear
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 scroll-smooth overscroll-none scrollbar-hide">
        {searchQuery ? (
          // Search Mode: Show filtered tabs in flat list
          <div className="space-y-2 search-mode-enter">
            {filteredTabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-600 opacity-40 animate-pulse">
                <Search size={48} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">
                  No tabs found<br/>
                  for "{searchQuery}"
                </p>
              </div>
            ) : (
              filteredTabs.map((tab: any, index: number) => (
                <div
                  key={tab.id}
                  style={{
                    animationDelay: `${index * 30}ms`,
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
              ))
            )}
          </div>
        ) : (
          // Normal Mode: Show islands and standalone tabs
            <>
              <SortableContext items={(islands || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
                {(islands || []).map((item: any, index: number) => {
                  const isCurrentIsland = item && 'tabs' in item;
                  const prevItem = islands?.[index - 1];
                  const isPrevIsland = prevItem && 'tabs' in prevItem;
                  const showGap = isCurrentIsland && isPrevIsland;

                  return (
                    <React.Fragment key={item.id}>
                      {showGap && <DroppableGap index={index} />}
                    {isCurrentIsland ? (
                      <Island
                        island={item}
                        onTabClick={(tab) => handleTabClick(tab.id)}
                        onNonDestructiveSave={() => saveToVault(item)}
                        onSave={() => moveToVault(item.id)}
                        onDelete={() => item.tabs.forEach((t: any) => closeTab(t.id))}
                        onRename={(title) => onRenameGroup(item.id, title)}
                        onToggleCollapse={() => onToggleCollapse(item.id)}
                        onTabSave={(tab) => saveToVault(tab)}
                        onTabClose={(id) => closeTab(id as number)}
                        disabled={!!searchQuery}
                      />
                    ) : (
                      <TabCard
                        tab={item}
                        onClick={() => handleTabClick(item.id)}
                        onSave={() => saveToVault(item)}
                        onClose={() => closeTab(item.id)}
                        disabled={!!searchQuery}
                        isLoading={isCreatingIsland && creatingTabId === item.id}
                      />
                    )}
                  </React.Fragment>
                );
              })}
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
  vault: any[],
  removeFromVault: (id: number | string) => void,
  isDraggingLiveItem: boolean,
  createVaultGroup: () => void,
  onRenameGroup: (id: number | string, title: string) => void,
  onToggleCollapse: (id: number | string) => void,
  sortVaultGroupsToTop: () => Promise<void>,
  restoreFromVault: (id: number | string) => void,
  vaultQuota: VaultQuotaInfo | null,
  onManageStorage?: () => void
}> = ({ dividerPosition, vault, removeFromVault, isDraggingLiveItem, createVaultGroup, onRenameGroup, onToggleCollapse, sortVaultGroupsToTop, restoreFromVault, vaultQuota, onManageStorage }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'vault-dropzone',
  });

  const { setNodeRef: setBottomRef, isOver: isBottomOver } = useDroppable({
    id: 'vault-bottom',
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2 scroll-smooth overscroll-none">
        {vaultQuota && vaultQuota.warningLevel !== 'none' && (
          <QuotaWarningBanner
            warningLevel={vaultQuota.warningLevel}
            percentage={vaultQuota.percentage}
            onManageStorage={onManageStorage}
          />
        )}
        <SortableContext items={(vault || []).map(i => i.id)} strategy={verticalListSortingStrategy}>
          {(vault || []).map((item, index) => {
            const isCurrentIsland = 'tabs' in item;
            const prevItem = vault?.[index - 1];
            const isPrevIsland = prevItem && 'tabs' in prevItem;
            const showGap = isCurrentIsland && isPrevIsland;

            return (
              <React.Fragment key={item.savedAt || item.id}>
                {showGap && <DroppableGap index={index} />}
                {'tabs' in item ? (
                  <Island
                    island={item}
                    isVault={true}
                    onRestore={() => restoreFromVault(item.id)}
                    onDelete={() => removeFromVault(item.id)}
                    onRename={(title) => onRenameGroup(item.id, title)}
                    onToggleCollapse={() => onToggleCollapse(item.id)}
                    onTabRestore={(tab) => restoreFromVault(tab.id)}
                    onTabClose={(id) => removeFromVault(id)}
                  />
                ) : (
                  <TabCard
                    tab={item}
                    isVault={true}
                    onRestore={() => restoreFromVault(item.id)}
                    onClose={() => removeFromVault(item.id)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </SortableContext>
        
        {(vault || []).length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-20 group">
            <Save size={64} className="group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[10px] font-black mt-6 italic uppercase tracking-[0.3em] text-center leading-loose">
              Initiate data transfer<br/>to secure items
            </p>
          </div>
        )}

        {/* Bottom Drop Zone / Spacer */}
        <div 
            ref={setBottomRef} 
            className={cn(
                "h-24 w-full rounded-xl border-2 border-dashed border-transparent transition-all flex items-center justify-center shrink-0",
                isBottomOver ? "border-gx-accent/30 bg-gx-accent/5" : "hover:border-gx-gray/30"
            )}
        >
            <span className={cn("text-xs font-bold uppercase tracking-widest text-gx-gray opacity-0 transition-opacity", isBottomOver && "opacity-100")}>
                Drop to Append
            </span>
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const {
    isDarkMode,
    islands,
    vault,
    moveToVault,
    saveToVault,
    restoreFromVault,
    dividerPosition,
    setDividerPosition,
    removeFromVault,
    moveItemOptimistically,
    renameGroup,
    createVaultGroup,
    toggleVaultGroupCollapse,
    toggleLiveGroupCollapse,
    deleteDuplicateTabs,
    sortGroupsToTop,
    sortVaultGroupsToTop,
    showVault,
    isRenaming,
    appearanceSettings,
    vaultQuota,
    quotaExceededPending,
    clearQuotaExceeded,
    setVaultSyncEnabled
  } = useStore();

  const [isResizing, setIsResizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [isDraggingVaultItem, setIsDraggingVaultItem] = useState(false);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'browser-order' | 'alpha-title' | 'alpha-url'>('browser-order');
  const [isCreatingIsland, setIsCreatingIsland] = useState(false);
  const [creatingTabId, setCreatingTabId] = useState<number | string | null>(null);

  // Flatten all tabs from islands and standalone tabs for search mode
  const allTabs = useMemo(() => {
    const tabs: any[] = [];
    (islands || []).forEach(item => {
      if (item && 'tabs' in item && item.tabs) {
        // It's an Island - extract all tabs
        tabs.push(...item.tabs.map((tab: any) => ({ ...tab, sourceIsland: item })));
      } else if (item) {
        // It's a standalone Tab
        tabs.push(item);
      }
    });
    return tabs;
  }, [islands]);

  // Filter and sort tabs for search mode
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return [];

    let filtered = allTabs.filter(tab => {
      const query = searchQuery.toLowerCase();
      return (
        tab.title?.toLowerCase().includes(query) ||
        tab.url?.toLowerCase().includes(query)
      );
    });

    // Sort based on selected option
    switch (sortOption) {
      case 'alpha-title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'alpha-url':
        filtered.sort((a, b) => a.url.localeCompare(b.url));
        break;
      case 'browser-order':
      default:
        filtered.sort((a, b) => (a.index || 0) - (b.index || 0));
        break;
    }

    return filtered;
  }, [searchQuery, allTabs, sortOption]);

  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { distance: 8 } 
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const scaleModifier = useCallback(({ transform }: any) => {
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
      setDividerPosition(Math.max(20, Math.min(80, percentage)));
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

  const handleTabClick = (tabId: number | string) => {
    const numericId = parseNumericId(tabId);
    if (numericId !== -1) {
      chrome.tabs.update(numericId, { active: true });
    }
  };

  const handleCloseTab = async (tabId: number | string) => {
    const numericId = parseNumericId(tabId);
    if (numericId !== -1) {
      await closeTab(numericId);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    setActiveItem(data);
    
    // Check if dragging a Group
    const isGroup = data && 'island' in data && data.type === 'island';
    setIsDraggingGroup(!!isGroup);

    // Check if dragging a Vault item (id starts with 'vault-')
    const isVault = event.active.id.toString().startsWith('vault-') || 
                    (data && data.island && data.island.id.toString().startsWith('vault-')) ||
                    (data && data.tab && data.tab.id.toString().startsWith('vault-'));
    setIsDraggingVaultItem(isVault);
    useStore.getState().setIsUpdating(true);
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

    moveItemOptimistically(activeId as any, overId as any);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setIsDraggingVaultItem(false);
    setIsDraggingGroup(false);
    
    try {
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
          await moveToVault(activeId as any);
        }
        return;
      }

      // SCENARIO 5: Create New Group from Tab (Live -> Create Zone)
      if (overIdStr === 'create-island-dropzone' && !isVaultSource) {
        const resolveTabId = (): number | null => {
          if (typeof activeId === 'number' && activeId > 0) return activeId;
          if (typeof activeId === 'string') {
            const numeric = parseNumericId(activeId);
            if (numeric !== -1) return numeric;
          }
          const data = event.active.data?.current;
          if (data?.type === 'tab' && data.tab?.id) return parseNumericId(data.tab.id);
          if (activeItem?.tab?.id) return parseNumericId(activeItem.tab.id);
          return null;
        };

        const tabId = resolveTabId();

        if (tabId) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.pinned) {
              console.warn('[ISLAND] Cannot create island from pinned tab');
              return;
            }

            // Set island creation state (lightweight, just for UI indicators)
            setIsCreatingIsland(true);
            setCreatingTabId(tabId);

            // Signal background to defer refreshes during group creation
            await chrome.runtime.sendMessage({ type: 'START_ISLAND_CREATION' });

            console.log(`[ISLAND] Creating island for tab: ${tabId}`);
            
            // Call createIsland with no title to ensure it remains "Untitled"
            const groupId = await createIsland([tabId], undefined, 'blue' as any);
            
            if (groupId) {
              console.log(`[SUCCESS] Created island ${groupId} for tab: ${tabId}`);
            } else {
              console.error(`[FAILED] createIsland returned null for tab: ${tabId}`);
            }

            // Signal end of island creation to background (triggers refresh)
            await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });

            // Brief delay for visual feedback completion (ensures pulse completes before refresh)
            await new Promise(r => setTimeout(r, 300));
          } catch (e) {
            console.error('[ISLAND] Tab no longer exists or access denied', e);
            await chrome.runtime.sendMessage({ type: 'END_ISLAND_CREATION' });
          } finally {
            setIsCreatingIsland(false);
            setCreatingTabId(null);
          }
        } else {
          console.error(`[FAILED] Could not resolve Tab ID. Received ID: ${activeId}, Data:`, event.active.data?.current);
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
          let targetItem: any = null;
          let targetIslandId: number | null = null;
          let isMovingGroup = false;

          for (const item of finalIslands) {
            const itemAny = item as any;
            if (itemAny.id == activeId) {
              targetItem = itemAny;
              const island = item as IslandType;
              isMovingGroup = island.tabs !== undefined;
              break;
            }
            if (itemAny.tabs) {
              const nested = itemAny.tabs.find((t: any) => t.id == activeId);
              if (nested) {
                targetItem = nested;
                targetIslandId = itemAny.id;
                browserIndex += itemAny.tabs.indexOf(nested);
                break;
              }
              browserIndex += itemAny.tabs.length;
            } else {
              browserIndex += 1;
            }
          }

          if (targetItem) {
            if (isMovingGroup) {
              // Use moveIsland (chrome.tabGroups.move) to move the entire group atomically.
              // This prevents the group from being ungrouped or split during the move.
              await moveIsland(parseNumericId(targetItem.id), browserIndex);
            } else {
              const tabId = parseNumericId(activeId);
              if (tabId !== -1) {
                await chrome.tabs.move(tabId, { index: browserIndex });
                if (targetIslandId) {
                  const numericIslandId = parseNumericId(targetIslandId);
                  if (numericIslandId !== -1) {
                    await chrome.tabs.group({ tabIds: tabId, groupId: numericIslandId });
                  }
                } else {
                  try { await chrome.tabs.ungroup(tabId); } catch(e) {}
                }
              }
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
            await restoreFromVault(activeId as any);
          }
        } finally {
          setIsLoading(false);
        }
        return;
      }
    } finally {
      // Orchestrate drag-end state and refresh logic
      useStore.getState().setIsUpdating(false);
      await useStore.getState().syncLiveTabs();
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
            deleteDuplicateTabs={deleteDuplicateTabs}
            sortGroupsToTop={sortGroupsToTop}
            showVault={showVault}
            isCreatingIsland={isCreatingIsland}
            creatingTabId={creatingTabId}
          />
          {showVault && (
            <>
              <div onMouseDown={handleMouseDown} className="w-1 bg-gx-gray/30 hover:bg-gx-accent cursor-col-resize transition-all flex items-center justify-center z-50 flex-shrink-0 relative">
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
              />
            </>
          )}
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.1' } } }) }}>
          {activeItem ? (activeItem.type === 'island' ? <Island island={activeItem.island} isOverlay /> : <TabCard tab={activeItem.tab} isOverlay />) : null}
        </DragOverlay>
      </DndContext>
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
