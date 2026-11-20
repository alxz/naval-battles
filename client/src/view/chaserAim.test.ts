import { describe, expect, it } from 'vitest';
import { chaserTrainDeg, turnAbout } from './chaserAim';
import type { ShipState } from '../sim/types';

const ship = (id: number, x: number, y: number, headingRad = 0, sunk = false): ShipState => ({ id, x, y, headingRad, sunk }) as unknown as ShipState;

describe('chaserTrainDeg (M3 step 7c)', () => {
  it('trains on the nearest ship within the arc', () => {
    const me = ship(1, 0, 0);
    const deg = chaserTrainDeg(me, [me, ship(2, 400, 100), ship(3, 300, -30)], 30, 800);
    expect(deg).toBeCloseTo((Math.atan2(-30, 300) * 180) / Math.PI, 5);
  });
  it('points ahead when nothing is in the arc or in range', () => {
    const me = ship(1, 0, 0);
    expect(chaserTrainDeg(me, [me, ship(2, 0, 300), ship(3, 2000, 0), ship(4, 100, 0, 0, true)], 30, 800)).toBe(0);
  });
  it('turns a point about the ship', () => {
    const p = turnAbout({ x: 10, y: 0 }, { x: 110, y: 0 }, 90);
    expect(p.x).toBeCloseTo(10, 6);
    expect(p.y).toBeCloseTo(100, 6);
  });
});
