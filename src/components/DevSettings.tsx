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
            { id: 'debug-overlays-toggle', label: 'Show Debug Overlays', description: 'Visual debug overlays for dropzones and UI components', keywords: ['debug', 'overlays', 'visual', 'dropzone', 'ui'] },
            { id: 'disable-proximity-gap-toggle', label: 'Disable Proximity Gap', description: 'Disable the proximity gap opening behavior during drag operations', keywords: ['proximity', 'gap', 'drag', 'dnd', 'drop'] },
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
    const isDebugLogsHighlighted = highlightedControl?.sectionId === 'debug-mode' && highlightedControl?.controlId === 'debug-mode-toggle';
    const isDebugOverlaysHighlighted = highlightedControl?.sectionId === 'debug-mode' && highlightedControl?.controlId === 'debug-overlays-toggle';
    const isDisableProximityGapHighlighted = highlightedControl?.sectionId === 'debug-mode' && highlightedControl?.controlId === 'disable-proximity-gap-toggle';

    return (
        <CollapsibleSection
            id="debug-mode"
            title="Debug Mode"
            icon={Terminal}
            isExpanded={expandedSections.has('debug-mode')}
            onToggle={() => toggleSection('debug-mode')}
        >
            <div className="space-y-4">
                <div id="debug-mode-toggle" className={isDebugLogsHighlighted ? 'animate-pulse rounded-lg ring-2 ring-gx-accent -m-1 p-1' : ''}>
                    <Toggle
                        checked={appearanceSettings.debugMode}
                        onChange={(checked) => setAppearanceSettings({ debugMode: checked })}
                        label="Enable Debug Logs"
                        description="Show detailed logs in the browser console for troubleshooting"
                    />
                </div>
                <div id="debug-overlays-toggle" className={isDebugOverlaysHighlighted ? 'animate-pulse rounded-lg ring-2 ring-gx-accent -m-1 p-1' : ''}>
                    <Toggle
                        checked={appearanceSettings.showDebugOverlays}
                        onChange={(checked) => setAppearanceSettings({ showDebugOverlays: checked })}
                        label="Show Debug Overlays"
                        description="Visual debug overlays for dropzones and UI components"
                    />
                </div>
                <div id="disable-proximity-gap-toggle" className={isDisableProximityGapHighlighted ? 'animate-pulse rounded-lg ring-2 ring-gx-accent -m-1 p-1' : ''}>
                    <Toggle
                        checked={appearanceSettings.disableProximityGap ?? false}
                        onChange={(checked) => setAppearanceSettings({ disableProximityGap: checked })}
                        label="Disable Proximity Gap"
                        description="Disable the proximity gap opening behavior during drag operations"
                    />
                </div>
            </div>
        </CollapsibleSection>
    );
};
