import React from 'react';
import { Terminal } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Toggle } from './ui/Toggle';
import type { AppearanceSettings } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'debug-mode',
        title: 'Debug Mode',
        category: 'dev',
        icon: Terminal,
        controls: [
            { id: 'debug-mode-toggle', label: 'Enable Debug Logs', description: 'Show detailed logs in the browser console for troubleshooting', keywords: ['debug', 'logs', 'troubleshooting', 'console'] },
        ],
    },
];

interface DevSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const DevSettings: React.FC<DevSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    const isHighlighted = highlightedControl?.sectionId === 'debug-mode' && highlightedControl?.controlId === 'debug-mode-toggle';

    return (
        <CollapsibleSection
            id="debug-mode"
            title="Debug Mode"
            icon={Terminal}
            isExpanded={expandedSections.has('debug-mode')}
            onToggle={() => toggleSection('debug-mode')}
        >
            <div id="debug-mode-toggle" className={isHighlighted ? 'animate-pulse rounded-lg ring-2 ring-gx-accent -m-1 p-1' : ''}>
                <Toggle
                    checked={appearanceSettings.debugMode}
                    onChange={(checked) => setAppearanceSettings({ debugMode: checked })}
                    label="Enable Debug Logs"
                    description="Show detailed logs in the browser console for troubleshooting"
                />
            </div>
        </CollapsibleSection>
    );
};
