import React from 'react';
import { Sun, Moon, Monitor, ZoomIn, Palette, Box } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Slider } from './ui/Slider';
import { ColorPalette } from './ui/ColorPalette';
import {
    UI_SCALE_MIN,
    UI_SCALE_MAX,
    UI_SCALE_STEP
} from '../constants';
import type { AppearanceSettings, ThemeMode, BorderRadius } from '../types';

interface DisplaySettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
}

export const DisplaySettings: React.FC<DisplaySettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection
}) => {
    return (
        <>
            <CollapsibleSection
                id="theme"
                title="Theme Mode"
                icon={Monitor}
                isExpanded={expandedSections.has('theme')}
                onToggle={() => toggleSection('theme')}
            >
                <Dropdown
                    value={appearanceSettings.theme}
                    onChange={(value) => setAppearanceSettings({ theme: value as ThemeMode })}
                    options={[
                        { value: 'dark', label: 'Dark Mode', icon: Moon },
                        { value: 'light', label: 'Light Mode', icon: Sun },
                        { value: 'system', label: 'System Default', icon: Monitor },
                    ]}
                    label="Select Theme"
                />
            </CollapsibleSection>

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
                id="accent-color"
                title="Accent Color"
                icon={Palette}
                isExpanded={expandedSections.has('accent-color')}
                onToggle={() => toggleSection('accent-color')}
            >
                <ColorPalette
                    value={appearanceSettings.accentColor}
                    onChange={(value) => setAppearanceSettings({ accentColor: value })}
                    label="Choose Accent Color"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="border-radius"
                title="Border Radius"
                icon={Box}
                isExpanded={expandedSections.has('border-radius')}
                onToggle={() => toggleSection('border-radius')}
            >
                <Dropdown
                    value={appearanceSettings.borderRadius}
                    onChange={(value) => setAppearanceSettings({ borderRadius: value as BorderRadius })}
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
