import React from 'react';
import { Sidebar, Box, Maximize2, Layout, PanelLeft, PanelRight } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Slider } from './ui/Slider';
import {
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH_PCT_MIN,
    SIDEBAR_MAX_WIDTH_PCT_MAX,
    SIDEBAR_DEFAULT_WIDTH
} from '../constants';
import { formatHotkey } from '../utils/hotkeys';
import type { AppearanceSettings, ToolbarClickAction, SidebarLayoutMode, SidebarDockSide } from '../types';

interface SidebarSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
}

export const SidebarSettings: React.FC<SidebarSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection
}) => {
    return (
        <>
            <CollapsibleSection
                id="sidebar"
                title="Custom Sidebar"
                icon={Sidebar}
                isExpanded={expandedSections.has('sidebar')}
                onToggle={() => toggleSection('sidebar')}
            >
                <div className="space-y-4">
                    <Dropdown
                        value={appearanceSettings.toolbarClickAction}
                        onChange={(value) => setAppearanceSettings({ toolbarClickAction: value as ToolbarClickAction })}
                        options={[
                            { value: 'toggle-sidebar', label: 'Toggle Sidebar', icon: Sidebar },
                            { value: 'open-manager-page', label: 'Open Manager Page', icon: Box },
                        ]}
                        label="Toolbar Click Action"
                    />

                    <Dropdown
                        value={appearanceSettings.sidebarLayoutMode}
                        onChange={(value) => setAppearanceSettings({ sidebarLayoutMode: value as SidebarLayoutMode })}
                        options={[
                            { value: 'overlay', label: 'Overlay (on top)', icon: Maximize2 },
                            { value: 'push', label: 'Push (move page)', icon: Layout },
                        ]}
                        label="Layout Mode"
                    />

                    <Dropdown
                        value={appearanceSettings.sidebarDockSide}
                        onChange={(value) => setAppearanceSettings({ sidebarDockSide: value as SidebarDockSide })}
                        options={[
                            { value: 'left', label: 'Left Side', icon: PanelLeft },
                            { value: 'right', label: 'Right Side', icon: PanelRight },
                        ]}
                        label="Dock Side"
                    />

                    <Slider
                        value={appearanceSettings.sidebarWidthPx}
                        onChange={(value) => setAppearanceSettings({ sidebarWidthPx: value })}
                        min={SIDEBAR_MIN_WIDTH}
                        max={typeof window !== 'undefined' ? Math.floor(window.innerWidth * (appearanceSettings.sidebarWidthMaxPct / 100)) : 1920}
                        step={10}
                        label="Sidebar Width"
                        displayValue={`${appearanceSettings.sidebarWidthPx}px`}
                    />

                    <Slider
                        value={appearanceSettings.sidebarWidthMaxPct}
                        onChange={(value) => setAppearanceSettings({ sidebarWidthMaxPct: value })}
                        min={SIDEBAR_MAX_WIDTH_PCT_MIN}
                        max={SIDEBAR_MAX_WIDTH_PCT_MAX}
                        step={1}
                        label="Max Width"
                        displayValue={`${appearanceSettings.sidebarWidthMaxPct}%`}
                    />

                    <div className="space-y-2">
                        <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">Sidebar Toggle Hotkey</span>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2.5 bg-gx-gray border border-white/5 rounded-lg">
                                <span className="text-xs text-gray-200 font-mono">
                                    {formatHotkey(appearanceSettings.sidebarToggleHotkey)}
                                </span>
                            </div>
                            <button
                                onClick={() => setAppearanceSettings({ sidebarWidthPx: SIDEBAR_DEFAULT_WIDTH })}
                                className="px-3 py-2 text-[10px] text-gray-500 hover:text-gx-red transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">Manager Page Hotkey</span>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2.5 bg-gx-gray border border-white/5 rounded-lg">
                                <span className="text-xs text-gray-200 font-mono">
                                    {formatHotkey(appearanceSettings.managerPageHotkey)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>
        </>
    );
};
