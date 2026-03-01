import React from 'react';
import { SpacingIcon } from './ui/SpacingIcon';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Slider } from './ui/Slider';
import {
    SIDEBAR_HEADER_PADDING_MIN,
    SIDEBAR_HEADER_PADDING_MAX,
    SIDEBAR_HEADER_PADDING_DEFAULT,
    SIDEBAR_HEADER_PADDING_STEP,
    SIDEBAR_ROW_GAP_MIN,
    SIDEBAR_ROW_GAP_MAX,
    SIDEBAR_ROW_GAP_DEFAULT,
    SIDEBAR_ROW_GAP_STEP,
    SIDEBAR_BUTTON_GAP_MIN,
    SIDEBAR_BUTTON_GAP_MAX,
    SIDEBAR_BUTTON_GAP_DEFAULT,
    SIDEBAR_BUTTON_GAP_STEP,
    SIDEBAR_BUTTON_PADDING_Y_MIN,
    SIDEBAR_BUTTON_PADDING_Y_MAX,
    SIDEBAR_BUTTON_PADDING_Y_DEFAULT,
    SIDEBAR_BUTTON_PADDING_Y_STEP,
    SIDEBAR_BUTTON_ICON_SIZE_MIN,
    SIDEBAR_BUTTON_ICON_SIZE_MAX,
    SIDEBAR_BUTTON_ICON_SIZE_DEFAULT,
    SIDEBAR_BUTTON_ICON_SIZE_STEP,
    PANEL_HEADER_PADDING_TOP_MIN,
    PANEL_HEADER_PADDING_TOP_MAX,
    PANEL_HEADER_PADDING_TOP_DEFAULT,
    PANEL_HEADER_PADDING_TOP_STEP,
    PANEL_HEADER_PADDING_BOTTOM_MIN,
    PANEL_HEADER_PADDING_BOTTOM_MAX,
    PANEL_HEADER_PADDING_BOTTOM_DEFAULT,
    PANEL_HEADER_PADDING_BOTTOM_STEP,
    PANEL_HEADER_PADDING_LEFT_MIN,
    PANEL_HEADER_PADDING_LEFT_MAX,
    PANEL_HEADER_PADDING_LEFT_DEFAULT,
    PANEL_HEADER_PADDING_LEFT_STEP,
    PANEL_HEADER_PADDING_RIGHT_MIN,
    PANEL_HEADER_PADDING_RIGHT_MAX,
    PANEL_HEADER_PADDING_RIGHT_DEFAULT,
    PANEL_HEADER_PADDING_RIGHT_STEP,
    PANEL_HEADER_ICON_TITLE_GAP_MIN,
    PANEL_HEADER_ICON_TITLE_GAP_MAX,
    PANEL_HEADER_ICON_TITLE_GAP_DEFAULT,
    PANEL_HEADER_ICON_TITLE_GAP_STEP,
    PANEL_HEADER_TITLE_ACTION_GAP_MIN,
    PANEL_HEADER_TITLE_ACTION_GAP_MAX,
    PANEL_HEADER_TITLE_ACTION_GAP_DEFAULT,
    PANEL_HEADER_TITLE_ACTION_GAP_STEP,
    PANEL_HEADER_ACTION_GAP_MIN,
    PANEL_HEADER_ACTION_GAP_MAX,
    PANEL_HEADER_ACTION_GAP_DEFAULT,
    PANEL_HEADER_ACTION_GAP_STEP,
    PANEL_LIST_GAP_MIN,
    PANEL_LIST_GAP_MAX,
    PANEL_LIST_GAP_DEFAULT,
    PANEL_LIST_GAP_STEP,
    PANEL_LIST_PADDING_TOP_MIN,
    PANEL_LIST_PADDING_TOP_MAX,
    PANEL_LIST_PADDING_TOP_DEFAULT,
    PANEL_LIST_PADDING_TOP_STEP,
    PANEL_LIST_PADDING_BOTTOM_MIN,
    PANEL_LIST_PADDING_BOTTOM_MAX,
    PANEL_LIST_PADDING_BOTTOM_DEFAULT,
    PANEL_LIST_PADDING_BOTTOM_STEP,
    SETTINGS_HEADER_PADDING_MIN,
    SETTINGS_HEADER_PADDING_MAX,
    SETTINGS_HEADER_PADDING_DEFAULT,
    SETTINGS_HEADER_PADDING_STEP,
    SETTINGS_TABS_PADDING_MIN,
    SETTINGS_TABS_PADDING_MAX,
    SETTINGS_TABS_PADDING_DEFAULT,
    SETTINGS_TABS_PADDING_STEP,
    SETTINGS_TAB_GAP_MIN,
    SETTINGS_TAB_GAP_MAX,
    SETTINGS_TAB_GAP_DEFAULT,
    SETTINGS_TAB_GAP_STEP,
    SETTINGS_CONTENT_PADDING_MIN,
    SETTINGS_CONTENT_PADDING_MAX,
    SETTINGS_CONTENT_PADDING_DEFAULT,
    SETTINGS_CONTENT_PADDING_STEP,
    SETTINGS_SECTION_GAP_MIN,
    SETTINGS_SECTION_GAP_MAX,
    SETTINGS_SECTION_GAP_DEFAULT,
    SETTINGS_SECTION_GAP_STEP,
} from '../constants';
import type { AppearanceSettings } from '../types';
import type { SettingSection } from './AppearanceSettingsPanel';

export const SETTING_SECTIONS: SettingSection[] = [
    {
        id: 'spacing',
        title: 'Spacing & Layout',
        category: 'spacing',
        icon: SpacingIcon,
        controls: [
            { id: 'sidebar-header-padding', label: 'Sidebar Header Padding', keywords: ['sidebar', 'header', 'padding'] },
            { id: 'sidebar-row-gap', label: 'Sidebar Row Gap', keywords: ['sidebar', 'row', 'gap'] },
            { id: 'sidebar-button-gap', label: 'Sidebar Button Gap', keywords: ['sidebar', 'button', 'gap'] },
            { id: 'sidebar-button-padding-y', label: 'Sidebar Button Padding Y', keywords: ['sidebar', 'button', 'padding', 'vertical'] },
            { id: 'sidebar-button-icon-size', label: 'Sidebar Button Icon Size', keywords: ['sidebar', 'button', 'icon', 'size'] },
            { id: 'panel-header-padding-top', label: 'Panel Header Padding Top', keywords: ['panel', 'header', 'padding', 'top'] },
            { id: 'panel-header-padding-bottom', label: 'Panel Header Padding Bottom', keywords: ['panel', 'header', 'padding', 'bottom'] },
            { id: 'panel-header-padding-left', label: 'Panel Header Padding Left', keywords: ['panel', 'header', 'padding', 'left'] },
            { id: 'panel-header-padding-right', label: 'Panel Header Padding Right', keywords: ['panel', 'header', 'padding', 'right'] },
            { id: 'panel-header-icon-title-gap', label: 'Panel Header Icon-Title Gap', keywords: ['panel', 'header', 'icon', 'title', 'gap'] },
            { id: 'panel-header-title-action-gap', label: 'Panel Header Title-Action Gap', keywords: ['panel', 'header', 'title', 'action', 'gap'] },
            { id: 'panel-header-action-gap', label: 'Panel Header Action Button Gap', keywords: ['panel', 'header', 'action', 'gap', 'button'] },
            { id: 'panel-list-gap', label: 'Panel List Gap', keywords: ['panel', 'list', 'gap'] },
            { id: 'panel-list-padding-top', label: 'Panel List Padding Top', keywords: ['panel', 'list', 'padding', 'top'] },
            { id: 'panel-list-padding-bottom', label: 'Panel List Padding Bottom', keywords: ['panel', 'list', 'padding', 'bottom'] },
            { id: 'settings-header-padding', label: 'Settings Header Padding', keywords: ['settings', 'header', 'padding'] },
            { id: 'settings-tabs-padding', label: 'Settings Tabs Padding', keywords: ['settings', 'tabs', 'padding'] },
            { id: 'settings-tab-gap', label: 'Settings Tab Gap', keywords: ['settings', 'tab', 'gap'] },
            { id: 'settings-content-padding', label: 'Settings Content Padding', keywords: ['settings', 'content', 'padding'] },
            { id: 'settings-section-gap', label: 'Settings Section Gap', keywords: ['settings', 'section', 'gap'] },
        ],
    },
];

interface SpacingSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    highlightedControl?: { sectionId: string; controlId: string } | null;
}

export const SpacingSettings: React.FC<SpacingSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    expandedSections,
    toggleSection,
    highlightedControl
}) => {
    return (
        <CollapsibleSection
            id="spacing"
            title="Spacing & Layout"
            icon={SpacingIcon}
            isExpanded={expandedSections.has('spacing')}
            onToggle={() => toggleSection('spacing')}
        >
            <div className="space-y-4">
                <div className="text-[10px] text-gx-muted font-bold tracking-widest uppercase mb-3">Sidebar Header</div>
                
                <Slider
                    value={appearanceSettings.sidebarHeaderPadding ?? SIDEBAR_HEADER_PADDING_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ sidebarHeaderPadding: value })}
                    min={SIDEBAR_HEADER_PADDING_MIN}
                    max={SIDEBAR_HEADER_PADDING_MAX}
                    step={SIDEBAR_HEADER_PADDING_STEP}
                    label="Header Padding"
                    displayValue={`${appearanceSettings.sidebarHeaderPadding ?? SIDEBAR_HEADER_PADDING_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.sidebarRowGap ?? SIDEBAR_ROW_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ sidebarRowGap: value })}
                    min={SIDEBAR_ROW_GAP_MIN}
                    max={SIDEBAR_ROW_GAP_MAX}
                    step={SIDEBAR_ROW_GAP_STEP}
                    label="Row Gap"
                    displayValue={`${appearanceSettings.sidebarRowGap ?? SIDEBAR_ROW_GAP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.sidebarButtonGap ?? SIDEBAR_BUTTON_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ sidebarButtonGap: value })}
                    min={SIDEBAR_BUTTON_GAP_MIN}
                    max={SIDEBAR_BUTTON_GAP_MAX}
                    step={SIDEBAR_BUTTON_GAP_STEP}
                    label="Button Gap"
                    displayValue={`${appearanceSettings.sidebarButtonGap ?? SIDEBAR_BUTTON_GAP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.sidebarButtonPaddingY ?? SIDEBAR_BUTTON_PADDING_Y_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ sidebarButtonPaddingY: value })}
                    min={SIDEBAR_BUTTON_PADDING_Y_MIN}
                    max={SIDEBAR_BUTTON_PADDING_Y_MAX}
                    step={SIDEBAR_BUTTON_PADDING_Y_STEP}
                    label="Button Padding Y"
                    displayValue={`${appearanceSettings.sidebarButtonPaddingY ?? SIDEBAR_BUTTON_PADDING_Y_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.sidebarButtonIconSize ?? SIDEBAR_BUTTON_ICON_SIZE_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ sidebarButtonIconSize: value })}
                    min={SIDEBAR_BUTTON_ICON_SIZE_MIN}
                    max={SIDEBAR_BUTTON_ICON_SIZE_MAX}
                    step={SIDEBAR_BUTTON_ICON_SIZE_STEP}
                    label="Button Icon Size"
                    displayValue={`${appearanceSettings.sidebarButtonIconSize ?? SIDEBAR_BUTTON_ICON_SIZE_DEFAULT}px`}
                />

                <div className="border-t border-gx-border pt-4 mt-4">
                    <div className="text-[10px] text-gx-muted font-bold tracking-widest uppercase mb-3">Panel Headers</div>
                </div>

                <Slider
                    value={appearanceSettings.panelHeaderPaddingTop ?? PANEL_HEADER_PADDING_TOP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelHeaderPaddingTop: value })}
                    min={PANEL_HEADER_PADDING_TOP_MIN}
                    max={PANEL_HEADER_PADDING_TOP_MAX}
                    step={PANEL_HEADER_PADDING_TOP_STEP}
                    label="Header Padding Top"
                    displayValue={`${appearanceSettings.panelHeaderPaddingTop ?? PANEL_HEADER_PADDING_TOP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelHeaderPaddingBottom ?? PANEL_HEADER_PADDING_BOTTOM_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelHeaderPaddingBottom: value })}
                    min={PANEL_HEADER_PADDING_BOTTOM_MIN}
                    max={PANEL_HEADER_PADDING_BOTTOM_MAX}
                    step={PANEL_HEADER_PADDING_BOTTOM_STEP}
                    label="Header Padding Bottom"
                    displayValue={`${appearanceSettings.panelHeaderPaddingBottom ?? PANEL_HEADER_PADDING_BOTTOM_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelHeaderPaddingLeft ?? PANEL_HEADER_PADDING_LEFT_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelHeaderPaddingLeft: value })}
                    min={PANEL_HEADER_PADDING_LEFT_MIN}
                    max={PANEL_HEADER_PADDING_LEFT_MAX}
                    step={PANEL_HEADER_PADDING_LEFT_STEP}
                    label="Header Padding Left"
                    displayValue={`${appearanceSettings.panelHeaderPaddingLeft ?? PANEL_HEADER_PADDING_LEFT_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelHeaderPaddingRight ?? PANEL_HEADER_PADDING_RIGHT_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelHeaderPaddingRight: value })}
                    min={PANEL_HEADER_PADDING_RIGHT_MIN}
                    max={PANEL_HEADER_PADDING_RIGHT_MAX}
                    step={PANEL_HEADER_PADDING_RIGHT_STEP}
                    label="Header Padding Right"
                    displayValue={`${appearanceSettings.panelHeaderPaddingRight ?? PANEL_HEADER_PADDING_RIGHT_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelHeaderIconTitleGap ?? PANEL_HEADER_ICON_TITLE_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelHeaderIconTitleGap: value })}
                    min={PANEL_HEADER_ICON_TITLE_GAP_MIN}
                    max={PANEL_HEADER_ICON_TITLE_GAP_MAX}
                    step={PANEL_HEADER_ICON_TITLE_GAP_STEP}
                    label="Icon-Title Gap"
                    displayValue={`${appearanceSettings.panelHeaderIconTitleGap ?? PANEL_HEADER_ICON_TITLE_GAP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelHeaderTitleActionGap ?? PANEL_HEADER_TITLE_ACTION_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelHeaderTitleActionGap: value })}
                    min={PANEL_HEADER_TITLE_ACTION_GAP_MIN}
                    max={PANEL_HEADER_TITLE_ACTION_GAP_MAX}
                    step={PANEL_HEADER_TITLE_ACTION_GAP_STEP}
                    label="Title-Action Gap"
                    displayValue={`${appearanceSettings.panelHeaderTitleActionGap ?? PANEL_HEADER_TITLE_ACTION_GAP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelHeaderActionGap ?? PANEL_HEADER_ACTION_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelHeaderActionGap: value })}
                    min={PANEL_HEADER_ACTION_GAP_MIN}
                    max={PANEL_HEADER_ACTION_GAP_MAX}
                    step={PANEL_HEADER_ACTION_GAP_STEP}
                    label="Action Button Gap"
                    displayValue={`${appearanceSettings.panelHeaderActionGap ?? PANEL_HEADER_ACTION_GAP_DEFAULT}px`}
                />

                <div className="border-t border-gx-border pt-4 mt-4">
                    <div className="text-[10px] text-gx-muted font-bold tracking-widest uppercase mb-3">Panel List</div>
                </div>

                <Slider
                    value={appearanceSettings.panelListGap ?? PANEL_LIST_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelListGap: value })}
                    min={PANEL_LIST_GAP_MIN}
                    max={PANEL_LIST_GAP_MAX}
                    step={PANEL_LIST_GAP_STEP}
                    label="List Gap"
                    displayValue={`${appearanceSettings.panelListGap ?? PANEL_LIST_GAP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelListPaddingTop ?? PANEL_LIST_PADDING_TOP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelListPaddingTop: value })}
                    min={PANEL_LIST_PADDING_TOP_MIN}
                    max={PANEL_LIST_PADDING_TOP_MAX}
                    step={PANEL_LIST_PADDING_TOP_STEP}
                    label="List Padding Top"
                    displayValue={`${appearanceSettings.panelListPaddingTop ?? PANEL_LIST_PADDING_TOP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.panelListPaddingBottom ?? PANEL_LIST_PADDING_BOTTOM_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ panelListPaddingBottom: value })}
                    min={PANEL_LIST_PADDING_BOTTOM_MIN}
                    max={PANEL_LIST_PADDING_BOTTOM_MAX}
                    step={PANEL_LIST_PADDING_BOTTOM_STEP}
                    label="List Padding Bottom"
                    displayValue={`${appearanceSettings.panelListPaddingBottom ?? PANEL_LIST_PADDING_BOTTOM_DEFAULT}px`}
                />

                <div className="border-t border-gx-border pt-4 mt-4">
                    <div className="text-[10px] text-gx-muted font-bold tracking-widest uppercase mb-3">Settings Panel</div>
                </div>

                <Slider
                    value={appearanceSettings.settingsHeaderPadding ?? SETTINGS_HEADER_PADDING_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ settingsHeaderPadding: value })}
                    min={SETTINGS_HEADER_PADDING_MIN}
                    max={SETTINGS_HEADER_PADDING_MAX}
                    step={SETTINGS_HEADER_PADDING_STEP}
                    label="Header Padding"
                    displayValue={`${appearanceSettings.settingsHeaderPadding ?? SETTINGS_HEADER_PADDING_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.settingsTabsPadding ?? SETTINGS_TABS_PADDING_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ settingsTabsPadding: value })}
                    min={SETTINGS_TABS_PADDING_MIN}
                    max={SETTINGS_TABS_PADDING_MAX}
                    step={SETTINGS_TABS_PADDING_STEP}
                    label="Tabs Padding"
                    displayValue={`${appearanceSettings.settingsTabsPadding ?? SETTINGS_TABS_PADDING_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.settingsTabGap ?? SETTINGS_TAB_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ settingsTabGap: value })}
                    min={SETTINGS_TAB_GAP_MIN}
                    max={SETTINGS_TAB_GAP_MAX}
                    step={SETTINGS_TAB_GAP_STEP}
                    label="Tab Gap"
                    displayValue={`${appearanceSettings.settingsTabGap ?? SETTINGS_TAB_GAP_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.settingsContentPadding ?? SETTINGS_CONTENT_PADDING_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ settingsContentPadding: value })}
                    min={SETTINGS_CONTENT_PADDING_MIN}
                    max={SETTINGS_CONTENT_PADDING_MAX}
                    step={SETTINGS_CONTENT_PADDING_STEP}
                    label="Content Padding"
                    displayValue={`${appearanceSettings.settingsContentPadding ?? SETTINGS_CONTENT_PADDING_DEFAULT}px`}
                />

                <Slider
                    value={appearanceSettings.settingsSectionGap ?? SETTINGS_SECTION_GAP_DEFAULT}
                    onChange={(value) => setAppearanceSettings({ settingsSectionGap: value })}
                    min={SETTINGS_SECTION_GAP_MIN}
                    max={SETTINGS_SECTION_GAP_MAX}
                    step={SETTINGS_SECTION_GAP_STEP}
                    label="Section Gap"
                    displayValue={`${appearanceSettings.settingsSectionGap ?? SETTINGS_SECTION_GAP_DEFAULT}px`}
                />
            </div>
        </CollapsibleSection>
    );
};
