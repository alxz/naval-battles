import { describe, expect, it } from 'vitest';
import { accuracyInputs, gunSigmaDeg, salvoSigmaDeg } from './accuracy';
import type { AccuracyInputs } from './accuracy';
import { GUNS, SHIP_CLASSES } from './data';
import { landingSpread, orderBroadside, predictLanding } from './guns';
import { STEP_SECONDS, stepWorld } from './step';
import type { ShipState, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const calm = { speedScale: 1, windDrift: false };
const base: AccuracyInputs = { battleSkill: 4, windStrength: 0.5, crewShortage: 0, gunWear: 0, ammoSpread: 1 };
const g = { ...GUNS, gunSigmaDeg: 1.5, salvoSigmaDeg: 0.6 }; // the plan's numbers, so the expected values stay fixed

function sloopAt(id: number, x: number, y: number): ShipState {
  return {
    id, shipClass: 'sloop', x, y, headingRad: 0, speed: 0, rudder: 0, sailLevel: 0,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: sloop.hullPoints, sunk: false, battleSkill: 4,
  };
}

function duelWorld(distance: number, windStrength: number): World {
  // Ship 1 looks east; its starboard side faces south (+y), where ship 2 lies parallel.
  return {
    tick: 0, rngState: 2026, wind: { fromRad: 0, strength: windStrength, baseFromRad: 0 },
    ships: [sloopAt(1, 0, 0), sloopAt(2, 0, distance)], balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [],
  };
}

/** The elevation that puts the middle ball on the target's centre (halve the interval until it fits). */
function aimAt(ship: ShipState, distance: number): number {
  let lo = 0;
  let hi = GUNS.maxElevationDeg;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const p = predictLanding({ ...ship, elevationDeg: mid }, sloop, 'starboard', STEP_SECONDS);
    if (p.y < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

describe('gun and salvo sigma (plan 4.4)', () => {
  it('match the formulas for Battle 4, wind 0.5', () => {
    expect(gunSigmaDeg(base, g)).toBeCloseTo(1.5 * (1.4 - 0.24), 6); // 1.74
    expect(salvoSigmaDeg(base, g)).toBeCloseTo(0.6 * 1.5 * (1.2 - 0.16), 6); // 0.936
  });

  it('a better captain shoots straighter; wind, crew shortage and worn guns make it worse', () => {
    expect(gunSigmaDeg({ ...base, battleSkill: 10 }, g)).toBeLessThan(gunSigmaDeg(base, g));
    expect(salvoSigmaDeg({ ...base, battleSkill: 10 }, g)).toBeLessThan(salvoSigmaDeg(base, g));
    expect(salvoSigmaDeg({ ...base, windStrength: 1 }, g)).toBeGreaterThan(salvoSigmaDeg(base, g));
    expect(gunSigmaDeg({ ...base, crewShortage: 0.5 }, g)).toBeCloseTo(1.5 * gunSigmaDeg(base, g), 6);
    expect(gunSigmaDeg({ ...base, gunWear: 1 }, g)).toBeCloseTo(1.5 * gunSigmaDeg(base, g), 6);
  });

  it('accuracyInputs takes the ship skill and the wind; crew, wear and ammunition stay neutral for now', () => {
    expect(accuracyInputs(sloopAt(1, 0, 0), 0.7)).toEqual({ battleSkill: 4, windStrength: 0.7, crewShortage: 0, gunWear: 0, ammoSpread: 1 });
  });
});

describe('random errors in a broadside', () => {
  it('one salvo error for the whole broadside, different between broadsides', () => {
    const w = duelWorld(150, 0.7);
    const ship = w.ships[0]!;
    orderBroadside(w, ship, 'starboard', STEP_SECONDS);
    const first = w.pendingShots.map((s) => s.salvoErrorDeg);
    expect(new Set(first).size).toBe(1);
    ship.reloadStarboard = 0;
    orderBroadside(w, ship, 'starboard', STEP_SECONDS);
    expect(w.pendingShots.at(-1)!.salvoErrorDeg).not.toBe(first[0]);
  });

  it('the same seed gives the same shots (saves and tests repeat exactly)', () => {
    const landing = (): number[] => {
      const w = duelWorld(400, 0.7); // target far away: every ball splashes
      orderBroadside(w, w.ships[0]!, 'starboard', STEP_SECONDS);
      const xs: number[] = [];
      for (let i = 0; i < 150; i++) {
        stepWorld(w, STEP_SECONDS, calm, []);
        for (const e of w.events) if (e.type === 'splash') xs.push(e.x);
      }
      return xs;
    };
    expect(landing()).toEqual(landing());
    expect(landing().length).toBe(sloop.gunsPerSide);
  });
});

describe('landingSpread (the ellipse)', () => {
  it('is wider in a strong wind and narrower for a better captain', () => {
    const ship = { ...sloopAt(1, 0, 0), elevationDeg: 6 };
    const calmSpread = landingSpread(ship, sloop, 'starboard', 0.2, STEP_SECONDS, g);
    const windy = landingSpread(ship, sloop, 'starboard', 1, STEP_SECONDS, g);
    const expert = landingSpread({ ...ship, battleSkill: 10 }, sloop, 'starboard', 0.2, STEP_SECONDS, g);
    expect(windy.alongM).toBeGreaterThan(calmSpread.alongM);
    expect(expert.alongM).toBeLessThan(calmSpread.alongM);
    expect(expert.acrossM).toBeLessThan(calmSpread.acrossM);
  });

  it('across = distance x tan(sigma_gun); along is tens of metres at 150 m', () => {
    const ship = { ...sloopAt(1, 0, 0), elevationDeg: aimAt(sloopAt(1, 0, 0), 150) };
    const s = landingSpread(ship, sloop, 'starboard', 0.5, STEP_SECONDS, g);
    const fly = 150 - sloop.beam / 2; // from the ship's side to the landing point
    expect(s.acrossM).toBeCloseTo(fly * Math.tan((1.74 * Math.PI) / 180), 0);
    expect(s.alongM).toBeGreaterThan(20);
    expect(s.alongM).toBeLessThan(60);
  });
});

describe('combat target D28 with the real game code', () => {
  it('a perfectly aimed broadside at 150 m gets 1-2 hull hits on average (round shot, Battle 4, wind 0.7)', () => {
    const salvos = 300;
    const w = duelWorld(150, 0.7);
    const shooter = w.ships[0]!;
    const target = w.ships[1]!;
    shooter.elevationDeg = aimAt(shooter, 150);
    let hullHits = 0;
    for (let i = 0; i < salvos; i++) {
      target.hull = sloop.hullPoints; // never let it sink during the count
      shooter.reloadStarboard = 0;
      orderBroadside(w, shooter, 'starboard', STEP_SECONDS);
      while (w.pendingShots.length > 0 || w.balls.length > 0) {
        stepWorld(w, STEP_SECONDS, calm, []);
        for (const e of w.events) if (e.type === 'hit' && e.zone === 'hull') hullHits++;
      }
    }
    const perSalvo = hullHits / salvos;
    expect(perSalvo).toBeGreaterThan(1);
    expect(perSalvo).toBeLessThan(2);
  });
});
