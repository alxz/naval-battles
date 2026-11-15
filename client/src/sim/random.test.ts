import { describe, expect, it } from 'vitest';
import { nextGaussian, nextRandom, nextSigned } from './random';

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

describe('nextGaussian', () => {
  it('has mean about 0 and sigma about 1; about 68% fall within -1..1', () => {
    const s = { rngState: 11 };
    const n = 20000;
    let sum = 0;
    let sumSq = 0;
    let inside = 0;
    for (let i = 0; i < n; i++) {
      const g = nextGaussian(s);
      sum += g;
      sumSq += g * g;
      if (Math.abs(g) < 1) inside++;
    }
    expect(sum / n).toBeCloseTo(0, 1);
    expect(Math.sqrt(sumSq / n)).toBeCloseTo(1, 1);
    expect(inside / n).toBeGreaterThan(0.66);
    expect(inside / n).toBeLessThan(0.70);
  });

  it('the same seed gives the same numbers', () => {
    expect(nextGaussian({ rngState: 5 })).toBe(nextGaussian({ rngState: 5 }));
  });
});
