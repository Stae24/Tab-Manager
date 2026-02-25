import React from 'react';
import { Layers, Type, ArrowUp } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Toggle } from './ui/Toggle';
import type { AppearanceSettings } from '../types';

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
    return (
        <>
            <CollapsibleSection
                id="group-headers"
                title="Group Headers"
                icon={Layers}
                isExpanded={expandedSections.has('group-headers')}
                onToggle={() => toggleSection('group-headers')}
            >
                <Toggle
                    checked={appearanceSettings.compactGroupHeaders}
                    onChange={(checked) => setAppearanceSettings({ compactGroupHeaders: checked })}
                    label="Compact Headers"
                    description="Use smaller headers for tab groups to save space"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="tab-count"
                title="Tab Count"
                icon={Type}
                isExpanded={expandedSections.has('tab-count')}
                onToggle={() => toggleSection('tab-count')}
            >
                <Toggle
                    checked={appearanceSettings.showTabCount}
                    onChange={(checked) => setAppearanceSettings({ showTabCount: checked })}
                    label="Show Tab Count"
                    description="Display the number of tabs in each group header"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="sort-groups"
                title="Sort Groups"
                icon={ArrowUp}
                isExpanded={expandedSections.has('sort-groups')}
                onToggle={() => toggleSection('sort-groups')}
            >
                <Toggle
                    checked={appearanceSettings.sortGroupsByCount}
                    onChange={(checked) => setAppearanceSettings({ sortGroupsByCount: checked })}
                    label="Sort Live Groups by Tab Count"
                    description="When enabled, Live Workspace groups are sorted from most to least tabs"
                />
                <div className="h-2" />
                <Toggle
                    checked={appearanceSettings.sortVaultGroupsByCount}
                    onChange={(checked) => setAppearanceSettings({ sortVaultGroupsByCount: checked })}
                    label="Sort Vault Groups by Tab Count"
                    description="When enabled, Neural Vault groups are sorted from most to least tabs"
                />
            </CollapsibleSection>
        </>
    );
};
