import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from './data';
import { STEP_SECONDS, sailingInfo, stepShip, stepWorld, targetSpeed, windFactor } from './step';
import type { ShipState, Wind } from './types';
import { createWorld } from './world';

const sloop = SHIP_CLASSES['sloop']!;
const EAST = 0;
const NORTH = -Math.PI / 2;
// For these tests: a full wind from the north. A ship heading east has it on the beam (TWA 90).
const northWind: Wind = { fromRad: NORTH, strength: 1 };

function newShip(headingRad = EAST): ShipState {
  return { id: 1, shipClass: 'sloop', x: 0, y: 0, headingRad, speed: 0, rudder: 0, sailLevel: 0 };
}

/** Run `seconds` of fixed steps. */
function run(ship: ShipState, seconds: number, wind: Wind = northWind, speedScale = 1): void {
  const steps = Math.round(seconds / STEP_SECONDS);
  for (let i = 0; i < steps; i++) stepShip(ship, sloop, wind, STEP_SECONDS, { speedScale });
}

describe('windFactor', () => {
  it('calm still gives 0.4, full wind gives 1', () => {
    expect(windFactor(0)).toBeCloseTo(0.4);
    expect(windFactor(1)).toBeCloseTo(1);
    expect(windFactor(0.5)).toBeCloseTo(0.7);
  });
});

describe('targetSpeed (plan 4.3)', () => {
  it('beam reach, full sails, full wind: maxSpeed x 0.9', () => {
    const s = newShip(EAST);
    s.sailLevel = 1;
    expect(targetSpeed(s, sloop, northWind)).toBeCloseTo(sloop.maxSpeed * 0.9);
  });

  it('half sails and half wind', () => {
    const s = newShip(EAST);
    s.sailLevel = 0.5;
    expect(targetSpeed(s, sloop, { fromRad: NORTH, strength: 0.5 })).toBeCloseTo(sloop.maxSpeed * 0.9 * 0.5 * 0.7);
  });

  it('bow into the wind: zero ("in irons")', () => {
    const s = newShip(NORTH);
    s.sailLevel = 1;
    expect(targetSpeed(s, sloop, northWind)).toBe(0);
    expect(sailingInfo(s, sloop, northWind).twaDeg).toBeCloseTo(0);
  });
});

describe('stepShip: speed', () => {
  it('stays still with the sails furled', () => {
    const s = newShip();
    run(s, 10);
    expect(s.speed).toBe(0);
    expect(s.x).toBe(0);
  });

  it('after one time constant it has made about 63% of the way', () => {
    const s = newShip();
    s.sailLevel = 1;
    run(s, sloop.speedTimeConstant);
    expect(s.speed / targetSpeed(s, sloop, northWind)).toBeCloseTo(0.632, 2);
  });

  it('after a long time it sails at the target speed', () => {
    const s = newShip();
    s.sailLevel = 1;
    run(s, 60);
    expect(s.speed).toBeCloseTo(sloop.maxSpeed * 0.9, 1);
  });

  it('turning into the wind slows the ship down to a stop', () => {
    const s = newShip(NORTH);
    s.speed = 8;
    s.sailLevel = 1;
    run(s, 60);
    expect(s.speed).toBeLessThan(0.01);
  });

  it('speedScale 2 doubles the target speed', () => {
    const s = newShip();
    s.sailLevel = 1;
    run(s, 60, northWind, 2);
    expect(s.speed).toBeCloseTo(sloop.maxSpeed * 0.9 * 2, 1);
  });
});

describe('stepShip: movement and rudder', () => {
  it('heading east moves x up; heading south moves y up (y points south)', () => {
    const e = newShip(EAST);
    e.speed = 5;
    stepShip(e, sloop, { fromRad: 0, strength: 0 }, 0.1);
    expect(e.x).toBeGreaterThan(0);
    expect(e.y).toBeCloseTo(0);
    const s = newShip(Math.PI / 2);
    s.speed = 5;
    stepShip(s, sloop, { fromRad: 0, strength: 0 }, 0.1);
    expect(s.y).toBeGreaterThan(0);
  });

  it('at a standstill the rudder keeps only minSteerShare of the turn rate', () => {
    const s = newShip();
    s.rudder = 1;
    stepShip(s, sloop, northWind, 1);
    expect(s.headingRad).toBeCloseTo(sloop.turnRate * sloop.minSteerShare);
  });

  it('from half of top speed the rudder works fully', () => {
    const s = newShip();
    s.speed = sloop.maxSpeed * 0.5;
    s.sailLevel = 1;
    s.rudder = 1;
    stepShip(s, sloop, northWind, STEP_SECONDS);
    expect(s.headingRad).toBeCloseTo(sloop.turnRate * STEP_SECONDS, 3);
  });

  it('negative rudder turns the other way (heading gets smaller)', () => {
    const s = newShip();
    s.speed = sloop.maxSpeed;
    s.rudder = -1;
    stepShip(s, sloop, northWind, STEP_SECONDS);
    expect(s.headingRad).toBeLessThan(0);
  });

  it('keeps the heading inside (-PI, PI]', () => {
    const s = newShip();
    s.sailLevel = 1;
    s.rudder = 1;
    run(s, 60);
    expect(s.headingRad).toBeLessThanOrEqual(Math.PI);
    expect(s.headingRad).toBeGreaterThan(-Math.PI);
  });
});

describe('ship data (game metres)', () => {
  it('every class has a size and sane numbers', () => {
    for (const p of Object.values(SHIP_CLASSES)) {
      expect(p.length).toBeGreaterThan(p.beam);
      expect(p.maxSpeed).toBeGreaterThan(0);
      expect(p.speedTimeConstant).toBeGreaterThan(0);
      expect(p.minSteerShare).toBeGreaterThanOrEqual(0);
      expect(p.minSteerShare).toBeLessThanOrEqual(1);
    }
  });

  it('the sloop is 30 game metres long (plan section 4.0)', () => {
    expect(sloop.length).toBe(30);
  });
});

describe('stepWorld', () => {
  it('counts ticks', () => {
    const w = createWorld();
    stepWorld(w);
    stepWorld(w);
    expect(w.tick).toBe(2);
  });

  it('leaves the moored target where it is', () => {
    const w = createWorld();
    const before = { ...w.ships[1]! };
    for (let i = 0; i < 90; i++) stepWorld(w);
    expect(w.ships[1]!.x).toBe(before.x);
    expect(w.ships[1]!.y).toBe(before.y);
  });
});
