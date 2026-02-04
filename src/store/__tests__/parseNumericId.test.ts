import { describe, it, expect } from 'vitest';
import { parseNumericId } from '../useStore';

describe('parseNumericId', () => {
  it('should parse standard live tab IDs', () => {
    expect(parseNumericId('live-tab-123')).toBe(123);
  });

  it('should parse standard live group IDs', () => {
    expect(parseNumericId('live-group-456')).toBe(456);
  });

  it('should return null for non-numeric IDs', () => {
    expect(parseNumericId('some-random-id')).toBe(null);
  });

  it('should handle IDs with non-numeric suffixes', () => {
    // Task 2.9 asks to handle non-numeric suffixes correctly.
    expect(parseNumericId('live-tab-123-extra')).toBe(123);
  });

  it('should handle numeric IDs passed as strings', () => {
    expect(parseNumericId('789')).toBe(789);
  });

  it('should handle numeric IDs passed as numbers', () => {
    expect(parseNumericId(1011)).toBe(1011);
  });

  it('should return null for non-positive IDs', () => {
    expect(parseNumericId('live-tab-0')).toBe(null);
    expect(parseNumericId('live-tab--1')).toBe(null);
  });

  it('should return null for non-safe integers', () => {
    expect(parseNumericId('live-tab-9007199254740992')).toBe(null);
  });

  it('should return null for IDs exceeding 32-bit limit', () => {
    expect(parseNumericId('live-tab-2147483648')).toBe(null);
  });
});
