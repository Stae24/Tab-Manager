import { describe, it, expect } from 'vitest';
import { cn, getIslandBorderColor, getBorderRadiusClass, getBottomBorderRadiusClass } from '../cn';

describe('cn utilities', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('foo', false && 'bar', true && 'baz');
      expect(result).toBe('foo baz');
    });

    it('should handle overrides', () => {
      const result = cn('foo', 'bar', 'bar-baz');
      expect(result).toBe('foo bar bar-baz');
    });
  });

  describe('getIslandBorderColor', () => {
    it('should return correct hex for grey', () => {
      expect(getIslandBorderColor('grey')).toBe('#737373');
    });

    it('should return correct hex for blue', () => {
      expect(getIslandBorderColor('blue')).toBe('#3b82f6');
    });

    it('should return correct hex for red', () => {
      expect(getIslandBorderColor('red')).toBe('#ef4444');
    });

    it('should return correct hex for yellow', () => {
      expect(getIslandBorderColor('yellow')).toBe('#eab308');
    });

    it('should return correct hex for green', () => {
      expect(getIslandBorderColor('green')).toBe('#22c55e');
    });

    it('should return correct hex for pink', () => {
      expect(getIslandBorderColor('pink')).toBe('#ec4899');
    });

    it('should return correct hex for purple', () => {
      expect(getIslandBorderColor('purple')).toBe('#a855f7');
    });

    it('should return correct hex for cyan', () => {
      expect(getIslandBorderColor('cyan')).toBe('#06b6d4');
    });

    it('should return correct hex for orange', () => {
      expect(getIslandBorderColor('orange')).toBe('#f97316');
    });

    it('should return default grey for unknown color', () => {
      expect(getIslandBorderColor('unknown')).toBe('#737373');
    });

    it('should return default grey for empty string', () => {
      expect(getIslandBorderColor('')).toBe('#737373');
    });
  });

  describe('getBorderRadiusClass', () => {
    it('should return none class', () => {
      expect(getBorderRadiusClass('none')).toBe('rounded-none');
    });

    it('should return small class', () => {
      expect(getBorderRadiusClass('small')).toBe('rounded-sm');
    });

    it('should return medium class', () => {
      expect(getBorderRadiusClass('medium')).toBe('rounded-lg');
    });

    it('should return large class', () => {
      expect(getBorderRadiusClass('large')).toBe('rounded-xl');
    });

    it('should return full class', () => {
      expect(getBorderRadiusClass('full')).toBe('rounded-2xl');
    });

    it('should return default medium for unknown', () => {
      expect(getBorderRadiusClass('unknown')).toBe('rounded-lg');
    });
  });

  describe('getBottomBorderRadiusClass', () => {
    it('should return none class', () => {
      expect(getBottomBorderRadiusClass('none')).toBe('rounded-b-none');
    });

    it('should return small class', () => {
      expect(getBottomBorderRadiusClass('small')).toBe('rounded-b-sm');
    });

    it('should return medium class', () => {
      expect(getBottomBorderRadiusClass('medium')).toBe('rounded-b-lg');
    });

    it('should return large class', () => {
      expect(getBottomBorderRadiusClass('large')).toBe('rounded-b-xl');
    });

    it('should return full class', () => {
      expect(getBottomBorderRadiusClass('full')).toBe('rounded-b-2xl');
    });

    it('should return default medium for unknown', () => {
      expect(getBottomBorderRadiusClass('unknown')).toBe('rounded-b-lg');
    });
  });
});
