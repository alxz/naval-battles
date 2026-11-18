import { describe, expect, it } from 'vitest';
import { DAMAGE, SHIP_CLASSES } from './data';
import { canRepair, enemyWithin, stepRepair } from './repair';
import type { ShipState, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const full = sloop.hullPoints;

function ship(id: number, x: number, hull: number, sailLevel = 0): ShipState {
  return {
    id, shipClass: 'sloop', x, y: 0, headingRad: 0, speed: 0, rudder: 0, sailLevel, aground: false, elevationDeg: 5,
    reloadPort: 0, reloadStarboard: 0, hull, sunk: false, battleSkill: 4, team: id === 1 ? 0 : 1, repairing: false,
  };
}

function world(ships: ShipState[]): World {
  return { tick: 0, rngState: 1, wind: { fromRad: 0, strength: 0.7, baseFromRad: 0 }, ships, balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [] };
}

describe('repair at sea', () => {
  it('needs: sails at 25% or less, no enemy afloat within 500 m, hull below 75%', () => {
    const far = DAMAGE.repair.safeRange + 50;
    expect(canRepair(ship(1, 0, 50), world([ship(1, 0, 50), ship(2, far, full)]), 0.75)).toBe(true);
    expect(canRepair(ship(1, 0, 50, 0.5), world([ship(2, far, full)]), 0.75)).toBe(false); // too much sail
    expect(canRepair(ship(1, 0, 50), world([ship(2, 300, full)]), 0.75)).toBe(false); // enemy near
    expect(canRepair(ship(1, 0, full * 0.8), world([ship(2, far, full)]), 0.75)).toBe(false); // nothing to mend at sea
    expect(canRepair(ship(1, 0, 50), world([{ ...ship(2, 300, 0), sunk: true }]), 0.75)).toBe(true); // a wreck is no danger
  });

  it('enemyWithin counts other teams only', () => {
    const me = ship(1, 0, full);
    expect(enemyWithin(me, world([me, ship(2, 100, full)]), 500)).toBe(true);
    expect(enemyWithin(ship(2, 0, full), world([ship(2, 0, full), ship(3, 100, full)]), 500)).toBe(false); // two bots are friends
  });

  it('mends at sharePerSecond up to 75% and no further; sets `repairing`', () => {
    const me = ship(1, 0, full * 0.5, 0.25);
    const w = world([me]);
    stepRepair(w, 1);
    expect(me.repairing).toBe(true);
    expect(me.hull).toBeCloseTo(full * (0.5 + DAMAGE.repair.sharePerSecond), 6);
    for (let i = 0; i < 100; i++) stepRepair(w, 1);
    expect(me.hull).toBeCloseTo(full * DAMAGE.repair.seaMaxShare, 6);
    expect(me.repairing).toBe(false); // done: nothing more to mend at sea
  });

  it('bots mend by the same rule', () => {
    const bot = ship(2, 2000, full * 0.2);
    const w = world([ship(1, 0, full), bot]);
    stepRepair(w, 10);
    expect(bot.hull).toBeGreaterThan(full * 0.2);
  });
});

describe('repair at sea: sails (M3 step 4)', () => {
  it('the crew mends torn sails up to 90%, even with a sound hull; lost men stay lost', () => {
    const me = { ...ship(1, 0, full, 0.25), sails: 10, crew: 30 };
    const w = world([me]);
    expect(canRepair(me, w, 0.75)).toBe(true); // the sails are the work
    stepRepair(w, 1);
    expect(me.sails).toBeCloseTo(10 + sloop.sailPoints * DAMAGE.repair.sailsPerSecond);
    for (let i = 0; i < 500; i++) stepRepair(w, 1);
    expect(me.sails).toBeCloseTo(sloop.sailPoints * DAMAGE.repair.sailsMaxShare);
    expect(me.crew).toBe(30);
    expect(canRepair(me, w, 0.75)).toBe(false); // nothing left to mend at sea
  });
});
