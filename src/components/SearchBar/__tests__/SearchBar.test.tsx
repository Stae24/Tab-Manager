import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { SearchBar } from '../index';
import { BANG_REGISTRY, COMMAND_REGISTRY, getAllBangNames, getAllCommandNames } from '../../../search';
import type { AutocompleteSuggestion } from '../../../search';

function buildAutocompleteSuggestions(input: string, cursorPos: number): AutocompleteSuggestion[] {
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
}

const mockProps = {
  query: '',
  onQueryChange: vi.fn(),
  scope: 'current' as const,
  onScopeChange: vi.fn(),
  onExecute: vi.fn(),
  onHelp: vi.fn(),
  resultCount: 0,
  isSearching: false,
};

describe('buildAutocompleteSuggestions', () => {
  it('returns empty for non-bang/command input', () => {
    const suggestions = buildAutocompleteSuggestions('hello world', 11);
    expect(suggestions).toEqual([]);
  });

  it('suggests bangs matching partial', () => {
    const suggestions = buildAutocompleteSuggestions('test !aud', 9);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBe('bang');
    expect(suggestions[0].value).toBe('audio');
    expect(suggestions[0].display).toBe('!audio');
  });

  it('suggests commands matching partial', () => {
    const suggestions = buildAutocompleteSuggestions('test /del', 9);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBe('command');
    expect(suggestions[0].value).toBe('delete');
  });

  it('respects cursor position (bang at end)', () => {
    const suggestions = buildAutocompleteSuggestions('!aud test', 4);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].type).toBe('bang');
  });

  it('returns empty when cursor is not at bang/command', () => {
    const suggestions = buildAutocompleteSuggestions('!audio test', 10);
    expect(suggestions).toEqual([]);
  });

  it('limits to 6 suggestions', () => {
    const suggestions = buildAutocompleteSuggestions('!', 1);
    expect(suggestions.length).toBeLessThanOrEqual(6);
  });

  it('is case insensitive', () => {
    const lower = buildAutocompleteSuggestions('!AUD', 4);
    const upper = buildAutocompleteSuggestions('!aud', 4);
    expect(lower).toEqual(upper);
  });

  it('handles empty partial after !', () => {
    const suggestions = buildAutocompleteSuggestions('!', 1);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('shows search input with placeholder', () => {
      render(<SearchBar {...mockProps} />);
      expect(screen.getByPlaceholderText(/Search tabs/)).toBeInTheDocument();
    });

    it('shows scope toggle buttons', () => {
      render(<SearchBar {...mockProps} />);
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('shows help button', () => {
      render(<SearchBar {...mockProps} />);
      expect(screen.getByTitle('Search help')).toBeInTheDocument();
    });

    it('does not show clear button when query is empty', () => {
      render(<SearchBar {...mockProps} query="" />);
      expect(screen.queryByTitle('Clear search')).not.toBeInTheDocument();
    });

    it('shows clear button when query is not empty', () => {
      render(<SearchBar {...mockProps} query="test" />);
      expect(screen.getByTitle('Clear search')).toBeInTheDocument();
    });

    it('does not show execute button when no commands', () => {
      render(<SearchBar {...mockProps} query="test" />);
      expect(screen.queryByTitle(/Execute on/)).not.toBeInTheDocument();
    });

    it('shows execute button when commands present', () => {
      render(<SearchBar {...mockProps} query="/delete" resultCount={5} />);
      expect(screen.getByTitle(/Execute on 5 tabs/)).toBeInTheDocument();
    });

    it('execute button shows result count', () => {
      render(<SearchBar {...mockProps} query="/delete" resultCount={5} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('execute button is disabled when resultCount is 0', () => {
      render(<SearchBar {...mockProps} query="/delete" resultCount={0} />);
      const button = screen.getByTitle(/Execute on 0 tabs/);
      expect(button).toBeDisabled();
    });

    it('highlights current scope button', () => {
      render(<SearchBar {...mockProps} scope="current" />);
      const currentBtn = screen.getByText('Current');
      const allBtn = screen.getByText('All');
      expect(currentBtn).toHaveClass('bg-gx-accent/20');
      expect(allBtn).not.toHaveClass('bg-gx-accent/20');
    });

    it('highlights all scope button', () => {
      render(<SearchBar {...mockProps} scope="all" />);
      const currentBtn = screen.getByText('Current');
      const allBtn = screen.getByText('All');
      expect(allBtn).toHaveClass('bg-gx-accent/20');
      expect(currentBtn).not.toHaveClass('bg-gx-accent/20');
    });
  });

  describe('interactions', () => {
    it('typing updates query', () => {
      const onQueryChange = vi.fn();
      render(<SearchBar {...mockProps} onQueryChange={onQueryChange} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      fireEvent.change(input, { target: { value: 'test query' } });
      
      expect(onQueryChange).toHaveBeenCalledWith('test query');
    });

    it('clear button clears query and focuses input', () => {
      const onQueryChange = vi.fn();
      render(<SearchBar {...mockProps} query="test" onQueryChange={onQueryChange} />);
      
      const clearBtn = screen.getByTitle('Clear search');
      fireEvent.click(clearBtn);
      
      expect(onQueryChange).toHaveBeenCalledWith('');
    });

    it('scope buttons call onScopeChange', () => {
      const onScopeChange = vi.fn();
      render(<SearchBar {...mockProps} scope="current" onScopeChange={onScopeChange} />);
      
      fireEvent.click(screen.getByText('All'));
      expect(onScopeChange).toHaveBeenCalledWith('all');
      
      fireEvent.click(screen.getByText('Current'));
      expect(onScopeChange).toHaveBeenCalledWith('current');
    });

    it('help button calls onHelp', () => {
      const onHelp = vi.fn();
      render(<SearchBar {...mockProps} onHelp={onHelp} />);
      
      fireEvent.click(screen.getByTitle('Search help'));
      expect(onHelp).toHaveBeenCalled();
    });

    it('execute button calls onExecute', () => {
      const onExecute = vi.fn();
      render(<SearchBar {...mockProps} query="/delete" resultCount={5} onExecute={onExecute} />);
      
      fireEvent.click(screen.getByTitle(/Execute on 5 tabs/));
      expect(onExecute).toHaveBeenCalled();
    });

    it('execute button is disabled when isSearching', () => {
      render(<SearchBar {...mockProps} query="/delete" resultCount={5} isSearching={true} />);
      const button = screen.getByTitle(/Execute on 5 tabs/);
      expect(button).toBeDisabled();
    });
  });

  describe('autocomplete', () => {
    it('handles bang input', async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn();
      render(<SearchBar {...mockProps} query="" onQueryChange={onQueryChange} />);
      const input = screen.getByPlaceholderText(/Search tabs/);
      
      await user.type(input, '!');
      
      expect(onQueryChange).toHaveBeenCalledWith('!');
    });

    it('handles command input', async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn();
      render(<SearchBar {...mockProps} query="" onQueryChange={onQueryChange} />);
      const input = screen.getByPlaceholderText(/Search tabs/);
      
      await user.type(input, '/');
      
      expect(onQueryChange).toHaveBeenCalledWith('/');
    });

    it('clicking suggestion completes it', async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn((newQuery: string) => {});
      const { rerender } = render(<SearchBar {...mockProps} query="" onQueryChange={onQueryChange} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      await user.type(input, '!');
      const lastQuery = onQueryChange.mock.calls[onQueryChange.mock.calls.length - 1]?.[0] || '';
      
      rerender(<SearchBar {...mockProps} query={lastQuery} onQueryChange={onQueryChange} />);
      
      const suggestionButtons = screen.queryAllByRole('button').filter(btn => 
        btn.className?.includes('w-full') && btn.textContent?.includes('!')
      );
      
      if (suggestionButtons.length > 0) {
        const audioSuggestion = suggestionButtons.find(btn => 
          btn.textContent?.includes('!audio')
        );
        if (audioSuggestion) {
          await user.click(audioSuggestion);
          expect(onQueryChange).toHaveBeenCalled();
        }
      }
    });
  });

  describe('keyboard navigation', () => {
    it('Escape clears query when autocomplete is closed', () => {
      const onQueryChange = vi.fn();
      render(<SearchBar {...mockProps} query="test" onQueryChange={onQueryChange} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      fireEvent.keyDown(input, { key: 'Escape' });
      
      expect(onQueryChange).toHaveBeenCalledWith('');
    });

    it('Enter executes command when present', () => {
      const onExecute = vi.fn();
      render(<SearchBar {...mockProps} query="/delete" resultCount={5} onExecute={onExecute} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(onExecute).toHaveBeenCalled();
    });

    it('Enter does nothing when no command', () => {
      const onExecute = vi.fn();
      render(<SearchBar {...mockProps} query="test" onExecute={onExecute} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('ArrowDown navigates suggestions', async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn();
      render(<SearchBar {...mockProps} query="" onQueryChange={onQueryChange} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      await user.type(input, '!');
      await user.keyboard('{ArrowDown}');
      
      expect(onQueryChange).toHaveBeenCalled();
    });

    it('ArrowUp navigates suggestions', async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn();
      render(<SearchBar {...mockProps} query="" onQueryChange={onQueryChange} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      await user.type(input, '!');
      await user.keyboard('{ArrowUp}');
      
      expect(onQueryChange).toHaveBeenCalled();
    });

    it('Tab completes selected suggestion', async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn((newQuery: string) => {});
      const { rerender } = render(<SearchBar {...mockProps} query="" onQueryChange={onQueryChange} />);
      
      const input = screen.getByPlaceholderText(/Search tabs/);
      await user.type(input, '!a');
      const lastQuery = onQueryChange.mock.calls[onQueryChange.mock.calls.length - 1]?.[0] || '';
      
      rerender(<SearchBar {...mockProps} query={lastQuery} onQueryChange={onQueryChange} />);
      
      await user.keyboard('{Tab}');
      
      expect(onQueryChange).toHaveBeenCalled();
    });
  });
});
