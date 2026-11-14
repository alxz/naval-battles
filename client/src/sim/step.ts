import { normalizeAngle } from './angles';
import { approach, clamp } from './math';
import type { ShipParams, ShipState, Tuning, World } from './types';
import { DEFAULT_TUNING } from './types';
import { SHIP_CLASSES } from './data';

/** One simulation step is 1/30 of a second. */
export const STEP_SECONDS = 1 / 30;

/**
 * Move one ship forward by `dt` seconds.
 *  1. Speed moves towards the target (sails x max speed) with inertia.
 *  2. The rudder turns the ship; with no way on, the rudder does nothing.
 *  3. The ship moves along its heading.
 * `speedScale` stretches all speeds; the ship still needs the same time to reach full speed.
 */
export function stepShip(ship: ShipState, params: ShipParams, dt: number, tuning: Tuning = DEFAULT_TUNING): void {
  const scale = tuning.speedScale;
  const targetSpeed = params.maxSpeed * scale * ship.sailLevel;
  ship.speed = approach(ship.speed, targetSpeed, params.acceleration * scale * dt);

  const steerage = clamp(ship.speed / (params.steerSpeed * scale), 0, 1);
  ship.heading = normalizeAngle(ship.heading + params.turnRate * ship.rudder * steerage * dt);

  ship.x += Math.cos(ship.heading) * ship.speed * dt;
  ship.y += Math.sin(ship.heading) * ship.speed * dt;
}

/** Run one fixed step for the whole world. */
export function stepWorld(world: World, dt: number = STEP_SECONDS, tuning: Tuning = DEFAULT_TUNING): void {
  for (const ship of world.ships) {
    const params = SHIP_CLASSES[ship.shipClass];
    if (params) stepShip(ship, params, dt, tuning);
  }
  world.tick += 1;
}
