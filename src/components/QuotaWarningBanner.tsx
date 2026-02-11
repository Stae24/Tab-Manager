import React from 'react';
import { cn } from '../utils/cn';
import type { QuotaWarningLevel } from '../types/index';

interface QuotaWarningBannerProps {
  warningLevel: QuotaWarningLevel;
  percentage: number;
  syncEnabled: boolean;
  onManageStorage?: () => void;
}

export function QuotaWarningBanner({
  warningLevel,
  percentage,
  syncEnabled,
  onManageStorage
}: QuotaWarningBannerProps) {
  if (!syncEnabled) {
    return (
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 text-sm rounded-md mb-2',
          'bg-gx-accent/20 border border-gx-accent/40 text-gx-accent'
        )}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Sync disabled - using local storage</span>
        </div>
      </div>
    );
  }

  if (warningLevel === 'none') return null;

  const isCritical = warningLevel === 'critical';
  const percentDisplay = Math.round(percentage * 100);

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 text-sm rounded-md mb-2',
        isCritical
          ? 'bg-gx-red/20 border border-gx-red/40 text-gx-red'
          : 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400'
      )}
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>
          {isCritical
            ? `Vault sync storage critical: ${percentDisplay}% used`
            : `Vault sync storage: ${percentDisplay}% used`
          }
        </span>
      </div>
      {onManageStorage && (
        <button
          onClick={onManageStorage}
          className={cn(
            'text-xs px-2 py-1 rounded transition-colors',
            isCritical
              ? 'bg-gx-red/30 hover:bg-gx-red/50'
              : 'bg-yellow-500/30 hover:bg-yellow-500/50'
          )}
        >
          Manage
        </button>
      )}
    </div>
  );
}
