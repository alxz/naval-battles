import { describe, expect, it } from 'vitest';
import { bearingDegToHeadingRad, compassPoint, headingRadToBearingDeg, twaDeg } from './angles';

const EAST = 0;
const SOUTH = Math.PI / 2;
const WEST = Math.PI;
const NORTH = -Math.PI / 2;

describe('heading <-> compass bearing', () => {
  it('the four main directions', () => {
    expect(headingRadToBearingDeg(NORTH)).toBeCloseTo(0);
    expect(headingRadToBearingDeg(EAST)).toBeCloseTo(90);
    expect(headingRadToBearingDeg(SOUTH)).toBeCloseTo(180);
    expect(headingRadToBearingDeg(WEST)).toBeCloseTo(270);
  });

  it('the trade wind direction ENE (67.5 deg) is -22.5 deg in sim heading', () => {
    expect(bearingDegToHeadingRad(67.5)).toBeCloseTo((-22.5 * Math.PI) / 180);
  });

  it('there and back again gives the same bearing', () => {
    for (const b of [0, 10, 89, 180, 271, 359]) {
      expect(headingRadToBearingDeg(bearingDegToHeadingRad(b))).toBeCloseTo(b);
    }
  });
});

describe('twaDeg (true wind angle)', () => {
  it('bow into the wind is 0, wind from astern is 180', () => {
    expect(twaDeg(EAST, EAST)).toBeCloseTo(0);
    expect(twaDeg(EAST, WEST)).toBeCloseTo(180);
  });

  it('wind on the beam is 90, on either side', () => {
    expect(twaDeg(NORTH, EAST)).toBeCloseTo(90);
    expect(twaDeg(SOUTH, EAST)).toBeCloseTo(90);
  });

  it('works across the -PI / PI seam', () => {
    expect(twaDeg(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo((0.2 * 180) / Math.PI);
  });
});

describe('compassPoint', () => {
  it('names the 16 points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(67.5)).toBe('ENE');
    expect(compassPoint(359)).toBe('N');
    expect(compassPoint(200)).toBe('SSW');
  });
});
