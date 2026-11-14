import { describe, expect, it } from 'vitest';
import { nextRandom, nextSigned } from './random';

describe('nextRandom', () => {
  it('the same seed gives the same numbers', () => {
    const a = { rngState: 42 };
    const b = { rngState: 42 };
    const listA = Array.from({ length: 5 }, () => nextRandom(a));
    const listB = Array.from({ length: 5 }, () => nextRandom(b));
    expect(listA).toEqual(listB);
  });

  it('another seed gives other numbers', () => {
    expect(nextRandom({ rngState: 1 })).not.toBe(nextRandom({ rngState: 2 }));
  });

  it('stays within 0..1 and averages about 0.5', () => {
    const s = { rngState: 7 };
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const r = nextRandom(s);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      sum += r;
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
  });

  it('nextSigned stays within -1..1', () => {
    const s = { rngState: 9 };
    for (let i = 0; i < 1000; i++) {
      const r = nextSigned(s);
      expect(r).toBeGreaterThanOrEqual(-1);
      expect(r).toBeLessThan(1);
    }
  });
});
