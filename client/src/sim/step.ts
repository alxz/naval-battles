import { cargoSpeedFactor, crewAccelFactor, crewSpeedFactor, crewTurnFactor, sailSpeedFactor } from './condition';
import { collideShips } from './collide';
import { stepRepair } from './repair';
import { normalizeAngle, twaDeg } from './angles';
import { DAMAGE, ISLANDS, polarOf, SHIP_CLASSES, WIND } from './data';
import { stepGunsAndBalls } from './guns';
import { stepLaw } from './law';
import { stepShore } from './shore';
import { touchesLand } from './land';
import { clamp } from './math';
import { polarShare } from './polar';
import type { DamageParams, Island, ShipParams, ShipState, Tuning, WindNow, World } from './types';
import { DEFAULT_TUNING } from './types';
import { inHarbour, portsCached, stepPortRepair } from './port';
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
  const polar = polarOf(params);
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
 *   x (0.2 + 0.8 x sail condition)   (M3 step 4: shot-away sails slow the ship)
 *   x crew factor                     (M3 step 4b, 7a: only below the sailing crew it falls much)
 *   x (1 - ladenSlowdown x cargo)     (M3 step 7a: a full hold)
 * The Navigation skill (M6) joins this formula later.
 */
export function targetSpeed(ship: ShipState, params: ShipParams, wind: WindNow, tuning: Tuning = DEFAULT_TUNING): number {
  const { share } = sailingInfo(ship, params, wind);
  const speed = params.maxSpeed * tuning.speedScale * share * ship.sailLevel * windFactor(wind.strength) * sailSpeedFactor(ship) * crewSpeedFactor(ship) * cargoSpeedFactor(ship);
  return damagedSpeed(speed, ship.hull / params.hullPoints);
}

/**
 * A badly damaged ship sails slower (M3 step 1b): below half of the hull the target speed falls
 * in a straight line to minFactor at hull 0. Speeds up to freeSpeed are never cut, so a wreck
 * can still crawl to a port.
 */
export function damagedSpeed(speed: number, hullShare: number, d: DamageParams = DAMAGE): number {
  const s = d.slowdown;
  if (hullShare >= s.startShare) return speed;
  const factor = s.minFactor + (1 - s.minFactor) * Math.max(0, hullShare) / s.startShare;
  return Math.max(Math.min(speed, s.freeSpeed), speed * factor);
}

/**
 * How much of its speed the damage leaves a ship (hull x sails x crew), 0..1: for the log and the screen.
 * The freeSpeed floor of damagedSpeed is left out (it only matters for a crawling wreck).
 */
export function damageSpeedFactor(ship: ShipState, params: ShipParams, d: DamageParams = DAMAGE): number {
  const s = d.slowdown;
  const hullShare = ship.hull / params.hullPoints;
  const hull = hullShare >= s.startShare ? 1 : s.minFactor + (1 - s.minFactor) * Math.max(0, hullShare) / s.startShare;
  return hull * sailSpeedFactor(ship) * crewSpeedFactor(ship, d);
}

/** How much of the turn rate the rudder gives at this speed: minSteerShare at a standstill, 1 from half of top speed. */
export function steerShare(ship: ShipState, params: ShipParams, tuning: Tuning = DEFAULT_TUNING): number {
  const fullSteerSpeed = 0.5 * params.maxSpeed * tuning.speedScale;
  return params.minSteerShare + (1 - params.minSteerShare) * Math.min(1, ship.speed / fullSteerSpeed);
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
export function stepShip(ship: ShipState, params: ShipParams, wind: WindNow, dt: number, tuning: Tuning = DEFAULT_TUNING, towMps = 0): void {
  // In a harbour (M3 step 6c) the harbour boats tow a ship that has any sail set: never slower than towMps.
  const sailing = targetSpeed(ship, params, wind, tuning);
  const target = ship.sailLevel > 0.05 ? Math.max(sailing, towMps) : sailing;
  // A short-handed crew (M3 step 7a) gathers way and loses it slower.
  ship.speed += (target - ship.speed) * (1 - Math.exp(-dt / (params.speedTimeConstant * crewAccelFactor(ship))));

  // Aground, the crew warps the ship round with boats and anchors: it turns at the full rate.
  // A short-handed ship turns slower (M3 step 4b), aground or not.
  const steer = (ship.aground ? 1 : steerShare(ship, params, tuning)) * crewTurnFactor(ship);
  ship.headingRad = normalizeAngle(ship.headingRad + params.turnRate * ship.rudder * steer * dt);

  ship.x += Math.cos(ship.headingRad) * ship.speed * dt;
  ship.y += Math.sin(ship.headingRad) * ship.speed * dt;
}

/** How far an aground ship slides back per step while it turns away (0.15 m x 30 = 4.5 m/s). */
export const PUSH_OFF_METRES = 0.15;

/**
 * Try to slide the ship PUSH_OFF_METRES (then 3x, then 6x) back, forward, then to either side of where it was
 * (keeping its new heading). Takes the first place that is clear of land. True if one was found.
 */
function pushOff(ship: ShipState, params: ShipParams, islands: readonly Island[], from: { x: number; y: number; headingRad: number }): boolean {
  const ways = [Math.PI, 0, Math.PI / 2, -Math.PI / 2]; // relative to the old heading
  // A short slide first; if the turn needs more room (the ship turns fast while aground), a longer one.
  for (const metres of [PUSH_OFF_METRES, 3 * PUSH_OFF_METRES, 6 * PUSH_OFF_METRES]) {
    for (const way of ways) {
      const a = from.headingRad + way;
      ship.x = from.x + Math.cos(a) * metres;
      ship.y = from.y + Math.sin(a) * metres;
      if (!touchesLand(ship, params, islands)) return true;
    }
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
    if (!params || ship.sunk) continue; // a wreck does not sail
    const before = { x: ship.x, y: ship.y, headingRad: ship.headingRad };
    const tow = inHarbour(ship.x, ship.y, portsCached(islands)) ? DAMAGE.port.towMps : 0;
    stepShip(ship, params, world.wind, dt, tuning, tow);
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
  collideShips(world, islands); // ships cannot sail through each other
  stepRepair(world, dt); // crews mend the hull when it is safe
  stepPortRepair(world, dt); // a port does it faster and better
  stepLaw(world, dt); // port law: offenders that stayed away long enough are pardoned
  stepShore(world, dt); // the shore guns fire at offenders
  stepGunsAndBalls(world, dt);
  world.tick += 1;
}
