import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Search,
  Settings,
  Palette,
  ZoomIn,
  Layout,
  Layers,
  Sparkles,
  Cloud,
  Sidebar,
  Terminal,
  Monitor,
  Space,
  GripVertical
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore, defaultAppearanceSettings } from '../store/useStore';
import {
  PANEL_CLOSE_DELAY_MS,
  SETTINGS_PANEL_MIN_WIDTH,
  SETTINGS_PANEL_MAX_WIDTH,
  SETTINGS_PANEL_WINDOW_GAP,
  SETTINGS_HEADER_PADDING_DEFAULT,
  SETTINGS_TABS_PADDING_DEFAULT,
  SETTINGS_TAB_GAP_DEFAULT,
  SETTINGS_CONTENT_PADDING_DEFAULT,
  SETTINGS_SECTION_GAP_DEFAULT,
} from '../constants';

import { ThemeSettings, SETTING_SECTIONS as THEME_SECTIONS } from './ThemeSettings';
import { DisplaySettings, SETTING_SECTIONS as DISPLAY_SECTIONS } from './DisplaySettings';
import { TabSettings, SETTING_SECTIONS as TAB_SECTIONS } from './TabSettings';
import { GroupSettings, SETTING_SECTIONS as GROUP_SECTIONS } from './GroupSettings';
import { VaultSettings, VaultRestorationSettings, SETTING_SECTIONS as VAULT_SECTIONS } from './VaultSettings';
import { GeneralSettings, SETTING_SECTIONS as GENERAL_SECTIONS } from './GeneralSettings';
import { SidebarSettings, SETTING_SECTIONS as SIDEBAR_SECTIONS } from './SidebarSettings';
import { DevSettings, SETTING_SECTIONS as DEV_SECTIONS } from './DevSettings';
import { SpacingSettings, SETTING_SECTIONS as SPACING_SECTIONS } from './SpacingSettings';

export interface SettingControl {
    id: string;
    label: string;
    description?: string;
    keywords?: string[];
}

export interface SettingSection {
    id: string;
    title: string;
    category: string;
    icon: React.ElementType;
    controls?: SettingControl[];
}

export const ALL_SETTING_SECTIONS: SettingSection[] = [
    ...THEME_SECTIONS,
    ...DISPLAY_SECTIONS,
    ...TAB_SECTIONS,
    ...GROUP_SECTIONS,
    ...VAULT_SECTIONS,
    ...GENERAL_SECTIONS,
    ...SIDEBAR_SECTIONS,
    ...SPACING_SECTIONS,
    ...DEV_SECTIONS,
];

type TabId = 'theme' | 'general' | 'display' | 'tabs' | 'groups' | 'vault' | 'advanced' | 'dev' | 'sidebar' | 'spacing';

interface AppearanceSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppearanceSettingsPanel: React.FC<AppearanceSettingsPanelProps> = ({ isOpen, onClose }) => {
  const appearanceSettings = useStore((state) => state.appearanceSettings);
  const setAppearanceSettings = useStore((state) => state.setAppearanceSettings);
  const vaultQuota = useStore((state) => state.vaultQuota);
  const setVaultSyncEnabled = useStore((state) => state.setVaultSyncEnabled);
  const settingsPanelWidth = useStore((state) => state.settingsPanelWidth);
  const setSettingsPanelWidth = useStore((state) => state.setSettingsPanelWidth);

  const blurValue = appearanceSettings.settingsBackgroundBlur ?? 0;
  const opacityValue = appearanceSettings.settingsBackgroundOpacity ?? 0;
  const backdropStyle = blurValue > 0 || opacityValue > 0 
    ? { 
        backgroundColor: `rgba(0, 0, 0, ${opacityValue / 100})`,
        backdropFilter: blurValue > 0 ? `blur(${blurValue}px)` : undefined
      }
    : undefined;

  const [activeTab, setActiveTab] = useState<TabId>('theme');
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(settingsPanelWidth || 400);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [highlightedControl, setHighlightedControl] = useState<{ sectionId: string; controlId: string } | null>(null);
  const highlightTimeoutRef = useRef<number | undefined>(undefined);


  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const panelWidthRef = useRef(panelWidth);
  const priorExpandedRef = useRef<Set<string> | null>(null);
  const expandedSectionsRef = useRef(expandedSections);

  // Keep ref in sync with state
  useEffect(() => {
    expandedSectionsRef.current = expandedSections;
  }, [expandedSections]);

  // Clear highlight after 3 seconds
  useEffect(() => {
    if (highlightedControl) {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedControl(null);
      }, 3000);
    }
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [highlightedControl]);

  // Auto-expand/collapse sections based on search
  useEffect(() => {
    if (searchQuery) {
      // Save current expanded sections before expanding for search
      if (!priorExpandedRef.current) {
        priorExpandedRef.current = expandedSectionsRef.current;
      }
      setExpandedSections(new Set(['theme', 'tab-density', 'favicons', 'active-indicator', 'audio-indicators', 'frozen-indicators', 'group-headers', 'tab-count', 'sort-groups', 'vault-sync', 'animations', 'drag-opacity', 'spinner', 'icons', 'button-size', 'auto-pin', 'search', 'sidebar', 'debug-mode']));
    } else if (priorExpandedRef.current) {
      // Restore prior expanded sections when search is cleared
      setExpandedSections(priorExpandedRef.current);
      priorExpandedRef.current = null;
    }
  }, [searchQuery]);

  const fitPanelToWindow = useCallback(() => {
    if (typeof window === 'undefined') return;
    const maxWidth = window.innerWidth - SETTINGS_PANEL_WINDOW_GAP;
    setPanelWidth(prev => Math.min(prev, maxWidth));

  }, []);

  useEffect(() => {
    fitPanelToWindow();
  }, [fitPanelToWindow]);

  const handleWindowResize = useCallback(() => {
    fitPanelToWindow();
  }, [fitPanelToWindow]);

  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [handleWindowResize]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;

      const newWidth = window.innerWidth - moveEvent.clientX;
      const constrainedWidth = Math.min(
        Math.max(newWidth, SETTINGS_PANEL_MIN_WIDTH),
        SETTINGS_PANEL_MAX_WIDTH,
        window.innerWidth - SETTINGS_PANEL_WINDOW_GAP
      );

      setPanelWidth(constrainedWidth);
      panelWidthRef.current = constrainedWidth;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      isResizingRef.current = false;
      setSettingsPanelWidth(panelWidthRef.current);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleSection = (id: string) => {
    const newSections = new Set(expandedSections);
    if (newSections.has(id)) {
      newSections.delete(id);
    } else {
      newSections.add(id);
    }
    setExpandedSections(newSections);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, PANEL_CLOSE_DELAY_MS);
  };

  const filterSettings = (category: string) => {
    if (!searchQuery) return true;
    return category.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const searchMatchesControl = (section: SettingSection): SettingControl[] => {
    if (!searchQuery || !section.controls) return [];
    const query = searchQuery.toLowerCase();
    return section.controls.filter(control => {
      if (control.label.toLowerCase().includes(query)) return true;
      if (control.description?.toLowerCase().includes(query)) return true;
      if (control.keywords?.some(kw => kw.toLowerCase().includes(query))) return true;
      return false;
    });
  };

  const searchMatchesSection = (section: SettingSection): boolean => {
    if (!searchQuery) return false;
    const query = searchQuery.toLowerCase();
    if (section.title.toLowerCase().includes(query) || section.category.toLowerCase().includes(query)) return true;
    const matchingControls = searchMatchesControl(section);
    return matchingControls.length > 0;
  };

  const getMatchingControls = (section: SettingSection) => {
    return searchMatchesControl(section);
  };

  const rawTabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'theme' as TabId, label: 'Theme', icon: Palette },
    { id: 'display' as TabId, label: 'Display', icon: Monitor },
    { id: 'tabs' as TabId, label: 'Tabs', icon: Layout },
    { id: 'groups' as TabId, label: 'Groups', icon: Layers },
    { id: 'vault' as TabId, label: 'Vault', icon: Cloud },
    { id: 'general' as TabId, label: 'General', icon: Settings },
    { id: 'sidebar' as TabId, label: 'Sidebar', icon: Sidebar },
    { id: 'spacing' as TabId, label: 'Spacing', icon: Space },
    { id: 'dev' as TabId, label: 'Developer', icon: Terminal },
  ];

  const matchingSections = searchQuery
    ? ALL_SETTING_SECTIONS.filter(searchMatchesSection)
    : [];

  const matchingControls: (SettingControl & { sectionId: string; sectionTitle: string; category: string; icon: React.ElementType })[] = searchQuery
    ? ALL_SETTING_SECTIONS.flatMap(section => {
        const matched = searchMatchesControl(section);
        return matched.map(control => ({ ...control, sectionId: section.id, sectionTitle: section.title, category: section.category, icon: section.icon }));
      })
    : [];

  const matchingCategories = searchQuery
    ? rawTabs.filter(tab => tab.label.toLowerCase().includes(searchQuery.toLowerCase())).map(tab => tab.id)
    : [];

  const tabs = rawTabs.filter(tab => filterSettings(tab.label));

  if (!isOpen && !isClosing) return null;

  const renderTabButton = (tab: { id: TabId; label: string; icon: React.ElementType }) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-bold tracking-wider whitespace-nowrap",
        activeTab === tab.id
          ? "bg-gx-accent/10 text-gx-accent border border-gx-accent/30"
          : "text-gx-muted hover:text-gx-text hover:bg-gx-hover border border-transparent"
      )}
    >
      <tab.icon size={14} />
      <span className="uppercase">{tab.label}</span>
    </button>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={backdropStyle}
        onClick={(e) => {
          if (panelRef.current?.contains(e.target as Node)) {
            return;
          }
          const dropdownPortals = document.querySelectorAll('[data-dropdown-portal]');
          for (const portal of dropdownPortals) {
            if (portal.contains(e.target as Node)) {
              return;
            }
          }
          handleClose();
        }}
      />

      {/* Slide-over Panel with resize handle */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "fixed right-0 top-0 bg-gx-gray/95 border-l border-gx-gray z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl",
          isClosing && "transition-transform duration-200"
        )}
        style={{
          width: `${panelWidth}px`,
          transform: isOpen
            ? `scale(${appearanceSettings.settingsScale})`
            : `scale(${appearanceSettings.settingsScale}) translateX(100%)`,
          transformOrigin: 'top right',
          height: `${100 / appearanceSettings.settingsScale}%`
        }}
      >
        {/* Resize handle on the left edge */}
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            "absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize z-[60] transition-all flex items-center justify-center",
            isResizing && "bg-gx-accent"
          )}
        >
          <GripVertical className={cn("w-4 h-4 text-gx-gray transition-colors", isResizing && "text-gx-text")} />
        </div>

        <div 
          className="flex items-center border-b border-gx-gray bg-gx-gray/50"
          style={{ gap: 12, padding: appearanceSettings.settingsHeaderPadding ?? SETTINGS_HEADER_PADDING_DEFAULT }}
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gx-accent to-gx-red flex items-center justify-center shadow-lg shadow-gx-accent/30 flex-shrink-0">
            <Settings className="w-5 h-5 text-gx-text" />
          </div>

          <div className="flex-1 relative group">
            <Search className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
              searchQuery ? "text-gx-accent" : "text-gx-muted group-focus-within:text-gx-accent"
            )} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className={cn(
                "w-full pl-10 pr-10 py-2.5 bg-gx-gray/50 border border-gx-border rounded-lg text-sm text-gx-text placeholder-gx-subtle outline-none transition-all",
                "focus:border-gx-accent/40 focus:ring-1 focus:ring-gx-accent/20"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gx-red/20 rounded transition-all"
              >
                <X size={12} className="text-gx-muted hover:text-gx-red" />
              </button>
            )}
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gx-red/20 text-gx-muted hover:text-gx-red transition-all flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Responsive Tabs Section */}
        {!searchQuery && (
          <div 
            className="border-b border-gx-gray bg-gx-gray/30"
            style={{ padding: appearanceSettings.settingsTabsPadding ?? SETTINGS_TABS_PADDING_DEFAULT }}
          >
            <div 
              className="flex flex-wrap justify-center"
              style={{ gap: appearanceSettings.settingsTabGap ?? SETTINGS_TAB_GAP_DEFAULT }}
            >
              {tabs.map(renderTabButton)}
            </div>
          </div>
        )}

        {/* Settings Content */}
        <div 
          className="flex-1 overflow-y-auto scroll-smooth overscroll-none scrollbar-hide"
          style={{ 
            padding: appearanceSettings.settingsContentPadding ?? SETTINGS_CONTENT_PADDING_DEFAULT,
            display: 'flex',
            flexDirection: 'column',
            gap: appearanceSettings.settingsSectionGap ?? SETTINGS_SECTION_GAP_DEFAULT
          }}
        >
          {searchQuery ? (
            <>
              {matchingSections.length > 0 || matchingCategories.length > 0 || matchingControls.length > 0 ? (
                <div>
                  {matchingCategories.length > 0 && (
                    <>
                      <div className="text-xs text-gx-muted font-bold uppercase tracking-wider mb-2">
                        Categories
                      </div>
                      {matchingCategories.map((cat) => {
                        const tab = rawTabs.find(t => t.id === cat);
                        if (!tab) return null;
                        return (
                          <button
                            key={cat}
                            onClick={() => {
                              setSearchQuery('');
                              setActiveTab(cat);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gx-border bg-gx-gray/30 hover:border-gx-accent/30 hover:bg-gx-gray/50 transition-all text-left"
                          >
                            <tab.icon size={16} className="text-gx-accent" />
                            <span className="text-sm font-bold text-gx-text">{tab.label}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {matchingControls.length > 0 && (
                    <>
                      <div className="text-xs text-gx-muted font-bold uppercase tracking-wider mb-2 mt-4">
                        Controls ({matchingControls.length})
                      </div>
                      {matchingControls.map((control) => {
                        const categoryToTab: Record<string, TabId> = {
                          theme: 'theme',
                          display: 'display',
                          tabs: 'tabs',
                          groups: 'groups',
                          vault: 'vault',
                          general: 'general',
                          sidebar: 'sidebar',
                          dev: 'dev',
                        };
                        return (
                          <button
                            key={`${control.sectionId}-${control.id}`}
                            onClick={() => {
                              const tabId = categoryToTab[control.category] || 'theme';
                              setSearchQuery('');
                              setActiveTab(tabId);
                              setExpandedSections((prev) => new Set([...prev, control.sectionId]));
                              setHighlightedControl({ sectionId: control.sectionId, controlId: control.id });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gx-border bg-gx-gray/30 hover:border-gx-accent/30 hover:bg-gx-gray/50 transition-all text-left"
                          >
                            <control.icon size={16} className="text-gx-accent" />
                            <div className="flex-1">
                              <span className="text-sm font-bold text-gx-text block">{control.label}</span>
                              <span className="text-[10px] text-gx-muted">{control.sectionTitle}</span>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {matchingSections.length > 0 && (
                    <>
                      <div className="text-xs text-gx-muted font-bold uppercase tracking-wider mb-2 mt-4">
                        Sections ({matchingSections.length})
                      </div>
                      {matchingSections.map((section) => {
                        const categoryToTab: Record<string, TabId> = {
                          theme: 'theme',
                          display: 'display',
                          tabs: 'tabs',
                          groups: 'groups',
                          vault: 'vault',
                          general: 'general',
                          sidebar: 'sidebar',
                          dev: 'dev',
                        };
                        return (
                          <button
                            key={section.id}
                            onClick={() => {
                              setSearchQuery('');
                              setActiveTab(categoryToTab[section.category] || 'theme');
                              setExpandedSections((prev) => new Set([...prev, section.id]));
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gx-border bg-gx-gray/30 hover:border-gx-accent/30 hover:bg-gx-gray/50 transition-all text-left"
                          >
                            <section.icon size={16} className="text-gx-accent" />
                            <div className="flex-1">
                              <span className="text-sm font-bold text-gx-text block">{section.title}</span>
                              <span className="text-[10px] text-gx-muted uppercase">{section.category}</span>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search size={32} className="mx-auto text-gx-subtle mb-2" />
                  <p className="text-sm text-gx-muted">No settings found for "{searchQuery}"</p>
                </div>
              )}
            </>
          ) : (
            <>
              {activeTab === 'theme' && filterSettings('Theme') && (
                <ThemeSettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}

              {activeTab === 'display' && filterSettings('Display') && (
                <DisplaySettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}

              {activeTab === 'tabs' && filterSettings('Tabs') && (
                <TabSettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}

              {activeTab === 'groups' && filterSettings('Groups') && (
                <GroupSettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}

              {activeTab === 'vault' && filterSettings('Vault') && (
                <>
                  <VaultSettings
                    appearanceSettings={appearanceSettings}
                    setAppearanceSettings={setAppearanceSettings}
                    setVaultSyncEnabled={setVaultSyncEnabled}
                    vaultQuota={vaultQuota}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    highlightedControl={highlightedControl}
                  />
                  <VaultRestorationSettings
                    appearanceSettings={appearanceSettings}
                    setAppearanceSettings={setAppearanceSettings}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    highlightedControl={highlightedControl}
                  />
                </>
              )}

              {activeTab === 'general' && filterSettings('General') && (
                <GeneralSettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}

              {activeTab === 'sidebar' && filterSettings('Sidebar') && (
                <SidebarSettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}

              {activeTab === 'spacing' && filterSettings('Spacing') && (
                <SpacingSettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}

              {activeTab === 'dev' && filterSettings('Dev') && (
                <DevSettings
                  appearanceSettings={appearanceSettings}
                  setAppearanceSettings={setAppearanceSettings}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  highlightedControl={highlightedControl}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gx-gray bg-gx-gray/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gx-green animate-pulse" />
              <span className="text-[10px] text-gray-500 font-mono">
                Settings auto-saved
              </span>
            </div>
            <button
              onClick={() => setAppearanceSettings({ ...defaultAppearanceSettings })}
              className="text-[10px] font-bold text-gray-500 hover:text-gx-red transition-all uppercase tracking-wider"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
