import React, { useCallback } from 'react';
import { Layers, Hash, ArrowDownUp } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Toggle } from './ui/Toggle';
import type { AppearanceSettings } from '../types';
import {
    GROUP_HEADERS_SECTION,
    TAB_COUNT_SECTION,
    SORT_GROUPS_SECTION
} from '../constants';

interface GroupSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
}

export const GroupSettings: React.FC<GroupSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection
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
                />
                <Toggle
                    checked={appearanceSettings.sortVaultGroupsByCount}
                    onChange={handleSortVaultGroupsByCountChange}
                    label="Sort Vault Groups by Tab Count"
                    description="When enabled, Neural Vault groups are sorted from most to least tabs"
                />
            </CollapsibleSection>
        </div>
    );
};
