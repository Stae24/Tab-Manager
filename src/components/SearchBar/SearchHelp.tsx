import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { BANG_REGISTRY, COMMAND_REGISTRY, SORT_OPTIONS, CHROME_GROUP_COLORS } from '../../search';

interface SearchHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchHelp: React.FC<SearchHelpProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-help-title"
      onClick={onClose}
    >
      <div
        className="bg-gx-gray border border-gx-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gx-border">
          <h2 id="search-help-title" className="text-lg font-semibold text-gx-text">Search Syntax</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gx-hover text-gx-muted hover:text-gx-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-6 text-sm">
          <section>
            <h3 className="text-gx-accent font-medium mb-2">Basic Search</h3>
            <div className="text-gray-300 space-y-1">
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">youtube</code> - Search in title and URL
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">youtube, music</code> - Multiple terms (AND)
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">"hello world"</code> - Exact phrase
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-gx-accent font-medium mb-2">Text Scope Bangs</h3>
            <div className="text-gray-300 space-y-1">
              {Object.entries(BANG_REGISTRY)
                .filter(([, def]) => def.type === 'text-scope')
                .map(([key, def]) => (
                  <p key={key}>
                    <code className="bg-gx-gray/30 px-1 rounded">!{def.short || key}</code> - {def.description}
                  </p>
                ))}
            </div>
          </section>

          <section>
            <h3 className="text-gx-accent font-medium mb-2">Boolean Bangs</h3>
            <div className="text-gray-300 space-y-1">
              {Object.entries(BANG_REGISTRY)
                .filter(([, def]) => def.type === 'boolean')
                .map(([key, def]) => (
                  <p key={key}>
                    <code className="bg-gx-gray/30 px-1 rounded">!{def.short || key}</code>
                    {def.short && <span className="text-gray-500 ml-1">(!{key})</span>} - {def.description}
                  </p>
                ))}
            </div>
          </section>

          <section>
            <h3 className="text-gx-accent font-medium mb-2">Value Bangs</h3>
            <div className="text-gray-300 space-y-1">
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">!gn work</code> - Group name contains "work"
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">!gc blue</code> - Group color is blue
                <span className="text-gray-500 ml-2">
                  ({CHROME_GROUP_COLORS.join(', ')})
                </span>
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-gx-accent font-medium mb-2">Exclude Modifier</h3>
            <div className="text-gray-300 space-y-1">
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">-!frozen</code> - NOT frozen
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">-!audio</code> - NO audio
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-gx-accent font-medium mb-2">Sort</h3>
            <div className="text-gray-300 space-y-1">
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">sort:title</code> - Sort by title (alpha)
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">sort:url</code> - Sort by URL
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">sort:index</code> - Browser order (default)
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-gx-accent font-medium mb-2">Commands</h3>
            <div className="text-gray-300 space-y-1">
              {Object.entries(COMMAND_REGISTRY).map(([key, def]) => (
                <p key={key}>
                  <code className="bg-gx-gray/30 px-1 rounded">/{def.short || key}</code>
                  {def.short && <span className="text-gray-500 ml-1">(/{key})</span>} - {def.description}
                  {def.destructive && <span className="text-red-400 ml-1">⚠️</span>}
                </p>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-gx-accent font-medium mb-2">Examples</h3>
            <div className="text-gray-300 space-y-1">
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">youtube, !audio</code> - YouTube tabs playing audio
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">!frozen /delete</code> - Delete all frozen tabs
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">-!grouped, !pin</code> - Ungrouped pinned tabs
              </p>
              <p>
                <code className="bg-gx-gray/30 px-1 rounded">!gn work, sort:title</code> - Group "work" tabs sorted by title
              </p>
            </div>
          </section>
        </div>

        <div className="px-4 py-3 border-t border-gx-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gx-accent hover:bg-gx-accent/80 text-gx-text rounded-lg transition-colors text-sm font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
