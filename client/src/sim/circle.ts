// The moving practice target (M2 step 3): it sails slowly round a fixed point.
// This is not a bot yet (that is step 4); it only chooses a rudder value.
// Like the player and the bots, the target is steered by commands: the scene
// sends `setRudder` with the value from here, so the rules stay the same for everyone.

import { degToRad, normalizeAngle, twaDeg } from './angles';
import { clamp } from './math';
import { polarOf } from './data';
import type { ShipParams, ShipState, WindNow } from './types';

/** The circle the target sails round, clockwise (turning to starboard), and where it is in its tack. */
export interface Circle {
  x: number; // centre, metres
  y: number;
  radiusM: number;
  tacking: boolean; // true while it sails close-hauled across the upwind part of the circle
}

/** How hard the ship steers back to the circle when it is off it (radians of heading per radius off). */
const RETURN_GAIN = 1.5;
/** At most this much (radians) off the tangent while returning. */
const MAX_RETURN_RAD = 0.6;
/** Rudder per radian of heading error. */
const RUDDER_GAIN = 3;
/** The circle counts as "into the wind" when it wants a heading closer than no-go + this (degrees). */
const UPWIND_MARGIN_DEG = 10;
/** Then the ship sails close-hauled this many degrees outside the no-go zone (enough to keep moving). */
const CLOSE_HAULED_MARGIN_DEG = 15;

/** The heading that follows the circle from where the ship is now: along the tangent, bent back toward the line. */
export function circleHeadingRad(ship: ShipState, circle: Circle): number {
  const dx = ship.x - circle.x;
  const dy = ship.y - circle.y;
  const around = Math.atan2(dy, dx); // where the ship is on the circle
  const off = (Math.hypot(dx, dy) - circle.radiusM) / circle.radiusM; // > 0: outside the circle
  // Clockwise on screen (y down): the tangent is 90 degrees past the position angle.
  return normalizeAngle(around + Math.PI / 2 + clamp(RETURN_GAIN * off, -MAX_RETURN_RAD, MAX_RETURN_RAD));
}

/**
 * The heading to steer: the circle's heading, unless that points into the wind.
 * Where the circle runs into the wind a ship cannot follow it. Then it tacks through
 * the wind to starboard and sails close-hauled (just outside the no-go zone, wind on the
 * port bow) across the top of the circle until the circle can be followed again.
 */
export function circleSteerRad(ship: ShipState, params: ShipParams, wind: WindNow, circle: Circle): number {
  const wanted = circleHeadingRad(ship, circle);
  const noGo = polarOf(params)?.noGoDeg ?? 0;
  const upwind = twaDeg(wanted, wind.fromRad) < noGo + UPWIND_MARGIN_DEG;
  // Memory (hysteresis): once the tack has started, it ends only when the circle can be
  // followed again with the wind on the port side (wanted heading clockwise from the wind).
  // Without it the ship would flip between the two choices while it is slow near the wind.
  if (upwind) circle.tacking = true;
  else if (normalizeAngle(wanted - wind.fromRad) > 0) circle.tacking = false;
  if (!circle.tacking) return wanted;
  return normalizeAngle(wind.fromRad + degToRad(noGo + CLOSE_HAULED_MARGIN_DEG));
}

/** The rudder (-1..1) that turns the ship toward `circleSteerRad`. Updates `circle.tacking`. */
export function circleRudder(ship: ShipState, params: ShipParams, wind: WindNow, circle: Circle): number {
  const steer = circleSteerRad(ship, params, wind, circle);
  return clamp(RUDDER_GAIN * normalizeAngle(steer - ship.headingRad), -1, 1);
}
