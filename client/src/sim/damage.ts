// Hull damage from any cause (a ball, a collision) goes through here, so a ship sinks in one way only.

import { PORTS, inSafeWater } from './port';
import type { Port } from './port';
import type { ShipState, World } from './types';

/**
 * Take hull points off a ship. At 0 it sinks: it stops, and a 'sunk' event tells the screen.
 * A ship in the safe water of a port takes no damage at all.
 */
export function damageHull(world: World, ship: ShipState, amount: number, byShipId: number, ports: readonly Port[] = PORTS): void {
  if (ship.sunk || amount <= 0) return;
  if (inSafeWater(ship.x, ship.y, ports)) return;
  ship.hull = Math.max(0, ship.hull - amount);
  if (ship.hull === 0) {
    ship.sunk = true;
    ship.speed = 0;
    ship.sailLevel = 0;
    ship.rudder = 0;
    ship.repairing = false;
    world.events.push({ type: 'sunk', shipId: ship.id, byShipId, x: ship.x, y: ship.y });
  }
}
