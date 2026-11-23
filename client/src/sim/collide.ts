// Ships cannot sail through each other ("Open Sea" package B).
//
// A ship is a rectangle (length x beam) turned to its heading. Two such rectangles overlap
// unless there is a line between them. It is enough to look along four directions: the long
// and the short side of each ship ("separating axis test"). If the shadows of the two ships
// overlap in all four directions, the ships touch; the direction with the smallest overlap is
// the shortest way to push them apart.
//
// When they touch:
//   - they are pushed apart along that direction, the lighter ship more (never onto land);
//   - if they came together faster than `minClosingSpeed`, both take hull damage (M3 step 6, D44):
//       damage = hullPerMps2 x (closing - min)^2      a fast ram hurts much more than a bump
//                x 2 x other mass / both masses       the lighter ship suffers more
//                x place                              struck amidships 1, near bow or stern 0.6,
//                                                     struck with its own bow 0.25, side against side 0.3
//                x (0.5 + 0.5 x own / closing)        its own share of the speed: a ship lying still
//                                                     takes half of what one sailing into the blow takes
//       at most maxHullShare of the ship's full hull in one collision (a head-on crash is bad, not fatal)
//     and both lose most of their speed. A touch during the pause renews the pause (5c). A slow touch does no damage: the ships just lean on each other.
//   - after a damaging contact the same two ships take no new damage for pairPauseSeconds, so two
//     hulls scraping along each other are not hurt again and again (your test, 18 Nov).

import { degToRad, normalizeAngle } from './angles';
import { DAMAGE, SHIP_CLASSES } from './data';
import { damageHull } from './damage';
import { touchesLand } from './land';
import { STEP_SECONDS } from './step';
import type { DamageParams, Island, ShipParams, ShipState, World } from './types';

/** Push direction (a unit vector from ship a toward ship b) and how deep the hulls overlap, or null. */
export function hullOverlap(a: ShipState, pa: ShipParams, b: ShipState, pb: ShipParams): { nx: number; ny: number; depth: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Quick way out: farther apart than both half-lengths together.
  if (Math.hypot(dx, dy) > (pa.length + pb.length) / 2 + Math.max(pa.beam, pb.beam)) return null;
  const axes = [a.headingRad, a.headingRad + Math.PI / 2, b.headingRad, b.headingRad + Math.PI / 2];
  let best: { nx: number; ny: number; depth: number } | null = null;
  for (const angle of axes) {
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    // Half the length of each ship's shadow on this direction.
    const half = (s: ShipState, p: ShipParams): number =>
      Math.abs(Math.cos(s.headingRad) * ax + Math.sin(s.headingRad) * ay) * (p.length / 2) +
      Math.abs(-Math.sin(s.headingRad) * ax + Math.cos(s.headingRad) * ay) * (p.beam / 2);
    const between = dx * ax + dy * ay; // distance of the centres along this direction
    const depth = half(a, pa) + half(b, pb) - Math.abs(between);
    if (depth <= 0) return null; // a gap in this direction: no contact
    if (!best || depth < best.depth) best = { nx: between >= 0 ? ax : -ax, ny: between >= 0 ? ay : -ay, depth };
  }
  return best;
}

/** Does this ship meet the other with its bow? (The other lies within `bowArcDeg` of dead ahead.) */
export function strikesWithBow(ship: ShipState, towardX: number, towardY: number, d: DamageParams = DAMAGE): boolean {
  const off = Math.abs(normalizeAngle(Math.atan2(towardY, towardX) - ship.headingRad));
  return off <= degToRad(d.collision.bowArcDeg);
}

/** Where a ship meets the other (M3 step 6): with its bow, struck amidships, near bow or stern, or side against side. */
export type ImpactPlace = 'bow' | 'side' | 'end' | 'alongside';

/**
 * `towardX, towardY`: a unit vector from this ship toward the other; `otherHeadingRad`: the other's heading.
 * Side against side first (the hulls lie within alongsideDeg of each other, either way round),
 * then its own bow, then amidships (within sideArcDeg of the beam), else near the bow or the stern.
 */
export function impactPlace(ship: ShipState, towardX: number, towardY: number, otherHeadingRad: number, d: DamageParams = DAMAGE): ImpactPlace {
  const c = d.collision;
  const between = Math.abs(normalizeAngle(ship.headingRad - otherHeadingRad));
  if (between <= degToRad(c.alongsideDeg) || between >= Math.PI - degToRad(c.alongsideDeg)) return 'alongside';
  if (strikesWithBow(ship, towardX, towardY, d)) return 'bow';
  const off = Math.abs(normalizeAngle(Math.atan2(towardY, towardX) - ship.headingRad));
  return Math.abs(off - Math.PI / 2) <= degToRad(c.sideArcDeg) ? 'side' : 'end';
}

export function placeFactor(place: ImpactPlace, d: DamageParams = DAMAGE): number {
  const c = d.collision;
  return place === 'bow' ? c.bowFactor : place === 'side' ? 1 : place === 'end' ? c.endFactor : c.alongsideFactor;
}

/** One ship in a collision: its weight, where it was met, its own speed toward the other (m/s, 0 if moving away). */
export interface ImpactSide {
  mass: number;
  place: ImpactPlace;
  ownSpeed: number;
}

/** Hull points each ship loses when they close at `closing` m/s (the formula at the top of this file). */
export function collisionDamage(closing: number, a: ImpactSide, b: ImpactSide, d: DamageParams = DAMAGE): { a: number; b: number } {
  const c = d.collision;
  if (closing < c.minClosingSpeed) return { a: 0, b: 0 };
  const base = c.hullPerMps2 * (closing - c.minClosingSpeed) ** 2;
  const total = a.mass + b.mass;
  const own = (s: ImpactSide): number => 0.5 + 0.5 * Math.min(1, Math.max(0, s.ownSpeed) / closing);
  return {
    a: base * ((2 * b.mass) / total) * placeFactor(a.place, d) * own(a),
    b: base * ((2 * a.mass) / total) * placeFactor(b.place, d) * own(b),
  };
}

/** The damage of one collision, capped at maxHullShare of each ship's full hull. */
export function cappedDamage(raw: { a: number; b: number }, hullA: number, hullB: number, d: DamageParams = DAMAGE): { a: number; b: number } {
  return { a: Math.min(raw.a, hullA * d.collision.maxHullShare), b: Math.min(raw.b, hullB * d.collision.maxHullShare) };
}

/** Are these two ships still in the pause after a collision? Drops pauses that are over. */
function paused(world: World, a: number, b: number): boolean {
  const list = world.contacts;
  if (!list || list.length === 0) return false;
  world.contacts = list.filter((c) => Math.max(c.untilTick, c.avoidUntilTick ?? 0) > world.tick);
  return world.contacts.some((c) => c.untilTick > world.tick && ((c.a === a && c.b === b) || (c.a === b && c.b === a)));
}

/**
 * Hulls that touch again during the pause keep the pause going (M4b step 5c, your test 23 Nov): a pair
 * takes new damage only after it has been apart for pairPauseSeconds, that is, after a new run-up.
 */
function keepPause(world: World, a: number, b: number, d: DamageParams): void {
  const until = world.tick + Math.round(d.collision.pairPauseSeconds / STEP_SECONDS);
  for (const c of world.contacts ?? []) {
    if (c.untilTick > world.tick && ((c.a === a && c.b === b) || (c.a === b && c.b === a))) c.untilTick = Math.max(c.untilTick, until);
  }
}

/** Find every pair of ships that touch, push them apart and apply the damage. Call once per step, after the ships moved. */
export function collideShips(world: World, islands: readonly Island[], d: DamageParams = DAMAGE): void {
  const ships = world.ships;
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i]!;
      const b = ships[j]!;
      const pa = SHIP_CLASSES[a.shipClass];
      const pb = SHIP_CLASSES[b.shipClass];
      if (!pa || !pb || a.sunk || b.sunk) continue; // a wreck is under water: you sail over it
      const hit = hullOverlap(a, pa, b, pb);
      if (!hit) continue;

      // How fast they come together along the push direction (positive = closing).
      const closing =
        (a.speed * Math.cos(a.headingRad) - b.speed * Math.cos(b.headingRad)) * hit.nx +
        (a.speed * Math.sin(a.headingRad) - b.speed * Math.sin(b.headingRad)) * hit.ny;
      const ownA = a.speed * (Math.cos(a.headingRad) * hit.nx + Math.sin(a.headingRad) * hit.ny);
      const ownB = -b.speed * (Math.cos(b.headingRad) * hit.nx + Math.sin(b.headingRad) * hit.ny);
      const isPaused = paused(world, a.id, b.id);
      if (isPaused) keepPause(world, a.id, b.id, d);
      const damage = isPaused
        ? { a: 0, b: 0 }
        : cappedDamage(
            collisionDamage(
              closing,
              { mass: pa.mass, place: impactPlace(a, hit.nx, hit.ny, b.headingRad, d), ownSpeed: ownA },
              { mass: pb.mass, place: impactPlace(b, -hit.nx, -hit.ny, a.headingRad, d), ownSpeed: ownB },
              d,
            ),
            pa.hullPoints,
            pb.hullPoints,
            d,
          );

      // Push apart: the lighter ship moves more. A ship that would be pushed onto land stays, the other moves instead.
      const push = hit.depth + d.collision.gapM;
      const shareA = pb.mass / (pa.mass + pb.mass);
      const move = (ship: ShipState, params: ShipParams, sign: number, amount: number): boolean => {
        const x = ship.x;
        const y = ship.y;
        ship.x += sign * hit.nx * amount;
        ship.y += sign * hit.ny * amount;
        if (!touchesLand(ship, params, islands)) return true;
        ship.x = x;
        ship.y = y;
        return false;
      };
      const movedA = move(a, pa, -1, push * shareA);
      const movedB = move(b, pb, 1, push * (1 - shareA));
      if (!movedA && movedB) move(b, pb, 1, push * shareA);
      if (!movedB && movedA) move(a, pa, -1, push * (1 - shareA));

      if (damage.a > 0 || damage.b > 0) {
        a.speed *= d.collision.speedKept;
        b.speed *= d.collision.speedKept;
        world.events.push({
          type: 'collision',
          shipA: a.id,
          shipB: b.id,
          damageA: damage.a,
          damageB: damage.b,
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        });
        (world.contacts ??= []).push({
          a: a.id,
          b: b.id,
          untilTick: world.tick + Math.round(d.collision.pairPauseSeconds / STEP_SECONDS),
          avoidUntilTick: world.tick + Math.round(d.collision.avoidSeconds / STEP_SECONDS),
        });
        damageHull(world, a, damage.a, b.id);
        damageHull(world, b, damage.b, a.id);
      }
    }
  }
}
