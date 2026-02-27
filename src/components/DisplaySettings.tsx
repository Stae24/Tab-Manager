import React, { useCallback } from 'react';
import { ZoomIn, Square } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Slider } from './ui/Slider';
import {
    UI_SCALE_MIN,
    UI_SCALE_MAX,
    UI_SCALE_STEP
} from '../constants';
import type { AppearanceSettings, BorderRadius } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'ui-scale',
        title: 'UI Scale',
        category: 'display',
        icon: ZoomIn,
        controls: [
            { id: 'interface-scale', label: 'Interface Scale', keywords: ['scale', 'zoom', 'interface', 'ui'] },
            { id: 'settings-scale', label: 'Settings Panel Scale', keywords: ['settings', 'panel', 'scale'] },
        ],
    },
    {
        id: 'border-radius',
        title: 'Border Radius',
        category: 'display',
        icon: Square,
        controls: [
            { id: 'corner-style', label: 'Corner Style', keywords: ['corner', 'radius', 'border', 'square', 'pill', 'rounded'] },
        ],
    },
];

function isBorderRadius(value: unknown): value is BorderRadius {
    return value === 'none' || value === 'small' || value === 'medium' || value === 'large' || value === 'full';
}

interface DisplaySettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const DisplaySettings: React.FC<DisplaySettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    const handleToggleUiScale = useCallback(() => {
        toggleSection('ui-scale');
    }, [toggleSection]);

    const handleToggleBorderRadius = useCallback(() => {
        toggleSection('border-radius');
    }, [toggleSection]);

    const handleBorderRadiusChange = useCallback((value: unknown) => {
        if (isBorderRadius(value)) {
            setAppearanceSettings({ borderRadius: value });
        }
    }, [setAppearanceSettings]);

    const handleUiScaleChange = useCallback((value: number) => {
        setAppearanceSettings({ uiScale: value });
    }, [setAppearanceSettings]);

    const handleSettingsScaleChange = useCallback((value: number) => {
        setAppearanceSettings({ settingsScale: value });
    }, [setAppearanceSettings]);

    return (
        <>
            <CollapsibleSection
                id="ui-scale"
                title="UI Scale"
                icon={ZoomIn}
                isExpanded={expandedSections.has('ui-scale')}
                onToggle={handleToggleUiScale}
            >
                <div className="space-y-4">
                    <Slider
                        value={appearanceSettings.uiScale}
                        onChange={handleUiScaleChange}
                        min={UI_SCALE_MIN}
                        max={UI_SCALE_MAX}
                        step={UI_SCALE_STEP}
                        label="Interface Scale"
                        displayValue={`${Math.round(appearanceSettings.uiScale * 100)}%`}
                    />
                    <Slider
                        value={appearanceSettings.settingsScale}
                        onChange={handleSettingsScaleChange}
                        min={UI_SCALE_MIN}
                        max={UI_SCALE_MAX}
                        step={UI_SCALE_STEP}
                        label="Settings Panel Scale"
                        displayValue={`${Math.round(appearanceSettings.settingsScale * 100)}%`}
                    />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="border-radius"
                title="Border Radius"
                icon={Square}
                isExpanded={expandedSections.has('border-radius')}
                onToggle={handleToggleBorderRadius}
            >
                <Dropdown
                    value={appearanceSettings.borderRadius}
                    onChange={handleBorderRadiusChange}
                    options={[
                        { value: 'none', label: 'None (Square)' },
                        { value: 'small', label: 'Small' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'large', label: 'Large' },
                        { value: 'full', label: 'Full (Pill)' },
                    ]}
                    label="Corner Style"
                />
            </CollapsibleSection>
        </>
    );
};
