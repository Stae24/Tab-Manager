import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, Box, Maximize2, Layout, PanelLeft, PanelRight, PanelTop } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Slider } from './ui/Slider';
import {
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH_PCT_MIN,
    SIDEBAR_MAX_WIDTH_PCT_MAX,
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_MAX_WIDTH_PCT_DEFAULT,
    PANEL_PADDING_MIN,
    PANEL_PADDING_MAX,
    PANEL_PADDING_STEP,
    SIDEBAR_PANEL_PADDING_DEFAULT,
    MANAGER_PANEL_PADDING_DEFAULT
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
    const sidebarWidthMaxPct = appearanceSettings.sidebarWidthMaxPct ?? SIDEBAR_MAX_WIDTH_PCT_DEFAULT;
    const [sidebarMaxPx, setSidebarMaxPx] = useState(() =>
        typeof window !== 'undefined' ? Math.floor(window.innerWidth * (sidebarWidthMaxPct / 100)) : 1920
    );

    useEffect(() => {
        const handleResize = () => {
            const newMax = Math.floor(window.innerWidth * (sidebarWidthMaxPct / 100));
            setSidebarMaxPx(newMax);

            // Clamp sidebarWidthPx if needed
            if (appearanceSettings.sidebarWidthPx > newMax) {
                setAppearanceSettings({ sidebarWidthPx: newMax });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [sidebarWidthMaxPct, appearanceSettings.sidebarWidthPx, setAppearanceSettings]);

    // Also clamp when sidebarWidthMaxPct changes
    useEffect(() => {
        const newMax = Math.floor((typeof window !== 'undefined' ? window.innerWidth : 1920) * (sidebarWidthMaxPct / 100));
        if (appearanceSettings.sidebarWidthPx > newMax) {
            setAppearanceSettings({ sidebarWidthPx: newMax });
        }
    }, [appearanceSettings.sidebarWidthPx, sidebarWidthMaxPct, setAppearanceSettings]);

    return (
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
                    onChange={(value) => {
                        const validActions: ToolbarClickAction[] = ['toggle-sidebar', 'open-manager-page'];
                        if (validActions.includes(value as ToolbarClickAction)) {
                            setAppearanceSettings({ toolbarClickAction: value as ToolbarClickAction });
                        }
                    }}
                    options={[
                        { value: 'toggle-sidebar', label: 'Toggle Sidebar', icon: Sidebar },
                        { value: 'open-manager-page', label: 'Open Manager Page', icon: Box },
                    ]}
                    label="Toolbar Click Action"
                />

                <Dropdown
                    value={appearanceSettings.sidebarLayoutMode}
                    onChange={(value) => {
                        const validModes: SidebarLayoutMode[] = ['overlay', 'push'];
                        if (validModes.includes(value as SidebarLayoutMode)) {
                            setAppearanceSettings({ sidebarLayoutMode: value as SidebarLayoutMode });
                        }
                    }}
                    options={[
                        { value: 'overlay', label: 'Overlay (on top)', icon: Maximize2 },
                        { value: 'push', label: 'Push (move page)', icon: Layout },
                    ]}
                    label="Layout Mode"
                />

                <Dropdown
                    value={appearanceSettings.sidebarDockSide}
                    onChange={(value) => {
                        const validSides: SidebarDockSide[] = ['left', 'right'];
                        if (validSides.includes(value as SidebarDockSide)) {
                            setAppearanceSettings({ sidebarDockSide: value as SidebarDockSide });
                        }
                    }}
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
                    max={sidebarMaxPx}
                    step={10}
                    label="Sidebar Width"
                    displayValue={`${appearanceSettings.sidebarWidthPx}px`}
                />

                <Slider
                    value={sidebarWidthMaxPct}
                    onChange={(value) => setAppearanceSettings({ sidebarWidthMaxPct: value })}
                    min={SIDEBAR_MAX_WIDTH_PCT_MIN}
                    max={SIDEBAR_MAX_WIDTH_PCT_MAX}
                    step={1}
                    label="Max Width"
                    displayValue={`${sidebarWidthMaxPct}%`}
                />

                <Slider
                    value={appearanceSettings.sidebarPanelPadding ?? SIDEBAR_PANEL_PADDING_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ sidebarPanelPadding: value })}
                    min={PANEL_PADDING_MIN}
                    max={PANEL_PADDING_MAX}
                    step={PANEL_PADDING_STEP}
                    label="Sidebar Padding"
                    displayValue={`${appearanceSettings.sidebarPanelPadding ?? SIDEBAR_PANEL_PADDING_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.managerPanelPadding ?? MANAGER_PANEL_PADDING_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ managerPanelPadding: value })}
                    min={PANEL_PADDING_MIN}
                    max={PANEL_PADDING_MAX}
                    step={PANEL_PADDING_STEP}
                    label="Manager Padding"
                    displayValue={`${appearanceSettings.managerPanelPadding ?? MANAGER_PANEL_PADDING_DEFAULT}px`}
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
                            onClick={() => setAppearanceSettings({ sidebarToggleHotkey: { code: 'Space', ctrl: true, meta: true, alt: false, shift: true } })}
                            className="px-3 py-2 text-[10px] text-gray-500 hover:text-gx-red transition-colors"
                            aria-label="Reset sidebar toggle hotkey"
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
    );
};
