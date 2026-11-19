// M3 step 6c: the water grid and the way round the land (sim/path.ts).
import { describe, expect, it } from 'vitest';
import { buildWaterGrid, findRoute, isOpenAt, lineIsOpen } from './path';
import type { Island } from './types';

const square = (name: string, x0: number, y0: number, x1: number, y1: number): Island => ({
  name,
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
});

// A sea 1000 x 1000 m closed by a frame, with a wall in the middle from the north edge down to y = 200.
const frame = [square('N', -500, -500, 500, -480), square('S', -500, 480, 500, 500), square('W', -500, -500, -480, 500), square('E', 480, -500, 500, 500)];
const wall = square('wall', -20, -500, 20, 200);
const sea = [...frame, wall];

describe('buildWaterGrid', () => {
  const g = buildWaterGrid(sea, 10, 16);
  it('land and the water within the clearance are closed; open sea is open', () => {
    expect(isOpenAt(g, 0, 0)).toBe(false); // on the wall
    expect(isOpenAt(g, 25, 0)).toBe(false); // 5 m from the wall: too close
    expect(isOpenAt(g, 60, 0)).toBe(true);
    expect(isOpenAt(g, 0, 300)).toBe(true); // south of the wall's end
    expect(isOpenAt(g, 5000, 0)).toBe(false); // off the grid (beyond the sea)
  });
  it('a straight line across the wall is blocked, one south of it is open; the ends can be skipped', () => {
    expect(lineIsOpen(g, { x: -200, y: 0 }, { x: 200, y: 0 })).toBe(false);
    expect(lineIsOpen(g, { x: -200, y: 350 }, { x: 200, y: 350 })).toBe(true);
    expect(lineIsOpen(g, { x: 25, y: 0 }, { x: 200, y: 0 })).toBe(false);
    expect(lineIsOpen(g, { x: 25, y: 0 }, { x: 200, y: 0 }, 20)).toBe(true); // the start (close to the wall) is not checked
  });
});

describe('findRoute', () => {
  const g = buildWaterGrid(sea, 10, 16);
  it('goes round the end of the wall, every leg on open water, and ends at the goal', () => {
    const from = { x: -200, y: 0 };
    const to = { x: 200, y: 0 };
    const route = findRoute(g, from, to);
    expect(route).not.toBeNull();
    const legs = [from, ...route!];
    for (let i = 1; i < legs.length; i++) expect(lineIsOpen(g, legs[i - 1]!, legs[i]!, 10)).toBe(true);
    expect(Math.max(...route!.map((p) => p.y))).toBeGreaterThan(200); // it passed south of the wall's end
    const last = route![route!.length - 1]!;
    expect(Math.hypot(last.x - to.x, last.y - to.y)).toBeLessThan(10);
    expect(route!.length).toBeLessThan(6); // pulled tight: a few legs, not one per cell
  });
  it('no way through: null', () => {
    const closed = [...frame, square('full wall', -20, -500, 20, 500)];
    expect(findRoute(buildWaterGrid(closed, 10, 16), { x: -200, y: 0 }, { x: 200, y: 0 })).toBeNull();
  });
});
