import { pointInPolygon } from './geometry';
import type { Vec2 } from './geometry';
import type { Island, ShipParams, ShipState } from './types';

/**
 * Five points on the hull: bow, stern, middle and both sides amidships.
 * Enough for a first collision test; the ship is long and thin.
 */
export function hullPoints(ship: ShipState, params: ShipParams): Vec2[] {
  const cos = Math.cos(ship.headingRad);
  const sin = Math.sin(ship.headingRad);
  const halfL = params.length / 2;
  const halfB = params.beam / 2;
  return [
    { x: ship.x + cos * halfL, y: ship.y + sin * halfL }, // bow
    { x: ship.x - cos * halfL, y: ship.y - sin * halfL }, // stern
    { x: ship.x, y: ship.y }, // middle
    { x: ship.x - sin * halfB, y: ship.y + cos * halfB }, // starboard side (90 deg clockwise from the bow)
    { x: ship.x + sin * halfB, y: ship.y - cos * halfB }, // port side
  ];
}

/** Does any hull point touch an island? */
export function touchesLand(ship: ShipState, params: ShipParams, islands: readonly Island[]): boolean {
  const points = hullPoints(ship, params);
  return islands.some((island) => points.some((p) => pointInPolygon(p, island.points)));
}
