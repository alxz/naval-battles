import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { GUNS, SHIP_CLASSES } from './data';
import { ballHit, segmentBoxEntry, toShipLocal } from './hits';
import { STEP_SECONDS, stepWorld } from './step';
import { withPerfectGuns } from './testing';
import type { ShipState, SimEvent, World } from './types';

const sloop = SHIP_CLASSES['sloop']!; // 30 x 10 m, hull 5 m, mast 22 m
const calm = { speedScale: 1, windDrift: false };
const box = { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 };

function ship(id: number, x: number, y: number, headingRad = 0): ShipState {
  return {
    id, shipClass: 'sloop', x, y, headingRad, speed: 0, rudder: 0, sailLevel: 0, aground: false,
    elevationDeg: 0, reloadPort: 0, reloadStarboard: 0, hull: sloop.hullPoints, sunk: false, battleSkill: 4,
  };
}

describe('segmentBoxEntry', () => {
  it('finds where a segment enters the box', () => {
    expect(segmentBoxEntry({ x: -10, y: 5, z: 5 }, { x: 10, y: 5, z: 5 }, box)).toBeCloseTo(0.5);
  });

  it('misses a box beside or above the segment', () => {
    expect(segmentBoxEntry({ x: -10, y: 20, z: 5 }, { x: 20, y: 20, z: 5 }, box)).toBeNull();
    expect(segmentBoxEntry({ x: -10, y: 5, z: 15 }, { x: 20, y: 5, z: 15 }, box)).toBeNull();
  });

  it('a segment that stops before the box misses it', () => {
    expect(segmentBoxEntry({ x: -10, y: 5, z: 5 }, { x: -1, y: 5, z: 5 }, box)).toBeNull();
  });

  it('a segment that starts inside gives t = 0', () => {
    expect(segmentBoxEntry({ x: 5, y: 5, z: 5 }, { x: 50, y: 5, z: 5 }, box)).toBe(0);
  });
});

describe('toShipLocal', () => {
  it('a point ahead of a ship heading south is "forward" (+x) for that ship', () => {
    const p = toShipLocal(ship(1, 0, 0, Math.PI / 2), { x: 0, y: 10, z: 0 });
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
  });
});

describe('ballHit (hit zones)', () => {
  const target = ship(2, 0, 0); // heading east: hull from x -15..15, y -5..5
  const across = (z: number) => ballHit(target, sloop, { x: 0, y: -20, z }, { x: 0, y: 20, z });

  it('low ball hits the hull, high ball the rigging, very high ball nothing', () => {
    expect(across(2)?.zone).toBe('hull');
    expect(across(10)?.zone).toBe('rigging');
    expect(across(30)).toBeNull();
  });

  it('a ball passing ahead of the bow misses', () => {
    expect(ballHit(target, sloop, { x: 20, y: -20, z: 2 }, { x: 20, y: 20, z: 2 })).toBeNull();
  });
});

describe('broadside against a moored target', () => {
  withPerfectGuns();
  /** Your ship at the origin heading east, the target 150 m to starboard (south). */
  function duel(elevationDeg: number): { world: World; events: SimEvent[] } {
    const me = ship(1, 0, 0);
    me.elevationDeg = elevationDeg;
    const world: World = {
      tick: 0, rngState: 1, wind: { fromRad: 0, strength: 0, baseFromRad: 0 }, ships: [me, ship(2, 0, 150)],
      balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [],
    };
    const events: SimEvent[] = [];
    applyCommand(world, { type: 'fire', shipId: 1, side: 'starboard' });
    for (let i = 0; i < 5 * 30; i++) {
      stepWorld(world, STEP_SECONDS, calm, []);
      events.push(...world.events);
    }
    return { world, events };
  }

  it('the right elevation hits with every ball (guns without random error)', () => {
    let best = 0;
    for (let e = 0; e <= 10; e += 0.5) {
      best = Math.max(best, duel(e).events.filter((ev) => ev.type === 'hit' && ev.zone === 'hull').length);
    }
    expect(best).toBe(sloop.gunsPerSide);
  });

  it('too low falls short: splashes, no hits', () => {
    const { events } = duel(0);
    expect(events.some((e) => e.type === 'hit')).toBe(false);
    expect(events.filter((e) => e.type === 'splash').length).toBe(sloop.gunsPerSide);
  });

  it('a hull hit takes `damage` hull points', () => {
    for (let e = 0; e <= 10; e += 0.5) {
      const { world, events } = duel(e);
      const hullHits = events.filter((ev) => ev.type === 'hit' && ev.zone === 'hull').length;
      expect(world.ships[1]!.hull).toBe(sloop.hullPoints - hullHits * GUNS.damage);
    }
  });

  it('your own balls never hit your own ship', () => {
    for (let e = 0; e <= 10; e += 1) {
      expect(duel(e).events.some((ev) => ev.type === 'hit' && ev.shipId === 1)).toBe(false);
    }
  });
});

describe('sinking', () => {
  withPerfectGuns();
  function sinkingWorld(): World {
    const target = ship(2, 0, 150);
    target.hull = GUNS.damage; // one more hull hit sinks it
    const me = ship(1, 0, 0);
    me.elevationDeg = 6.5;
    return {
      tick: 0, rngState: 1, wind: { fromRad: 0, strength: 0, baseFromRad: 0 }, ships: [me, target],
      balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [],
    };
  }

  it('at 0 hull points the ship sinks once, stops and takes no more hits', () => {
    const world = sinkingWorld();
    world.ships[1]!.sailLevel = 1;
    applyCommand(world, { type: 'fire', shipId: 1, side: 'starboard' });
    const events: SimEvent[] = [];
    for (let i = 0; i < 5 * 30; i++) {
      stepWorld(world, STEP_SECONDS, calm, []);
      events.push(...world.events);
    }
    const t = world.ships[1]!;
    expect(t.sunk).toBe(true);
    expect(t.hull).toBe(0);
    expect(t.sailLevel).toBe(0);
    expect(events.filter((e) => e.type === 'sunk').length).toBe(1);
    expect(events.filter((e) => e.type === 'hit' && e.shipId === 2).length).toBe(1);
  });

  it('a sunk ship cannot fire, and placeShip brings it back afloat with a full hull', () => {
    const world = sinkingWorld();
    const t = world.ships[1]!;
    t.hull = 0;
    t.sunk = true;
    applyCommand(world, { type: 'fire', shipId: 2, side: 'port' });
    expect(world.pendingShots.length).toBe(0);
    applyCommand(world, { type: 'placeShip', shipId: 2, x: 0, y: 100, headingRad: 0 });
    expect(t.sunk).toBe(false);
    expect(t.hull).toBe(sloop.hullPoints);
  });
});
