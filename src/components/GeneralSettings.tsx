import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, MousePointer, SlidersHorizontal, MoreHorizontal, Type, Pin, Keyboard, Search as SearchIcon } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Dropdown } from './ui/Dropdown';
import { Slider } from './ui/Slider';
import { Toggle } from './ui/Toggle';
import {
    DRAG_OPACITY_MIN,
    DRAG_OPACITY_MAX,
    DRAG_OPACITY_STEP,
    SEARCH_DEBOUNCE_MIN,
    SEARCH_DEBOUNCE_MAX,
    SEARCH_DEBOUNCE_STEP,
    SEARCH_DEBOUNCE_MS
} from '../constants';
import { logger } from '../utils/logger';
import type { AppearanceSettings, AnimationIntensity, IconPack, ButtonSize, LoadingSpinnerStyle } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'animations',
        title: 'Animations',
        category: 'general',
        icon: Sparkles,
        controls: [
            { id: 'animation-style', label: 'Animation Style', keywords: ['animation', 'full', 'subtle', 'off', 'effects'] },
        ],
    },
    {
        id: 'drag-opacity',
        title: 'Drag Opacity',
        category: 'general',
        icon: MousePointer,
        controls: [
            { id: 'dragged-opacity', label: 'Dragged Item Opacity', keywords: ['drag', 'opacity', 'dragged'] },
        ],
    },
    {
        id: 'spinner',
        title: 'Loading Spinner',
        category: 'general',
        icon: MoreHorizontal,
        controls: [
            { id: 'spinner-animation', label: 'Spinner Animation', keywords: ['spinner', 'loading', 'pulse', 'dots', 'bars', 'ring'] },
        ],
    },
    {
        id: 'icons',
        title: 'Icon Pack',
        category: 'general',
        icon: Type,
        controls: [
            { id: 'icon-style', label: 'Icon Style', keywords: ['icon', 'pack', 'gx', 'gaming', 'standard', 'minimal'] },
        ],
    },
    {
        id: 'button-size',
        title: 'Button Size',
        category: 'general',
        icon: SlidersHorizontal,
        controls: [
            { id: 'ui-action-size', label: 'UI Action Size', keywords: ['button', 'size', 'small', 'medium', 'large'] },
        ],
    },
    {
        id: 'auto-pin',
        title: 'Tab Manager Pin',
        category: 'general',
        icon: Pin,
        controls: [
            { id: 'auto-pin-tab-manager', label: 'Auto-Pin Tab Manager', description: 'Automatically pin the Tab Manager page when opened via extension icon', keywords: ['auto', 'pin', 'tab', 'manager'] },
            { id: 'focus-existing-tab', label: 'Focus Existing Tab', description: 'If Tab Manager is already open, switch to it instead of creating a new tab', keywords: ['focus', 'existing', 'tab'] },
            { id: 'configure-shortcut', label: 'Configure Shortcut', keywords: ['shortcut', 'keyboard', 'hotkey'] },
        ],
    },
    {
        id: 'search',
        title: 'Search',
        category: 'general',
        icon: SearchIcon,
        controls: [
            { id: 'search-debounce', label: 'Search Debounce', keywords: ['search', 'debounce', 'delay'] },
        ],
    },
];

interface GeneralSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    const [shortcutCopied, setShortcutCopied] = useState(false);
    const shortcutTimeoutRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        return () => {
            if (shortcutTimeoutRef.current) {
                clearTimeout(shortcutTimeoutRef.current);
                shortcutTimeoutRef.current = undefined;
            }
        };
    }, []);

    return (
        <>
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
                id="drag-opacity"
                title="Drag Opacity"
                icon={MousePointer}
                isExpanded={expandedSections.has('drag-opacity')}
                onToggle={() => toggleSection('drag-opacity')}
            >
                <Slider
                    value={appearanceSettings.dragOpacity}
                    onChange={(value) => setAppearanceSettings({ dragOpacity: value })}
                    min={DRAG_OPACITY_MIN}
                    max={DRAG_OPACITY_MAX}
                    step={DRAG_OPACITY_STEP}
                    label="Dragged Item Opacity"
                    displayValue={`${Math.round(appearanceSettings.dragOpacity * 100)}%`}
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="spinner"
                title="Loading Spinner"
                icon={MoreHorizontal}
                isExpanded={expandedSections.has('spinner')}
                onToggle={() => toggleSection('spinner')}
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

            <CollapsibleSection
                id="icons"
                title="Icon Pack"
                icon={Type}
                isExpanded={expandedSections.has('icons')}
                onToggle={() => toggleSection('icons')}
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
                id="button-size"
                title="Button Size"
                icon={SlidersHorizontal}
                isExpanded={expandedSections.has('button-size')}
                onToggle={() => toggleSection('button-size')}
            >
                <Dropdown
                    value={appearanceSettings.buttonSize}
                    onChange={(value) => setAppearanceSettings({ buttonSize: value as ButtonSize })}
                    options={[
                        { value: 'small', label: 'Small' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'large', label: 'Large' },
                    ]}
                    label="UI Action Size"
                />
            </CollapsibleSection>

            <CollapsibleSection
                id="auto-pin"
                title="Tab Manager Pin"
                icon={Pin}
                isExpanded={expandedSections.has('auto-pin')}
                onToggle={() => toggleSection('auto-pin')}
            >
                <Toggle
                    checked={appearanceSettings.autoPinTabManager}
                    onChange={(checked) => setAppearanceSettings({ autoPinTabManager: checked })}
                    label="Auto-Pin Tab Manager"
                    description="Automatically pin the Tab Manager page when opened via extension icon"
                />
                <Toggle
                    checked={appearanceSettings.focusExistingTab ?? true}
                    onChange={(checked) => setAppearanceSettings({ focusExistingTab: checked })}
                    label="Focus Existing Tab"
                    description="If Tab Manager is already open, switch to it instead of creating a new tab"
                />
                <div className="h-2" />
                <button
                    onClick={async () => {
                        try {
                            await navigator.clipboard.writeText('chrome://extensions/shortcuts');
                            if (shortcutTimeoutRef.current !== undefined) {
                                clearTimeout(shortcutTimeoutRef.current);
                            }
                            setShortcutCopied(true);
                            shortcutTimeoutRef.current = window.setTimeout(() => setShortcutCopied(false), 2000);
                        } catch (err) {
                            logger.error('GeneralSettings', 'Failed to copy shortcut URL:', err);
                        }
                    }}
                    className="flex items-center gap-3 w-full p-3 rounded-lg transition-all border bg-gx-gray border-white/5 hover:border-gx-accent/20"
                >
                    <Keyboard className="w-5 h-5 text-gx-accent" />
                    <div className="flex-1 text-left">
                        <span className="text-xs font-bold block text-gray-300">
                            Configure Shortcut
                        </span>
                        <span className="text-[10px] text-gray-500 block mt-0.5">
                            {shortcutCopied
                                ? 'Copied! Paste in address bar to open shortcuts'
                                : 'Copy link and paste in address bar to customize keyboard shortcut'}
                        </span>
                    </div>
                </button>
            </CollapsibleSection>

            <CollapsibleSection
                id="search"
                title="Search"
                icon={SearchIcon}
                isExpanded={expandedSections.has('search')}
                onToggle={() => toggleSection('search')}
            >
                <Slider
                    value={appearanceSettings.searchDebounce ?? SEARCH_DEBOUNCE_MS}
                    onChange={(value) => setAppearanceSettings({ searchDebounce: value })}
                    min={SEARCH_DEBOUNCE_MIN}
                    max={SEARCH_DEBOUNCE_MAX}
                    step={SEARCH_DEBOUNCE_STEP}
                    label="Search Debounce"
                    displayValue={`${appearanceSettings.searchDebounce ?? SEARCH_DEBOUNCE_MS}ms`}
                />
            </CollapsibleSection>
        </>
    );
};
