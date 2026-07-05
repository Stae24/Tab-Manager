import { describe, it, expect } from 'vitest';
import { tokenize, parseQuery } from '../parser';

describe('searchParser', () => {
  describe('tokenize', () => {
    it('should tokenize plain text', () => {
      const tokens = tokenize('youtube');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('youtube');
    });

    it('should tokenize multiple text terms', () => {
      const tokens = tokenize('youtube music');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('youtube music');
    });

    it('should tokenize bangs', () => {
      const tokens = tokenize('!audio');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('bang');
      expect(tokens[0].value).toBe('audio');
    });

    it('should tokenize commands', () => {
      const tokens = tokenize('/delete');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('command');
      expect(tokens[0].value).toBe('delete');
    });

    it('should tokenize exclude modifier', () => {
      const tokens = tokenize('-!frozen');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('exclude');
      expect(tokens[0].value).toBe('frozen');
    });

    it('should tokenize excluded text terms', () => {
      const tokens = tokenize('-github');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('exclude-text');
      expect(tokens[0].value).toBe('github');
    });

    it('should tokenize excluded quoted strings', () => {
      const tokens = tokenize('-"hello world"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('exclude-text');
      expect(tokens[0].value).toBe('hello world');
    });

    it('should tokenize quoted strings', () => {
      const tokens = tokenize('"hello world"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('hello world');
    });

    it('should enforce boundary for bangs', () => {
      const tokens = tokenize('url!audio');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('url!audio');
    });

    it('should enforce boundary for commands', () => {
      const tokens = tokenize('path/delete');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('path/delete');
    });

    it('should enforce boundary for quoted strings', () => {
      const tokens = tokenize('say"hello"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('say"hello"');
    });

    it('should enforce boundary for excluded terms', () => {
      const tokens = tokenize('co-operate');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('co-operate');
    });

    it('should not treat dash in URLs as exclusion', () => {
      const tokens = tokenize('https://example.com/path');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('text');
      expect(tokens[0].value).toBe('https://example.com/path');
    });

    it('should tokenize complex queries', () => {
      const tokens = tokenize('youtube, !audio /delete');
      expect(tokens.length).toBeGreaterThan(1);
    });
  });

  describe('parseQuery', () => {
    it('should parse plain text terms', () => {
      const result = parseQuery('youtube');
      expect(result.textTerms).toContain('youtube');
      expect(result.bangs).toHaveLength(0);
      expect(result.commands).toHaveLength(0);
    });

    it('should parse comma-separated terms as OR', () => {
      const result = parseQuery('youtube, music');
      expect(result.textTerms).toContain('youtube');
      expect(result.textTerms).toContain('music');
    });

    it('should parse boolean bangs', () => {
      const result = parseQuery('!audio');
      expect(result.bangs).toHaveLength(1);
      expect(result.bangs[0].type).toBe('audio');
      expect(result.bangs[0].negated).toBe(false);
    });

    it('should parse negated bangs', () => {
      const result = parseQuery('-!frozen');
      expect(result.bangs).toHaveLength(1);
      expect(result.bangs[0].type).toBe('frozen');
      expect(result.bangs[0].negated).toBe(true);
    });

    it('should parse text-scope bangs with values', () => {
      const result = parseQuery('!t hello world');
      expect(result.bangs).toHaveLength(1);
      expect(result.bangs[0].type).toBe('title');
      expect(result.bangs[0].value).toBe('hello world');
    });

    it('should parse commands', () => {
      const result = parseQuery('/delete');
      expect(result.commands).toContain('delete');
    });

    it('should parse multiple bangs and commands', () => {
      const result = parseQuery('youtube !audio !frozen /delete');
      expect(result.textTerms).toContain('youtube');
      expect(result.bangs).toHaveLength(2);
      expect(result.commands).toContain('delete');
    });

    it('should treat unknown bangs as text', () => {
      const result = parseQuery('!xyz');
      expect(result.bangs).toHaveLength(0);
      expect(result.textTerms).toContain('xyz');
    });

    it('should parse short aliases', () => {
      const result = parseQuery('!a');
      expect(result.bangs).toHaveLength(1);
      expect(result.bangs[0].type).toBe('audio');
    });

    it('should parse sort:title', () => {
      const result = parseQuery('sort:title');
      expect(result.sort).toBe('title');
    });

    it('should parse sort:url', () => {
      const result = parseQuery('sort:url');
      expect(result.sort).toBe('url');
    });

    it('should default to index sort', () => {
      const result = parseQuery('test');
      expect(result.sort).toBe('index');
    });

    it('should parse excluded text terms', () => {
      const result = parseQuery('react -github');
      expect(result.textTerms).toContain('react');
      expect(result.excludedTextTerms).toContain('github');
    });

    it('should parse excluded quoted phrases', () => {
      const result = parseQuery('!audio -"spotify music"');
      expect(result.bangs).toHaveLength(1);
      expect(result.excludedTextTerms).toContain('spotify music');
    });

    it('should parse multiple excluded terms', () => {
      const result = parseQuery('test -github -docs');
      expect(result.textTerms).toContain('test');
      expect(result.excludedTextTerms).toContain('github');
      expect(result.excludedTextTerms).toContain('docs');
    });

    it('should handle only excluded terms', () => {
      const result = parseQuery('-documentation');
      expect(result.textTerms).toHaveLength(0);
      expect(result.excludedTextTerms).toContain('documentation');
    });

    it('should parse combined exclusions and bangs', () => {
      const result = parseQuery('!audio -github -!frozen');
      expect(result.bangs).toHaveLength(2);
      expect(result.excludedTextTerms).toContain('github');
    });
  });
});
