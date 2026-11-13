import { describe, expect, it } from 'vitest';
import { approach, clamp } from './math';

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('cuts values outside the range', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('approach', () => {
  it('moves up by at most maxDelta', () => {
    expect(approach(0, 10, 3)).toBe(3);
  });
  it('moves down by at most maxDelta', () => {
    expect(approach(10, 0, 3)).toBe(7);
  });
  it('does not overshoot the target', () => {
    expect(approach(9, 10, 3)).toBe(10);
    expect(approach(1, 0, 3)).toBe(0);
  });
  it('stays put when already at the target', () => {
    expect(approach(5, 5, 3)).toBe(5);
  });
});
