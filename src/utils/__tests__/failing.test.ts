import { describe, it, expect } from 'vitest';

describe('intentionally failing tests', () => {
  it('should fail: 1 + 1 equals 3', () => {
    expect(1 + 1).toBe(3);
  });

  it('should fail: array length check', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(5);
  });

  it('should fail: object property check', () => {
    const obj = { name: 'test' };
    expect(obj.name).toBe('wrong');
  });
});
