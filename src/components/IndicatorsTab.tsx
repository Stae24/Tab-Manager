import React from 'react';
import { Sparkles, CheckCircle2, Volume2, Volume1, VolumeX, Snowflake, Hash } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Toggle } from './ui/Toggle';
import type { AppearanceSettings, FaviconSource, FaviconFallback, FaviconSize, AudioIndicatorMode } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'favicons',
        title: 'Favicons',
        category: 'indicators',
        icon: Sparkles,
        controls: [
            { id: 'show-favicons', label: 'Show Tab Favicons', description: 'Display website icons next to tab titles', keywords: ['favicon', 'icon', 'show', 'display', 'website'] },
            { id: 'favicon-source', label: 'Primary Source', keywords: ['favicon', 'source', 'google', 'duckduckgo', 'icon horse', 'chrome'] },
            { id: 'favicon-size', label: 'Icon Size', keywords: ['favicon', 'size', 'icon', '16', '32', '64', '128'] },
            { id: 'favicon-fallback', label: 'Fallback Source', keywords: ['favicon', 'fallback', 'source', 'none', 'disabled'] },
        ],
    },
    {
        id: 'active-tab',
        title: 'Active Tab',
        category: 'indicators',
        icon: CheckCircle2,
        controls: [
            { id: 'show-active-glow', label: 'Show Active Glow', description: 'Highlight the currently active tab with a glow effect', keywords: ['active', 'glow', 'indicator', 'highlight'] },
        ],
    },
    {
        id: 'audio-indicators',
        title: 'Audio Indicators',
        category: 'indicators',
        icon: Volume2,
        controls: [
            { id: 'audio-display', label: 'Display Logic', keywords: ['audio', 'sound', 'indicator', 'playing', 'muted', 'hidden'] },
        ],
    },
    {
        id: 'frozen-indicators',
        title: 'Frozen Tabs',
        category: 'indicators',
        icon: Snowflake,
        controls: [
            { id: 'show-frozen', label: 'Show Frozen Status', description: 'Show snowflake icon for discarded (sleeping) tabs', keywords: ['frozen', 'snowflake', 'discarded', 'sleeping', 'indicator'] },
        ],
    },
    {
        id: 'tab-count',
        title: 'Tab Count',
        category: 'indicators',
        icon: Hash,
        controls: [
            { id: 'show-tab-count', label: 'Show Tab Count', description: 'Display the number of tabs in each group header', keywords: ['count', 'number', 'tabs'] },
        ],
    },
];

interface IndicatorsTabProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const IndicatorsTab: React.FC<IndicatorsTabProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl,
}) => {
    return (
        <>
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
                    highlighted={highlightedControl?.sectionId === 'favicons' && highlightedControl?.controlId === 'show-favicons'}
                />
                <div className="mt-4 space-y-4">
                    <Dropdown
                        value={appearanceSettings.faviconSource}
                        onChange={(value) => {
                            const newValue = value as FaviconSource;
                            const updates: Partial<AppearanceSettings> = { faviconSource: newValue };
                            if (appearanceSettings.faviconFallback === newValue) {
                                updates.faviconFallback = 'none';
                            }
                            setAppearanceSettings(updates);
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
                id="active-tab"
                title="Active Tab"
                icon={CheckCircle2}
                isExpanded={expandedSections.has('active-tab')}
                onToggle={() => toggleSection('active-tab')}
            >
                <Toggle
                    checked={appearanceSettings.showActiveIndicator}
                    onChange={(checked) => setAppearanceSettings({ showActiveIndicator: checked })}
                    label="Show Active Glow"
                    description="Highlight the currently active tab with a glow effect"
                    highlighted={highlightedControl?.sectionId === 'active-tab' && highlightedControl?.controlId === 'show-active-glow'}
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
                title="Frozen Tabs"
                icon={Snowflake}
                isExpanded={expandedSections.has('frozen-indicators')}
                onToggle={() => toggleSection('frozen-indicators')}
            >
                <Toggle
                    checked={appearanceSettings.showFrozenIndicators}
                    onChange={(checked) => setAppearanceSettings({ showFrozenIndicators: checked })}
                    label="Show Frozen Status"
                    description="Show snowflake icon for discarded (sleeping) tabs"
                    highlighted={highlightedControl?.sectionId === 'frozen-indicators' && highlightedControl?.controlId === 'show-frozen'}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="tab-count"
                title="Tab Count"
                icon={Hash}
                isExpanded={expandedSections.has('tab-count')}
                onToggle={() => toggleSection('tab-count')}
            >
                <Toggle
                    checked={appearanceSettings.showTabCount}
                    onChange={(checked) => setAppearanceSettings({ showTabCount: checked })}
                    label="Show Tab Count"
                    description="Display the number of tabs in each group header"
                    highlighted={highlightedControl?.sectionId === 'tab-count' && highlightedControl?.controlId === 'show-tab-count'}
                />
            </CollapsibleSection>
        </>
    );
};
