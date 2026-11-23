import { describe, expect, it } from 'vitest';
import { cappedDamage, collideShips, collisionDamage, hullOverlap, impactPlace, strikesWithBow } from './collide';
import type { ImpactSide } from './collide';
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
    // Both head east; the second lies to the south. Beam 12 m: sides touch at 12 m between the centres.
    expect(hullOverlap(ship(1, 0, 0), sloop, ship(2, 0, 14), sloop)).toBeNull();
    const hit = hullOverlap(ship(1, 0, 0), sloop, ship(2, 0, 10), sloop)!;
    expect(hit.depth).toBeCloseTo(2, 6);
    expect(hit.nx).toBeCloseTo(0, 6);
    expect(hit.ny).toBeCloseTo(1, 6); // push the second ship south
  });

  it('bow into the side (a T): touches when the bow reaches the other hull', () => {
    const rammer = ship(1, 0, 0, Math.PI / 2); // heads south; its bow is at y = 18
    expect(hullOverlap(rammer, sloop, ship(2, 0, 25), sloop)).toBeNull(); // the other's side is at y = 19
    expect(hullOverlap(rammer, sloop, ship(2, 0, 23), sloop)!.depth).toBeCloseTo(1, 6);
  });

  it('turned ships: corners that only pass each other do not count', () => {
    // Two sloops at 45 degrees, centres 29 m apart along x: their boxes' corners are apart.
    expect(hullOverlap(ship(1, 0, 0, Math.PI / 4), sloop, ship(2, 29, 0, Math.PI / 4), sloop)).toBeNull();
  });
});

describe('collisionDamage, impactPlace and strikesWithBow (M3 step 6, D44)', () => {
  const k = DAMAGE.collision.hullPerMps2;
  const side = (mass: number, own = 0): ImpactSide => ({ mass, place: 'side', ownSpeed: own });

  it('grows with the square of the closing speed above 1 m/s; the lighter ship loses more', () => {
    const same = collisionDamage(8, side(100, 8), side(100, 8));
    expect(same.a).toBeCloseTo(k * 49, 6); // both sailed into it: own factor 1
    expect(same.b).toBeCloseTo(same.a, 6);
    expect(collisionDamage(5, side(100, 5), side(100, 5)).a).toBeCloseTo(k * 16, 6);
    const uneven = collisionDamage(8, side(sloop.mass, 8), side(frigate.mass, 0)); // a = sloop
    expect(uneven.a).toBeGreaterThan(uneven.b);
  });

  it('place: own bow 0.25, amidships 1, near bow or stern 0.6, side against side 0.3', () => {
    const at = (place: ImpactSide['place']): number => collisionDamage(8, { mass: 100, place, ownSpeed: 8 }, side(100, 8)).a;
    expect(at('bow') / at('side')).toBeCloseTo(DAMAGE.collision.bowFactor, 6);
    expect(at('end') / at('side')).toBeCloseTo(DAMAGE.collision.endFactor, 6);
    expect(at('alongside') / at('side')).toBeCloseTo(DAMAGE.collision.alongsideFactor, 6);
  });

  it('a ship lying still takes half of what it would take sailing into the blow', () => {
    const moving = collisionDamage(8, side(100, 8), side(100, 0));
    expect(moving.b / moving.a).toBeCloseTo(0.5, 6);
  });

  it('one collision takes at most maxHullShare of a ship\'s full hull', () => {
    const raw = collisionDamage(20, side(100, 20), side(100, 20)); // a head-on crash at 20 m/s
    const capped = cappedDamage(raw, sloop.hullPoints, frigate.hullPoints);
    expect(raw.a).toBeGreaterThan(sloop.hullPoints * DAMAGE.collision.maxHullShare);
    expect(capped.a).toBeCloseTo(sloop.hullPoints * DAMAGE.collision.maxHullShare, 6);
    expect(cappedDamage({ a: 5, b: 5 }, sloop.hullPoints, sloop.hullPoints)).toEqual({ a: 5, b: 5 });
  });

  it('a slow touch does no damage', () => {
    expect(collisionDamage(DAMAGE.collision.minClosingSpeed - 0.1, side(100, 1), side(100, 0))).toEqual({ a: 0, b: 0 });
  });

  it('impactPlace: a T is bow for the rammer and side for the struck; parallel hulls are alongside', () => {
    const rammer = ship(1, 0, 0, Math.PI / 2); // heading south
    const struck = ship(2, 0, 20, 0); // lying east-west, south of it
    expect(impactPlace(rammer, 0, 1, struck.headingRad)).toBe('bow');
    expect(impactPlace(struck, 0, -1, rammer.headingRad)).toBe('side');
    expect(impactPlace(ship(3, 0, 0, 0), 0, 1, Math.PI)).toBe('alongside'); // opposite courses, side by side
    expect(impactPlace(ship(4, 0, 0, 0), -1, -0.3, Math.PI / 2)).toBe('end'); // met near its stern
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
    const k = DAMAGE.collision.hullPerMps2 * 7 * 7; // (8 - 1)^2
    expect(sloop.hullPoints - rammer.hull).toBeCloseTo(k * DAMAGE.collision.bowFactor, 6); // its bow, sailing into it: about 25
    expect(sloop.hullPoints - victim.hull).toBeCloseTo(k * 0.5, 6); // amidships, lying still: half, about 49
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
    expect(frigate.hullPoints - big.hull).toBeLessThan(frigate.hullPoints * 0.05); // under 5% of its hull
  });

  it('two hulls scraping along each other: one damage, then a pause of 2 s for that pair (your test, 18 Nov)', () => {
    const a = ship(1, 0, 0, 0, 6); // east...
    const b = ship(2, 6, 11, Math.PI + 0.3, 10); // ...and a little north of west: they close sideways, sides touching
    const w = world([a, b]);
    const lost = (): number => 2 * sloop.hullPoints - a.hull - b.hull;
    collideShips(w, []);
    const first = lost();
    expect(first).toBeGreaterThan(0);
    // Pushed back into each other every step for 1.9 s: no new damage.
    for (let i = 0; i < 57; i++) {
      w.tick++;
      Object.assign(a, { x: 0, y: 0 });
      Object.assign(b, { x: 6, y: 11 });
      a.speed = 6;
      b.speed = 10;
      collideShips(w, []);
    }
    expect(lost()).toBeCloseTo(first, 6);
    // Touching renewed the pause (5c): 1 s later it still holds; only after 2 s apart a new blow counts.
    w.tick += 30;
    Object.assign(a, { x: 0, y: 0 });
    Object.assign(b, { x: 6, y: 11 });
    a.speed = 6;
    b.speed = 10;
    collideShips(w, []);
    expect(lost()).toBeCloseTo(first, 6);
    w.tick += 70;
    Object.assign(a, { x: 0, y: 0 });
    Object.assign(b, { x: 6, y: 11 });
    a.speed = 6;
    b.speed = 10;
    collideShips(w, []);
    expect(lost()).toBeGreaterThan(first);
  });

  it('repeated bumps every 1.5 s never hurt again: a new damage needs a run-up after 2 s apart (5c, 23 Nov)', () => {
    const a = ship(1, 0, 0, 0, 6);
    const b = ship(2, 6, 11, Math.PI + 0.3, 10);
    const w = world([a, b]);
    const lost = (): number => 2 * sloop.hullPoints - a.hull - b.hull;
    collideShips(w, []);
    const first = lost();
    for (let n = 0; n < 6; n++) {
      w.tick += 45; // 1.5 s apart: shorter than the pause
      Object.assign(a, { x: 0, y: 0, speed: 6 });
      Object.assign(b, { x: 6, y: 11, speed: 10 });
      collideShips(w, []);
    }
    expect(lost()).toBeCloseTo(first, 6);
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
