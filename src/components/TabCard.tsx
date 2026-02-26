import React, { useState, useEffect, useRef } from 'react';
import { Snowflake, LogOut, Trash2, X, Save, ExternalLink, Loader2, Link, Volume2, VolumeX, Copy, CopyPlus, Speaker, ArrowDownToLine } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn, getBorderRadiusClass } from '../utils/cn';
import { tabService } from '../services/tabService';
import { parseNumericId, isIsland, useStore } from '../store/useStore';
import { Favicon } from './Favicon';
import { useScrollContainer } from '../contexts/ScrollContainerContext';
import { ContextMenu } from './ContextMenu';
import { INTERSECTION_OBSERVER_MARGIN_PX, TAB_LOAD_DELAY_BASE_MS } from '../constants';
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

interface NavigatorWithConnection extends Navigator {
  connection?: {
    saveData: boolean;
  };
}

export const TabCard: React.FC<TabCardProps> = React.memo(({ tab, onClick, onClose, onSave, onRestore, isOverlay, disabled, isVault, isLoading }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [priority, setPriority] = useState<number | null>(null);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const { appearanceSettings, islands, vault, removeFromVault } = useStore();

  const tabsBelow = React.useMemo(() => {
    const items = isVault ? vault : islands;
    if (!items) return [];
    const allTabs = items.flatMap((item) => (isIsland(item) ? item.tabs : [item]));
    return allTabs.filter(
      (t) => t.index > tab.index && t.windowId === tab.windowId && String(t.id) !== String(tab.id)
    );
  }, [isVault, vault, islands, tab.index, tab.windowId, tab.id]);

  const tabsBelowCount = tabsBelow.length;
  const { containerRef } = useScrollContainer();

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

  const buttonPadding: Record<string, string> = {
    small: 'p-1',
    medium: 'p-1.5',
    large: 'p-2',
  };

  const buttonIconSize: Record<string, number> = {
    small: 14,
    medium: 16,
    large: 18,
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? appearanceSettings.dragOpacity : 1,
    zIndex: isOverlay ? 9999 : undefined,
  };

  useEffect(() => {
    if (isOverlay || !appearanceSettings.showFavicons) {
      setPriority(0);
      setHasStartedLoading(true);
      return;
    }

    const visibleObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setPriority(0);
      }
    }, {
      threshold: 0.01,
      root: containerRef?.current || null
    });

    const nearObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const rect = entry.boundingClientRect;
        const viewportHeight = window.innerHeight;
        let distance = 0;
        if (rect.top > viewportHeight) {
          distance = rect.top - viewportHeight;
        } else if (rect.bottom < 0) {
          distance = Math.abs(rect.bottom);
        }
        const p = Math.ceil(distance / 100);
        setPriority(prev => (prev === 0 ? 0 : p));
      }
    }, {
      rootMargin: `${INTERSECTION_OBSERVER_MARGIN_PX}px`,
      root: containerRef?.current || null
    });

    if (cardRef.current) {
      visibleObserver.observe(cardRef.current);
      nearObserver.observe(cardRef.current);
    }

    return () => {
      visibleObserver.disconnect();
      nearObserver.disconnect();
    };
  }, [isOverlay, appearanceSettings.showFavicons]);

  useEffect(() => {
    if (priority === 0) {
      setHasStartedLoading(true);
    } else if (priority !== null && priority > 0) {
      const isDataSaver = (navigator as NavigatorWithConnection).connection?.saveData === true;
      if (isDataSaver) return;

      const timer = setTimeout(() => {
        setHasStartedLoading(true);
      }, priority * TAB_LOAD_DELAY_BASE_MS);
      return () => clearTimeout(timer);
    }
  }, [priority]);

  // Calculate menu position - use mouse position directly
  const calculateMenuPosition = (clientX: number, clientY: number) => {
    // clientX and clientY are already viewport coordinates in CSS pixels
    // No adjustment needed for fixed positioning
    return { x: clientX, y: clientY };
  };

  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    cardRef.current = node;
  };

  return (
    <div className="relative" ref={combinedRef} style={style}>

      <div
        {...listeners}
        {...attributes}
        className={cn(
          `group relative flex items-center gap-2 transition-all cursor-grab active:cursor-grabbing touch-none`,
          getBorderRadiusClass(appearanceSettings.borderRadius),
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
          setMenuPosition(calculateMenuPosition(e.clientX, e.clientY));
          setShowMenu(true);
        }}
      >
        {/* Glow background for active/drag state */}
        {isOverlay && (
          <div className={cn(
            "absolute inset-0 bg-gradient-to-r from-gx-accent/10 via-transparent to-gx-red/10 animate-pulse-glow",
            getBorderRadiusClass(appearanceSettings.borderRadius)
          )} />
        )}

        {/* Loading state - absorption animation */}
        {isLoading && !isOverlay && (
          <>
            <div className={cn(
              "absolute inset-0 bg-gx-cyan/5 animate-pulse-glow",
              getBorderRadiusClass(appearanceSettings.borderRadius)
            )} />
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <Loader2 className="w-4 h-4 text-gx-cyan animate-spin" />
            </div>
          </>
        )}

        {appearanceSettings.showFavicons && (
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center relative z-10">
            {hasStartedLoading ? (
              <Favicon src={tab.favicon} url={tab.url} className="w-4 h-4 pointer-events-none" source={appearanceSettings.faviconSource} fallback={appearanceSettings.faviconFallback} size={appearanceSettings.faviconSize} />
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>
        )}
        <span className="flex-1 text-xs font-medium truncate pointer-events-none relative z-10">{tab.title}</span>
        {tab.discarded && appearanceSettings.showFrozenIndicators && <Snowflake size={14} className="text-blue-400 relative z-10 mr-1" />}
        {appearanceSettings.showAudioIndicators !== 'off' && (
          <>
            {tab.muted && (appearanceSettings.showAudioIndicators === 'muted' || appearanceSettings.showAudioIndicators === 'both') ? (
              <VolumeX size={14} className="text-orange-400 relative z-10 mr-1" />
            ) : tab.audible && (appearanceSettings.showAudioIndicators === 'playing' || appearanceSettings.showAudioIndicators === 'both') ? (
              <Speaker size={14} className="text-green-400 relative z-10 mr-1 animate-pulse" />
            ) : null}
          </>
        )}

        {/* Action Buttons - visible on hover */}
        {!isOverlay && (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity relative z-20">
            {!isVault && onSave && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                className={cn(
                  "rounded-lg hover:bg-gx-cyan/20 text-gray-500 hover:text-gx-cyan transition-all group/save",
                  buttonPadding[appearanceSettings.buttonSize]
                )}
                title="Save to Vault"
              >
                <Save size={buttonIconSize[appearanceSettings.buttonSize]} className="group-hover/save:scale-110 transition-transform" />
              </button>
            )}
            {isVault && onRestore && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                className={cn(
                  "rounded-lg hover:bg-gx-green/20 text-gray-500 hover:text-gx-green transition-all group/restore",
                  buttonPadding[appearanceSettings.buttonSize]
                )}
                title="Open in Window"
              >
                <ExternalLink size={buttonIconSize[appearanceSettings.buttonSize]} className="group-hover/restore:scale-110 transition-transform" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onClose) onClose();
                else {
                  const numericId = parseNumericId(tab.id);
                  if (numericId !== null) tabService.closeTab(numericId);
                }
              }}
              className={cn(
                "rounded-lg hover:bg-gx-red/20 text-gray-500 hover:text-gx-red transition-all group/close",
                buttonPadding[appearanceSettings.buttonSize]
              )}
              title={isVault ? "Delete from Vault" : "Close Tab"}
            >
              <X size={buttonIconSize[appearanceSettings.buttonSize]} className="group-hover/close:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {/* Active tab indicator */}
        {tab.active && appearanceSettings.showActiveIndicator && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-gx-accent rounded-r-full shadow-[0_0_8px_#7f22fe] z-20" />
        )}
      </div>

      <ContextMenu
        show={showMenu && !isOverlay}
        x={menuPosition?.x ?? 0}
        y={menuPosition?.y ?? 0}
        onClose={() => setShowMenu(false)}
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
                if (numericId !== null) tabService.discardTab(numericId);
                setShowMenu(false);
              }}
              className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-accent/20 rounded"
            >
              <Snowflake size={10} /> FREEZE
            </button>
            <button
              onClick={() => {
                const numericId = parseNumericId(tab.id);
                if (numericId !== null) tabService.ungroupTab(numericId);
                setShowMenu(false);
              }}
              className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-accent/20 rounded"
            >
              <LogOut size={10} /> UNGROUP
            </button>
            <button
              onClick={() => {
                const numericId = parseNumericId(tab.id);
                if (numericId !== null) {
                  if (tab.pinned) tabService.unpinTab(numericId);
                  else tabService.pinTab(numericId);
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
                if (numericId !== null) {
                  if (tab.muted) tabService.unmuteTab(numericId);
                  else tabService.muteTab(numericId);
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
                if (numericId !== null) tabService.duplicateTab(numericId);
                setShowMenu(false);
              }}
              className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
            >
              <CopyPlus size={10} /> DUPLICATE
            </button>
            <button
              onClick={() => {
                const numericId = parseNumericId(tab.id);
                if (numericId !== null) tabService.copyTabUrl(numericId);
                setShowMenu(false);
              }}
              className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-cyan/20 hover:text-gx-cyan rounded"
            >
              <Copy size={10} /> COPY URL
            </button>
            <button
              onClick={() => {
                const ids = tabsBelow.map((t) => parseNumericId(t.id)).filter((id): id is number => id !== null);
                if (ids.length > 0) tabService.closeTabs(ids);
                setShowMenu(false);
              }}
              disabled={tabsBelowCount === 0}
              className={cn(
                "flex items-center gap-2 px-2 py-1 text-[10px] rounded",
                tabsBelowCount === 0 ? "text-gray-400" : "hover:bg-gx-red/20 text-gx-red"
              )}
            >
              <ArrowDownToLine size={10} /> CLOSE TABS BELOW ({tabsBelowCount})
            </button>
          </>
        )}
        {isVault && onRestore && (
          <button onClick={() => { onRestore(); setShowMenu(false); }} className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-green/20 hover:text-gx-green rounded">
            <ExternalLink size={10} /> OPEN IN WINDOW
          </button>
        )}
        {isVault && (
          <button
            onClick={() => {
              const ids = tabsBelow.map((t) => t.id);
              ids.forEach((id) => removeFromVault(id));
              setShowMenu(false);
            }}
            disabled={tabsBelowCount === 0}
            className={cn(
              "flex items-center gap-2 px-2 py-1 text-[10px] rounded",
              tabsBelowCount === 0 ? "text-gray-400 cursor-not-allowed" : "hover:bg-gx-red/20 text-gx-red"
            )}
          >
            <ArrowDownToLine size={10} /> DELETE TABS BELOW ({tabsBelowCount})
          </button>
        )}
        <button
          onClick={() => {
            if (onClose) onClose();
            else {
              const numericId = parseNumericId(tab.id);
              if (numericId !== null) tabService.closeTab(numericId);
            }
            setShowMenu(false);
          }}
          className="flex items-center gap-2 px-2 py-1 text-[10px] hover:bg-gx-red/20 text-gx-red rounded"
        >
          <Trash2 size={10} /> {isVault ? 'DELETE' : 'CLOSE'}
        </button>
      </ContextMenu>
    </div>
  );
});
