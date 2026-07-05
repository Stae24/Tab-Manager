import React from 'react';
import { Snowflake, VolumeX, Speaker } from 'lucide-react';
import type { Tab, AppearanceSettings } from '../types/index';
import { TAB_INDICATOR_GAP_DEFAULT } from '../constants';

interface TabIndicatorsProps {
  tab: Tab;
  settings: Pick<AppearanceSettings, 'showFrozenIndicators' | 'showAudioIndicators' | 'tabIndicatorGap'>;
}

export const TabIndicators: React.FC<TabIndicatorsProps> = ({ tab, settings }) => {
  const indicatorMargin = settings.tabIndicatorGap ?? TAB_INDICATOR_GAP_DEFAULT;
  return (
    <>
      {tab.discarded && settings.showFrozenIndicators && (
        <Snowflake size={14} className="text-blue-400 relative z-10" style={{ marginRight: indicatorMargin }} />
      )}
      {settings.showAudioIndicators !== 'off' && (
        <>
          {tab.muted && (settings.showAudioIndicators === 'muted' || settings.showAudioIndicators === 'both') ? (
            <VolumeX size={14} className="text-orange-400 relative z-10" style={{ marginRight: indicatorMargin }} />
          ) : tab.audible && (settings.showAudioIndicators === 'playing' || settings.showAudioIndicators === 'both') ? (
            <Speaker size={14} className="text-green-400 relative z-10 animate-pulse" style={{ marginRight: indicatorMargin }} />
          ) : null}
        </>
      )}
    </>
  );
};
