import { describe, expect, it } from 'vitest';
import { collideShips, collisionDamage, hullOverlap, strikesWithBow } from './collide';
import { DAMAGE, SHIP_CLASSES } from './data';
import { STEP_SECONDS, stepWorld } from './step';
import type { Island, ShipState, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const frigate = SHIP_CLASSES['frigate']!;
const steady = { speedScale: 1, windDrift: false };

function ship(id: number, x: number, y: number, headingRad = 0, speed = 0, shipClass = 'sloop'): ShipState {
  return {
    id, shipClass, x, y, headingRad, speed, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 5,
    reloadPort: 0, reloadStarboard: 0, hull: SHIP_CLASSES[shipClass]!.hullPoints, sunk: false, battleSkill: 4, team: id === 1 ? 0 : 1, repairing: false,
  };
}

function world(ships: ShipState[]): World {
  return { tick: 0, rngState: 1, wind: { fromRad: 0, strength: 0.7, baseFromRad: 0 }, ships, balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [] };
}

describe('hullOverlap', () => {
  it('two sloops side by side: touch when their sides overlap, not when there is water between', () => {
    // Both head east; the second lies to the south. Beam 10 m: sides touch at 10 m between the centres.
    expect(hullOverlap(ship(1, 0, 0), sloop, ship(2, 0, 12), sloop)).toBeNull();
    const hit = hullOverlap(ship(1, 0, 0), sloop, ship(2, 0, 8), sloop)!;
    expect(hit.depth).toBeCloseTo(2, 6);
    expect(hit.nx).toBeCloseTo(0, 6);
    expect(hit.ny).toBeCloseTo(1, 6); // push the second ship south
  });

  it('bow into the side (a T): touches when the bow reaches the other hull', () => {
    const rammer = ship(1, 0, 0, Math.PI / 2); // heads south; its bow is at y = 15
    expect(hullOverlap(rammer, sloop, ship(2, 0, 21), sloop)).toBeNull(); // the other's side is at y = 16
    expect(hullOverlap(rammer, sloop, ship(2, 0, 19), sloop)!.depth).toBeCloseTo(1, 6);
  });

  it('turned ships: corners that only pass each other do not count', () => {
    // Two sloops at 45 degrees, centres 24 m apart along x: their boxes' corners are apart.
    expect(hullOverlap(ship(1, 0, 0, Math.PI / 4), sloop, ship(2, 24, 0, Math.PI / 4), sloop)).toBeNull();
  });
});

describe('collisionDamage and strikesWithBow', () => {
  it('equal ships lose the same; the lighter loses more; a bow strike costs the rammer half', () => {
    const same = collisionDamage(8, 100, 100, false, false);
    expect(same.a).toBeCloseTo(DAMAGE.collision.hullPerMps * 8, 6);
    expect(same.b).toBeCloseTo(same.a, 6);
    const uneven = collisionDamage(8, sloop.mass, frigate.mass, false, false); // a = sloop
    expect(uneven.a).toBeGreaterThan(uneven.b * 5);
    expect(collisionDamage(8, 100, 100, true, false).a).toBeCloseTo(same.a * DAMAGE.collision.bowFactor, 6);
  });

  it('a slow touch does no damage', () => {
    expect(collisionDamage(DAMAGE.collision.minClosingSpeed - 0.1, 100, 100, false, false)).toEqual({ a: 0, b: 0 });
  });

  it('bow: the other ship within 35 degrees of dead ahead', () => {
    const s = ship(1, 0, 0, 0); // heads east
    expect(strikesWithBow(s, 1, 0)).toBe(true);
    expect(strikesWithBow(s, 1, 0.5)).toBe(true); // about 27 degrees off
    expect(strikesWithBow(s, 0, 1)).toBe(false); // on the beam
    expect(strikesWithBow(s, -1, 0)).toBe(false); // astern
  });
});

describe('collideShips', () => {
  it('ramming: both are damaged (the rammed side more), pushed apart and slowed; one event', () => {
    const rammer = ship(1, 0, 0, Math.PI / 2, 8); // south at 8 m/s
    const victim = ship(2, 0, 19); // lies across its bow
    const w = world([rammer, victim]);
    collideShips(w, []);
    const event = w.events.find((e) => e.type === 'collision');
    expect(event).toBeDefined();
    expect(sloop.hullPoints - rammer.hull).toBeCloseTo(DAMAGE.collision.hullPerMps * 8 * DAMAGE.collision.bowFactor, 6); // 24
    expect(sloop.hullPoints - victim.hull).toBeCloseTo(DAMAGE.collision.hullPerMps * 8, 6); // 48
    expect(hullOverlap(rammer, sloop, victim, sloop)).toBeNull();
    expect(rammer.speed).toBeCloseTo(8 * DAMAGE.collision.speedKept, 6);
  });

  it('leaning on each other slowly: pushed apart, no damage, no event', () => {
    const a = ship(1, 0, 0, 0, 0.3);
    const b = ship(2, 0, 8, 0, 0.3);
    const w = world([a, b]);
    collideShips(w, []);
    expect(w.events).toEqual([]);
    expect(a.hull).toBe(sloop.hullPoints);
    expect(hullOverlap(a, sloop, b, sloop)).toBeNull();
  });

  it('a sloop that rams a frigate at full speed is badly hurt; the frigate hardly', () => {
    const me = ship(1, 0, 0, Math.PI / 2, 11); // south at 11 m/s
    const big = ship(2, 0, 15 + 9 - 1, 0, 0, 'frigate'); // its side 1 m inside my bow
    const w = world([me, big]);
    collideShips(w, []);
    expect(sloop.hullPoints - me.hull).toBeGreaterThan(50);
    expect(frigate.hullPoints - big.hull).toBeLessThan(25);
  });

  it('a fatal collision sinks the ship and names the other as the cause', () => {
    const rammer = ship(1, 0, 0, Math.PI / 2, 10);
    const victim = { ...ship(2, 0, 19), hull: 20 };
    const w = world([rammer, victim]);
    collideShips(w, []);
    expect(victim.sunk).toBe(true);
    expect(w.events.some((e) => e.type === 'sunk' && e.shipId === 2 && e.byShipId === 1)).toBe(true);
  });

  it('never pushes a ship onto land: the other one moves instead', () => {
    const shore: Island = { name: 'shore', points: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: -6 }, { x: -100, y: -6 }] };
    const a = ship(1, 0, 0, 0, 0.2); // 1 m of water between its side and the shore to the north
    const b = ship(2, 0, 8, 0, 0.2);
    const w = world([a, b]);
    collideShips(w, [shore]);
    expect(a.y).toBe(0); // it could not move north
    expect(hullOverlap(a, sloop, b, sloop)).toBeNull();
  });

  it('wrecks do not collide; ships never end a step inside each other', () => {
    const sunk = { ...ship(2, 0, 5), sunk: true };
    const w = world([ship(1, 0, 0, 0, 5), sunk]);
    collideShips(w, []);
    expect(w.events).toEqual([]);
    // Two sloops sail at each other for 30 s.
    const a = { ...ship(1, -150, 0, 0, 0), sailLevel: 1 };
    const b = { ...ship(2, 150, 3, Math.PI, 0), sailLevel: 1 };
    const w2 = world([a, b]);
    w2.wind = { fromRad: -Math.PI / 2, strength: 0.7, baseFromRad: -Math.PI / 2 }; // a beam wind for both
    for (let i = 0; i < 30 / STEP_SECONDS; i++) {
      stepWorld(w2, STEP_SECONDS, steady, []);
      expect(hullOverlap(a, sloop, b, sloop)).toBeNull();
    }
    expect(a.hull).toBeLessThan(sloop.hullPoints); // they did meet
  });
});
