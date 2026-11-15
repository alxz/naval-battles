// Hit test for cannonballs (plan 4.4). Positions in game metres, z = height above the water.
import type { ShipParams, ShipState } from './types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A box with sides parallel to the axes. */
export interface Box3 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export type HitZone = 'hull' | 'rigging';

/**
 * Where does the segment p0 -> p1 first enter the box? ("slab method")
 * Returns t between 0 (at p0) and 1 (at p1), or null if it misses.
 * For each axis we find the part of the segment between the two walls of the box;
 * the segment is inside the box where all three parts overlap.
 */
export function segmentBoxEntry(p0: Vec3, p1: Vec3, box: Box3): number | null {
  let tMin = 0;
  let tMax = 1;
  const axes: [number, number, number, number][] = [
    [p0.x, p1.x, box.minX, box.maxX],
    [p0.y, p1.y, box.minY, box.maxY],
    [p0.z, p1.z, box.minZ, box.maxZ],
  ];
  for (const [a, b, lo, hi] of axes) {
    const d = b - a;
    if (Math.abs(d) < 1e-9) {
      if (a < lo || a > hi) return null; // parallel to these walls and outside them
      continue;
    }
    let t1 = (lo - a) / d;
    let t2 = (hi - a) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

/**
 * A world point seen from the ship: x' forward along the keel, y' to starboard, z unchanged.
 * (Move the ship to the origin, then turn the world back by the ship's heading.)
 */
export function toShipLocal(ship: ShipState, p: Vec3): Vec3 {
  const dx = p.x - ship.x;
  const dy = p.y - ship.y;
  const c = Math.cos(-ship.headingRad);
  const s = Math.sin(-ship.headingRad);
  return { x: dx * c - dy * s, y: dx * s + dy * c, z: p.z };
}

/**
 * Does a ball moving from `from` to `to` during one step hit this ship?
 * The ship is two boxes on top of each other: the hull (water to deck edge)
 * and the rigging (deck edge to mast top). Returns the zone hit first and when (t 0..1).
 */
export function ballHit(ship: ShipState, params: ShipParams, from: Vec3, to: Vec3): { zone: HitZone; t: number } | null {
  const a = toShipLocal(ship, from);
  const b = toShipLocal(ship, to);
  const halfL = params.length / 2;
  const halfB = params.beam / 2;
  const footprint = { minX: -halfL, maxX: halfL, minY: -halfB, maxY: halfB };
  const hull = segmentBoxEntry(a, b, { ...footprint, minZ: 0, maxZ: params.hullHeight });
  const rigging = segmentBoxEntry(a, b, { ...footprint, minZ: params.hullHeight, maxZ: params.mastHeight });
  if (hull === null && rigging === null) return null;
  if (rigging === null || (hull !== null && hull <= rigging)) return { zone: 'hull', t: hull! };
  return { zone: 'rigging', t: rigging };
}
