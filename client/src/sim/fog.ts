// M4b step 5a: fog banks for the rules. Until now fog was only a picture (scenes/Fog.ts drew it with Math.random,
// and nobody's eyes cared). Now the banks live in the world as plain data, drift down the wind every step, and
// shrink how far ships see: a ship inside a bank, or one seen across a bank, is seen only at visibilityInFog of
// the usual ranges (data/fog.json). The picture draws the same banks, so what you see is what the rules use.
// Their own seeded random numbers (not the world's generator), so adding fog does not change any other dice.
import fogJson from '../data/fog.json';
import { WORLD } from './data';
import { nextRandom } from './random';
import type { FogBank, FogState, WindNow } from './types';

export interface FogParams {
  banks: number;
  puffs: number;
  lengthMinM: number;
  lengthRangeM: number;
  acrossM: number;
  puffSizeMinM: number;
  puffSizeRangeM: number;
  speedMin: number;
  speedRange: number;
  driftBaseMps: number;
  driftPerWindMps: number;
  marginM: number;
  visibilityInFog: number;
  thickCore: number;
  lineSamples: number;
}

export const FOG: FogParams = fogJson;

/** The banks of a new game, from the game's seed (the same seed gives the same fog). */
export function makeFog(seed: number, p: FogParams = FOG): FogState {
  const rng = { rngState: (seed ^ 0x5f0c3a1d) | 0 };
  const spanX = WORLD.maxX - WORLD.minX;
  const spanY = WORLD.maxY - WORLD.minY;
  const banks: FogBank[] = [];
  for (let i = 0; i < p.banks; i++) {
    const length = p.lengthMinM + nextRandom(rng) * p.lengthRangeM;
    const bank: FogBank = {
      x: WORLD.minX + nextRandom(rng) * spanX,
      y: WORLD.minY + nextRandom(rng) * spanY,
      speed: p.speedMin + nextRandom(rng) * p.speedRange,
      reachM: 0,
      puffs: [],
    };
    for (let k = 0; k < p.puffs; k++) {
      const t = k / (p.puffs - 1) - 0.5; // -0.5 .. 0.5 along the band
      const along = t * length + (nextRandom(rng) - 0.5) * 80;
      const across = (nextRandom(rng) - 0.5) * p.acrossM * (1 - Math.abs(t)); // thinner at the ends
      const size = p.puffSizeMinM + nextRandom(rng) * p.puffSizeRangeM * (1 - Math.abs(t));
      bank.puffs.push({ along, across, size });
      bank.reachM = Math.max(bank.reachM, Math.hypot(along, across) + size / 2);
    }
    banks.push(bank);
  }
  return { banks };
}

/** One step: every bank drifts where the wind blows; off one side of the sea it comes back on the other. */
export function stepFog(fog: FogState, wind: WindNow, dt: number, p: FogParams = FOG): void {
  const to = wind.fromRad + Math.PI; // the wind blows FROM fromRad
  const drift = p.driftBaseMps + p.driftPerWindMps * wind.strength;
  const spanX = WORLD.maxX - WORLD.minX + 2 * p.marginM;
  const spanY = WORLD.maxY - WORLD.minY + 2 * p.marginM;
  for (const bank of fog.banks) {
    bank.x += Math.cos(to) * drift * bank.speed * dt;
    bank.y += Math.sin(to) * drift * bank.speed * dt;
    if (bank.x < WORLD.minX - p.marginM) bank.x += spanX;
    if (bank.x > WORLD.maxX + p.marginM) bank.x -= spanX;
    if (bank.y < WORLD.minY - p.marginM) bank.y += spanY;
    if (bank.y > WORLD.maxY + p.marginM) bank.y -= spanY;
  }
}

/** Where one puff is now: the band lies along the wind (it turns when the wind veers). */
export function puffPlace(bank: FogBank, puff: FogBank['puffs'][number], wind: WindNow): { x: number; y: number } {
  const to = wind.fromRad + Math.PI;
  return {
    x: bank.x + Math.cos(to) * puff.along - Math.sin(to) * puff.across,
    y: bank.y + Math.sin(to) * puff.along + Math.cos(to) * puff.across,
  };
}

/** How thick the fog is at this point: 0 = clear, 1 = thick (the inner part of a puff). */
export function fogAt(fog: FogState | undefined, wind: WindNow, x: number, y: number, p: FogParams = FOG): number {
  if (!fog) return 0;
  let thick = 0;
  for (const bank of fog.banks) {
    if (Math.hypot(x - bank.x, y - bank.y) > bank.reachM) continue;
    for (const puff of bank.puffs) {
      const at = puffPlace(bank, puff, wind);
      const r = puff.size / 2;
      const t = p.thickCore * (1 - Math.hypot(x - at.x, y - at.y) / r);
      if (t > thick) thick = Math.min(1, t);
      if (thick >= 1) return 1;
    }
  }
  return thick;
}

/** The thickest fog on the line between two points (the two ends included). */
export function fogBetween(fog: FogState | undefined, wind: WindNow, ax: number, ay: number, bx: number, by: number, p: FogParams = FOG): number {
  if (!fog) return 0;
  let thick = 0;
  const n = Math.max(2, p.lineSamples);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    thick = Math.max(thick, fogAt(fog, wind, ax + (bx - ax) * t, ay + (by - ay) * t, p));
    if (thick >= 1) break;
  }
  return thick;
}

/** The share of the clear-day sight ranges left with fog this thick: 1 in clear air, visibilityInFog in thick fog. */
export function fogVisibility(thick: number, p: FogParams = FOG): number {
  return 1 - (1 - p.visibilityInFog) * Math.max(0, Math.min(1, thick));
}
