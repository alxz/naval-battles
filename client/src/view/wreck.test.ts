import { describe, expect, it } from 'vitest';
import { speedScaleFor, wreckAlpha, wreckGone, type WreckParams } from './wreck';

const P: WreckParams = { minAlpha: 0.2, sinkRate: 0.3, keepSeconds: 30, fadeSeconds: 5 };

describe('wreckAlpha', () => {
  it('starts solid and sinks to the faint wreck', () => {
    expect(wreckAlpha(0, P)).toBe(1);
    expect(wreckAlpha(1, P)).toBeCloseTo(0.7);
    expect(wreckAlpha(10, P)).toBeCloseTo(0.2);
  });
  it('stays faint until keepSeconds, then melts to nothing', () => {
    expect(wreckAlpha(30, P)).toBeCloseTo(0.2);
    expect(wreckAlpha(32.5, P)).toBeCloseTo(0.1);
    expect(wreckAlpha(35, P)).toBe(0);
    expect(wreckAlpha(100, P)).toBe(0);
  });
});

describe('wreckGone', () => {
  it('is true only after keep + fade seconds', () => {
    expect(wreckGone(34.9, P)).toBe(false);
    expect(wreckGone(35, P)).toBe(true);
  });
});

describe('speedScaleFor', () => {
  it('adds the solo factor in a battle, not in the arena', () => {
    expect(speedScaleFor(1, false, 1.15)).toBeCloseTo(1.15);
    expect(speedScaleFor(1, true, 1.15)).toBe(1);
    expect(speedScaleFor(0.8, false, 1.25)).toBeCloseTo(1);
  });
});
