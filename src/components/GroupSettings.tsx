import React, { useCallback } from 'react';
import { Layers, Hash, ArrowDownUp, LayoutPanelTop } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Toggle } from './ui/Toggle';
import type { AppearanceSettings } from '../types';
import {
    GROUP_HEADERS_SECTION,
    TAB_COUNT_SECTION,
    SORT_GROUPS_SECTION,
    PANEL_HEADERS_SECTION
} from '../constants';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: GROUP_HEADERS_SECTION,
        title: 'Group Headers',
        category: 'groups',
        icon: Layers,
        controls: [
            { id: 'compact-headers', label: 'Compact Headers', description: 'Use smaller headers for tab groups to save space', keywords: ['compact', 'small', 'headers'] },
        ],
    },
    {
        id: TAB_COUNT_SECTION,
        title: 'Tab Count',
        category: 'groups',
        icon: Hash,
        controls: [
            { id: 'show-tab-count', label: 'Show Tab Count', description: 'Display the number of tabs in each group header', keywords: ['count', 'number', 'tabs'] },
        ],
    },
    {
        id: SORT_GROUPS_SECTION,
        title: 'Sort Groups',
        category: 'groups',
        icon: ArrowDownUp,
        controls: [
            { id: 'sort-live-groups', label: 'Sort Live Groups by Tab Count', description: 'Sort Live Workspace groups from most to least tabs', keywords: ['sort', 'live', 'groups', 'count'] },
            { id: 'sort-vault-groups', label: 'Sort Vault Groups by Tab Count', description: 'Sort Neural Vault groups from most to least tabs', keywords: ['sort', 'vault', 'groups', 'count'] },
        ],
    },
    {
        id: PANEL_HEADERS_SECTION,
        title: 'Panel Headers',
        category: 'groups',
        icon: LayoutPanelTop,
        controls: [
            { id: 'show-panel-name', label: 'Show Panel Name', description: 'Display "Live" and "Vault" text in panel headers', keywords: ['panel', 'name', 'text', 'header'] },
            { id: 'show-panel-icon', label: 'Show Panel Icon', description: 'Display folder and save icons in panel headers', keywords: ['panel', 'icon', 'header'] },
            { id: 'collapse-expand-layout', label: 'Horizontal Collapse/Expand', description: 'Stack collapse/expand buttons horizontally instead of vertically', keywords: ['collapse', 'expand', 'layout', 'buttons', 'vertical', 'horizontal'] },
        ],
    },
];

interface GroupSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const GroupSettings: React.FC<GroupSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    const handleToggleGroupHeaders = useCallback(() => {
        toggleSection(GROUP_HEADERS_SECTION);
    }, [toggleSection]);

    const handleToggleTabCount = useCallback(() => {
        toggleSection(TAB_COUNT_SECTION);
    }, [toggleSection]);

    const handleToggleSortGroups = useCallback(() => {
        toggleSection(SORT_GROUPS_SECTION);
    }, [toggleSection]);

    const handleTogglePanelHeaders = useCallback(() => {
        toggleSection(PANEL_HEADERS_SECTION);
    }, [toggleSection]);

    const handleCompactGroupHeadersChange = useCallback((checked: boolean) => {
        setAppearanceSettings({ compactGroupHeaders: checked });
    }, [setAppearanceSettings]);

    const handleShowTabCountChange = useCallback((checked: boolean) => {
        setAppearanceSettings({ showTabCount: checked });
    }, [setAppearanceSettings]);

    const handleSortGroupsByCountChange = useCallback((checked: boolean) => {
        setAppearanceSettings({ sortGroupsByCount: checked });
    }, [setAppearanceSettings]);

    const handleSortVaultGroupsByCountChange = useCallback((checked: boolean) => {
        setAppearanceSettings({ sortVaultGroupsByCount: checked });
    }, [setAppearanceSettings]);

    const handleShowPanelNameChange = useCallback((checked: boolean) => {
        setAppearanceSettings({ showPanelName: checked });
    }, [setAppearanceSettings]);

    const handleShowPanelIconChange = useCallback((checked: boolean) => {
        setAppearanceSettings({ showPanelIcon: checked });
    }, [setAppearanceSettings]);

    const handleCollapseExpandLayoutChange = useCallback((checked: boolean) => {
        setAppearanceSettings({ collapseExpandLayout: checked ? 'horizontal' : 'vertical' });
    }, [setAppearanceSettings]);

    return (
        <div className="flex flex-col gap-2">
            <CollapsibleSection
                id={GROUP_HEADERS_SECTION}
                title="Group Headers"
                icon={Layers}
                isExpanded={expandedSections.has(GROUP_HEADERS_SECTION)}
                onToggle={handleToggleGroupHeaders}
            >
                <Toggle
                    checked={appearanceSettings.compactGroupHeaders}
                    onChange={handleCompactGroupHeadersChange}
                    label="Compact Headers"
                    description="Use smaller headers for tab groups to save space"
                    highlighted={highlightedControl?.sectionId === GROUP_HEADERS_SECTION && highlightedControl?.controlId === 'compact-headers'}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id={TAB_COUNT_SECTION}
                title="Tab Count"
                icon={Hash}
                isExpanded={expandedSections.has(TAB_COUNT_SECTION)}
                onToggle={handleToggleTabCount}
            >
                <Toggle
                    checked={appearanceSettings.showTabCount}
                    onChange={handleShowTabCountChange}
                    label="Show Tab Count"
                    description="Display the number of tabs in each group header"
                    highlighted={highlightedControl?.sectionId === TAB_COUNT_SECTION && highlightedControl?.controlId === 'show-tab-count'}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id={SORT_GROUPS_SECTION}
                title="Sort Groups"
                icon={ArrowDownUp}
                isExpanded={expandedSections.has(SORT_GROUPS_SECTION)}
                onToggle={handleToggleSortGroups}
            >
                <Toggle
                    checked={appearanceSettings.sortGroupsByCount}
                    onChange={handleSortGroupsByCountChange}
                    label="Sort Live Groups by Tab Count"
                    description="When enabled, Live Workspace groups are sorted from most to least tabs"
                    highlighted={highlightedControl?.sectionId === SORT_GROUPS_SECTION && highlightedControl?.controlId === 'sort-live-groups'}
                />
                <Toggle
                    checked={appearanceSettings.sortVaultGroupsByCount}
                    onChange={handleSortVaultGroupsByCountChange}
                    label="Sort Vault Groups by Tab Count"
                    description="When enabled, Neural Vault groups are sorted from most to least tabs"
                    highlighted={highlightedControl?.sectionId === SORT_GROUPS_SECTION && highlightedControl?.controlId === 'sort-vault-groups'}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id={PANEL_HEADERS_SECTION}
                title="Panel Headers"
                icon={LayoutPanelTop}
                isExpanded={expandedSections.has(PANEL_HEADERS_SECTION)}
                onToggle={handleTogglePanelHeaders}
            >
                <Toggle
                    checked={appearanceSettings.showPanelName}
                    onChange={handleShowPanelNameChange}
                    label="Show Panel Name"
                    description='Display "Live" and "Vault" text in panel headers'
                    highlighted={highlightedControl?.sectionId === PANEL_HEADERS_SECTION && highlightedControl?.controlId === 'show-panel-name'}
                />
                <Toggle
                    checked={appearanceSettings.showPanelIcon}
                    onChange={handleShowPanelIconChange}
                    label="Show Panel Icon"
                    description="Display folder and save icons in panel headers"
                    highlighted={highlightedControl?.sectionId === PANEL_HEADERS_SECTION && highlightedControl?.controlId === 'show-panel-icon'}
                />
                <Toggle
                    checked={appearanceSettings.collapseExpandLayout === 'horizontal'}
                    onChange={handleCollapseExpandLayoutChange}
                    label="Horizontal Collapse/Expand"
                    description="Stack collapse/expand buttons horizontally instead of vertically"
                    highlighted={highlightedControl?.sectionId === PANEL_HEADERS_SECTION && highlightedControl?.controlId === 'collapse-expand-layout'}
                />
            </CollapsibleSection>
        </div>
    );
};
