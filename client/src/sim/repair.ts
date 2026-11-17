// Repair at sea ("Open Sea" package B). The same rule for you and for the bots:
// the crew mends the hull while the ship is almost stopped (sails at 25% or less) and no enemy
// afloat is within 500 m. At sea the hull can be mended only up to 75% of a full hull;
// a port does better (package C), a dock mends everything (later, for gold).
// An offender against a port's law does not repair until it is pardoned.

import { DAMAGE, SHIP_CLASSES } from './data';
import type { DamageParams, ShipState, World } from './types';

/** Is an enemy (a ship of another team, afloat) within `range` metres? */
export function enemyWithin(ship: ShipState, world: World, range: number): boolean {
  return world.ships.some((o) => o.team !== ship.team && !o.sunk && Math.hypot(o.x - ship.x, o.y - ship.y) <= range);
}

/** May this ship repair now, and is there anything left to mend? `maxShare`: 0.75 at sea. */
export function canRepair(ship: ShipState, world: World, maxShare: number, d: DamageParams = DAMAGE): boolean {
  const full = SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 0;
  if (ship.offender) return false; // port law: no mending while the shore guns are after you (sim/law.ts)
  return !ship.sunk && ship.sailLevel <= d.repair.maxSails + 1e-9 && ship.hull < full * maxShare && !enemyWithin(ship, world, d.repair.safeRange);
}

/** One step of repair for every ship. Sets `ship.repairing` (the HUD shows it). */
export function stepRepair(world: World, dt: number, d: DamageParams = DAMAGE): void {
  for (const ship of world.ships) {
    ship.repairing = canRepair(ship, world, d.repair.seaMaxShare, d);
    if (!ship.repairing) continue;
    const full = SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 0;
    ship.hull = Math.min(full * d.repair.seaMaxShare, ship.hull + full * d.repair.sharePerSecond * dt);
  }
}
