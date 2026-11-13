import { normalizeAngle } from './angles';
import { approach, clamp } from './math';
import type { ShipParams, ShipState, World } from './types';
import { SHIP_CLASSES } from './data';

/** One simulation step is 1/30 of a second. */
export const STEP_SECONDS = 1 / 30;

/**
 * Move one ship forward by `dt` seconds.
 *  1. Speed moves towards the target (sails x max speed) with inertia.
 *  2. The rudder turns the ship; with no way on, the rudder does nothing.
 *  3. The ship moves along its heading.
 */
export function stepShip(ship: ShipState, params: ShipParams, dt: number): void {
  const targetSpeed = params.maxSpeed * ship.sailLevel;
  ship.speed = approach(ship.speed, targetSpeed, params.acceleration * dt);

  const steerage = clamp(ship.speed / params.steerSpeed, 0, 1);
  ship.heading = normalizeAngle(ship.heading + params.turnRate * ship.rudder * steerage * dt);

  ship.x += Math.cos(ship.heading) * ship.speed * dt;
  ship.y += Math.sin(ship.heading) * ship.speed * dt;
}

/** Run one fixed step for the whole world. */
export function stepWorld(world: World, dt: number = STEP_SECONDS): void {
  for (const ship of world.ships) {
    const params = SHIP_CLASSES[ship.shipClass];
    if (params) stepShip(ship, params, dt);
  }
  world.tick += 1;
}
