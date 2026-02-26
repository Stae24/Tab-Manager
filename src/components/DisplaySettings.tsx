import React, { useCallback } from 'react';
import { Sun, Moon, Monitor, ZoomIn, Palette, Square } from 'lucide-react';
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

function isThemeMode(value: unknown): value is ThemeMode {
    return value === 'dark' || value === 'light' || value === 'system';
}

function isBorderRadius(value: unknown): value is BorderRadius {
    return value === 'none' || value === 'small' || value === 'medium' || value === 'large' || value === 'full';
}

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
    const handleToggleTheme = useCallback(() => {
        toggleSection('theme');
    }, [toggleSection]);

    const handleToggleUiScale = useCallback(() => {
        toggleSection('ui-scale');
    }, [toggleSection]);

    const handleToggleAccentColor = useCallback(() => {
        toggleSection('accent-color');
    }, [toggleSection]);

    const handleToggleBorderRadius = useCallback(() => {
        toggleSection('border-radius');
    }, [toggleSection]);

    const handleThemeChange = useCallback((value: unknown) => {
        if (isThemeMode(value)) {
            setAppearanceSettings({ theme: value });
        }
    }, [setAppearanceSettings]);

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

    const handleAccentColorChange = useCallback((value: string) => {
        setAppearanceSettings({ accentColor: value });
    }, [setAppearanceSettings]);

    return (
        <>
            <CollapsibleSection
                id="theme"
                title="Theme Mode"
                icon={Monitor}
                isExpanded={expandedSections.has('theme')}
                onToggle={handleToggleTheme}
            >
                <Dropdown
                    value={appearanceSettings.theme}
                    onChange={handleThemeChange}
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
                id="accent-color"
                title="Accent Color"
                icon={Palette}
                isExpanded={expandedSections.has('accent-color')}
                onToggle={handleToggleAccentColor}
            >
                <ColorPalette
                    value={appearanceSettings.accentColor}
                    onChange={handleAccentColorChange}
                    label="Choose Accent Color"
                />
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
