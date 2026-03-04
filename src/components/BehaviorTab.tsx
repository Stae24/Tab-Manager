import React, { useState, useRef, useEffect } from 'react';
import { MousePointer, Pin, Keyboard, Search as SearchIcon, ArrowDownUp, GripVertical, Sidebar, Box } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Slider } from './ui/Slider';
import { Toggle } from './ui/Toggle';
import { Dropdown } from './ui/Dropdown';
import {
    DRAG_OPACITY_MIN,
    DRAG_OPACITY_MAX,
    DRAG_OPACITY_STEP,
    SEARCH_DEBOUNCE_MIN,
    SEARCH_DEBOUNCE_MAX,
    SEARCH_DEBOUNCE_STEP,
    SEARCH_DEBOUNCE_MS
} from '../constants';
import { formatHotkey, DEFAULT_SIDEBAR_TOGGLE_HOTKEY } from '../utils/hotkeys';
import { logger } from '../utils/logger';
import type { AppearanceSettings, ToolbarClickAction, TabElementOrder } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'drag-drop',
        title: 'Drag & Drop',
        category: 'behavior',
        icon: MousePointer,
        controls: [
            { id: 'dragged-opacity', label: 'Dragged Item Opacity', keywords: ['drag', 'opacity', 'dragged'] },
        ],
    },
    {
        id: 'tab-manager',
        title: 'Tab Manager',
        category: 'behavior',
        icon: Pin,
        controls: [
            { id: 'auto-pin-tab-manager', label: 'Auto-Pin Tab Manager', description: 'Automatically pin the Tab Manager page when opened via extension icon', keywords: ['auto', 'pin', 'tab', 'manager'] },
            { id: 'focus-existing-tab', label: 'Focus Existing Tab', description: 'If Tab Manager is already open, switch to it instead of creating a new tab', keywords: ['focus', 'existing', 'tab'] },
            { id: 'configure-shortcut', label: 'Configure Shortcut', keywords: ['shortcut', 'keyboard', 'hotkey'] },
        ],
    },
    {
        id: 'search',
        title: 'Search',
        category: 'behavior',
        icon: SearchIcon,
        controls: [
            { id: 'search-debounce', label: 'Search Debounce', keywords: ['search', 'debounce', 'delay'] },
        ],
    },
    {
        id: 'sort-groups',
        title: 'Sort Groups',
        category: 'behavior',
        icon: ArrowDownUp,
        controls: [
            { id: 'sort-live-groups', label: 'Sort Live Groups by Tab Count', description: 'Sort Live Workspace groups from most to least tabs', keywords: ['sort', 'live', 'groups', 'count'] },
            { id: 'sort-vault-groups', label: 'Sort Vault Groups by Tab Count', description: 'Sort Neural Vault groups from most to least tabs', keywords: ['sort', 'vault', 'groups', 'count'] },
        ],
    },
    {
        id: 'tab-layout',
        title: 'Tab Layout',
        category: 'behavior',
        icon: GripVertical,
        controls: [
            { id: 'element-order', label: 'Element Order', keywords: ['element', 'order', 'layout', 'favicon', 'indicator', 'position'] },
        ],
    },
    {
        id: 'sidebar-actions',
        title: 'Sidebar Actions',
        category: 'behavior',
        icon: Sidebar,
        controls: [
            { id: 'toolbar-click', label: 'Toolbar Click Action', keywords: ['toolbar', 'click', 'sidebar', 'manager', 'page'] },
            { id: 'sidebar-toggle-hotkey', label: 'Sidebar Toggle Hotkey', keywords: ['sidebar', 'toggle', 'hotkey', 'keyboard'] },
            { id: 'manager-page-hotkey', label: 'Manager Page Hotkey', keywords: ['manager', 'page', 'hotkey', 'keyboard'] },
        ],
    },
];

interface BehaviorTabProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
}

export const BehaviorTab: React.FC<BehaviorTabProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
}) => {
    const [shortcutCopied, setShortcutCopied] = useState(false);
    const shortcutTimeoutRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        return () => {
            if (shortcutTimeoutRef.current) {
                clearTimeout(shortcutTimeoutRef.current);
                shortcutTimeoutRef.current = undefined;
            }
        };
    }, []);

    return (
        <>
            <CollapsibleSection
                id="drag-drop"
                title="Drag & Drop"
                icon={MousePointer}
                isExpanded={expandedSections.has('drag-drop')}
                onToggle={() => toggleSection('drag-drop')}
            >
                <Slider
                    value={appearanceSettings.dragOpacity}
                    onChange={(value) => setAppearanceSettings({ dragOpacity: value })}
                    min={DRAG_OPACITY_MIN}
                    max={DRAG_OPACITY_MAX}
                    step={DRAG_OPACITY_STEP}
                    label="Dragged Item Opacity"
                    displayValue={`${Math.round(appearanceSettings.dragOpacity * 100)}%`}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="tab-manager"
                title="Tab Manager"
                icon={Pin}
                isExpanded={expandedSections.has('tab-manager')}
                onToggle={() => toggleSection('tab-manager')}
            >
                <Toggle
                    checked={appearanceSettings.autoPinTabManager}
                    onChange={(checked) => setAppearanceSettings({ autoPinTabManager: checked })}
                    label="Auto-Pin Tab Manager"
                    description="Automatically pin the Tab Manager page when opened via extension icon"
                />
                <Toggle
                    checked={appearanceSettings.focusExistingTab ?? true}
                    onChange={(checked) => setAppearanceSettings({ focusExistingTab: checked })}
                    label="Focus Existing Tab"
                    description="If Tab Manager is already open, switch to it instead of creating a new tab"
                />
                <div className="h-2" />
                <button
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText('chrome://extensions/shortcuts');
                            if (shortcutTimeoutRef.current !== undefined) {
                                clearTimeout(shortcutTimeoutRef.current);
                            }
                            setShortcutCopied(true);
                            shortcutTimeoutRef.current = window.setTimeout(() => setShortcutCopied(false), 2000);
                        } catch (err) {
                            logger.error('BehaviorTab', 'Failed to copy shortcut URL:', err);
                        }
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-lg transition-all border bg-gx-gray border-white/5 hover:border-gx-accent/20"
                >
                    <Keyboard className="w-5 h-5 text-gx-accent" />
                    <div className="flex-1 text-left">
                        <span className="text-xs font-bold block text-gray-300">
                            Configure Shortcut
                        </span>
                        <span className="text-[10px] text-gray-500 block mt-0.5">
                            {shortcutCopied
                                ? 'Copied! Paste in address bar to open shortcuts'
                                : 'Copy link and paste in address bar to customize keyboard shortcut'}
                        </span>
                    </div>
                </button>
            </CollapsibleSection>

            <CollapsibleSection
                id="search"
                title="Search"
                icon={SearchIcon}
                isExpanded={expandedSections.has('search')}
                onToggle={() => toggleSection('search')}
            >
                <Slider
                    value={appearanceSettings.searchDebounce ?? SEARCH_DEBOUNCE_MS}
                    onChange={(value) => setAppearanceSettings({ searchDebounce: value })}
                    min={SEARCH_DEBOUNCE_MIN}
                    max={SEARCH_DEBOUNCE_MAX}
                    step={SEARCH_DEBOUNCE_STEP}
                    label="Search Debounce"
                    displayValue={`${appearanceSettings.searchDebounce ?? SEARCH_DEBOUNCE_MS}ms`}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="sort-groups"
                title="Sort Groups"
                icon={ArrowDownUp}
                isExpanded={expandedSections.has('sort-groups')}
                onToggle={() => toggleSection('sort-groups')}
            >
                <Toggle
                    checked={appearanceSettings.sortGroupsByCount}
                    onChange={(checked) => setAppearanceSettings({ sortGroupsByCount: checked })}
                    label="Sort Live Groups by Tab Count"
                    description="When enabled, Live Workspace groups are sorted from most to least tabs"
                />
                <Toggle
                    checked={appearanceSettings.sortVaultGroupsByCount}
                    onChange={(checked) => setAppearanceSettings({ sortVaultGroupsByCount: checked })}
                    label="Sort Vault Groups by Tab Count"
                    description="When enabled, Neural Vault groups are sorted from most to least tabs"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="tab-layout"
                title="Tab Layout"
                icon={GripVertical}
                isExpanded={expandedSections.has('tab-layout')}
                onToggle={() => toggleSection('tab-layout')}
            >
                <Dropdown
                    value={appearanceSettings.tabElementOrder}
                    onChange={(value) => setAppearanceSettings({ tabElementOrder: value as TabElementOrder })}
                    options={[
                        { value: 'favicon-indicators-title', label: 'Favicon → Indicators → Title' },
                        { value: 'indicators-first', label: 'Indicators → Favicon → Title' },
                        { value: 'favicon-first', label: 'Favicon → Title → Indicators' },
                    ]}
                    label="Element Order"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="sidebar-actions"
                title="Sidebar Actions"
                icon={Sidebar}
                isExpanded={expandedSections.has('sidebar-actions')}
                onToggle={() => toggleSection('sidebar-actions')}
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

                    <div className="space-y-2">
                        <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">Sidebar Toggle Hotkey</span>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 px-3 py-2.5 bg-gx-gray border border-white/5 rounded-lg">
                                <span className="text-xs text-gray-200 font-mono">
                                    {formatHotkey(appearanceSettings.sidebarToggleHotkey)}
                                </span>
                            </div>
                            <button
                                onClick={() => setAppearanceSettings({ sidebarToggleHotkey: DEFAULT_SIDEBAR_TOGGLE_HOTKEY })}
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
        </>
    );
};
