import React from 'react';
import { LayoutPanelTop, Sparkles, Terminal } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Slider } from './ui/Slider';
import { Toggle } from './ui/Toggle';

import type { AppearanceSettings } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'header',
        title: 'Header',
        category: 'advanced',
        icon: LayoutPanelTop,
        controls: [
            { id: 'show-island-manager-icon', label: 'Show Icon', keywords: ['icon', 'show', 'header', 'logo'] },
            { id: 'show-island-manager-title', label: 'Show Title', keywords: ['title', 'show', 'header', 'text'] },
            { id: 'move-settings-button-down', label: 'Move Settings Down', keywords: ['settings', 'button', 'move', 'down'] },
        ],
    },
    {
        id: 'background-effects',
        title: 'Background Effects',
        category: 'advanced',
        icon: Sparkles,
        controls: [
            { id: 'settings-blur', label: 'Settings Background Blur', keywords: ['blur', 'background', 'settings', 'overlay'] },
            { id: 'settings-opacity', label: 'Settings Overlay Opacity', keywords: ['opacity', 'background', 'settings', 'overlay'] },
        ],
    },
    {
        id: 'developer',
        title: 'Developer',
        category: 'advanced',
        icon: Terminal,
        controls: [
            { id: 'debug-mode-toggle', label: 'Enable Debug Logs', description: 'Show detailed logs in the browser console for troubleshooting', keywords: ['debug', 'logs', 'troubleshooting', 'console'] },
            { id: 'debug-overlays-toggle', label: 'Show Debug Overlays', description: 'Visual debug overlays for dropzones and UI components', keywords: ['debug', 'overlays', 'visual', 'dropzone', 'ui'] },
            { id: 'disable-proximity-gap-toggle', label: 'Disable Proximity Gap', description: 'Disable the proximity gap opening behavior during drag operations', keywords: ['proximity', 'gap', 'drag', 'dnd', 'drop'] },
        ],
    },
];

interface AdvancedTabProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    const isDebugLogsHighlighted = highlightedControl?.sectionId === 'developer' && highlightedControl?.controlId === 'debug-mode-toggle';
    const isDebugOverlaysHighlighted = highlightedControl?.sectionId === 'developer' && highlightedControl?.controlId === 'debug-overlays-toggle';
    const isDisableProximityGapHighlighted = highlightedControl?.sectionId === 'developer' && highlightedControl?.controlId === 'disable-proximity-gap-toggle';

    return (
        <>
            <CollapsibleSection
                id="header"
                title="Header"
                icon={LayoutPanelTop}
                isExpanded={expandedSections.has('header')}
                onToggle={() => toggleSection('header')}
            >
                <Toggle
                    checked={appearanceSettings.showIslandManagerIcon}
                    onChange={(checked) => setAppearanceSettings({ showIslandManagerIcon: checked })}
                    label="Show Icon"
                    description="Display the gradient icon in the header"
                    highlighted={highlightedControl?.sectionId === 'header' && highlightedControl?.controlId === 'show-island-manager-icon'}
                />
                <Toggle
                    checked={appearanceSettings.showIslandManagerTitle}
                    onChange={(checked) => setAppearanceSettings({ showIslandManagerTitle: checked })}
                    label="Show Title"
                    description="Display the Island Manager title and edition text"
                    highlighted={highlightedControl?.sectionId === 'header' && highlightedControl?.controlId === 'show-island-manager-title'}
                />
                <Toggle
                    checked={appearanceSettings.moveSettingsButtonDown}
                    onChange={(checked) => setAppearanceSettings({ moveSettingsButtonDown: checked })}
                    label="Move Settings Down"
                    description="Move the settings button to the row with Theme, Vault, and Export"
                    highlighted={highlightedControl?.sectionId === 'header' && highlightedControl?.controlId === 'move-settings-button-down'}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="background-effects"
                title="Background Effects"
                icon={Sparkles}
                isExpanded={expandedSections.has('background-effects')}
                onToggle={() => toggleSection('background-effects')}
            >
                <div className="space-y-4">
                    <Slider
                        value={appearanceSettings.settingsBackgroundBlur ?? 0}
                        onChange={(value) => setAppearanceSettings({ settingsBackgroundBlur: value })}
                        min={0}
                        max={100}
                        step={1}
                        label="Settings Background Blur"
                        displayValue={appearanceSettings.settingsBackgroundBlur === 0 ? 'None' : appearanceSettings.settingsBackgroundBlur === 100 ? 'Maximum' : `${appearanceSettings.settingsBackgroundBlur}px`}
                    />
                    <Slider
                        value={appearanceSettings.settingsBackgroundOpacity ?? 0}
                        onChange={(value) => setAppearanceSettings({ settingsBackgroundOpacity: value })}
                        min={0}
                        max={100}
                        step={1}
                        label="Settings Overlay Opacity"
                        displayValue={appearanceSettings.settingsBackgroundOpacity === 0 ? 'None' : `${appearanceSettings.settingsBackgroundOpacity}%`}
                    />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="developer"
                title="Developer"
                icon={Terminal}
                isExpanded={expandedSections.has('developer')}
                onToggle={() => toggleSection('developer')}
            >
                <div className="space-y-4">
                    <Toggle
                        checked={appearanceSettings.debugMode}
                        onChange={(checked) => setAppearanceSettings({ debugMode: checked })}
                        label="Enable Debug Logs"
                        description="Show detailed logs in the browser console for troubleshooting"
                        highlighted={isDebugLogsHighlighted}
                    />
                    <Toggle
                        checked={appearanceSettings.showDebugOverlays}
                        onChange={(checked) => setAppearanceSettings({ showDebugOverlays: checked })}
                        label="Show Debug Overlays"
                        description="Visual debug overlays for dropzones and UI components"
                        highlighted={isDebugOverlaysHighlighted}
                    />
                    <Toggle
                        checked={appearanceSettings.disableProximityGap ?? false}
                        onChange={(checked) => setAppearanceSettings({ disableProximityGap: checked })}
                        label="Disable Proximity Gap"
                        description="Disable the proximity gap opening behavior during drag operations"
                        highlighted={isDisableProximityGapHighlighted}
                    />
                </div>
            </CollapsibleSection>
        </>
    );
};
