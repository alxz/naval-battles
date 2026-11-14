import { normalizeAngle, twaDeg } from './angles';
import { POLARS, SHIP_CLASSES } from './data';
import { clamp } from './math';
import { polarShare } from './polar';
import type { ShipParams, ShipState, Tuning, Wind, World } from './types';
import { DEFAULT_TUNING } from './types';

/** One simulation step is 1/30 of a second. */
export const STEP_SECONDS = 1 / 30;

/** How the wind meets one ship right now. Used by the step and by the HUD. */
export interface SailingInfo {
  twaDeg: number; // 0 = bow into the wind
  share: number; // polar share of top speed, 0..1
  noGoDeg: number; // closer than this to the wind, the sails give no drive
}

export function sailingInfo(ship: ShipState, params: ShipParams, wind: Wind): SailingInfo {
  const polar = POLARS[params.rig];
  const twa = twaDeg(ship.headingRad, wind.fromRad);
  return { twaDeg: twa, share: polar ? polarShare(polar, twa) : 0, noGoDeg: polar?.noGoDeg ?? 0 };
}

/** A light wind still moves a ship a little: 0 -> 0.4, 1 -> 1 (plan 4.3). */
export function windFactor(strength: number): number {
  return 0.4 + 0.6 * clamp(strength, 0, 1);
}

/**
 * The speed the ship is heading for (plan 4.3):
 *   maxSpeed x polar(TWA) x sailLevel x (0.4 + 0.6 x wind)
 * Sail condition (M3) and the Navigation skill (M6) join this formula later.
 */
export function targetSpeed(ship: ShipState, params: ShipParams, wind: Wind, tuning: Tuning = DEFAULT_TUNING): number {
  const { share } = sailingInfo(ship, params, wind);
  return params.maxSpeed * tuning.speedScale * share * ship.sailLevel * windFactor(wind.strength);
}

/**
 * Move one ship forward by `dt` seconds.
 *  1. Speed moves toward the target speed. Each second it closes the same SHARE of the gap
 *     (not the same number of m/s): fast at first, then gently. After `speedTimeConstant`
 *     seconds about 63% of the gap is closed.
 *  2. The rudder turns the ship. A slow ship steers badly: at a standstill only
 *     `minSteerShare` of the turn rate is left; from half of top speed it steers fully.
 *  3. The ship moves along its heading.
 */
export function stepShip(ship: ShipState, params: ShipParams, wind: Wind, dt: number, tuning: Tuning = DEFAULT_TUNING): void {
  const target = targetSpeed(ship, params, wind, tuning);
  ship.speed += (target - ship.speed) * (1 - Math.exp(-dt / params.speedTimeConstant));

  const fullSteerSpeed = 0.5 * params.maxSpeed * tuning.speedScale;
  const steer = params.minSteerShare + (1 - params.minSteerShare) * Math.min(1, ship.speed / fullSteerSpeed);
  ship.headingRad = normalizeAngle(ship.headingRad + params.turnRate * ship.rudder * steer * dt);

  ship.x += Math.cos(ship.headingRad) * ship.speed * dt;
  ship.y += Math.sin(ship.headingRad) * ship.speed * dt;
}

/** Run one fixed step for the whole world. */
export function stepWorld(world: World, dt: number = STEP_SECONDS, tuning: Tuning = DEFAULT_TUNING): void {
  for (const ship of world.ships) {
    const params = SHIP_CLASSES[ship.shipClass];
    if (params) stepShip(ship, params, world.wind, dt, tuning);
  }
  world.tick += 1;
}
