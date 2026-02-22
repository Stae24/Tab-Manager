import React from 'react';
import { cn } from '../utils/cn';
import type { CompressionTier } from '../types/index';

interface CompressionWarningProps {
  tier: CompressionTier;
  onDismiss: () => void;
}

export function CompressionWarning({ tier, onDismiss }: CompressionWarningProps) {
  if (tier === 'full') return null;
  
  const isMinimal = tier === 'minimal';
  const message = isMinimal
    ? 'Some visual data removed to fit sync quota (colors, favicons)'
    : 'Favicons removed to fit sync quota';
  
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 text-sm rounded-md mb-2',
        'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400'
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
        <span>{message}</span>
      </div>
      <button
        onClick={onDismiss}
        className="text-xs px-2 py-1 rounded bg-yellow-500/30 hover:bg-yellow-500/50 transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
