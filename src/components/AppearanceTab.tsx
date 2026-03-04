import React, { useCallback } from 'react';
import { Monitor, Palette, Moon, Sun, MonitorSmartphone, Paintbrush, Check, X, Sparkles, Square, Type, MoreHorizontal } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { ColorPalette } from './ui/ColorPalette';
import { Dropdown } from './ui/Dropdown';
import { cn } from '../utils/cn';
import type { AppearanceSettings, ThemeMode, AccentMode, AnimationIntensity, BorderRadius, IconPack, LoadingSpinnerStyle } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'color-themes',
        title: 'Color Themes',
        category: 'appearance',
        icon: Monitor,
        controls: [
            { id: 'theme-select', label: 'Color Themes', keywords: ['theme', 'color', 'dark', 'light', 'system', 'ocean', 'forest', 'sunset', 'dracula', 'nord', 'monokai', 'solarized', 'midnight', 'cyberpunk', 'coffee'] },
        ],
    },
    {
        id: 'accent-color',
        title: 'Accent Color',
        category: 'appearance',
        icon: Palette,
        controls: [
            { id: 'choose-accent', label: 'Choose Accent Color', keywords: ['accent', 'color', 'primary', 'button', 'highlight'] },
        ],
    },
    {
        id: 'themed-elements',
        title: 'Themed Elements',
        category: 'appearance',
        icon: Palette,
        controls: [
            { id: 'theme-backgrounds', label: 'Backgrounds', description: 'Main app background color', keywords: ['background', 'theme', 'color'] },
            { id: 'theme-panels', label: 'Panels & Sidebars', description: 'Islands, settings panels, and context menus', keywords: ['panel', 'sidebar', 'island', 'theme'] },
            { id: 'theme-text', label: 'Text & Borders', description: 'Typography and outline colors', keywords: ['text', 'border', 'typography', 'theme'] },
        ],
    },
    {
        id: 'animations',
        title: 'Animations',
        category: 'appearance',
        icon: Sparkles,
        controls: [
            { id: 'animation-style', label: 'Animation Style', keywords: ['animation', 'full', 'subtle', 'off', 'effects'] },
        ],
    },
    {
        id: 'border-radius',
        title: 'Border Radius',
        category: 'appearance',
        icon: Square,
        controls: [
            { id: 'corner-style', label: 'Corner Style', keywords: ['corner', 'radius', 'border', 'square', 'pill', 'rounded'] },
        ],
    },
    {
        id: 'icon-pack',
        title: 'Icon Pack',
        category: 'appearance',
        icon: Type,
        controls: [
            { id: 'icon-style', label: 'Icon Style', keywords: ['icon', 'pack', 'gx', 'gaming', 'standard', 'minimal'] },
        ],
    },
    {
        id: 'loading-spinner',
        title: 'Loading Spinner',
        category: 'appearance',
        icon: MoreHorizontal,
        controls: [
            { id: 'spinner-animation', label: 'Spinner Animation', keywords: ['spinner', 'loading', 'pulse', 'dots', 'bars', 'ring'] },
        ],
    },
];

const THEME_OPTIONS: { id: ThemeMode; label: string; icon?: React.ElementType; colors: { bg: string; panel: string; text: string; primary: string } }[] = [
    { id: 'system', label: 'System Default', icon: MonitorSmartphone, colors: { bg: '#0e0e0e', panel: '#1c1c1c', text: '#ffffff', primary: '#7f22fe' } },
    { id: 'dark', label: 'Dark Mode', icon: Moon, colors: { bg: '#0e0e0e', panel: '#1c1c1c', text: '#ffffff', primary: '#7f22fe' } },
    { id: 'dark-pro', label: 'Dark Pro', icon: Moon, colors: { bg: '#000000', panel: '#111111', text: '#ffffff', primary: '#7f22fe' } },
    { id: 'light', label: 'Light Mode', icon: Sun, colors: { bg: '#f8fafc', panel: '#ffffff', text: '#0f172a', primary: '#ef4444' } },
    { id: 'ocean', label: 'Ocean', colors: { bg: '#0f172a', panel: '#1e293b', text: '#f8fafc', primary: '#38bdf8' } },
    { id: 'forest', label: 'Forest', colors: { bg: '#142e1f', panel: '#1f452f', text: '#f1f8f4', primary: '#4ade80' } },
    { id: 'sunset', label: 'Sunset', colors: { bg: '#2a1b28', panel: '#402434', text: '#f9e3d8', primary: '#fb923c' } },
    { id: 'dracula', label: 'Dracula', colors: { bg: '#282a36', panel: '#44475a', text: '#f8f8f2', primary: '#ff79c6' } },
    { id: 'nord', label: 'Nord', colors: { bg: '#2e3440', panel: '#3b4252', text: '#eceff4', primary: '#88c0d0' } },
    { id: 'monokai', label: 'Monokai', colors: { bg: '#272822', panel: '#3e3d32', text: '#f8f8f2', primary: '#a6e22e' } },
    { id: 'solarized-light', label: 'Solar Light', icon: Sun, colors: { bg: '#fdf6e3', panel: '#eee8d5', text: '#586e75', primary: '#b58900' } },
    { id: 'solarized-dark', label: 'Solar Dark', colors: { bg: '#002b36', panel: '#073642', text: '#839496', primary: '#2aa198' } },
    { id: 'midnight', label: 'Midnight', colors: { bg: '#020617', panel: '#0f172a', text: '#f8fafc', primary: '#6366f1' } },
    { id: 'cyberpunk', label: 'Cyberpunk', colors: { bg: '#120024', panel: '#240046', text: '#00ffff', primary: '#f00' } },
    { id: 'coffee', label: 'Coffee', colors: { bg: '#2c211f', panel: '#3e2f2b', text: '#eee0d5', primary: '#d4a373' } },
];

function isBorderRadius(value: unknown): value is BorderRadius {
    return value === 'none' || value === 'small' || value === 'medium' || value === 'large' || value === 'full';
}

interface AppearanceTabProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    const handleThemeChange = useCallback((value: ThemeMode) => {
        setAppearanceSettings({ theme: value });
    }, [setAppearanceSettings]);

    const handleAccentModeChange = useCallback((mode: AccentMode) => {
        setAppearanceSettings({
            themeElements: {
                ...appearanceSettings.themeElements,
                accent: mode
            }
        });
    }, [appearanceSettings.themeElements, setAppearanceSettings]);

    const handleAccentColorChange = useCallback((value: string) => {
        setAppearanceSettings({
            accentColor: value,
            themeElements: {
                ...appearanceSettings.themeElements,
                accent: 'custom'
            }
        });
    }, [appearanceSettings.themeElements, setAppearanceSettings]);

    const handleThemeElementToggle = useCallback((key: 'background' | 'panels' | 'text') => {
        setAppearanceSettings({
            themeElements: {
                ...appearanceSettings.themeElements,
                [key]: !appearanceSettings.themeElements[key]
            }
        });
    }, [appearanceSettings.themeElements, setAppearanceSettings]);

    const handleBorderRadiusChange = useCallback((value: unknown) => {
        if (isBorderRadius(value)) {
            setAppearanceSettings({ borderRadius: value });
        }
    }, [setAppearanceSettings]);

    return (
        <>
            <CollapsibleSection
                id="color-themes"
                title="Color Themes"
                icon={Monitor}
                isExpanded={expandedSections.has('color-themes')}
                onToggle={() => toggleSection('color-themes')}
            >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {THEME_OPTIONS.map((themeOption) => {
                        const isSelected = appearanceSettings.theme === themeOption.id;
                        return (
                            <button
                                key={themeOption.id}
                                onClick={() => handleThemeChange(themeOption.id)}
                                className={cn(
                                    "flex flex-col items-start p-3 rounded-xl border-2 transition-all hover:scale-[1.02]",
                                    isSelected
                                        ? "border-gx-accent bg-gx-accent/10 shadow-lg shadow-gx-accent/20"
                                        : "border-gx-border bg-gx-gray/30 hover:bg-gx-gray/50 hover:border-gx-border"
                                )}
                            >
                                <div
                                    className="w-full h-12 rounded-lg mb-2 relative overflow-hidden flex flex-col"
                                    style={{ backgroundColor: themeOption.colors.bg }}
                                >
                                    <div
                                        className="absolute top-0 left-0 right-0 h-4 border-b border-black/10 flex items-center px-1.5 gap-1"
                                        style={{ backgroundColor: themeOption.colors.panel }}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/80" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/80" />
                                    </div>
                                    <div className="mt-5 mx-2 flex gap-1 items-center">
                                        <div
                                            className="w-4 h-4 rounded-md shrink-0"
                                            style={{ backgroundColor: themeOption.colors.primary }}
                                        />
                                        <div
                                            className="h-2 w-full rounded-full opacity-60"
                                            style={{ backgroundColor: themeOption.colors.text }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 w-full">
                                    {themeOption.icon && <themeOption.icon size={12} className="text-gx-muted" />}
                                    <span className={cn(
                                        "text-xs font-semibold truncate",
                                        isSelected ? "text-gx-accent" : "text-gx-text"
                                    )}>
                                        {themeOption.label}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="accent-color"
                title="Accent Color"
                icon={Palette}
                isExpanded={expandedSections.has('accent-color')}
                onToggle={() => toggleSection('accent-color')}
            >
                <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => handleAccentModeChange('custom')}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                                appearanceSettings.themeElements.accent === 'custom'
                                    ? "border-gx-accent bg-gx-accent/10"
                                    : "border-gx-border bg-gx-gray/30 hover:bg-gx-gray/50"
                            )}
                        >
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                appearanceSettings.themeElements.accent === 'custom'
                                    ? "border-gx-accent"
                                    : "border-gx-border"
                            )}>
                                {appearanceSettings.themeElements.accent === 'custom' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-gx-accent" />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <Paintbrush size={14} className="text-gx-muted" />
                                    <span className="text-sm font-medium text-gx-text">Custom Color</span>
                                </div>
                                <span className="text-xs text-gx-muted">Pick your own accent color</span>
                            </div>
                        </button>

                        <button
                            onClick={() => handleAccentModeChange('theme')}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                                appearanceSettings.themeElements.accent === 'theme'
                                    ? "border-gx-accent bg-gx-accent/10"
                                    : "border-gx-border bg-gx-gray/30 hover:bg-gx-gray/50"
                            )}
                        >
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                appearanceSettings.themeElements.accent === 'theme'
                                    ? "border-gx-accent"
                                    : "border-gx-border"
                            )}>
                                {appearanceSettings.themeElements.accent === 'theme' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-gx-accent" />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <Check size={14} className="text-gx-muted" />
                                    <span className="text-sm font-medium text-gx-text">Theme Default</span>
                                </div>
                                <span className="text-xs text-gx-muted">Use the selected theme's accent color</span>
                            </div>
                        </button>

                        <button
                            onClick={() => handleAccentModeChange('none')}
                            className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                                appearanceSettings.themeElements.accent === 'none'
                                    ? "border-gx-accent bg-gx-accent/10"
                                    : "border-gx-border bg-gx-gray/30 hover:bg-gx-gray/50"
                            )}
                        >
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                appearanceSettings.themeElements.accent === 'none'
                                    ? "border-gx-accent"
                                    : "border-gx-border"
                            )}>
                                {appearanceSettings.themeElements.accent === 'none' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-gx-accent" />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <X size={14} className="text-gx-muted" />
                                    <span className="text-sm font-medium text-gx-text">None</span>
                                </div>
                                <span className="text-xs text-gx-muted">Disable accent styling entirely</span>
                            </div>
                        </button>
                    </div>

                    {appearanceSettings.themeElements.accent === 'custom' && (
                        <div className="pt-2 border-t border-gx-border">
                            <ColorPalette
                                value={appearanceSettings.accentColor}
                                onChange={handleAccentColorChange}
                                label="Choose Accent Color"
                            />
                        </div>
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="themed-elements"
                title="Themed Elements"
                icon={Palette}
                isExpanded={expandedSections.has('themed-elements')}
                onToggle={() => toggleSection('themed-elements')}
            >
                <div className="text-xs text-gx-text/60 mb-3 ml-1">
                    Choose which UI elements adapt to the selected theme. Elements toggled off will use the base dark/light palette.
                </div>
                <div className="space-y-2 relative z-10">
                    <button
                        onClick={() => handleThemeElementToggle('background')}
                        className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                            appearanceSettings.themeElements.background
                                ? "border-gx-accent/30 bg-gx-accent/10"
                                : "border-gx-border bg-gx-gray/30"
                        )}
                    >
                        <div>
                            <span className="text-sm font-medium text-gx-text">Backgrounds</span>
                            <span className="text-xs text-gx-muted block">Main app background color</span>
                        </div>
                        <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            appearanceSettings.themeElements.background ? "border-gx-accent" : "border-gx-border"
                        )}>
                            {appearanceSettings.themeElements.background && (
                                <Check size={12} className="text-gx-accent" />
                            )}
                        </div>
                    </button>
                    <button
                        onClick={() => handleThemeElementToggle('panels')}
                        className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                            appearanceSettings.themeElements.panels
                                ? "border-gx-accent/30 bg-gx-accent/10"
                                : "border-gx-border bg-gx-gray/30"
                        )}
                    >
                        <div>
                            <span className="text-sm font-medium text-gx-text">Panels & Sidebars</span>
                            <span className="text-xs text-gx-muted block">Islands, settings panels, and context menus</span>
                        </div>
                        <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            appearanceSettings.themeElements.panels ? "border-gx-accent" : "border-gx-border"
                        )}>
                            {appearanceSettings.themeElements.panels && (
                                <Check size={12} className="text-gx-accent" />
                            )}
                        </div>
                    </button>
                    <button
                        onClick={() => handleThemeElementToggle('text')}
                        className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                            appearanceSettings.themeElements.text
                                ? "border-gx-accent/30 bg-gx-accent/10"
                                : "border-gx-border bg-gx-gray/30"
                        )}
                    >
                        <div>
                            <span className="text-sm font-medium text-gx-text">Text & Borders</span>
                            <span className="text-xs text-gx-muted block">Typography and outline colors</span>
                        </div>
                        <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            appearanceSettings.themeElements.text ? "border-gx-accent" : "border-gx-border"
                        )}>
                            {appearanceSettings.themeElements.text && (
                                <Check size={12} className="text-gx-accent" />
                            )}
                        </div>
                    </button>
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="animations"
                title="Animations"
                icon={Sparkles}
                isExpanded={expandedSections.has('animations')}
                onToggle={() => toggleSection('animations')}
            >
                <Dropdown
                    value={appearanceSettings.animationIntensity}
                    onChange={(value) => setAppearanceSettings({ animationIntensity: value as AnimationIntensity })}
                    options={[
                        { value: 'full', label: 'Full Animations' },
                        { value: 'subtle', label: 'Subtle Effects' },
                        { value: 'off', label: 'Animations Off' },
                    ]}
                    label="Animation Style"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="border-radius"
                title="Border Radius"
                icon={Square}
                isExpanded={expandedSections.has('border-radius')}
                onToggle={() => toggleSection('border-radius')}
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

            <CollapsibleSection
                id="icon-pack"
                title="Icon Pack"
                icon={Type}
                isExpanded={expandedSections.has('icon-pack')}
                onToggle={() => toggleSection('icon-pack')}
            >
                <Dropdown
                    value={appearanceSettings.iconPack}
                    onChange={(value) => setAppearanceSettings({ iconPack: value as IconPack })}
                    options={[
                        { value: 'gx', label: 'GX Gaming' },
                        { value: 'default', label: 'Standard' },
                        { value: 'minimal', label: 'Minimal' },
                    ]}
                    label="Icon Style"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="loading-spinner"
                title="Loading Spinner"
                icon={MoreHorizontal}
                isExpanded={expandedSections.has('loading-spinner')}
                onToggle={() => toggleSection('loading-spinner')}
            >
                <Dropdown
                    value={appearanceSettings.loadingSpinnerStyle}
                    onChange={(value) => setAppearanceSettings({ loadingSpinnerStyle: value as LoadingSpinnerStyle })}
                    options={[
                        { value: 'pulse', label: 'Pulse Glow' },
                        { value: 'dots', label: 'Three Dots' },
                        { value: 'bars', label: 'Loading Bars' },
                        { value: 'ring', label: 'Spinning Ring' },
                    ]}
                    label="Spinner Animation"
                />
            </CollapsibleSection>
        </>
    );
};
