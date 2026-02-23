import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { Search, X, Play, HelpCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { parseQuery, hasCommands as checkHasCommands } from '../../search';
import { BANG_REGISTRY, COMMAND_REGISTRY, getAllBangNames, getAllCommandNames } from '../../search';
import type { ParsedQuery, AutocompleteSuggestion } from '../../search';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  scope: 'current' | 'all';
  onScopeChange: (scope: 'current' | 'all') => void;
  onExecute: () => void;
  onHelp: () => void;
  resultCount?: number;
  isSearching?: boolean;
  className?: string;
}

const buildAutocompleteSuggestions = (input: string, cursorPos: number): AutocompleteSuggestion[] => {
  const suggestions: AutocompleteSuggestion[] = [];
  const beforeCursor = input.slice(0, cursorPos);
  const bangMatch = beforeCursor.match(/!([a-zA-Z]*)$/);
  const cmdMatch = beforeCursor.match(/\/([a-zA-Z]*)$/);

  if (bangMatch && beforeCursor.endsWith(bangMatch[0])) {
    const partial = bangMatch[1].toLowerCase();
    const bangNames = getAllBangNames();

    for (const name of bangNames) {
      if (name.toLowerCase().startsWith(partial)) {
        const def = BANG_REGISTRY[name as keyof typeof BANG_REGISTRY];
        if (def) {
          suggestions.push({
            type: 'bang',
            value: name,
            display: `!${name}`,
            description: def.description,
            short: def.short,
          });
        }
      }
    }
  }

  if (cmdMatch) {
    const partial = cmdMatch[1].toLowerCase();
    const cmdNames = getAllCommandNames();

    for (const name of cmdNames) {
      if (name.toLowerCase().startsWith(partial)) {
        const def = COMMAND_REGISTRY[name as keyof typeof COMMAND_REGISTRY];
        if (def) {
          suggestions.push({
            type: 'command',
            value: name,
            display: `/${name}`,
            description: def.description,
            short: def.short,
          });
        }
      }
    }
  }

  return suggestions.slice(0, 6);
};

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>((
  {
    query,
    onQueryChange,
    scope,
    onScopeChange,
    onExecute,
    onHelp,
    resultCount = 0,
    isSearching = false,
    className,
  },
  forwardedRef
) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery | null>(null);
  const [cursorPos, setCursorPos] = useState<number>(0);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (forwardedRef) {
      if (typeof forwardedRef === 'function') {
        forwardedRef(inputRef.current);
      } else {
        forwardedRef.current = inputRef.current;
      }
    }
  }, [forwardedRef]);

  const suggestions = useMemo(() => {
    return buildAutocompleteSuggestions(query, cursorPos);
  }, [query, cursorPos]);

  const hasCommands = useMemo(() => checkHasCommands(parsedQuery), [parsedQuery]);

  useEffect(() => {
    setParsedQuery(parseQuery(query));
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
    setShowAutocomplete(suggestions.length > 0);
  }, [suggestions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab' && suggestions.length > 0) {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        if (selected) {
          const lastBang = query.match(/!([a-zA-Z]*)$/);
          const lastCmd = query.match(/\/([a-zA-Z]*)$/);
          let newQuery = query;

          if (lastBang) {
            newQuery = query.slice(0, -lastBang[0].length) + selected.display + ' ';
          } else if (lastCmd) {
            newQuery = query.slice(0, -lastCmd[0].length) + selected.display + ' ';
          }

          onQueryChange(newQuery);
          setShowAutocomplete(false);
        }
      } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        if (showAutocomplete && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];
          if (selected) {
            const lastBang = query.match(/!([a-zA-Z]*)$/);
            const lastCmd = query.match(/\/([a-zA-Z]*)$/);
            let newQuery = query;

            if (lastBang) {
              newQuery = query.slice(0, -lastBang[0].length) + selected.display + ' ';
            } else if (lastCmd) {
              newQuery = query.slice(0, -lastCmd[0].length) + selected.display + ' ';
            }

            onQueryChange(newQuery);
            setShowAutocomplete(false);
            return;
          }
        }

        if (hasCommands) {
          onExecute();
        }
      } else if (e.key === 'Escape') {
        if (showAutocomplete) {
          setShowAutocomplete(false);
        } else if (query) {
          onQueryChange('');
        }
      }
    },
    [suggestions, selectedIndex, query, hasCommands, showAutocomplete, onExecute, onQueryChange]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onQueryChange(e.target.value);
      setCursorPos(e.target.selectionStart ?? e.target.value.length);
    },
    [onQueryChange]
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    setCursorPos(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    setCursorPos(e.currentTarget.selectionStart ?? e.currentTarget.value.length);
  }, []);

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setShowAutocomplete(true);
    }
  }, [suggestions]);

  const handleBlur = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => setShowAutocomplete(false), 150);
  }, []);

  const handleClear = useCallback(() => {
    onQueryChange('');
    inputRef.current?.focus();
  }, [onQueryChange]);

  return (
    <div className={cn('relative flex items-center gap-2 w-full flex-1', className)}>
      <div
        className={cn(
          'flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all',
          query
            ? 'border-gx-accent/30 ring-1 ring-gx-accent/10 shadow-[0_0_12px_rgba(127,34,254,0.15)]'
            : 'border-gx-gray/30 hover:border-gx-accent/20'
        )}
      >
        <Search
          className={cn('w-4 h-4 transition-colors', query ? 'text-gx-accent' : 'text-gray-500')}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search tabs... (try !audio, !frozen, /delete)"
          className={cn(
            'flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500',
            'transition-all min-w-48'
          )}
        />
        {query && (
          <button
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs">
        <button
          onClick={() => onScopeChange('current')}
          className={cn(
            'px-2 py-1 rounded transition-colors',
            scope === 'current' ? 'bg-gx-accent/20 text-gx-accent' : 'text-gray-400 hover:text-white'
          )}
        >
          Current
        </button>
        <button
          onClick={() => onScopeChange('all')}
          className={cn(
            'px-2 py-1 rounded transition-colors',
            scope === 'all' ? 'bg-gx-accent/20 text-gx-accent' : 'text-gray-400 hover:text-white'
          )}
        >
          All
        </button>
      </div>

      {hasCommands && (
        <button
          onClick={onExecute}
          disabled={isSearching || resultCount === 0}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all',
            resultCount > 0
              ? 'bg-gx-accent text-white hover:bg-gx-accent/80'
              : 'bg-gx-gray/20 text-gray-500 cursor-not-allowed'
          )}
          title={`Execute on ${resultCount} tabs`}
        >
          <Play className="w-3 h-3" />
          <span>{resultCount}</span>
        </button>
      )}

      <button
        onClick={onHelp}
        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        title="Search help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {showAutocomplete && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-20 mt-1 bg-[#1a1a1a] border border-gx-gray/30 rounded-lg shadow-lg z-50 overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.type}-${s.value}`}
              onClick={() => {
                const lastBang = query.match(/!([a-zA-Z]*)$/);
                const lastCmd = query.match(/\/([a-zA-Z]*)$/);
                let newQuery = query;

                if (lastBang) {
                  newQuery = query.slice(0, -lastBang[0].length) + s.display + ' ';
                } else if (lastCmd) {
                  newQuery = query.slice(0, -lastCmd[0].length) + s.display + ' ';
                }

                onQueryChange(newQuery);
                setShowAutocomplete(false);
                inputRef.current?.focus();
              }}
              className={cn(
                'w-full px-3 py-2 flex items-center justify-between text-left text-sm transition-colors',
                i === selectedIndex ? 'bg-gx-accent/20' : 'hover:bg-white/5'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-gx-accent">{s.display}</span>
                {s.short && <span className="text-gray-500 text-xs">(!{s.short})</span>}
              </div>
              <span className="text-gray-400 text-xs truncate max-w-[200px]">{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
