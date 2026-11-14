import { bearingDegToHeadingRad } from './angles';
import { WIND_START } from './data';
import type { World } from './types';

/** How far the moored target lies from the player at the start, in game metres. */
export const TARGET_START_DISTANCE = 150;

/** Your ship starts heading south: with the trade wind from the ENE that is a fast beam reach. */
const START_HEADING_RAD = Math.PI / 2;

/**
 * A new world for M1:
 *  - the trade wind from the east-north-east (data/wind.json);
 *  - ship 1: your sloop, standing still, heading south;
 *  - ship 2: a moored target sloop, 150 m to your starboard (west), same heading,
 *    so it lies right on your beam, where a broadside would hit it.
 */
export function createWorld(): World {
  const side = START_HEADING_RAD + Math.PI / 2; // starboard = 90 deg clockwise from the bow
  return {
    tick: 0,
    wind: { fromRad: bearingDegToHeadingRad(WIND_START.startFromBearingDeg), strength: WIND_START.startStrength },
    ships: [
      { id: 1, shipClass: 'sloop', x: 160, y: 90, headingRad: START_HEADING_RAD, speed: 0, rudder: 0, sailLevel: 0 },
      {
        id: 2,
        shipClass: 'sloop',
        x: 160 + Math.cos(side) * TARGET_START_DISTANCE,
        y: 90 + Math.sin(side) * TARGET_START_DISTANCE,
        headingRad: START_HEADING_RAD,
        speed: 0,
        rudder: 0,
        sailLevel: 0,
      },
    ],
  };
}
