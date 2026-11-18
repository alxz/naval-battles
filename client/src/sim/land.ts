import { bounds, distanceToSegment, pointInPolygon } from './geometry';
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

/** The four corners of the hull's rectangle (length x beam), in order round it. */
function hullCorners(ship: ShipState, params: ShipParams): Vec2[] {
  const cos = Math.cos(ship.headingRad);
  const sin = Math.sin(ship.headingRad);
  const l = params.length / 2;
  const b = params.beam / 2;
  return [
    { x: ship.x + cos * l - sin * b, y: ship.y + sin * l + cos * b },
    { x: ship.x + cos * l + sin * b, y: ship.y + sin * l - cos * b },
    { x: ship.x - cos * l + sin * b, y: ship.y - sin * l - cos * b },
    { x: ship.x - cos * l - sin * b, y: ship.y - sin * l + cos * b },
  ];
}

/** Do segments a-b and c-d cross? */
function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const side = (p: Vec2, q: Vec2, r: Vec2): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** The box round each island, worked out once. */
const boxes = new WeakMap<Island, ReturnType<typeof bounds>>();
function boxOf(island: Island): ReturnType<typeof bounds> {
  let box = boxes.get(island);
  if (!box) {
    box = bounds(island.points);
    boxes.set(island, box);
  }
  return box;
}

/**
 * Does the hull touch an island?
 *  - a hull point (bow, stern, middle, sides) on land, or
 *  - a corner of the land inside the hull's rectangle, or an edge of the land crossing it.
 * The last two catch thin things that pass between the hull points: a pier, a moored boat, a spit of sand.
 */
export function touchesLand(ship: ShipState, params: ShipParams, islands: readonly Island[]): boolean {
  const points = hullPoints(ship, params);
  const corners = hullCorners(ship, params);
  const reach = Math.hypot(params.length, params.beam) / 2;
  for (const island of islands) {
    const box = boxOf(island);
    if (ship.x + reach < box.minX || ship.x - reach > box.maxX || ship.y + reach < box.minY || ship.y - reach > box.maxY) continue;
    if (points.some((p) => pointInPolygon(p, island.points))) return true;
    const poly = island.points;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j]!;
      const b = poly[i]!;
      if (pointInPolygon(b, corners)) return true;
      for (let k = 0; k < 4; k++) if (segmentsCross(a, b, corners[k]!, corners[(k + 1) % 4]!)) return true;
    }
  }
  return false;
}

/**
 * How far is the nearest land from this point, in metres (0 = on land), and whose it is.
 * Only for the log and for checks: it walks every edge of every island, so not for every step.
 */
export function distanceToLand(x: number, y: number, islands: readonly Island[]): { distance: number; name: string } {
  let best = Infinity;
  let name = '';
  const p = { x, y };
  for (const island of islands) {
    const poly = island.points;
    let d = Infinity;
    if (pointInPolygon(p, poly)) d = 0;
    else for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, distanceToSegment(p, poly[j]!, poly[i]!));
    if (d < best) {
      best = d;
      name = island.name;
    }
  }
  return { distance: best, name };
}
