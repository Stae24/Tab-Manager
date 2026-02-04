import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Trash2, Save, LogOut, ExternalLink, Edit3, X, Snowflake, Copy } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TabCard } from './TabCard';
import { cn, getIslandBorderColor, getBorderRadiusClass, getBottomBorderRadiusClass } from '../utils/cn';
import { Island as IslandType, Tab, UniversalId } from '../types/index';
import { ungroupTab, updateTabGroupCollapse, discardTabs, duplicateIsland } from '../utils/chromeApi';
import { useStore, parseNumericId } from '../store/useStore';

interface IslandProps {
  island: IslandType;
  onTabClick?: (tab: Tab) => void;
  onToggleCollapse?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onNonDestructiveSave?: () => void;
  onRestore?: () => void;
  onRename?: (title: string) => void;
  onTabSave?: (tab: Tab) => void;
  onTabRestore?: (tab: Tab) => void;
  onTabClose?: (id: UniversalId) => void;
  isOverlay?: boolean;
  disabled?: boolean;
  isVault?: boolean;
}

export const Island: React.FC<IslandProps> = ({
  island,
  onTabClick,
  onDelete,
  onSave,
  onNonDestructiveSave,
  onRestore,
  onRename,
  onToggleCollapse,
  onTabSave,
  onTabRestore,
  onTabClose,
  isOverlay,
  disabled,
  isVault,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { appearanceSettings, setIsRenaming } = useStore();
  const [editTitle, setEditTitle] = useState(island.title);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const borderColor = getIslandBorderColor(island.color);

  const buttonPadding: Record<string, string> = {
    small: 'p-0.5',
    medium: 'p-1',
    large: 'p-1.5',
  };

  const buttonIconSize: Record<string, number> = {
    small: 12,
    medium: 14,
    large: 16,
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: island.id,
    data: { type: 'island', island },
    disabled: disabled || isEditing, // Disable DnD when editing
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? appearanceSettings.dragOpacity : 1,
    zIndex: isOverlay ? 9999 : undefined,
  };

  const handleRename = () => {
    if (editTitle !== island.title) {
      onRename?.(editTitle.trim());
    }
    setIsEditing(false);
    setIsRenaming(false);
  };

  const handleToggleCollapse = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOverlay) return;

    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const numericId = parseNumericId(island.id);
      if (numericId > 0) {
        updateTabGroupCollapse(numericId, !island.collapsed);
      }
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Start renaming from context menu
  const handleRenameFromMenu = () => {
    setShowMenu(false);
    setEditTitle(island.title);
    setIsEditing(true);
    setIsRenaming(true);
  };

  // Ungroup all tabs
  const handleUngroupAll = () => {
    setShowMenu(false);
    const ids = island.tabs.map(t => parseNumericId(t.id)).filter(id => id !== -1);
    if (ids.length > 0) ungroupTab(ids);
  };

  // Freeze all tabs
  const handleFreezeAll = () => {
    setShowMenu(false);
    const ids = island.tabs.map(t => parseNumericId(t.id)).filter(id => id !== -1);
    if (ids.length > 0) discardTabs(ids);
  };

  // Duplicate group
  const handleDuplicate = () => {
    setShowMenu(false);
    const ids = island.tabs.map(t => parseNumericId(t.id)).filter(id => id !== -1);
    if (ids.length > 0) duplicateIsland(ids);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group transition-all duration-300",
        isOverlay && "z-[9999] scale-105"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "relative flex items-center gap-2 bg-gx-gray/80 border-t-2 border-x-2 border-transparent cursor-grab active:cursor-grabbing",
          getBorderRadiusClass(appearanceSettings.borderRadius),
          appearanceSettings.compactGroupHeaders ? "px-2 py-1" : "px-3 py-2",
          island.collapsed && cn(getBottomBorderRadiusClass(appearanceSettings.borderRadius), "border-b-2 shadow-lg"),
          isOverlay && cn("shadow-2xl ring-2 ring-gx-accent/50 bg-gx-dark border-b-2", getBorderRadiusClass(appearanceSettings.borderRadius))
        )}
        style={{
          borderTopColor: borderColor,
          borderLeftColor: borderColor,
          borderRightColor: borderColor,
          borderBottomColor: (island.collapsed || isOverlay) ? borderColor : 'transparent'
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (isOverlay) return;
          setMenuPosition({ x: e.clientX, y: e.clientY });
          setShowMenu(true);
        }}
      >
        <button
          onClick={handleToggleCollapse}
          className={cn(
            "hover:bg-white/10 rounded pointer-events-auto relative z-10",
            buttonPadding[appearanceSettings.buttonSize]
          )}
        >
          {island.collapsed ? (
            <ChevronRight size={buttonIconSize[appearanceSettings.buttonSize]} />
          ) : (
            <ChevronDown size={buttonIconSize[appearanceSettings.buttonSize]} />
          )}
        </button>
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setEditTitle(island.title);
                setIsEditing(false);
                setIsRenaming(false);
              }
            }}
            autoFocus
            placeholder="Untitled Group"
            className="flex-1 text-sm font-bold bg-black/50 text-white border-none outline-none rounded px-1 relative z-20"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-sm font-bold truncate relative z-10 cursor-text"
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isOverlay && onRename) {
                setEditTitle(island.title);
                setIsEditing(true);
                setIsRenaming(true);
              }
            }}
            title="Double-click to rename"
          >
            {island.title || "Untitled Group"}
            {appearanceSettings.showTabCount && (island.tabs?.length || 0) > 0 && (
              <span className="text-[10px] font-black text-white/30 ml-2 tracking-tighter">
                {island.tabs.length}
              </span>
            )}
          </span>
        )}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto relative z-10">
          {!isVault && !isOverlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const ids = island.tabs.map(t => parseNumericId(t.id)).filter(id => id !== -1);
                if (ids.length > 0) ungroupTab(ids);
              }}
              title="Ungroup All"
              className={buttonPadding[appearanceSettings.buttonSize]}
            >
              <LogOut size={buttonIconSize[appearanceSettings.buttonSize]} className="text-gray-400 hover:text-white" />
            </button>
          )}
          {!isVault && onNonDestructiveSave && (
            <button
              onClick={(e) => { e.stopPropagation(); onNonDestructiveSave(); }}
              title="Save to Vault (Keep Live)"
              className={buttonPadding[appearanceSettings.buttonSize]}
            >
              <Save size={buttonIconSize[appearanceSettings.buttonSize]} className="text-gray-400 hover:text-gx-cyan" />
            </button>
          )}
          {isVault && onRestore && (
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              title="Open in Current Window"
              className={buttonPadding[appearanceSettings.buttonSize]}
            >
              <ExternalLink size={buttonIconSize[appearanceSettings.buttonSize]} className="text-gray-400 hover:text-gx-green" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title={isVault ? "Delete from Vault" : "Delete"}
              className={buttonPadding[appearanceSettings.buttonSize]}
            >
              <Trash2 size={buttonIconSize[appearanceSettings.buttonSize]} className="text-gray-400 hover:text-gx-red" />
            </button>
          )}
        </div>

        {/* Active/Overlay background effect */}
        {isOverlay && (
          <div className="absolute inset-0 bg-gradient-to-r from-gx-accent/10 via-transparent to-gx-red/10 rounded-lg animate-pulse-glow" />
        )}
      </div>

      {/* Context Menu */}
      {showMenu && !isOverlay && (
        <div
          ref={menuRef}
          className="fixed w-36 bg-gx-gray border border-gx-accent/20 rounded shadow-xl z-[1000] p-1 flex flex-col gap-1"
          style={{ left: menuPosition?.x ?? 0, top: menuPosition?.y ?? 0 }}
        >
          <button
            onClick={handleRenameFromMenu}
            className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
          >
            <Edit3 size={10} /> RENAME
          </button>
          <button
            onClick={handleDuplicate}
            className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
          >
            <Copy size={10} /> DUPLICATE GROUP
          </button>
          {!isVault && (
            <>
              <button
                onClick={handleUngroupAll}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-accent/20 rounded"
              >
                <LogOut size={10} /> UNGROUP ALL
              </button>
              <button
                onClick={handleFreezeAll}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
              >
                <Snowflake size={10} /> FREEZE ALL
              </button>
            </>
          )}
          {!isVault && onNonDestructiveSave && (
            <button
              onClick={() => { setShowMenu(false); onNonDestructiveSave(); }}
              className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
            >
              <Save size={10} /> SAVE TO VAULT
            </button>
          )}
          {isVault && onRestore && (
            <button
              onClick={() => { setShowMenu(false); onRestore(); }}
              className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-green/20 hover:text-gx-green rounded"
            >
              <ExternalLink size={10} /> OPEN IN WINDOW
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { setShowMenu(false); onDelete(); }}
              className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-red/20 text-gx-red rounded"
            >
              <Trash2 size={10} /> {isVault ? 'DELETE' : 'DELETE GROUP'}
            </button>
          )}
        </div>
      )}

      {!island.collapsed && !isOverlay && (
        <div
          className={cn(
            "p-2 bg-gx-dark/30 border-x-2 border-b-2 border-transparent shadow-inner min-h-[40px]",
            getBottomBorderRadiusClass(appearanceSettings.borderRadius)
          )}
          style={{ borderColor: `${borderColor}33`, borderBottomColor: borderColor }}
        >
          <div className="space-y-1 relative">
            <SortableContext items={(island.tabs || []).map(t => t.id)} strategy={verticalListSortingStrategy}>
              {(island.tabs || []).map((tab) => (
                <TabCard
                  key={tab.id}
                  tab={tab}
                  onClick={() => onTabClick?.(tab)}
                  disabled={disabled}
                  isVault={isVault}
                  onSave={onTabSave ? () => onTabSave(tab) : undefined}
                  onRestore={onTabRestore ? () => onTabRestore(tab) : undefined}
                  onClose={onTabClose ? () => onTabClose(tab.id) : undefined}
                />
              ))}
            </SortableContext>
          </div>
        </div>
      )}

      {/* When in overlay, show tabs but without context */}
      {isOverlay && !island.collapsed && (
        <div
          className={cn(
            "p-2 bg-gx-dark/30 border-x-2 border-b-2 border-transparent",
            getBottomBorderRadiusClass(appearanceSettings.borderRadius)
          )}
          style={{ borderColor: `${borderColor}33` }}
        >
          <div className="space-y-1">
            {(island.tabs || []).map((tab) => (
              <TabCard
                key={tab.id}
                tab={tab}
                isOverlay
                isVault={isVault}
                onSave={onTabSave ? () => onTabSave(tab) : undefined}
                onRestore={onTabRestore ? () => onTabRestore(tab) : undefined}
                onClose={onTabClose ? () => onTabClose(tab.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
