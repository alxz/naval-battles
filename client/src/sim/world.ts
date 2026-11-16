import { bearingDegToHeadingRad } from './angles';
import { ISLANDS, SHIP_CLASSES, WIND } from './data';
import { openWaterSpot } from './spawn';
import type { World } from './types';

/** How far the moored target lies from the player at the start, in game metres. */
export const TARGET_START_DISTANCE = 150;

const SLOOP_HULL = SHIP_CLASSES['sloop']?.hullPoints ?? 1;

/** Your ship starts heading south: with the trade wind from the ENE that is a fast beam reach. */
const START_HEADING_RAD = Math.PI / 2;

/**
 * A new world for M1:
 *  - the trade wind from the east-north-east (data/wind.json), drifting slowly;
 *  - Pelican Cay (data/islands.json) about 450 m ahead;
 *  - ship 1: your sloop, standing still, heading south;
 *  - ship 2: a moored target sloop, 150 m to your starboard (west), same heading,
 *    so it lies right on your beam, where a broadside would hit it.
 */
/** Battle skill of both captains until captains and bot skill tiers exist (plan 4.7: skills 0..10). */
export const START_BATTLE_SKILL = 4;

/** Any whole number. The same seed gives the same wind drift (and later the same gun errors). */
export const DEFAULT_SEED = 20261114;

/** Where extra enemies appear: between these distances from your start, in open water. */
const SPAWN_MIN_M = 700;
const SPAWN_MAX_M = 1400;

/**
 * `enemies`: how many enemy ships (1 to 3). Ship 2 always starts 150 m to starboard (the
 * practice target of the tests); ships 3 and up start at random places in open water.
 */
export function createWorld(seed: number = DEFAULT_SEED, enemies = 1): World {
  const wind = bearingDegToHeadingRad(WIND.startFromBearingDeg);
  const side = START_HEADING_RAD + Math.PI / 2; // starboard = 90 deg clockwise from the bow
  const world: World = {
    tick: 0,
    rngState: seed,
    wind: { fromRad: wind, strength: WIND.startStrength, baseFromRad: wind },
    ships: [
      { id: 1, shipClass: 'sloop', x: 160, y: 90, headingRad: START_HEADING_RAD, speed: 0, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: SLOOP_HULL, sunk: false, battleSkill: START_BATTLE_SKILL, team: 0, repairing: false },
      {
        id: 2,
        shipClass: 'sloop',
        x: 160 + Math.cos(side) * TARGET_START_DISTANCE,
        y: 90 + Math.sin(side) * TARGET_START_DISTANCE,
        headingRad: START_HEADING_RAD,
        speed: 0,
        rudder: 0,
        sailLevel: 0,
        aground: false,
        elevationDeg: 5,
        reloadPort: 0,
        reloadStarboard: 0,
        hull: SLOOP_HULL,
        sunk: false, battleSkill: START_BATTLE_SKILL, team: 1, repairing: false,
      },
    ],
    balls: [],
    pendingShots: [],
    bots: [],
    nextBallId: 1,
    events: [],
  };  const sloop = SHIP_CLASSES['sloop'];
  for (let id = 3; id <= enemies + 1 && sloop; id++) {
    const me = world.ships[0]!;
    const spot = openWaterSpot(world, ISLANDS, me, SPAWN_MIN_M, SPAWN_MAX_M, sloop, world.ships);
    if (!spot) break; // no room (should not happen in this sea)
    world.ships.push({
      ...world.ships[1]!,
      id,
      x: spot.x,
      y: spot.y,
      headingRad: Math.atan2(me.y - spot.y, me.x - spot.x), // bow toward you
    });
  }
  return world;
}
