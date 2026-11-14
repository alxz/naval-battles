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
}

/**
 * One small random change of the wind (plan 4.2): the direction turns a few degrees
 * but stays near its base direction; the strength goes a little up or down within limits.
 * Uses the world's seeded random generator, so the same game drifts the same way.
 */
export function driftWind(world: World, p: WindDriftParams): void {
  const w = world.wind;
  const turned = normalizeAngle(w.fromRad + degToRad(p.driftMaxStepDeg) * nextSigned(world));
  const offset = clamp(normalizeAngle(turned - w.baseFromRad), -degToRad(p.driftMaxOffsetDeg), degToRad(p.driftMaxOffsetDeg));
  w.fromRad = normalizeAngle(w.baseFromRad + offset);
  w.strength = clamp(w.strength + p.driftMaxStrengthStep * nextSigned(world), p.minStrength, p.maxStrength);
}
