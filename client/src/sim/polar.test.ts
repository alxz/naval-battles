import { describe, expect, it } from 'vitest';
import { POLARS, SHIP_CLASSES } from './data';
import { polarShare } from './polar';

const sloop = POLARS['foreAndAft']!;
const square = POLARS['square']!;

describe('polarShare', () => {
  it('gives nothing inside the no-go zone', () => {
    expect(polarShare(sloop, 0)).toBe(0);
    expect(polarShare(sloop, 39)).toBe(0);
    expect(polarShare(square, 50)).toBe(0);
  });

  it('gives the table value at a table point', () => {
    expect(polarShare(sloop, 90)).toBeCloseTo(0.9);
    expect(polarShare(sloop, 135)).toBeCloseTo(1);
    expect(polarShare(square, 180)).toBeCloseTo(0.85);
  });

  it('draws a straight line between two points', () => {
    expect(polarShare(sloop, 60)).toBeCloseTo((0.4 + 0.65) / 2);
  });

  it('a sloop sails closer to the wind than a frigate (plan 4.3)', () => {
    expect(polarShare(sloop, 50)).toBeGreaterThan(polarShare(square, 50));
  });
});

describe('polar data', () => {
  it('every ship class has a known rig', () => {
    for (const p of Object.values(SHIP_CLASSES)) expect(POLARS[p.rig]).toBeDefined();
  });

  it('every table is sorted, starts at its no-go angle and stays within 0..1', () => {
    for (const polar of Object.values(POLARS)) {
      expect(polar.points[0]!.twaDeg).toBe(polar.noGoDeg);
      for (let i = 1; i < polar.points.length; i++) {
        expect(polar.points[i]!.twaDeg).toBeGreaterThan(polar.points[i - 1]!.twaDeg);
      }
      for (const p of polar.points) expect(p.share).toBeGreaterThanOrEqual(0);
      for (const p of polar.points) expect(p.share).toBeLessThanOrEqual(1);
    }
  });
});
