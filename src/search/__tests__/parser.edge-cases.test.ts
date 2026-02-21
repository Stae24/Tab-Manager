import { describe, it, expect } from 'vitest';
import { tokenize, parseQuery, hasCommands, hasDestructiveCommands, getQueryString } from '../parser';

describe('tokenize edge cases', () => {
  describe('empty and whitespace', () => {
    it('returns empty array for empty string', () => {
      expect(tokenize('')).toEqual([]);
    });

    it('returns empty array for only whitespace', () => {
      expect(tokenize('   ')).toEqual([]);
      expect(tokenize('\t\n')).toEqual([]);
    });

    it('trims whitespace from text tokens', () => {
      const tokens = tokenize('  hello  world  ');
      expect(tokens.some(t => t.value === 'hello  world')).toBe(true);
    });
  });

  describe('consecutive bangs', () => {
    it('tokenizes multiple bangs without spaces', () => {
      const tokens = tokenize('!audio!frozen!pin');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe('bang');
      expect(tokens[0].value).toBe('audio');
      expect(tokens[1].type).toBe('bang');
      expect(tokens[1].value).toBe('frozen');
      expect(tokens[2].type).toBe('bang');
      expect(tokens[2].value).toBe('pin');
    });

    it('tokenizes bangs with spaces', () => {
      const tokens = tokenize('!audio !frozen !pin');
      expect(tokens).toHaveLength(3);
    });
  });

  describe('bang and command combinations', () => {
    it('tokenizes bang immediately followed by command', () => {
      const tokens = tokenize('!audio/delete');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('bang');
      expect(tokens[1].type).toBe('command');
    });

    it('tokenizes command immediately followed by bang', () => {
      const tokens = tokenize('/delete!audio');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('command');
      expect(tokens[1].type).toBe('bang');
    });
  });

  describe('text after command', () => {
    it('tokenizes text after command', () => {
      const tokens = tokenize('/delete something');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('command');
      expect(tokens[0].value).toBe('delete');
      expect(tokens[1].type).toBe('text');
    });
  });

  describe('quotes', () => {
    it('handles unclosed quote as text', () => {
      const tokens = tokenize('"hello world');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
    });

    it('handles quote in middle of text', () => {
      const tokens = tokenize('hello "world" test');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('tokenizes quoted string as single text token', () => {
      const tokens = tokenize('"hello world"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('hello world');
    });
  });

  describe('commas', () => {
    it('handles comma at start of query', () => {
      const tokens = tokenize(',test');
      expect(tokens.some(t => t.value.includes('test'))).toBe(true);
    });

    it('handles comma at end of query', () => {
      const tokens = tokenize('test,');
      expect(tokens.some(t => t.value.includes('test'))).toBe(true);
    });

    it('handles multiple consecutive commas', () => {
      const tokens = tokenize('test,,value');
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('negated command', () => {
    it('tokenizes negated command as text', () => {
      const tokens = tokenize('-/delete');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
    });
  });

  describe('special characters', () => {
    it('handles special characters in text', () => {
      const tokens = tokenize('hello@world.com');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
    });
  });

  describe('token positions', () => {
    it('tracks correct positions', () => {
      const tokens = tokenize('test !audio');
      expect(tokens[0].position.start).toBe(0);
      expect(tokens[1].position.start).toBe(5);
    });
  });
});

describe('parseQuery edge cases', () => {
  describe('multiple commands', () => {
    it('parses multiple commands', () => {
      const result = parseQuery('/delete /save');
      expect(result.commands).toContain('delete');
      expect(result.commands).toContain('save');
    });

    it('parses three commands', () => {
      const result = parseQuery('/delete /save /freeze');
      expect(result.commands).toHaveLength(3);
    });
  });

  describe('sort aliases', () => {
    it('recognizes sort:alpha as title sort', () => {
      const result = parseQuery('sort:alpha');
      expect(result.sort).toBe('title');
    });

    it('recognizes sort:title', () => {
      const result = parseQuery('sort:title');
      expect(result.sort).toBe('title');
    });

    it('recognizes sort:url', () => {
      const result = parseQuery('sort:url');
      expect(result.sort).toBe('url');
    });

    it('recognizes sort:index', () => {
      const result = parseQuery('sort:index');
      expect(result.sort).toBe('index');
    });
  });

  describe('bang positions', () => {
    it('parses bang at end of query', () => {
      const result = parseQuery('test !audio');
      expect(result.bangs).toHaveLength(1);
      expect(result.bangs[0].type).toBe('audio');
    });

    it('parses value bang at end of query', () => {
      const result = parseQuery('test !gn work');
      expect(result.bangs).toHaveLength(1);
      expect(result.bangs[0].type).toBe('groupname');
      expect(result.bangs[0].value).toBe('work');
    });
  });

  describe('text-scope bang edge cases', () => {
    it('handles text-scope bang value', () => {
      const result = parseQuery('!t hello world');
      expect(result.bangs).toHaveLength(1);
      expect(result.bangs[0].value).toBe('hello world');
    });

    it('handles value bang with following bang', () => {
      const result = parseQuery('!gn work !audio');
      expect(result.bangs).toHaveLength(2);
      expect(result.bangs[0].type).toBe('groupname');
      expect(result.bangs[0].value).toBe('work');
      expect(result.bangs[1].type).toBe('audio');
    });
  });

  describe('raw query preservation', () => {
    it('preserves raw query in result', () => {
      const result = parseQuery('test !audio /delete');
      expect(result.raw).toBe('test !audio /delete');
    });

    it('preserves trimmed query', () => {
      const result = parseQuery('  test  ');
      expect(result.raw).toBe('test');
    });
  });

  describe('errors array', () => {
    it('returns empty errors array for valid query', () => {
      const result = parseQuery('test !audio /delete');
      expect(result.errors).toEqual([]);
    });
  });

  describe('empty query', () => {
    it('returns empty arrays for empty query', () => {
      const result = parseQuery('');
      expect(result.textTerms).toEqual([]);
      expect(result.bangs).toEqual([]);
      expect(result.commands).toEqual([]);
    });
  });
});

describe('hasCommands', () => {
  it('returns true when commands present', () => {
    const parsed = parseQuery('/delete');
    expect(hasCommands(parsed)).toBe(true);
  });

  it('returns true when multiple commands present', () => {
    const parsed = parseQuery('/delete /save');
    expect(hasCommands(parsed)).toBe(true);
  });

  it('returns false when no commands', () => {
    const parsed = parseQuery('test !audio');
    expect(hasCommands(parsed)).toBe(false);
  });

  it('returns false for empty query', () => {
    const parsed = parseQuery('');
    expect(hasCommands(parsed)).toBe(false);
  });
});

describe('hasDestructiveCommands', () => {
  it('returns true for delete command', () => {
    const parsed = parseQuery('/delete');
    expect(hasDestructiveCommands(parsed)).toBe(true);
  });

  it('returns true when delete is mixed with other commands', () => {
    const parsed = parseQuery('/save /delete');
    expect(hasDestructiveCommands(parsed)).toBe(true);
  });

  it('returns false for save command only', () => {
    const parsed = parseQuery('/save');
    expect(hasDestructiveCommands(parsed)).toBe(false);
  });

  it('returns false for freeze command only', () => {
    const parsed = parseQuery('/freeze');
    expect(hasDestructiveCommands(parsed)).toBe(false);
  });

  it('returns false when no commands', () => {
    const parsed = parseQuery('test !audio');
    expect(hasDestructiveCommands(parsed)).toBe(false);
  });
});

describe('getQueryString', () => {
  it('reconstructs text terms', () => {
    const parsed = parseQuery('hello world');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toContain('hello world');
  });

  it('reconstructs comma-separated terms', () => {
    const parsed = parseQuery('hello, world');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toContain('hello');
    expect(reconstructed).toContain('world');
  });

  it('reconstructs bangs with values', () => {
    const parsed = parseQuery('!t hello world');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toContain('!title');
    expect(reconstructed).toContain('hello world');
  });

  it('reconstructs negated bangs', () => {
    const parsed = parseQuery('-!frozen');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toContain('-!frozen');
  });

  it('reconstructs commands', () => {
    const parsed = parseQuery('/delete');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toContain('/delete');
  });

  it('reconstructs mixed query', () => {
    const parsed = parseQuery('test !audio -!frozen /delete');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toContain('test');
    expect(reconstructed).toContain('!audio');
    expect(reconstructed).toContain('-!frozen');
    expect(reconstructed).toContain('/delete');
  });

  it('handles empty query', () => {
    const parsed = parseQuery('');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toBe('');
  });

  it('reconstructs value bangs', () => {
    const parsed = parseQuery('!gn work');
    const reconstructed = getQueryString(parsed);
    expect(reconstructed).toContain('!groupname');
    expect(reconstructed).toContain('work');
  });
});
