import React, { useState, useEffect } from 'react';
import { ZoomIn, Layout, SlidersHorizontal, Sidebar, MinusCircle, Minus, Layers, Plus, Check, LayoutPanelTop } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Slider } from './ui/Slider';
import { Toggle } from './ui/Toggle';
import { cn } from '../utils/cn';
import { SpacingIcon } from './ui/SpacingIcon';
import {
    UI_SCALE_MIN,
    UI_SCALE_MAX,
    UI_SCALE_STEP,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_MAX_WIDTH_PCT_MIN,
    SIDEBAR_MAX_WIDTH_PCT_MAX,
    SIDEBAR_MAX_WIDTH_PCT_DEFAULT,
    SIDEBAR_HEADER_PADDING_MIN,
    SIDEBAR_HEADER_PADDING_MAX,
    SIDEBAR_HEADER_PADDING_DEFAULT,
    SIDEBAR_HEADER_PADDING_STEP,
    SIDEBAR_ROW_GAP_MIN,
    SIDEBAR_ROW_GAP_MAX,
    SIDEBAR_ROW_GAP_DEFAULT,
    SIDEBAR_ROW_GAP_STEP,
    SIDEBAR_BUTTON_GAP_MIN,
    SIDEBAR_BUTTON_GAP_MAX,
    SIDEBAR_BUTTON_GAP_DEFAULT,
    SIDEBAR_BUTTON_GAP_STEP,
    SIDEBAR_BUTTON_PADDING_Y_MIN,
    SIDEBAR_BUTTON_PADDING_Y_MAX,
    SIDEBAR_BUTTON_PADDING_Y_DEFAULT,
    SIDEBAR_BUTTON_PADDING_Y_STEP,
    SIDEBAR_BUTTON_ICON_SIZE_MIN,
    SIDEBAR_BUTTON_ICON_SIZE_MAX,
    SIDEBAR_BUTTON_ICON_SIZE_DEFAULT,
    SIDEBAR_BUTTON_ICON_SIZE_STEP,
    PANEL_HEADER_PADDING_TOP_MIN,
    PANEL_HEADER_PADDING_TOP_MAX,
    PANEL_HEADER_PADDING_TOP_DEFAULT,
    PANEL_HEADER_PADDING_TOP_STEP,
    PANEL_HEADER_PADDING_BOTTOM_MIN,
    PANEL_HEADER_PADDING_BOTTOM_MAX,
    PANEL_HEADER_PADDING_BOTTOM_DEFAULT,
    PANEL_HEADER_PADDING_BOTTOM_STEP,
    PANEL_HEADER_PADDING_LEFT_MIN,
    PANEL_HEADER_PADDING_LEFT_MAX,
    PANEL_HEADER_PADDING_LEFT_DEFAULT,
    PANEL_HEADER_PADDING_LEFT_STEP,
    PANEL_HEADER_PADDING_RIGHT_MIN,
    PANEL_HEADER_PADDING_RIGHT_MAX,
    PANEL_HEADER_PADDING_RIGHT_DEFAULT,
    PANEL_HEADER_PADDING_RIGHT_STEP,
    PANEL_HEADER_ICON_TITLE_GAP_MIN,
    PANEL_HEADER_ICON_TITLE_GAP_MAX,
    PANEL_HEADER_ICON_TITLE_GAP_DEFAULT,
    PANEL_HEADER_ICON_TITLE_GAP_STEP,
    PANEL_HEADER_TITLE_ACTION_GAP_MIN,
    PANEL_HEADER_TITLE_ACTION_GAP_MAX,
    PANEL_HEADER_TITLE_ACTION_GAP_DEFAULT,
    PANEL_HEADER_TITLE_ACTION_GAP_STEP,
    PANEL_HEADER_ACTION_GAP_MIN,
    PANEL_HEADER_ACTION_GAP_MAX,
    PANEL_HEADER_ACTION_GAP_DEFAULT,
    PANEL_HEADER_ACTION_GAP_STEP,
    PANEL_LIST_GAP_MIN,
    PANEL_LIST_GAP_MAX,
    PANEL_LIST_GAP_DEFAULT,
    PANEL_LIST_GAP_STEP,
    PANEL_LIST_PADDING_TOP_MIN,
    PANEL_LIST_PADDING_TOP_MAX,
    PANEL_LIST_PADDING_TOP_DEFAULT,
    PANEL_LIST_PADDING_TOP_STEP,
    PANEL_LIST_PADDING_BOTTOM_MIN,
    PANEL_LIST_PADDING_BOTTOM_MAX,
    PANEL_LIST_PADDING_BOTTOM_DEFAULT,
    PANEL_LIST_PADDING_BOTTOM_STEP,
    SETTINGS_HEADER_PADDING_MIN,
    SETTINGS_HEADER_PADDING_MAX,
    SETTINGS_HEADER_PADDING_DEFAULT,
    SETTINGS_HEADER_PADDING_STEP,
    SETTINGS_TABS_PADDING_MIN,
    SETTINGS_TABS_PADDING_MAX,
    SETTINGS_TABS_PADDING_DEFAULT,
    SETTINGS_TABS_PADDING_STEP,
    SETTINGS_TAB_GAP_MIN,
    SETTINGS_TAB_GAP_MAX,
    SETTINGS_TAB_GAP_DEFAULT,
    SETTINGS_TAB_GAP_STEP,
    SETTINGS_CONTENT_PADDING_MIN,
    SETTINGS_CONTENT_PADDING_MAX,
    SETTINGS_CONTENT_PADDING_DEFAULT,
    SETTINGS_CONTENT_PADDING_STEP,
    SETTINGS_SECTION_GAP_MIN,
    SETTINGS_SECTION_GAP_MAX,
    SETTINGS_SECTION_GAP_DEFAULT,
    SETTINGS_SECTION_GAP_STEP,
} from '../constants';
import type { AppearanceSettings, ButtonSize, SidebarLayoutMode, SidebarDockSide } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'ui-scale',
        title: 'UI Scale',
        category: 'layout',
        icon: ZoomIn,
        controls: [
            { id: 'interface-scale', label: 'Interface Scale', keywords: ['scale', 'zoom', 'interface', 'ui'] },
            { id: 'settings-scale', label: 'Settings Panel Scale', keywords: ['settings', 'panel', 'scale'] },
        ],
    },
    {
        id: 'tab-density',
        title: 'Tab Density',
        category: 'layout',
        icon: Layout,
        controls: [
            { id: 'tab-density-options', label: 'Tab Density', keywords: ['tab', 'density', 'minified', 'compact', 'normal', 'spacious'] },
        ],
    },
    {
        id: 'buttons',
        title: 'Buttons',
        category: 'layout',
        icon: SlidersHorizontal,
        controls: [
            { id: 'button-size', label: 'Button Size', keywords: ['button', 'size', 'small', 'medium', 'large'] },
            { id: 'custom-button-hover-size', label: 'Custom Button Size', keywords: ['button', 'hover', 'size', 'custom', 'padding'] },
            { id: 'button-hover-padding', label: 'Button Padding', keywords: ['button', 'padding', 'px', 'pixels'] },
        ],
    },
    {
        id: 'sidebar',
        title: 'Sidebar',
        category: 'layout',
        icon: Sidebar,
        controls: [
            { id: 'dock-side', label: 'Dock Side', keywords: ['dock', 'side', 'left', 'right'] },
            { id: 'layout-mode', label: 'Layout Mode', keywords: ['layout', 'mode', 'overlay', 'push'] },
            { id: 'sidebar-width', label: 'Sidebar Width', keywords: ['sidebar', 'width'] },
            { id: 'max-width', label: 'Max Width', keywords: ['max', 'width', 'percentage'] },
        ],
    },
    {
        id: 'sidebar-spacing',
        title: 'Sidebar Spacing',
        category: 'layout',
        icon: SpacingIcon,
        controls: [
            { id: 'sidebar-header-padding', label: 'Sidebar Header Padding', keywords: ['sidebar', 'header', 'padding'] },
            { id: 'sidebar-row-gap', label: 'Sidebar Row Gap', keywords: ['sidebar', 'row', 'gap'] },
            { id: 'sidebar-button-gap', label: 'Sidebar Button Gap', keywords: ['sidebar', 'button', 'gap'] },
            { id: 'sidebar-button-padding-y', label: 'Sidebar Button Padding Y', keywords: ['sidebar', 'button', 'padding', 'vertical'] },
            { id: 'sidebar-button-icon-size', label: 'Sidebar Button Icon Size', keywords: ['sidebar', 'button', 'icon', 'size'] },
        ],
    },
    {
        id: 'panel-layout',
        title: 'Panel Layout',
        category: 'layout',
        icon: LayoutPanelTop,
        controls: [
            { id: 'compact-headers', label: 'Compact Headers', description: 'Use smaller headers for tab groups to save space', keywords: ['compact', 'small', 'headers'] },
            { id: 'show-panel-name', label: 'Show Panel Name', description: 'Display "Live" and "Vault" text in panel headers', keywords: ['panel', 'name', 'text', 'header'] },
            { id: 'show-panel-icon', label: 'Show Panel Icon', description: 'Display folder and save icons in panel headers', keywords: ['panel', 'icon', 'header'] },
            { id: 'collapse-expand-layout', label: 'Horizontal Collapse/Expand', description: 'Stack collapse/expand buttons horizontally instead of vertically', keywords: ['collapse', 'expand', 'layout', 'buttons', 'vertical', 'horizontal'] },
        ],
    },
    {
        id: 'panel-spacing',
        title: 'Panel Spacing',
        category: 'layout',
        icon: SpacingIcon,
        controls: [
            { id: 'panel-header-padding-top', label: 'Panel Header Padding Top', keywords: ['panel', 'header', 'padding', 'top'] },
            { id: 'panel-header-padding-bottom', label: 'Panel Header Padding Bottom', keywords: ['panel', 'header', 'padding', 'bottom'] },
            { id: 'panel-header-padding-left', label: 'Panel Header Padding Left', keywords: ['panel', 'header', 'padding', 'left'] },
            { id: 'panel-header-padding-right', label: 'Panel Header Padding Right', keywords: ['panel', 'header', 'padding', 'right'] },
            { id: 'panel-header-icon-title-gap', label: 'Panel Header Icon-Title Gap', keywords: ['panel', 'header', 'icon', 'title', 'gap'] },
            { id: 'panel-header-title-action-gap', label: 'Panel Header Title-Action Gap', keywords: ['panel', 'header', 'title', 'action', 'gap'] },
            { id: 'panel-header-action-gap', label: 'Panel Header Action Button Gap', keywords: ['panel', 'header', 'action', 'gap', 'button'] },
            { id: 'panel-list-gap', label: 'Panel List Gap', keywords: ['panel', 'list', 'gap'] },
            { id: 'panel-list-padding-top', label: 'Panel List Padding Top', keywords: ['panel', 'list', 'padding', 'top'] },
            { id: 'panel-list-padding-bottom', label: 'Panel List Padding Bottom', keywords: ['panel', 'list', 'padding', 'bottom'] },
        ],
    },
    {
        id: 'settings-spacing',
        title: 'Settings Spacing',
        category: 'layout',
        icon: SpacingIcon,
        controls: [
            { id: 'settings-header-padding', label: 'Settings Header Padding', keywords: ['settings', 'header', 'padding'] },
            { id: 'settings-tabs-padding', label: 'Settings Tabs Padding', keywords: ['settings', 'tabs', 'padding'] },
            { id: 'settings-tab-gap', label: 'Settings Tab Gap', keywords: ['settings', 'tab', 'gap'] },
            { id: 'settings-content-padding', label: 'Settings Content Padding', keywords: ['settings', 'content', 'padding'] },
            { id: 'settings-section-gap', label: 'Settings Section Gap', keywords: ['settings', 'section', 'gap'] },
        ],
    },
];

interface LayoutTabProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const LayoutTab: React.FC<LayoutTabProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl,
}) => {
    const sidebarWidthMaxPct = appearanceSettings.sidebarWidthMaxPct ?? SIDEBAR_MAX_WIDTH_PCT_DEFAULT;
    const [sidebarMaxPx, setSidebarMaxPx] = useState(() =>
        typeof window !== 'undefined' ? Math.floor(window.innerWidth * (sidebarWidthMaxPct / 100)) : 1920
    );

    useEffect(() => {
        const handleResize = () => {
            const newMax = Math.floor(window.innerWidth * (sidebarWidthMaxPct / 100));
            setSidebarMaxPx(newMax);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [sidebarWidthMaxPct]);

    useEffect(() => {
        const newMax = Math.floor((typeof window !== 'undefined' ? window.innerWidth : 1920) * (sidebarWidthMaxPct / 100));
        if (appearanceSettings.sidebarWidthPx > newMax) {
            setAppearanceSettings({ sidebarWidthPx: newMax });
        }
    }, [sidebarWidthMaxPct, setAppearanceSettings]);

    return (
        <>
            <CollapsibleSection
                id="ui-scale"
                title="UI Scale"
                icon={ZoomIn}
                isExpanded={expandedSections.has('ui-scale')}
                onToggle={() => toggleSection('ui-scale')}
            >
                <div className="space-y-4">
                    <Slider
                        value={appearanceSettings.uiScale}
                        onChange={(value) => setAppearanceSettings({ uiScale: value })}
                        min={UI_SCALE_MIN}
                        max={UI_SCALE_MAX}
                        step={UI_SCALE_STEP}
                        label="Interface Scale"
                        displayValue={`${Math.round(appearanceSettings.uiScale * 100)}%`}
                    />
                    <Slider
                        value={appearanceSettings.settingsScale}
                        onChange={(value) => setAppearanceSettings({ settingsScale: value })}
                        min={UI_SCALE_MIN}
                        max={UI_SCALE_MAX}
                        step={UI_SCALE_STEP}
                        label="Settings Panel Scale"
                        displayValue={`${Math.round(appearanceSettings.settingsScale * 100)}%`}
                    />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="tab-density"
                title="Tab Density"
                icon={Layout}
                isExpanded={expandedSections.has('tab-density')}
                onToggle={() => toggleSection('tab-density')}
            >
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { value: 'minified', label: 'Minified', icon: MinusCircle },
                        { value: 'compact', label: 'Compact', icon: Minus },
                        { value: 'normal', label: 'Normal', icon: Layers },
                        { value: 'spacious', label: 'Spacious', icon: Plus },
                    ].map((density) => (
                        <button
                            type="button"
                            key={density.value}
                            onClick={() => setAppearanceSettings({ tabDensity: density.value as 'minified' | 'compact' | 'normal' | 'spacious' })}
                            aria-pressed={appearanceSettings.tabDensity === density.value}
                            className={cn(
                                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                                appearanceSettings.tabDensity === density.value
                                    ? "bg-gx-cyan/10 border-gx-cyan/50"
                                    : "bg-gx-gray border-white/5 hover:border-gx-cyan/30"
                            )}
                        >
                            <density.icon size={20} className={cn(
                                appearanceSettings.tabDensity === density.value ? "text-gx-cyan" : "text-gray-500"
                            )} />
                            <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                appearanceSettings.tabDensity === density.value ? "text-gx-cyan" : "text-gray-500"
                            )}>
                                {density.label}
                            </span>
                        </button>
                    ))}
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="buttons"
                title="Buttons"
                icon={SlidersHorizontal}
                isExpanded={expandedSections.has('buttons')}
                onToggle={() => toggleSection('buttons')}
            >
                <div className="space-y-4">
                    <Dropdown
                        value={appearanceSettings.buttonSize}
                        onChange={(value) => setAppearanceSettings({ buttonSize: value as ButtonSize })}
                        options={[
                            { value: 'small', label: 'Small' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'large', label: 'Large' },
                        ]}
                        label="Button Size"
                    />
                    <Toggle
                        checked={appearanceSettings.customButtonHoverSize}
                        onChange={(checked) => setAppearanceSettings({ customButtonHoverSize: checked })}
                        label="Enable Custom Hover Padding"
                        description="Override the default button padding with a custom value"
                        highlighted={highlightedControl?.sectionId === 'buttons' && highlightedControl?.controlId === 'custom-button-hover-size'}
                    />
                    <div className={cn(!appearanceSettings.customButtonHoverSize && "opacity-50 pointer-events-none")}>
                        <Slider
                            value={appearanceSettings.buttonHoverPaddingPx}
                            onChange={(value) => setAppearanceSettings({ buttonHoverPaddingPx: value })}
                            min={2}
                            max={24}
                            step={1}
                            label="Button Padding"
                            displayValue={`${appearanceSettings.buttonHoverPaddingPx}px`}
                        />
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="sidebar"
                title="Sidebar"
                icon={Sidebar}
                isExpanded={expandedSections.has('sidebar')}
                onToggle={() => toggleSection('sidebar')}
            >
                <div className="space-y-4">
                    <Dropdown
                        value={appearanceSettings.sidebarDockSide}
                        onChange={(value) => {
                            const validSides: SidebarDockSide[] = ['left', 'right'];
                            if (validSides.includes(value as SidebarDockSide)) {
                                setAppearanceSettings({ sidebarDockSide: value as SidebarDockSide });
                            }
                        }}
                        options={[
                            { value: 'left', label: 'Left Side' },
                            { value: 'right', label: 'Right Side' },
                        ]}
                        label="Dock Side"
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
                            { value: 'overlay', label: 'Overlay (on top)' },
                            { value: 'push', label: 'Push (move page)' },
                        ]}
                        label="Layout Mode"
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
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="sidebar-spacing"
                title="Sidebar Spacing"
                icon={SpacingIcon}
                isExpanded={expandedSections.has('sidebar-spacing')}
                onToggle={() => toggleSection('sidebar-spacing')}
            >
                <div className="space-y-4">
                    <Slider
                        value={appearanceSettings.sidebarHeaderPadding ?? SIDEBAR_HEADER_PADDING_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ sidebarHeaderPadding: value })}
                        min={SIDEBAR_HEADER_PADDING_MIN}
                        max={SIDEBAR_HEADER_PADDING_MAX}
                        step={SIDEBAR_HEADER_PADDING_STEP}
                        label="Header Padding"
                        displayValue={`${appearanceSettings.sidebarHeaderPadding ?? SIDEBAR_HEADER_PADDING_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.sidebarRowGap ?? SIDEBAR_ROW_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ sidebarRowGap: value })}
                        min={SIDEBAR_ROW_GAP_MIN}
                        max={SIDEBAR_ROW_GAP_MAX}
                        step={SIDEBAR_ROW_GAP_STEP}
                        label="Row Gap"
                        displayValue={`${appearanceSettings.sidebarRowGap ?? SIDEBAR_ROW_GAP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.sidebarButtonGap ?? SIDEBAR_BUTTON_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ sidebarButtonGap: value })}
                        min={SIDEBAR_BUTTON_GAP_MIN}
                        max={SIDEBAR_BUTTON_GAP_MAX}
                        step={SIDEBAR_BUTTON_GAP_STEP}
                        label="Button Gap"
                        displayValue={`${appearanceSettings.sidebarButtonGap ?? SIDEBAR_BUTTON_GAP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.sidebarButtonPaddingY ?? SIDEBAR_BUTTON_PADDING_Y_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ sidebarButtonPaddingY: value })}
                        min={SIDEBAR_BUTTON_PADDING_Y_MIN}
                        max={SIDEBAR_BUTTON_PADDING_Y_MAX}
                        step={SIDEBAR_BUTTON_PADDING_Y_STEP}
                        label="Button Padding Y"
                        displayValue={`${appearanceSettings.sidebarButtonPaddingY ?? SIDEBAR_BUTTON_PADDING_Y_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.sidebarButtonIconSize ?? SIDEBAR_BUTTON_ICON_SIZE_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ sidebarButtonIconSize: value })}
                        min={SIDEBAR_BUTTON_ICON_SIZE_MIN}
                        max={SIDEBAR_BUTTON_ICON_SIZE_MAX}
                        step={SIDEBAR_BUTTON_ICON_SIZE_STEP}
                        label="Button Icon Size"
                        displayValue={`${appearanceSettings.sidebarButtonIconSize ?? SIDEBAR_BUTTON_ICON_SIZE_DEFAULT}px`}
                    />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="panel-layout"
                title="Panel Layout"
                icon={LayoutPanelTop}
                isExpanded={expandedSections.has('panel-layout')}
                onToggle={() => toggleSection('panel-layout')}
            >
                <div className="space-y-2">
                    <Toggle
                        checked={appearanceSettings.compactGroupHeaders}
                        onChange={(checked) => setAppearanceSettings({ compactGroupHeaders: checked })}
                        label="Compact Headers"
                        description="Use smaller headers for tab groups to save space"
                        highlighted={highlightedControl?.sectionId === 'panel-layout' && highlightedControl?.controlId === 'compact-headers'}
                    />
                    <Toggle
                        checked={appearanceSettings.showPanelName}
                        onChange={(checked) => setAppearanceSettings({ showPanelName: checked })}
                        label="Show Panel Name"
                        description='Display "Live" and "Vault" text in panel headers'
                        highlighted={highlightedControl?.sectionId === 'panel-layout' && highlightedControl?.controlId === 'show-panel-name'}
                    />
                    <Toggle
                        checked={appearanceSettings.showPanelIcon}
                        onChange={(checked) => setAppearanceSettings({ showPanelIcon: checked })}
                        label="Show Panel Icon"
                        description="Display folder and save icons in panel headers"
                        highlighted={highlightedControl?.sectionId === 'panel-layout' && highlightedControl?.controlId === 'show-panel-icon'}
                    />
                    <Toggle
                        checked={appearanceSettings.collapseExpandLayout === 'horizontal'}
                        onChange={(checked) => setAppearanceSettings({ collapseExpandLayout: checked ? 'horizontal' : 'vertical' })}
                        label="Horizontal Collapse/Expand"
                        description="Stack collapse/expand buttons horizontally instead of vertically"
                        highlighted={highlightedControl?.sectionId === 'panel-layout' && highlightedControl?.controlId === 'collapse-expand-layout'}
                    />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="panel-spacing"
                title="Panel Spacing"
                icon={SpacingIcon}
                isExpanded={expandedSections.has('panel-spacing')}
                onToggle={() => toggleSection('panel-spacing')}
            >
                <div className="space-y-4">
                    <div className="text-[10px] text-gx-muted font-bold tracking-widest uppercase">Header Padding</div>
                    <Slider
                        value={appearanceSettings.panelHeaderPaddingTop ?? PANEL_HEADER_PADDING_TOP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelHeaderPaddingTop: value })}
                        min={PANEL_HEADER_PADDING_TOP_MIN}
                        max={PANEL_HEADER_PADDING_TOP_MAX}
                        step={PANEL_HEADER_PADDING_TOP_STEP}
                        label="Top"
                        displayValue={`${appearanceSettings.panelHeaderPaddingTop ?? PANEL_HEADER_PADDING_TOP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.panelHeaderPaddingBottom ?? PANEL_HEADER_PADDING_BOTTOM_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelHeaderPaddingBottom: value })}
                        min={PANEL_HEADER_PADDING_BOTTOM_MIN}
                        max={PANEL_HEADER_PADDING_BOTTOM_MAX}
                        step={PANEL_HEADER_PADDING_BOTTOM_STEP}
                        label="Bottom"
                        displayValue={`${appearanceSettings.panelHeaderPaddingBottom ?? PANEL_HEADER_PADDING_BOTTOM_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.panelHeaderPaddingLeft ?? PANEL_HEADER_PADDING_LEFT_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelHeaderPaddingLeft: value })}
                        min={PANEL_HEADER_PADDING_LEFT_MIN}
                        max={PANEL_HEADER_PADDING_LEFT_MAX}
                        step={PANEL_HEADER_PADDING_LEFT_STEP}
                        label="Left"
                        displayValue={`${appearanceSettings.panelHeaderPaddingLeft ?? PANEL_HEADER_PADDING_LEFT_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.panelHeaderPaddingRight ?? PANEL_HEADER_PADDING_RIGHT_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelHeaderPaddingRight: value })}
                        min={PANEL_HEADER_PADDING_RIGHT_MIN}
                        max={PANEL_HEADER_PADDING_RIGHT_MAX}
                        step={PANEL_HEADER_PADDING_RIGHT_STEP}
                        label="Right"
                        displayValue={`${appearanceSettings.panelHeaderPaddingRight ?? PANEL_HEADER_PADDING_RIGHT_DEFAULT}px`}
                    />
                    <div className="border-t border-gx-border pt-4 mt-4">
                        <div className="text-[10px] text-gx-muted font-bold tracking-widest uppercase mb-4">Header Gaps</div>
                    </div>
                    <Slider
                        value={appearanceSettings.panelHeaderIconTitleGap ?? PANEL_HEADER_ICON_TITLE_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelHeaderIconTitleGap: value })}
                        min={PANEL_HEADER_ICON_TITLE_GAP_MIN}
                        max={PANEL_HEADER_ICON_TITLE_GAP_MAX}
                        step={PANEL_HEADER_ICON_TITLE_GAP_STEP}
                        label="Icon-Title Gap"
                        displayValue={`${appearanceSettings.panelHeaderIconTitleGap ?? PANEL_HEADER_ICON_TITLE_GAP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.panelHeaderTitleActionGap ?? PANEL_HEADER_TITLE_ACTION_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelHeaderTitleActionGap: value })}
                        min={PANEL_HEADER_TITLE_ACTION_GAP_MIN}
                        max={PANEL_HEADER_TITLE_ACTION_GAP_MAX}
                        step={PANEL_HEADER_TITLE_ACTION_GAP_STEP}
                        label="Title-Action Gap"
                        displayValue={`${appearanceSettings.panelHeaderTitleActionGap ?? PANEL_HEADER_TITLE_ACTION_GAP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.panelHeaderActionGap ?? PANEL_HEADER_ACTION_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelHeaderActionGap: value })}
                        min={PANEL_HEADER_ACTION_GAP_MIN}
                        max={PANEL_HEADER_ACTION_GAP_MAX}
                        step={PANEL_HEADER_ACTION_GAP_STEP}
                        label="Action Button Gap"
                        displayValue={`${appearanceSettings.panelHeaderActionGap ?? PANEL_HEADER_ACTION_GAP_DEFAULT}px`}
                    />
                    <div className="border-t border-gx-border pt-4 mt-4">
                        <div className="text-[10px] text-gx-muted font-bold tracking-widest uppercase mb-4">List Spacing</div>
                    </div>
                    <Slider
                        value={appearanceSettings.panelListGap ?? PANEL_LIST_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelListGap: value })}
                        min={PANEL_LIST_GAP_MIN}
                        max={PANEL_LIST_GAP_MAX}
                        step={PANEL_LIST_GAP_STEP}
                        label="List Gap"
                        displayValue={`${appearanceSettings.panelListGap ?? PANEL_LIST_GAP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.panelListPaddingTop ?? PANEL_LIST_PADDING_TOP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelListPaddingTop: value })}
                        min={PANEL_LIST_PADDING_TOP_MIN}
                        max={PANEL_LIST_PADDING_TOP_MAX}
                        step={PANEL_LIST_PADDING_TOP_STEP}
                        label="List Padding Top"
                        displayValue={`${appearanceSettings.panelListPaddingTop ?? PANEL_LIST_PADDING_TOP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.panelListPaddingBottom ?? PANEL_LIST_PADDING_BOTTOM_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ panelListPaddingBottom: value })}
                        min={PANEL_LIST_PADDING_BOTTOM_MIN}
                        max={PANEL_LIST_PADDING_BOTTOM_MAX}
                        step={PANEL_LIST_PADDING_BOTTOM_STEP}
                        label="List Padding Bottom"
                        displayValue={`${appearanceSettings.panelListPaddingBottom ?? PANEL_LIST_PADDING_BOTTOM_DEFAULT}px`}
                    />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="settings-spacing"
                title="Settings Spacing"
                icon={SpacingIcon}
                isExpanded={expandedSections.has('settings-spacing')}
                onToggle={() => toggleSection('settings-spacing')}
            >
                <div className="space-y-4">
                    <Slider
                        value={appearanceSettings.settingsHeaderPadding ?? SETTINGS_HEADER_PADDING_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ settingsHeaderPadding: value })}
                        min={SETTINGS_HEADER_PADDING_MIN}
                        max={SETTINGS_HEADER_PADDING_MAX}
                        step={SETTINGS_HEADER_PADDING_STEP}
                        label="Header Padding"
                        displayValue={`${appearanceSettings.settingsHeaderPadding ?? SETTINGS_HEADER_PADDING_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.settingsTabsPadding ?? SETTINGS_TABS_PADDING_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ settingsTabsPadding: value })}
                        min={SETTINGS_TABS_PADDING_MIN}
                        max={SETTINGS_TABS_PADDING_MAX}
                        step={SETTINGS_TABS_PADDING_STEP}
                        label="Tabs Padding"
                        displayValue={`${appearanceSettings.settingsTabsPadding ?? SETTINGS_TABS_PADDING_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.settingsTabGap ?? SETTINGS_TAB_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ settingsTabGap: value })}
                        min={SETTINGS_TAB_GAP_MIN}
                        max={SETTINGS_TAB_GAP_MAX}
                        step={SETTINGS_TAB_GAP_STEP}
                        label="Tab Gap"
                        displayValue={`${appearanceSettings.settingsTabGap ?? SETTINGS_TAB_GAP_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.settingsContentPadding ?? SETTINGS_CONTENT_PADDING_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ settingsContentPadding: value })}
                        min={SETTINGS_CONTENT_PADDING_MIN}
                        max={SETTINGS_CONTENT_PADDING_MAX}
                        step={SETTINGS_CONTENT_PADDING_STEP}
                        label="Content Padding"
                        displayValue={`${appearanceSettings.settingsContentPadding ?? SETTINGS_CONTENT_PADDING_DEFAULT}px`}
                    />
                    <Slider
                        value={appearanceSettings.settingsSectionGap ?? SETTINGS_SECTION_GAP_DEFAULT}
                        onChange={(value) => setAppearanceSettings({ settingsSectionGap: value })}
                        min={SETTINGS_SECTION_GAP_MIN}
                        max={SETTINGS_SECTION_GAP_MAX}
                        step={SETTINGS_SECTION_GAP_STEP}
                        label="Section Gap"
                        displayValue={`${appearanceSettings.settingsSectionGap ?? SETTINGS_SECTION_GAP_DEFAULT}px`}
                    />
                </div>
            </CollapsibleSection>
        </>
    );
};
