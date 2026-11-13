import { describe, expect, it } from 'vitest';
import { lerp, lerpAngle } from './interpolate';

describe('lerp', () => {
  it('returns the ends and the middle', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe('lerpAngle', () => {
  it('blends normal angles like lerp', () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });
  it('takes the short way across the +-PI seam', () => {
    // From 170 deg to -170 deg is a 20 degree turn, not 340.
    const a = (170 * Math.PI) / 180;
    const b = (-170 * Math.PI) / 180;
    const mid = lerpAngle(a, b, 0.5);
    expect(Math.abs(Math.cos(mid) + 1)).toBeLessThan(1e-9); // mid is 180 deg
  });
});
