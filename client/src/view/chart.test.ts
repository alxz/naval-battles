import { describe, expect, it } from 'vitest';
import type { Island, ShipState } from '../sim/types';
import { chartFit, discover, isKnown, newChart, toChart, updateSightings } from './chart';

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
});
