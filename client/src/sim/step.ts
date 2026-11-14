import { normalizeAngle, twaDeg } from './angles';
import { ISLANDS, POLARS, SHIP_CLASSES, WIND } from './data';
import { stepGunsAndBalls } from './guns';
import { touchesLand } from './land';
import { clamp } from './math';
import { polarShare } from './polar';
import type { Island, ShipParams, ShipState, Tuning, WindNow, World } from './types';
import { DEFAULT_TUNING } from './types';
import { driftWind } from './wind';

/** One simulation step is 1/30 of a second. */
export const STEP_SECONDS = 1 / 30;

/** How the wind meets one ship right now. Used by the step and by the HUD. */
export interface SailingInfo {
  twaDeg: number; // 0 = bow into the wind
  share: number; // polar share of top speed, 0..1
  noGoDeg: number; // closer than this to the wind, the sails give no drive
}

export function sailingInfo(ship: ShipState, params: ShipParams, wind: WindNow): SailingInfo {
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
export function targetSpeed(ship: ShipState, params: ShipParams, wind: WindNow, tuning: Tuning = DEFAULT_TUNING): number {
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
export function stepShip(ship: ShipState, params: ShipParams, wind: WindNow, dt: number, tuning: Tuning = DEFAULT_TUNING): void {
  const target = targetSpeed(ship, params, wind, tuning);
  ship.speed += (target - ship.speed) * (1 - Math.exp(-dt / params.speedTimeConstant));

  const fullSteerSpeed = 0.5 * params.maxSpeed * tuning.speedScale;
  const steer = params.minSteerShare + (1 - params.minSteerShare) * Math.min(1, ship.speed / fullSteerSpeed);
  ship.headingRad = normalizeAngle(ship.headingRad + params.turnRate * ship.rudder * steer * dt);

  ship.x += Math.cos(ship.headingRad) * ship.speed * dt;
  ship.y += Math.sin(ship.headingRad) * ship.speed * dt;
}

/** How far an aground ship slides back per step while it turns away (0.1 m x 30 = 3 m/s). */
export const PUSH_OFF_METRES = 0.1;

/**
 * Try to slide the ship PUSH_OFF_METRES back, forward, then to either side of where it was
 * (keeping its new heading). Takes the first place that is clear of land. True if one was found.
 */
function pushOff(ship: ShipState, params: ShipParams, islands: readonly Island[], from: { x: number; y: number; headingRad: number }): boolean {
  const ways = [Math.PI, 0, Math.PI / 2, -Math.PI / 2]; // relative to the old heading
  for (const way of ways) {
    const a = from.headingRad + way;
    ship.x = from.x + Math.cos(a) * PUSH_OFF_METRES;
    ship.y = from.y + Math.sin(a) * PUSH_OFF_METRES;
    if (!touchesLand(ship, params, islands)) return true;
  }
  return false;
}

/** How many steps pass between two small wind changes. */
export const WIND_DRIFT_TICKS = Math.round(WIND.driftEverySeconds / STEP_SECONDS);

/**
 * Run one fixed step for the whole world:
 *  1. now and then the wind drifts a little;
 *  2. every ship moves;
 *  4. reload timers run down, guns fire (ripple), balls fly and splash.
 *  3. a ship that would touch land goes back to where it was and stops ("aground").
 *     It keeps its new heading if the turn alone does not touch land. If the turn does
 *     touch land, the crew pushes off: the ship slides a little (PUSH_OFF_METRES per step)
 *     back, forward or sideways, whichever way is free, while it turns. So a ship can
 *     always turn away from the shore: with the sails set, in irons, bow or stern on the sand.
 * Hull damage from grounding comes with hull points in M3.
 */
export function stepWorld(
  world: World,
  dt: number = STEP_SECONDS,
  tuning: Tuning = DEFAULT_TUNING,
  islands: readonly Island[] = ISLANDS,
): void {
  world.events = [];
  if (tuning.windDrift && world.tick > 0 && world.tick % WIND_DRIFT_TICKS === 0) driftWind(world, WIND);

  for (const ship of world.ships) {
    const params = SHIP_CLASSES[ship.shipClass];
    if (!params) continue;
    const before = { x: ship.x, y: ship.y, headingRad: ship.headingRad };
    stepShip(ship, params, world.wind, dt, tuning);
    if (touchesLand(ship, params, islands)) {
      ship.x = before.x;
      ship.y = before.y;
      ship.speed = 0;
      ship.aground = true;
      if (touchesLand(ship, params, islands) && !pushOff(ship, params, islands, before)) {
        // Every way is blocked: undo the turn too.
        ship.x = before.x;
        ship.y = before.y;
        ship.headingRad = before.headingRad;
      }
    } else {
      ship.aground = false;
    }
  }
  stepGunsAndBalls(world, dt);
  world.tick += 1;
}
