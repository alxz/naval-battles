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
//   - if they came together faster than `minClosingSpeed`, both take hull damage: more for the
//     lighter ship, and only `bowFactor` for a ship that struck with its strong bow; both lose
//     most of their speed. A slow touch does no damage: the ships just lean on each other.

import { degToRad, normalizeAngle } from './angles';
import { DAMAGE, SHIP_CLASSES } from './data';
import { damageHull } from './damage';
import { touchesLand } from './land';
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

/**
 * Hull points each ship loses when they close at `closing` m/s.
 * Two equal ships each lose hullPerMps x closing; a heavier ship loses less, a lighter one more.
 */
export function collisionDamage(closing: number, massA: number, massB: number, bowA: boolean, bowB: boolean, d: DamageParams = DAMAGE): { a: number; b: number } {
  if (closing < d.collision.minClosingSpeed) return { a: 0, b: 0 };
  const base = d.collision.hullPerMps * closing;
  const total = massA + massB;
  return {
    a: base * ((2 * massB) / total) * (bowA ? d.collision.bowFactor : 1),
    b: base * ((2 * massA) / total) * (bowB ? d.collision.bowFactor : 1),
  };
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
      const bowA = strikesWithBow(a, hit.nx, hit.ny, d);
      const bowB = strikesWithBow(b, -hit.nx, -hit.ny, d);
      const damage = collisionDamage(closing, pa.mass, pb.mass, bowA, bowB, d);

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
        damageHull(world, a, damage.a, b.id);
        damageHull(world, b, damage.b, a.id);
      }
    }
  }
}
