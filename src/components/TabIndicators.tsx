import React from 'react';
import { Snowflake, VolumeX, Speaker } from 'lucide-react';
import type { Tab, AppearanceSettings } from '../types/index';

interface TabIndicatorsProps {
  tab: Tab;
  settings: Pick<AppearanceSettings, 'showFrozenIndicators' | 'showAudioIndicators'>;
}

export const TabIndicators: React.FC<TabIndicatorsProps> = ({ tab, settings }) => {
  return (
    <>
      {tab.discarded && settings.showFrozenIndicators && <Snowflake size={14} className="text-blue-400 relative z-10 mr-1" />}
      {settings.showAudioIndicators !== 'off' && (
        <>
          {tab.muted && (settings.showAudioIndicators === 'muted' || settings.showAudioIndicators === 'both') ? (
            <VolumeX size={14} className="text-orange-400 relative z-10 mr-1" />
          ) : tab.audible && (settings.showAudioIndicators === 'playing' || settings.showAudioIndicators === 'both') ? (
            <Speaker size={14} className="text-green-400 relative z-10 mr-1 animate-pulse" />
          ) : null}
        </>
      )}
    </>
  );
};
