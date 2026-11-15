import { describe, expect, it } from 'vitest';
import { circleHeadingRad, circleRudder, circleSteerRad } from './circle';
import type { Circle } from './circle';
import { SHIP_CLASSES } from './data';
import { STEP_SECONDS, stepShip } from './step';
import type { ShipState } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const wind = { fromRad: -Math.PI / 2, strength: 0.7 }; // from the north
const circle = (): Circle => ({ x: 0, y: 150, radiusM: 150, tacking: false }); // the ship starts at the top of the circle

function ship(x: number, y: number, headingRad: number, speed: number): ShipState {
  return {
    id: 2, shipClass: 'sloop', x, y, headingRad, speed, rudder: 0, sailLevel: 0.3,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: 220, sunk: false, battleSkill: 4,
  };
}

describe('circleHeadingRad', () => {
  it('on the circle: along the tangent, clockwise', () => {
    expect(circleHeadingRad(ship(0, 0, 0, 0), circle())).toBeCloseTo(0, 6); // top of the circle -> heading east
    expect(circleHeadingRad(ship(150, 150, 0, 0), circle())).toBeCloseTo(Math.PI / 2, 6); // east side -> heading south
  });

  it('outside the circle it bends inward, inside it bends outward', () => {
    expect(circleHeadingRad(ship(0, -50, 0, 0), circle())).toBeGreaterThan(0); // outside at the top: turn south (inward)
    expect(circleHeadingRad(ship(0, 50, 0, 0), circle())).toBeLessThan(0); // inside: turn north (outward)
  });
});

describe('circleRudder', () => {
  it('where the circle runs into the wind it tacks to starboard and sails close-hauled', () => {
    // West side of the circle, heading north-west: the circle wants north, straight into the wind.
    const s = ship(-150, 150, (-3 * Math.PI) / 4, 1);
    expect(circleSteerRad(s, sloop, wind, circle())).toBeCloseTo(-Math.PI / 2 + ((40 + 15) * Math.PI) / 180, 6); // NE, 55 deg off the wind
    expect(circleRudder(s, sloop, wind, circle())).toBe(1); // hard to starboard, through the wind
  });

  it('holds a steady course when already on the tangent', () => {
    expect(Math.abs(circleRudder(ship(0, 0, 0, 3), sloop, wind, circle()))).toBeLessThan(0.05);
  });

  it('with 30% sails it goes round for 10 minutes: never stuck long, never leaves its circle', () => {
    const s = ship(0, 0, 0, 0);
    const c = circle();
    let farthest = 0;
    let slowSeconds = 0;
    let turned = 0;
    let lastHeading = s.headingRad;
    for (let i = 0; i < Math.round(600 / STEP_SECONDS); i++) {
      s.rudder = circleRudder(s, sloop, wind, c);
      stepShip(s, sloop, wind, STEP_SECONDS);
      const t = i * STEP_SECONDS;
      farthest = Math.max(farthest, Math.hypot(s.x - c.x, s.y - c.y));
      if (t > 20 && s.speed < 0.5) slowSeconds += STEP_SECONDS;
      let d = s.headingRad - lastHeading;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      turned += d;
      lastHeading = s.headingRad;
    }
    expect(turned / (2 * Math.PI)).toBeGreaterThan(2); // more than two full turns
    expect(farthest).toBeLessThan(c.radiusM + 30); // no drift away: it cuts the upwind part short, inside the circle
    expect(slowSeconds).toBeLessThan(60);
  });
});
