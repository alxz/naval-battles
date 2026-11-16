// Hull damage from any cause (a ball, a collision) goes through here, so a ship sinks in one way only.

import type { ShipState, World } from './types';

/** Take hull points off a ship. At 0 it sinks: it stops, and a 'sunk' event tells the screen. */
export function damageHull(world: World, ship: ShipState, amount: number, byShipId: number): void {
  if (ship.sunk || amount <= 0) return;
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
