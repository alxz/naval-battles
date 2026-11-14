import type { World } from './types';

/** How far the moored target lies from the player at the start, in game metres. */
export const TARGET_START_DISTANCE = 150;

/**
 * A new world for the scale test:
 *  - ship 1: your sloop, standing still, heading east;
 *  - ship 2: a moored target sloop, 150 m to starboard (south), also heading east,
 *    so it lies right on your beam, where a broadside would hit it.
 */
export function createWorld(): World {
  return {
    tick: 0,
    ships: [
      { id: 1, shipClass: 'sloop', x: 160, y: 90, heading: 0, speed: 0, rudder: 0, sailLevel: 0 },
      {
        id: 2,
        shipClass: 'sloop',
        x: 160,
        y: 90 + TARGET_START_DISTANCE,
        heading: 0,
        speed: 0,
        rudder: 0,
        sailLevel: 0,
      },
    ],
  };
}
