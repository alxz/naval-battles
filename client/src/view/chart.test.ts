import { describe, expect, it } from 'vitest';
import type { Island, ShipState } from '../sim/types';
import { chartFit, discover, forget, fromChart, isKnown, movePoint, newChart, pointAt, toChart, updateSightings, viewFrame } from './chart';

const square = (name: string, x: number, y: number, kind?: string): Island => ({
  name,
  kind,
  points: [{ x, y }, { x: x + 100, y }, { x: x + 100, y: y + 100 }, { x, y: y + 100 }],
});
const view = { minX: 0, minY: 0, maxX: 600, maxY: 400 };

function ship(id: number, x: number, y: number, sunk = false): ShipState {
  return {
    id, shipClass: 'sloop', x, y, headingRad: 1, speed: 0, rudder: 0, sailLevel: 0,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: 220, sunk, battleSkill: 4, team: id === 1 ? 0 : 1, repairing: false,
  };
}

describe('discover', () => {
  it('adds islands on the screen, once; the reef is always known', () => {
    const chart = newChart();
    const near = square('Near', 550, 350); // its corner reaches into the view
    const far = square('Far', 2000, 2000);
    const reef = square('North reef', 5000, 5000, 'reef');
    discover(chart, [near, far, reef], view);
    discover(chart, [near, far, reef], view);
    expect(chart.known).toEqual(['Near']);
    expect(isKnown(chart, near)).toBe(true);
    expect(isKnown(chart, far)).toBe(false);
    expect(isKnown(chart, reef)).toBe(true);
  });
});

describe('updateSightings', () => {
  it('follows a ship on the screen; keeps the last place, pale, when it leaves', () => {
    const chart = newChart();
    updateSightings(chart, [ship(2, 100, 100)], view);
    expect(chart.sightings).toEqual([{ shipId: 2, shipClass: 'sloop', x: 100, y: 100, headingRad: 1, inSight: true, sunk: false }]);
    updateSightings(chart, [ship(2, 300, 200)], view);
    expect(chart.sightings[0]).toMatchObject({ x: 300, y: 200, inSight: true });
    updateSightings(chart, [ship(2, 900, 200)], view); // sailed off the screen
    expect(chart.sightings[0]).toMatchObject({ x: 300, y: 200, inSight: false });
  });

  it('a ship never seen has no mark', () => {
    const chart = newChart();
    updateSightings(chart, [ship(3, 5000, 5000)], view);
    expect(chart.sightings).toEqual([]);
  });
});

describe('chartFit and toChart', () => {
  const world = { minX: -3000, maxX: 3000, minY: -2000, maxY: 2000, reefWidth: 60 };
  it('fits the sea into the panel, keeps its shape and centres it', () => {
    const fit = chartFit(world, { x: 10, y: 10, w: 600, h: 300 }); // the panel is wider than the sea needs
    expect(fit.scale).toBeCloseTo(300 / 4000, 6);
    expect(toChart(fit, world, { x: 0, y: 0 })).toEqual({ x: 310, y: 160 }); // the middle of the sea = the middle of the panel
    const nw = toChart(fit, world, { x: -3000, y: -2000 });
    expect(nw.y).toBeCloseTo(10, 6);
    expect(nw.x).toBeCloseTo(310 - 3000 * fit.scale, 6);
  });
  it('fromChart turns a point back into the sea and stays inside it (M3 step 7c)', () => {
    const fit = chartFit(world, { x: 10, y: 10, w: 600, h: 300 });
    const p = fromChart(fit, world, toChart(fit, world, { x: 1234, y: -567 }));
    expect(p.x).toBeCloseTo(1234, 6);
    expect(p.y).toBeCloseTo(-567, 6);
    expect(fromChart(fit, world, { x: 0, y: 1000 })).toEqual({ x: -3000, y: 2000 });
  });
});

describe('viewFrame (M3 step 4b)', () => {
  const world = { minX: -3000, maxX: 3000, minY: -2000, maxY: 2000, reefWidth: 60 };
  const fit = chartFit(world, { x: 0, y: 0, w: 120, h: 80 }); // 0.02 px per metre

  it('the camera view as a box on the map', () => {
    expect(viewFrame(fit, world, { x: 0, y: 0 }, 500, 300)).toEqual({ x: 50, y: 34, w: 20, h: 12 });
  });

  it('clipped at the edge of the sea, never smaller than 2 x 2', () => {
    expect(viewFrame(fit, world, { x: -3000, y: -2000 }, 500, 300)).toEqual({ x: 0, y: 0, w: 10, h: 6 });
    expect(viewFrame(fit, world, { x: 0, y: 0 }, 10, 10)).toMatchObject({ w: 2, h: 2 });
  });
});

describe('forget', () => {
  it('drops the marks of the given ships and keeps the rest', () => {
    const chart = newChart();
    updateSightings(chart, [ship(2, 100, 100, true), ship(3, 200, 200)], view);
    forget(chart, [2]);
    expect(chart.sightings.map((x) => x.shipId)).toEqual([3]);
    forget(chart, []);
    expect(chart.sightings).toHaveLength(1);
  });

  it('M4b step 3: with a "seen" rule of its own, a ship far off the screen can still be in sight', () => {
    const chart = newChart();
    updateSightings(chart, [ship(2, 9000, 9000)], view, () => true);
    expect(chart.sightings[0]!.inSight).toBe(true);
    updateSightings(chart, [ship(2, 9100, 9000)], view, () => false);
    expect(chart.sightings[0]!.inSight).toBe(false);
    expect(chart.sightings[0]!.x).toBe(9000); // the old mark stays where it was last seen
  });
});

describe('route editing (D73)', () => {
  const pts = [
    { x: 10, y: 10 },
    { x: 60, y: 10 },
    { x: 64, y: 12 },
  ];
  it('pointAt finds the nearest point within the radius', () => {
    expect(pointAt(pts, { x: 12, y: 11 }, 12)).toBe(0);
    expect(pointAt(pts, { x: 63, y: 11 }, 12)).toBe(2); // 60 and 64 are both near: the closer wins
  });
  it('pointAt gives -1 when nothing is near, or there are no points', () => {
    expect(pointAt(pts, { x: 30, y: 40 }, 12)).toBe(-1);
    expect(pointAt([], { x: 0, y: 0 }, 12)).toBe(-1);
  });
  it('movePoint moves one point and leaves the others and the input alone', () => {
    const moved = movePoint(pts, 1, { x: 5, y: 6 });
    expect(moved[1]).toEqual({ x: 5, y: 6 });
    expect(moved[0]).toEqual(pts[0]);
    expect(pts[1]).toEqual({ x: 60, y: 10 });
    expect(movePoint(pts, 7, { x: 1, y: 1 })).toEqual(pts);
  });
});
