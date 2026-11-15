import { describe, expect, it } from 'vitest';
import { directionFrame } from './shipFrame';

describe('directionFrame', () => {
  it('16 directions: east 0, south 4, west 8, north 12', () => {
    expect(directionFrame(0, 16)).toBe(0);
    expect(directionFrame(Math.PI / 2, 16)).toBe(4);
    expect(directionFrame(Math.PI, 16)).toBe(8);
    expect(directionFrame(-Math.PI / 2, 16)).toBe(12);
  });

  it('picks the nearest picture', () => {
    const step = (2 * Math.PI) / 16;
    expect(directionFrame(step * 0.49, 16)).toBe(0);
    expect(directionFrame(step * 0.51, 16)).toBe(1);
    expect(directionFrame(-step * 0.49, 16)).toBe(0);
    expect(directionFrame(-step * 0.51, 16)).toBe(15);
  });

  it('always gives a frame inside the sheet', () => {
    for (let a = -7; a <= 7; a += 0.1) {
      for (const n of [16, 32]) {
        const f = directionFrame(a, n);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(n);
      }
    }
  });
});
