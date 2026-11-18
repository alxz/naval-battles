import { describe, expect, it } from 'vitest';
import { ISLANDS, SHIP_CLASSES, WORLD } from './data';
import { pointInPolygon } from './geometry';
import { touchesLand } from './land';
import { gridSpot, isOpenWater, nearestOpenWater, openWaterSpot } from './spawn';
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

/** A point that is really on land: a spot inside the first real island, found by scanning its box. */
function pointOnLand(): { x: number; y: number } {
  const island = ISLANDS.find((i) => i.kind === 'big' || i.kind === 'medium')!;
  const xs = island.points.map((p) => p.x);
  const ys = island.points.map((p) => p.y);
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 10) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 10) if (pointInPolygon({ x, y }, island.points)) return { x, y };
  }
  throw new Error('no land found');
}

describe('isOpenWater', () => {
  it('no on land, not at the reef, not outside the sea; yes in open water', () => {
    const land = pointOnLand();
    expect(isOpenWater(land.x, land.y, sloop, ISLANDS)).toBe(false);
    expect(isOpenWater(WORLD.minX + 10, 0, sloop, ISLANDS)).toBe(false); // on the reef
    expect(isOpenWater(WORLD.maxX + 500, 0, sloop, ISLANDS)).toBe(false); // outside the sea
    expect(isOpenWater(160, 90, sloop, ISLANDS)).toBe(true); // the start of the sea
  });
});

describe('nearestOpenWater', () => {
  it('keeps a good spot; moves a spot on land to open water near it; the same answer every time', () => {
    expect(nearestOpenWater(160, 90, sloop, ISLANDS)).toEqual({ x: 160, y: 90 });
    const land = pointOnLand();
    const spot = nearestOpenWater(land.x, land.y, sloop, ISLANDS)!;
    expect(spot).not.toBeNull();
    for (const h of [0, 1, 2, 3]) expect(touchesLand({ x: spot.x, y: spot.y, headingRad: h } as ShipState, sloop, ISLANDS)).toBe(false);
    expect(nearestOpenWater(land.x, land.y, sloop, ISLANDS)).toEqual(spot);
  });
  it('null when there is no open water within the radius', () => {
    const land = pointOnLand();
    expect(nearestOpenWater(land.x, land.y, sloop, ISLANDS, WORLD, 1)).toBeNull();
  });
});

describe('gridSpot', () => {
  it('finds open water by looking over the whole sea, apart from the others; null if the gap is impossible', () => {
    const rng = { rngState: 3 };
    const a = gridSpot(rng, ISLANDS, sloop, [], 400)!;
    expect(a).not.toBeNull();
    expect(isOpenWater(a.x, a.y, sloop, ISLANDS)).toBe(true);
    const b = gridSpot(rng, ISLANDS, sloop, [a], 400)!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(400);
    expect(gridSpot(rng, ISLANDS, sloop, [a], 100000)).toBeNull();
  });
});
