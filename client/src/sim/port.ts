// A neutral port ("Open Sea" package C). Simple first:
//  - round the anchorage there is safe water, kept by the port law (sim/law.ts): a law-abiding
//    ship inside takes no ramming damage and only part of a ball's damage, and whoever fires
//    there, or at it, becomes an offender whom the shore guns fire at (sim/shore.ts);
//  - a ship that lies almost still at the anchorage is repaired up to 90% of a full hull,
//    faster than at sea, even with an enemy near;
//  - bots know the same rules: a badly hurt bot runs for the port, and no bot attacks a ship in safe water.
// The full repair in a dock, for gold, comes with ports and trade (M5).

import { refillAmmo } from './ammo';
import { crewOf, sailsOf } from './condition';
import { DAMAGE, ISLANDS, SHIP_CLASSES } from './data';
import { nearestOpenWater } from './spawn';
import type { DamageParams, Island, ShipParams, ShipState, World } from './types';

export interface Port {
  name: string; // the island's name
  x: number; // the anchorage, metres
  y: number;
  /** A port up an inlet: the way in, from the mouth to the anchorage (bots follow it). */
  path?: { x: number; y: number }[];
  /** The places of its shore guns, metres (port law, sim/shore.ts). */
  guns?: { x: number; y: number }[];
  /** How many ships can lie at the anchorage at once (M3 step 5): a small harbour up an inlet has fewer. */
  berths: number;
}

/** The ports of these islands. */
export function portsOf(islands: readonly Island[], d: DamageParams = DAMAGE): Port[] {
  return islands.flatMap((island) => {
    if (!island.port) return [];
    const path = island.inlet?.path;
    const guns = island.port.guns;
    const berths = path ? d.port.berthsInlet : d.port.berths;
    return [{ name: island.name, x: island.port.x, y: island.port.y, berths, ...(path ? { path } : {}), ...(guns ? { guns } : {}) }];
  });
}

/**
 * How many berths of this port are taken (M3 step 5): ships afloat at the anchorage
 * (within the dock range), not counting `exceptId` (the one that asks).
 */
export function berthsTaken(ships: readonly ShipState[], port: Port, exceptId: number, d: DamageParams = DAMAGE): number {
  return ships.filter((s) => s.id !== exceptId && !s.sunk && Math.hypot(s.x - port.x, s.y - port.y) < d.port.dockRange).length;
}

/**
 * Where a ship waits while the port's berths are full (M3 step 5): `distanceM` off the anchorage
 * on its own side; a harbour up an inlet: off the inlet's mouth. Moved to the nearest open water
 * if that spot is on land (or too close to it).
 */
export function berthWaitSpot(port: Port, ship: ShipState, params: ShipParams, islands: readonly Island[], distanceM: number): { x: number; y: number } {
  let spot: { x: number; y: number };
  const path = port.path;
  if (path && path.length > 0) {
    const a = path[0]!;
    const b = path[1] ?? a;
    const len = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    spot = { x: a.x + ((a.x - b.x) / len) * 150, y: a.y + ((a.y - b.y) / len) * 150 };
  } else {
    const dx = ship.x - port.x;
    const dy = ship.y - port.y;
    const len = Math.hypot(dx, dy) || 1;
    spot = { x: port.x + (dx / len) * distanceM, y: port.y + (dy / len) * distanceM };
  }
  return nearestOpenWater(spot.x, spot.y, params, islands) ?? spot;
}

/**
 * Where a ship sailing to this port should head now. A port in open water: the anchorage.
 * A port up an inlet: first the mouth, then a point two steps further along the way in,
 * so the ship follows the bends instead of cutting across the land.
 */
export function portWaypoint(x: number, y: number, port: Port): { x: number; y: number; inside: boolean } {
  const path = port.path;
  if (!path || path.length === 0) return { x: port.x, y: port.y, inside: false };
  let best = 0;
  let bestD = Infinity;
  path.forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const inside = bestD < 90;
  if (!inside) {
    // Not on the way in yet: sail to a point off the mouth, then in.
    const a = path[0]!;
    const b = path[1] ?? a;
    const len = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const off = { x: a.x + ((a.x - b.x) / len) * 120, y: a.y + ((a.y - b.y) / len) * 120 };
    return Math.hypot(off.x - x, off.y - y) < 60 || best > 0 ? { ...path[Math.min(path.length - 1, best + 1)]!, inside } : { ...off, inside };
  }
  const next = path[Math.min(path.length - 1, best + 2)]!;
  return { x: next.x, y: next.y, inside };
}

/** The ports of the game's sea. */
export const PORTS: Port[] = portsOf(ISLANDS);

/** The nearest port to a point and the distance to it, or null if the sea has no port. */
export function nearestPort(x: number, y: number, ports: readonly Port[] = PORTS): { port: Port; distance: number } | null {
  let best: { port: Port; distance: number } | null = null;
  for (const port of ports) {
    const distance = Math.hypot(port.x - x, port.y - y);
    if (!best || distance < best.distance) best = { port, distance };
  }
  return best;
}

/** Is this point in the safe water of a port? */
export function inSafeWater(x: number, y: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): boolean {
  const near = nearestPort(x, y, ports);
  return near !== null && near.distance <= d.port.safeRange;
}

/**
 * Does this ship lie at the anchorage, slow enough for the port's carpenters to work?
 * A port does not serve a ship that broke its peace (port law, sim/law.ts).
 */
export function isDocked(ship: ShipState, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): boolean {
  const near = nearestPort(ship.x, ship.y, ports);
  if (near !== null && ship.offender !== undefined && ports[ship.offender.port] === near.port) return false;
  return !ship.sunk && near !== null && near.distance <= d.port.dockRange && Math.abs(ship.speed) <= d.port.maxDockSpeed;
}

/**
 * One step of repair in port for every docked ship. Run it after the repair at sea:
 * it keeps `ship.repairing` true while the port still has work to do.
 */
export function stepPortRepair(world: World, dt: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): void {
  for (const ship of world.ships) {
    const params = SHIP_CLASSES[ship.shipClass];
    if (!params || !isDocked(ship, ports, d)) continue;
    let work = false;
    if (ship.hull < params.hullPoints * d.port.maxShare) {
      ship.hull = Math.min(params.hullPoints * d.port.maxShare, ship.hull + params.hullPoints * d.port.sharePerSecond * dt);
      work = true;
    }
    // M3 step 4: the port also mends every sail, lets new sailors sign on and refills the chain and
    // grape shot (all free until there is gold, M5).
    const sails = sailsOf(ship);
    if (sails < params.sailPoints) {
      ship.sails = Math.min(params.sailPoints, sails + params.sailPoints * d.port.sailsPerSecond * dt);
      work = true;
    }
    const crew = crewOf(ship);
    if (crew < params.crew) {
      ship.crew = Math.min(params.crew, crew + d.port.crewPerSecond * dt);
      work = true;
    }
    refillAmmo(ship);
    if (work) ship.repairing = true;
  }
}
