import React, { useState, useEffect, useRef } from 'react';
import { Snowflake, LogOut, Trash2, X, Save, ExternalLink, Loader2, Link, Volume2, VolumeX, Copy, CopyPlus, Speaker } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../utils/cn';
import { discardTab, ungroupTab, closeTab, copyTabUrl, muteTab, unmuteTab, pinTab, unpinTab, duplicateTab } from '../utils/chromeApi';
import { parseNumericId, useStore } from '../store/useStore';
import type { Tab } from '../types/index';

interface TabCardProps {
  tab: Tab;
  onClick?: () => void;
  onClose?: () => void;
  onSave?: () => void;
  onRestore?: () => void;
  isOverlay?: boolean;
  disabled?: boolean;
  isVault?: boolean;
  isLoading?: boolean;
}

export const TabCard: React.FC<TabCardProps> = ({ tab, onClick, onClose, onSave, onRestore, isOverlay, disabled, isVault, isLoading }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { appearanceSettings } = useStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tab.id,
    data: { type: 'tab', tab },
    disabled,
  });

  // Density classes mapping
  const densityClasses: Record<string, string> = {
    minified: 'py-0 px-1',
    compact: 'py-1 px-2 text-[9px]',
    normal: 'py-2 px-3 text-xs',
    spacious: 'py-3 px-4 text-sm',
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.2 : 1, // Make original very faint or 0
    zIndex: isOverlay ? 9999 : undefined,
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

  return (
    <div className="relative" ref={setNodeRef} style={style}>
      <div
        {...listeners}
        {...attributes}
        className={cn(
          `group relative flex items-center gap-2 rounded-lg transition-all cursor-grab active:cursor-grabbing touch-none`,
          densityClasses[appearanceSettings.tabDensity],
          'bg-gx-gray border border-white/5',
          tab.active && 'bg-gx-accent/10 border-gx-accent/40 shadow-[0_0_15px_rgba(127,34,254,0.15)]',
          tab.discarded && 'opacity-60 grayscale-[0.3]',
          isOverlay && 'shadow-2xl scale-105 border-gx-accent opacity-100 ring-2 ring-gx-accent/50 z-[9999] bg-gx-dark/90',
          !isOverlay && 'hover:border-gx-accent/30 hover:bg-gx-gray/80',
          isLoading && !isOverlay && 'border-gx-cyan/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse-glow cursor-not-allowed opacity-90'
        )}
        onClick={(e) => {
          if (isDragging || isOverlay) return;
          onClick?.();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (isOverlay) return;
          setMenuPosition({ x: e.clientX, y: e.clientY });
          setShowMenu(true);
        }}
      >
        {/* Glow background for active/drag state */}
        {isOverlay && (
          <div className="absolute inset-0 bg-gradient-to-r from-gx-accent/10 via-transparent to-gx-red/10 rounded-lg animate-pulse-glow" />
        )}

        {/* Loading state - absorption animation */}
        {isLoading && !isOverlay && (
          <>
            <div className="absolute inset-0 bg-gx-cyan/5 rounded-lg animate-pulse-glow" />
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <Loader2 className="w-4 h-4 text-gx-cyan animate-spin" />
            </div>
          </>
        )}

        {tab.favicon && <img src={tab.favicon} alt="" className="w-4 h-4 pointer-events-none relative z-10" />}
        <span className="flex-1 text-xs font-medium truncate pointer-events-none relative z-10">{tab.title}</span>
        {tab.discarded && <Snowflake size={14} className="text-blue-400 relative z-10 mr-1" />}
        {tab.muted ? (
          <VolumeX size={14} className="text-orange-400 relative z-10 mr-1" />
        ) : tab.audible ? (
          <Speaker size={14} className="text-green-400 relative z-10 mr-1 animate-pulse" />
        ) : null}

        {/* Action Buttons - visible on hover */}
        {!isOverlay && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity relative z-20">
            {!isVault && onSave && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                className="p-1.5 rounded-lg hover:bg-gx-cyan/20 text-gray-500 hover:text-gx-cyan transition-all group/save"
                title="Save to Vault"
              >
                <Save size={16} className="group-hover/save:scale-110 transition-transform" />
              </button>
            )}
            {isVault && onRestore && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                className="p-1.5 rounded-lg hover:bg-gx-green/20 text-gray-500 hover:text-gx-green transition-all group/restore"
                title="Open in Window"
              >
                <ExternalLink size={16} className="group-hover/restore:scale-110 transition-transform" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onClose) onClose();
                else {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== -1) closeTab(numericId);
                }
              }}
              className="p-1.5 rounded-lg hover:bg-gx-red/20 text-gray-500 hover:text-gx-red transition-all group/close"
              title={isVault ? "Delete from Vault" : "Close Tab"}
            >
              <X size={16} className="group-hover/close:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {/* Active tab indicator */}
        {tab.active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-gx-accent rounded-r-full shadow-[0_0_8px_#7f22fe] z-20" />
        )}
      </div>

      {showMenu && !isOverlay && (
        <div
          ref={menuRef}
          className="fixed w-36 bg-gx-gray border border-gx-accent/20 rounded shadow-xl z-[1000] p-1 flex flex-col gap-1"
          style={{ left: menuPosition?.x ?? 0, top: menuPosition?.y ?? 0 }}
        >
          {!isVault && onSave && (
            <button onClick={() => { onSave(); setShowMenu(false); }} className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded">
              <Save size={10} /> SAVE TO VAULT
            </button>
          )}
          {!isVault && (
            <>
              <button
                onClick={() => {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== -1) discardTab(numericId);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-accent/20 rounded"
              >
                <Snowflake size={10} /> FREEZE
              </button>
              <button
                onClick={() => {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== -1) ungroupTab(numericId);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-accent/20 rounded"
              >
                <LogOut size={10} /> UNGROUP
              </button>
              <button
                onClick={() => {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== -1) {
                    if (tab.pinned) unpinTab(numericId);
                    else pinTab(numericId);
                  }
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
              >
                <Link size={10} /> {tab.pinned ? 'UNPIN' : 'PIN'}
              </button>
              <button
                onClick={() => {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== -1) {
                    if (tab.muted) unmuteTab(numericId);
                    else muteTab(numericId);
                  }
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
              >
                {tab.muted ? <Volume2 size={10} /> : <VolumeX size={10} />} {tab.muted ? 'UNMUTE' : 'MUTE'}
              </button>
              <button
                onClick={() => {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== -1) duplicateTab(numericId);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
              >
                <CopyPlus size={10} /> DUPLICATE
              </button>
              <button
                onClick={() => {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== -1) copyTabUrl(numericId);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
              >
                <Copy size={10} /> COPY URL
              </button>
            </>
          )}
          {isVault && onRestore && (
            <button onClick={() => { onRestore(); setShowMenu(false); }} className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-green/20 hover:text-gx-green rounded">
              <ExternalLink size={10} /> OPEN IN WINDOW
            </button>
          )}
          <button
            onClick={() => {
              if (onClose) onClose();
              else {
                const numericId = parseNumericId(tab.id);
                if (numericId !== -1) closeTab(numericId);
              }
              setShowMenu(false);
            }}
            className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-red/20 text-gx-red rounded"
          >
            <Trash2 size={10} /> {isVault ? 'DELETE' : 'CLOSE'}
          </button>
        </div>
      )}
    </div>
  );
};
