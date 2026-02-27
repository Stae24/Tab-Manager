import React from 'react';
import {
    Layout,
    MinusCircle,
    Minus,
    Layers,
    Plus,
    Sparkles,
    CheckCircle2,
    Volume2,
    Volume1,
    VolumeX,
    Snowflake,
    GripVertical
} from 'lucide-react';
import { cn } from '../utils/cn';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Toggle } from './ui/Toggle';
import type {
    AppearanceSettings,
    FaviconSource,
    FaviconFallback,
    FaviconSize,
    AudioIndicatorMode,
    TabElementOrder
} from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'tab-density',
        title: 'Tab Density',
        category: 'tabs',
        icon: Layout,
        controls: [
            { id: 'tab-density-options', label: 'Tab Density', keywords: ['tab', 'density', 'minified', 'compact', 'normal', 'spacious'] },
        ],
    },
    {
        id: 'favicons',
        title: 'Favicons',
        category: 'tabs',
        icon: Sparkles,
        controls: [
            { id: 'show-favicons', label: 'Show Tab Favicons', description: 'Display website icons next to tab titles', keywords: ['favicon', 'icon', 'show', 'display', 'website'] },
            { id: 'favicon-source', label: 'Primary Source', keywords: ['favicon', 'source', 'google', 'duckduckgo', 'icon horse', 'chrome'] },
            { id: 'favicon-size', label: 'Icon Size', keywords: ['favicon', 'size', 'icon', '16', '32', '64', '128'] },
            { id: 'favicon-fallback', label: 'Fallback Source', keywords: ['favicon', 'fallback', 'source', 'none', 'disabled'] },
        ],
    },
    {
        id: 'active-indicator',
        title: 'Active Tab Indicator',
        category: 'tabs',
        icon: CheckCircle2,
        controls: [
            { id: 'show-active-glow', label: 'Show Active Glow', description: 'Highlight the currently active tab with a glow effect', keywords: ['active', 'glow', 'indicator', 'highlight'] },
        ],
    },
    {
        id: 'audio-indicators',
        title: 'Audio Indicators',
        category: 'tabs',
        icon: Volume2,
        controls: [
            { id: 'audio-display', label: 'Display Logic', keywords: ['audio', 'sound', 'indicator', 'playing', 'muted', 'hidden'] },
        ],
    },
    {
        id: 'frozen-indicators',
        title: 'Frozen Indicators',
        category: 'tabs',
        icon: Snowflake,
        controls: [
            { id: 'show-frozen', label: 'Show Frozen Status', description: 'Show snowflake icon for discarded (sleeping) tabs', keywords: ['frozen', 'snowflake', 'discarded', 'sleeping', 'indicator'] },
        ],
    },
    {
        id: 'tab-layout',
        title: 'Tab Layout',
        category: 'tabs',
        icon: GripVertical,
        controls: [
            { id: 'element-order', label: 'Element Order', keywords: ['element', 'order', 'layout', 'favicon', 'indicator', 'position'] },
        ],
    },
];

type TabDensity = AppearanceSettings['tabDensity'];

interface TabSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const TabSettings: React.FC<TabSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    return (
        <>
            <CollapsibleSection
                id="tab-density"
                title="Tab Density"
                icon={Layout}
                isExpanded={expandedSections.has('tab-density')}
                onToggle={() => toggleSection('tab-density')}
            >
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { value: 'minified', label: 'Minified', icon: MinusCircle },
                        { value: 'compact', label: 'Compact', icon: Minus },
                        { value: 'normal', label: 'Normal', icon: Layers },
                        { value: 'spacious', label: 'Spacious', icon: Plus },
                    ].map((density) => (
                        <button
                            type="button"
                            key={density.value}
                            onClick={() => setAppearanceSettings({ tabDensity: density.value as TabDensity })}
                            aria-pressed={appearanceSettings.tabDensity === density.value}
                            className={cn(
                                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                                appearanceSettings.tabDensity === density.value
                                    ? "bg-gx-cyan/10 border-gx-cyan/50"
                                    : "bg-gx-gray border-white/5 hover:border-gx-cyan/30"
                            )}
                        >
                            <density.icon size={20} className={cn(
                                appearanceSettings.tabDensity === density.value ? "text-gx-cyan" : "text-gray-500"
                            )} />
                            <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider",
                                appearanceSettings.tabDensity === density.value ? "text-gx-cyan" : "text-gray-500"
                            )}>
                                {density.label}
                            </span>
                        </button>
                    ))}
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="favicons"
                title="Favicons"
                icon={Sparkles}
                isExpanded={expandedSections.has('favicons')}
                onToggle={() => toggleSection('favicons')}
            >
                <Toggle
                    checked={appearanceSettings.showFavicons}
                    onChange={(checked) => setAppearanceSettings({ showFavicons: checked })}
                    label="Show Tab Favicons"
                    description="Display website icons next to tab titles"
                />
                <div className="mt-4 space-y-4">
                    <Dropdown
                        value={appearanceSettings.faviconSource}
                        onChange={(value) => {
                            setAppearanceSettings({ faviconSource: value as FaviconSource });
                            if (appearanceSettings.faviconFallback === value) {
                                setAppearanceSettings({ faviconFallback: 'none' });
                            }
                        }}
                        options={[
                            { value: 'google', label: 'Google (32px)' },
                            { value: 'google-hd', label: 'Google HD (128px)' },
                            { value: 'duckduckgo', label: 'DuckDuckGo' },
                            { value: 'icon-horse', label: 'Icon Horse' },
                            { value: 'chrome', label: 'Chrome Extension' },
                        ]}
                        label="Primary Source"
                        disabled={!appearanceSettings.showFavicons}
                    />
                    <Dropdown
                        value={appearanceSettings.faviconSize}
                        onChange={(value) => setAppearanceSettings({ faviconSize: value as FaviconSize })}
                        options={[
                            { value: '16', label: '16px (Small)' },
                            { value: '32', label: '32px (Normal)' },
                            { value: '64', label: '64px (Large)' },
                            { value: '128', label: '128px (Extra Large)' },
                        ]}
                        label="Icon Size"
                        disabled={!appearanceSettings.showFavicons}
                    />
                    <Dropdown
                        value={appearanceSettings.faviconFallback}
                        onChange={(value) => setAppearanceSettings({ faviconFallback: value as FaviconFallback })}
                        options={[
                            { value: 'none', label: 'None (disabled)' },
                            ...(appearanceSettings.faviconSource !== 'google' ? [{ value: 'google', label: 'Google (32px)' }] : []),
                            ...(appearanceSettings.faviconSource !== 'google-hd' ? [{ value: 'google-hd', label: 'Google HD (128px)' }] : []),
                            ...(appearanceSettings.faviconSource !== 'duckduckgo' ? [{ value: 'duckduckgo', label: 'DuckDuckGo' }] : []),
                            ...(appearanceSettings.faviconSource !== 'icon-horse' ? [{ value: 'icon-horse', label: 'Icon Horse' }] : []),
                            ...(appearanceSettings.faviconSource !== 'chrome' ? [{ value: 'chrome', label: 'Chrome Extension' }] : []),
                        ]}
                        label="Fallback Source"
                        disabled={!appearanceSettings.showFavicons}
                    />
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="active-indicator"
                title="Active Tab Indicator"
                icon={CheckCircle2}
                isExpanded={expandedSections.has('active-indicator')}
                onToggle={() => toggleSection('active-indicator')}
            >
                <Toggle
                    checked={appearanceSettings.showActiveIndicator}
                    onChange={(checked) => setAppearanceSettings({ showActiveIndicator: checked })}
                    label="Show Active Glow"
                    description="Highlight the currently active tab with a glow effect"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="audio-indicators"
                title="Audio Indicators"
                icon={Volume2}
                isExpanded={expandedSections.has('audio-indicators')}
                onToggle={() => toggleSection('audio-indicators')}
            >
                <Dropdown
                    value={appearanceSettings.showAudioIndicators}
                    onChange={(value) => setAppearanceSettings({ showAudioIndicators: value as AudioIndicatorMode })}
                    options={[
                        { value: 'off', label: 'Hidden', icon: VolumeX },
                        { value: 'playing', label: 'Only when Playing', icon: Volume2 },
                        { value: 'muted', label: 'Only when Muted', icon: VolumeX },
                        { value: 'both', label: 'Show Both', icon: Volume1 },
                    ]}
                    label="Display Logic"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="frozen-indicators"
                title="Frozen Indicators"
                icon={Snowflake}
                isExpanded={expandedSections.has('frozen-indicators')}
                onToggle={() => toggleSection('frozen-indicators')}
            >
                <Toggle
                    checked={appearanceSettings.showFrozenIndicators}
                    onChange={(checked) => setAppearanceSettings({ showFrozenIndicators: checked })}
                    label="Show Frozen Status"
                    description="Show snowflake icon for discarded (sleeping) tabs"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="tab-layout"
                title="Tab Layout"
                icon={GripVertical}
                isExpanded={expandedSections.has('tab-layout')}
                onToggle={() => toggleSection('tab-layout')}
            >
                <Dropdown
                    value={appearanceSettings.tabElementOrder}
                    onChange={(value) => setAppearanceSettings({ tabElementOrder: value as TabElementOrder })}
                    options={[
                        { value: 'indicators-first', label: 'Indicators → Favicon → Title' },
                        { value: 'favicon-first', label: 'Favicon → Title → Indicators' },
                    ]}
                    label="Element Order"
                />
            </CollapsibleSection>
        </>
    );
};
