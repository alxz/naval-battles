import { describe, expect, it } from 'vitest';
import { ISLANDS, SHIP_CLASSES, WORLD } from './data';
import { touchesLand } from './land';
import { openWaterSpot } from './spawn';
import type { ShipState } from './types';
import { createWorld } from './world';

const sloop = SHIP_CLASSES['sloop']!;

describe('openWaterSpot', () => {
  it('finds spots in open water, inside the sea, at the asked distance, apart from other ships', () => {
    const rng = { rngState: 5 };
    const near = { x: 160, y: 90 };
    const taken: ShipState[] = [];
    for (let i = 0; i < 20; i++) {
      const spot = openWaterSpot(rng, ISLANDS, near, 700, 1400, sloop, taken)!;
      expect(spot).not.toBeNull();
      const d = Math.hypot(spot.x - near.x, spot.y - near.y);
      expect(d).toBeGreaterThanOrEqual(700);
      expect(d).toBeLessThanOrEqual(1400);
      expect(spot.x).toBeGreaterThan(WORLD.minX + WORLD.reefWidth);
      expect(spot.x).toBeLessThan(WORLD.maxX - WORLD.reefWidth);
      for (const h of [0, 1, 2, 3]) expect(touchesLand({ x: spot.x, y: spot.y, headingRad: h } as ShipState, sloop, ISLANDS)).toBe(false);
      for (const t of taken) expect(Math.hypot(t.x - spot.x, t.y - spot.y)).toBeGreaterThanOrEqual(200);
      taken.push({ x: spot.x, y: spot.y } as ShipState);
    }
  });

  it('the same seed gives the same spot; no room gives null', () => {
    const a = openWaterSpot({ rngState: 9 }, ISLANDS, { x: 0, y: 0 }, 300, 900, sloop);
    const b = openWaterSpot({ rngState: 9 }, ISLANDS, { x: 0, y: 0 }, 300, 900, sloop);
    expect(a).toEqual(b);
    expect(openWaterSpot({ rngState: 1 }, ISLANDS, { x: 0, y: 0 }, 9000, 9500, sloop)).toBeNull(); // outside the sea
  });
});

describe('createWorld with more enemies', () => {
  it('ship 2 is the practice target as before; ships 3 and 4 appear at random places in open water', () => {
    const w = createWorld(123, 3);
    expect(w.ships.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(w.ships.map((s) => s.team)).toEqual([0, 1, 1, 1]);
    expect(createWorld(123, 1).ships.length).toBe(2);
    for (const s of w.ships.slice(2)) {
      expect(touchesLand(s, sloop, ISLANDS)).toBe(false);
      expect(Math.hypot(s.x - 160, s.y - 90)).toBeGreaterThanOrEqual(400);
    }
    expect(createWorld(123, 3).ships).toEqual(w.ships); // the same seed, the same places
    expect(createWorld(124, 3).ships[2]!.x).not.toBe(w.ships[2]!.x);
  });
});
