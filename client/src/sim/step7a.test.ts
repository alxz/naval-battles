// M3 step 7a: the fluyt and the caravel, the arena's half win for getting away, a runner that keeps sea room.
import { describe, expect, it } from 'vitest';
import { ARENA, createArenaWorld, isHurt, pilotScore, stepEscapes } from './arena';
import { fleeHeading, seaRoom } from './bot';
import { polarOf, POLARS, SHIP_CLASSES, WORLD } from './data';
import { polarShare } from './polar';
import { arenaResults } from '../view/arenaResults';
import type { ShipState, World } from './types';

const fluyt = SHIP_CLASSES['fluyt']!;
const caravel = SHIP_CLASSES['caravel']!;
const sloop = SHIP_CLASSES['sloop']!;

describe('the two traders (M3 step 7a)', () => {
  it('fluyt: 0.7 of a sloop, one gun a side, a small crew; caravel: 0.8, 2 guns a side (7b), higher and stronger sides', () => {
    expect(fluyt.maxSpeed / sloop.maxSpeed).toBeCloseTo(0.7, 2);
    expect(fluyt.gunsPerSide).toBe(1);
    expect(fluyt.crew).toBeLessThan(sloop.crew / 2);
    expect(caravel.maxSpeed / sloop.maxSpeed).toBeCloseTo(0.8, 2);
    expect(caravel.gunsPerSide).toBe(2);
    expect(caravel.sternGuns).toBe(2);
    expect(fluyt.sternGuns).toBe(2);
    expect(caravel.hullHeight).toBeGreaterThan(sloop.hullHeight);
    expect(caravel.hullPoints).toBeGreaterThan(sloop.hullPoints);
    for (const p of Object.values(SHIP_CLASSES)) expect(p.sailCrew).toBeLessThanOrEqual(p.crew);
    expect(SHIP_CLASSES['merchantman']).toBeUndefined();
  });

  it("the fluyt's tall masts: her own polar, as good dead downwind as on the broad reach", () => {
    expect(polarOf(fluyt)).toBe(POLARS['squareTall']);
    expect(polarOf(sloop)).toBe(POLARS['foreAndAft']);
    const own = polarOf(fluyt)!;
    expect(polarShare(own, 180)).toBeGreaterThan(polarShare(POLARS['square']!, 180));
    expect(polarShare(own, 180)).toBeGreaterThan(polarShare(POLARS['foreAndAft']!, 180));
  });

  it('the arena brings both traders with a load in the hold; warships carry none', () => {
    const w = createArenaWorld(7);
    const classes = w.ships.map((s) => s.shipClass);
    expect(classes).toEqual(ARENA.classes.slice(0, ARENA.bots));
    expect(classes).toContain('fluyt');
    expect(classes).toContain('caravel');
    for (const s of w.ships) {
      const p = SHIP_CLASSES[s.shipClass]!;
      if (p.cargoMax === undefined) expect(s.cargo).toBeUndefined();
      else {
        expect(s.cargo).toBeGreaterThanOrEqual(p.cargoMin ?? 0);
        expect(s.cargo).toBeLessThanOrEqual(p.cargoMax);
      }
    }
  });
});

describe('getting away alive: half a win (M3 step 7a)', () => {
  const setUp = (): { w: World; prey: ShipState; hunter: ShipState } => {
    const w = createArenaWorld(3);
    const prey = w.ships[2]!;
    const hunter = w.ships[0]!;
    prey.x = 0;
    prey.y = -1500;
    hunter.x = 0;
    hunter.y = -1300;
    prey.hull = (SHIP_CLASSES[prey.shipClass]!.hullPoints) * 0.5;
    w.events = [{ type: 'hit', shipId: prey.id, byShipId: hunter.id, zone: 'hull', x: 0, y: 0, z: 0, ammo: 'round', hullLost: 10, sailsLost: 0, crewLost: 0 }];
    stepEscapes(w, 0.1);
    w.events = [];
    return { w, prey, hunter };
  };

  it('pilotScore: wins + half the escapes', () => {
    expect(pilotScore({ wins: 3, escapes: 3 })).toBe(4.5);
    expect(pilotScore({ wins: 2 })).toBe(2);
  });

  it('a hit makes a threat; far away and quiet long enough, hurt: escaped, once', () => {
    const { w, prey, hunter } = setUp();
    expect(w.arena!.threats).toHaveLength(1);
    stepEscapes(w, ARENA.escapeQuietSeconds); // quiet, but the hunter is still close
    expect(w.events.some((e) => e.type === 'escaped')).toBe(false);
    hunter.y = prey.y + ARENA.escapeRangeM + 100;
    stepEscapes(w, 1);
    expect(w.events.filter((e) => e.type === 'escaped')).toHaveLength(1);
    expect(w.arena!.pilots.find((p) => p.shipId === prey.id)!.escapes).toBe(1);
    expect(w.arena!.threats).toHaveLength(0);
    stepEscapes(w, 100);
    expect(w.arena!.pilots.find((p) => p.shipId === prey.id)!.escapes).toBe(1);
    // Hit again by the same enemy and away again: no second half win in this life.
    w.events = [{ type: 'hit', shipId: prey.id, byShipId: hunter.id, zone: 'hull', x: 0, y: 0, z: 0, ammo: 'round', hullLost: 1, sailsLost: 0, crewLost: 0 }];
    stepEscapes(w, ARENA.escapeQuietSeconds + 1);
    expect(w.arena!.pilots.find((p) => p.shipId === prey.id)!.escapes).toBe(1);
  });

  it('no credit for a ship that is not hurt, or whose enemy sank', () => {
    const a = setUp();
    a.prey.hull = SHIP_CLASSES[a.prey.shipClass]!.hullPoints;
    delete a.prey.crew;
    delete a.prey.sails;
    expect(isHurt(a.prey)).toBe(false);
    a.hunter.y = 2000;
    stepEscapes(a.w, ARENA.escapeQuietSeconds + 1);
    expect(a.w.events.some((e) => e.type === 'escaped')).toBe(false);
    const b = setUp();
    b.hunter.sunk = true;
    stepEscapes(b.w, ARENA.escapeQuietSeconds + 1);
    expect(b.w.arena!.threats).toHaveLength(0);
    expect(b.w.events.some((e) => e.type === 'escaped')).toBe(false);
  });

  it('the results table ranks by score: 2 wins + 2 escapes beat 2 wins', () => {
    const rows = arenaResults(
      [
        { shipId: 1, number: 1, name: 'A', wins: 2, losses: 0, balls: 10, hullHits: 5, sinceSeconds: 0 },
        { shipId: 2, number: 2, name: 'B', wins: 2, escapes: 2, losses: 3, balls: 10, hullHits: 1, sinceSeconds: 0 },
      ],
      () => 'sloop',
    );
    expect(rows[0]!.name).toBe('B');
    expect(rows[0]!.score).toBe(3);
  });
});

describe('a runner keeps sea room (M3 step 7a)', () => {
  it('seaRoom: 0 at the reef, large in the middle', () => {
    expect(seaRoom(0, 0)).toBeGreaterThan(1500);
    expect(seaRoom(WORLD.minX + WORLD.reefWidth, 0)).toBe(0);
  });

  it('chased toward the north-west corner, it runs along the edge instead of into the corner', () => {
    const w = createArenaWorld(5);
    const s = w.ships[2]!;
    s.x = WORLD.minX + 350;
    s.y = WORLD.minY + 350;
    s.speed = 6;
    const wind = { fromRad: Math.PI / 2, strength: 0.8 }; // from the south: every way north-west sails well
    const towardCorner = Math.atan2(-1, -1); // the enemy is to the south-east: straight away is the corner
    const h = fleeHeading(s, SHIP_CLASSES[s.shipClass]!, wind, towardCorner + Math.PI, []);
    const end = { x: s.x + Math.cos(h) * 500, y: s.y + Math.sin(h) * 500 };
    expect(seaRoom(end.x, end.y)).toBeGreaterThan(seaRoom(s.x + Math.cos(towardCorner) * 500, s.y + Math.sin(towardCorner) * 500));
  });
});
