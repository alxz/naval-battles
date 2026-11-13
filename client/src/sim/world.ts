import type { World } from './types';

/** A new world for the first test: one sloop, standing still, in open water. */
export function createWorld(): World {
  return {
    tick: 0,
    ships: [
      {
        id: 1,
        shipClass: 'sloop',
        x: 160,
        y: 90,
        heading: 0,
        speed: 0,
        rudder: 0,
        sailLevel: 0,
      },
    ],
  };
}
