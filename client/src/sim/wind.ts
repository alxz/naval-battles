import { degToRad, normalizeAngle } from './angles';
import { clamp } from './math';
import { nextSigned } from './random';
import type { World } from './types';

/** How the wind drifts. Loaded from `data/wind.json`. */
export interface WindDriftParams {
  driftEverySeconds: number;
  driftMaxStepDeg: number; // each drift turns the wind by at most this much
  driftMaxOffsetDeg: number; // never farther than this from the base direction
  driftMaxStrengthStep: number;
  minStrength: number;
  maxStrength: number;
  shiftMinSeconds: number; // every so often the base direction swings to a new one...
  shiftMaxSeconds: number;
  shiftMinDeg: number; // ... by this much, to either side
  shiftMaxDeg: number;
  shiftTurnDegPerDrift: number; // the wind follows a new base direction by this much per drift
}

/** A random number between a and b from the world's generator. */
function between(world: World, a: number, b: number): number {
  return a + (b - a) * (0.5 + 0.5 * nextSigned(world));
}

/**
 * One small random change of the wind (plan 4.2), every driftEverySeconds:
 *  - the direction turns a few degrees but stays near its base direction;
 *  - every 2.5-5 minutes the base direction itself swings 30-90 degrees to a new one (M3 step 1b:
 *    a wind that never changes made some ports and the inlet hard to reach). The wind does not
 *    jump: it follows the new base by shiftTurnDegPerDrift each drift;
 *  - the strength goes a little up or down within limits.
 * Uses the world's seeded random generator, so the same game drifts the same way.
 */
export function driftWind(world: World, p: WindDriftParams): void {
  const w = world.wind;
  if (w.shiftInSeconds === undefined) w.shiftInSeconds = between(world, p.shiftMinSeconds, p.shiftMaxSeconds);
  w.shiftInSeconds -= p.driftEverySeconds;
  if (w.shiftInSeconds <= 0) {
    const side = nextSigned(world) < 0 ? -1 : 1;
    w.baseFromRad = normalizeAngle(w.baseFromRad + side * degToRad(between(world, p.shiftMinDeg, p.shiftMaxDeg)));
    w.shiftInSeconds = between(world, p.shiftMinSeconds, p.shiftMaxSeconds);
  }
  const turned = normalizeAngle(w.fromRad + degToRad(p.driftMaxStepDeg) * nextSigned(world));
  const offset = normalizeAngle(turned - w.baseFromRad);
  const limit = degToRad(p.driftMaxOffsetDeg);
  // Far from the base (just after a shift): come closer by at most shiftTurnDegPerDrift.
  const pull = Math.min(Math.max(0, Math.abs(offset) - limit), degToRad(p.shiftTurnDegPerDrift));
  w.fromRad = normalizeAngle(w.baseFromRad + offset - Math.sign(offset) * pull);
  w.strength = clamp(w.strength + p.driftMaxStrengthStep * nextSigned(world), p.minStrength, p.maxStrength);
}
