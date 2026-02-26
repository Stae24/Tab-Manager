import React from 'react';
import { Terminal } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Toggle } from './ui/Toggle';
import type { AppearanceSettings } from '../types';

interface DevSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
}

export const DevSettings: React.FC<DevSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection
}) => {
    return (
        <CollapsibleSection
            id="debug-mode"
            title="Debug Mode"
            icon={Terminal}
            isExpanded={expandedSections.has('debug-mode')}
            onToggle={() => toggleSection('debug-mode')}
        >
            <Toggle
                checked={appearanceSettings.debugMode}
                onChange={(checked) => setAppearanceSettings({ debugMode: checked })}
                label="Enable Debug Logs"
                description="Show detailed logs in the browser console for troubleshooting"
            />
        </CollapsibleSection>
    );
};
