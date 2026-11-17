// A neutral port ("Open Sea" package C). Simple first:
//  - round the anchorage there is safe water: a ship inside cannot fire and takes no damage
//    (no ball, no ramming), whoever it is;
//  - a ship that lies almost still at the anchorage is repaired up to 90% of a full hull,
//    faster than at sea, even with an enemy near;
//  - bots know the same rules: a badly hurt bot runs for the port, and no bot attacks a ship in safe water.
// The full repair in a dock, for gold, comes with ports and trade (M5).

import { DAMAGE, ISLANDS, SHIP_CLASSES } from './data';
import type { DamageParams, Island, ShipState, World } from './types';

export interface Port {
  name: string; // the island's name
  x: number; // the anchorage, metres
  y: number;
  /** A port up an inlet: the way in, from the mouth to the anchorage (bots follow it). */
  path?: { x: number; y: number }[];
}

/** The ports of these islands. */
export function portsOf(islands: readonly Island[]): Port[] {
  return islands.flatMap((island) => {
    if (!island.port) return [];
    const path = island.inlet?.path;
    return [{ name: island.name, x: island.port.x, y: island.port.y, ...(path ? { path } : {}) }];
  });
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

/** Does this ship lie at the anchorage, slow enough for the port's carpenters to work? */
export function isDocked(ship: ShipState, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): boolean {
  const near = nearestPort(ship.x, ship.y, ports);
  return !ship.sunk && near !== null && near.distance <= d.port.dockRange && Math.abs(ship.speed) <= d.port.maxDockSpeed;
}

/**
 * One step of repair in port for every docked ship. Run it after the repair at sea:
 * it keeps `ship.repairing` true while the port still has work to do.
 */
export function stepPortRepair(world: World, dt: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): void {
  for (const ship of world.ships) {
    const full = SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 0;
    if (!isDocked(ship, ports, d) || ship.hull >= full * d.port.maxShare) continue;
    ship.hull = Math.min(full * d.port.maxShare, ship.hull + full * d.port.sharePerSecond * dt);
    ship.repairing = true;
  }
}
