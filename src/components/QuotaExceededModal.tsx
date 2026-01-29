import React from 'react';
import { cn } from '../utils/cn';

export type QuotaExceededAction = 'switch-local' | 'free-space' | 'cancel';

interface QuotaExceededModalProps {
  isOpen: boolean;
  bytesUsed: number;
  bytesAvailable: number;
  onAction: (action: QuotaExceededAction) => void;
}

export function QuotaExceededModal({
  isOpen,
  bytesUsed,
  bytesAvailable,
  onAction
}: QuotaExceededModalProps) {
  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div 
        className={cn(
          'bg-gx-gray border border-gx-red/50 rounded-lg shadow-2xl',
          'w-full max-w-md mx-4 p-6',
          'shadow-[0_0_30px_rgba(255,27,27,0.2)]'
        )}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gx-red/20 flex items-center justify-center">
            <svg 
              className="w-6 h-6 text-gx-red" 
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
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Sync Storage Full
            </h2>
            <p className="text-sm text-gray-400">
              Your vault has exceeded the sync storage quota. 
              Using {formatBytes(bytesUsed)}, need {formatBytes(Math.abs(bytesAvailable))} more.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onAction('switch-local')}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg text-left',
              'bg-gx-dark/50 border border-white/10',
              'hover:border-gx-accent/50 hover:bg-gx-accent/10',
              'transition-colors group'
            )}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gx-accent/20 flex items-center justify-center group-hover:bg-gx-accent/30">
              <svg className="w-5 h-5 text-gx-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-white">Switch to Local Storage</div>
              <div className="text-xs text-gray-400">Unlimited space, but won't sync across devices</div>
            </div>
          </button>

          <button
            onClick={() => onAction('free-space')}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg text-left',
              'bg-gx-dark/50 border border-white/10',
              'hover:border-yellow-500/50 hover:bg-yellow-500/10',
              'transition-colors group'
            )}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/30">
              <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-white">Free Up Space</div>
              <div className="text-xs text-gray-400">Remove old items from your vault</div>
            </div>
          </button>

          <button
            onClick={() => onAction('cancel')}
            className={cn(
              'w-full p-3 rounded-lg text-center',
              'text-gray-400 hover:text-white',
              'hover:bg-white/5 transition-colors'
            )}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
