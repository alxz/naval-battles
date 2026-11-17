import { describe, expect, it } from 'vitest';
import { radToDeg, normalizeAngle } from './angles';
import { WIND } from './data';
import { STEP_SECONDS, WIND_DRIFT_TICKS, stepWorld } from './step';
import { driftWind } from './wind';
import { createWorld } from './world';

describe('driftWind', () => {
  it('turns the wind by at most the step size', () => {
    const w = createWorld();
    const before = w.wind.fromRad;
    driftWind(w, WIND);
    expect(Math.abs(radToDeg(normalizeAngle(w.wind.fromRad - before)))).toBeLessThanOrEqual(WIND.driftMaxStepDeg + 1e-9);
  });

  it('after many drifts stays near the base direction and within the strength limits (no shifts)', () => {
    const w = createWorld();
    const noShifts = { ...WIND, shiftMinSeconds: 1e9, shiftMaxSeconds: 1e9 };
    for (let i = 0; i < 5000; i++) {
      driftWind(w, noShifts);
      const offset = Math.abs(radToDeg(normalizeAngle(w.wind.fromRad - w.wind.baseFromRad)));
      expect(offset).toBeLessThanOrEqual(WIND.driftMaxOffsetDeg + 1e-9);
      expect(w.wind.strength).toBeGreaterThanOrEqual(WIND.minStrength);
      expect(w.wind.strength).toBeLessThanOrEqual(WIND.maxStrength);
    }
  });

  it('the same seed drifts the same way; another seed differently', () => {
    const a = createWorld(1);
    const b = createWorld(1);
    const c = createWorld(2);
    for (let i = 0; i < 20; i++) {
      driftWind(a, WIND);
      driftWind(b, WIND);
      driftWind(c, WIND);
    }
    expect(a.wind).toEqual(b.wind);
    expect(c.wind.fromRad).not.toBe(a.wind.fromRad);
  });
});

describe('wind drift in stepWorld', () => {
  it('changes the wind only every driftEverySeconds', () => {
    const w = createWorld();
    const start = { ...w.wind };
    for (let i = 0; i < WIND_DRIFT_TICKS; i++) stepWorld(w);
    expect(w.wind).toEqual(start); // tick 0 .. N-1: no drift yet
    stepWorld(w);
    expect(w.wind).not.toEqual(start);
    expect(WIND_DRIFT_TICKS * STEP_SECONDS).toBeCloseTo(WIND.driftEverySeconds);
  });

  it('no drift when windDrift is off (tuning)', () => {
    const w = createWorld();
    const start = { ...w.wind };
    for (let i = 0; i < WIND_DRIFT_TICKS * 3; i++) stepWorld(w, STEP_SECONDS, { speedScale: 1, windDrift: false });
    expect(w.wind).toEqual(start);
  });
});

describe('wind shifts (M3 step 1b)', () => {
  it('every 2.5-5 minutes the base direction swings 30-90 degrees, and the wind follows it without jumping', () => {
    const w = createWorld(5);
    const bases: number[] = [w.wind.baseFromRad];
    let from = w.wind.fromRad;
    const drifts = (30 * 60) / WIND.driftEverySeconds; // half an hour
    for (let i = 0; i < drifts; i++) {
      driftWind(w, WIND);
      const turn = Math.abs(radToDeg(normalizeAngle(w.wind.fromRad - from)));
      expect(turn).toBeLessThanOrEqual(WIND.driftMaxStepDeg + WIND.shiftTurnDegPerDrift + 1e-9);
      from = w.wind.fromRad;
      if (w.wind.baseFromRad !== bases[bases.length - 1]) bases.push(w.wind.baseFromRad);
    }
    // Half an hour: 6-12 shifts.
    expect(bases.length - 1).toBeGreaterThanOrEqual(6);
    expect(bases.length - 1).toBeLessThanOrEqual(12);
    for (let i = 1; i < bases.length; i++) {
      const swing = Math.abs(radToDeg(normalizeAngle(bases[i]! - bases[i - 1]!)));
      expect(swing).toBeGreaterThanOrEqual(WIND.shiftMinDeg - 1e-9);
      expect(swing).toBeLessThanOrEqual(WIND.shiftMaxDeg + 1e-9);
    }
  });
});
