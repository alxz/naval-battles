import { bearingDegToHeadingRad } from './angles';
import { ENEMIES, ISLANDS, SHIP_CLASSES, WIND, WORLD } from './data';
import { nationFor } from './nation';
import { nextRandom } from './random';
import worldJson from '../data/world.json';
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

/**
 * Where extra enemies appear: between these distances from your start, in open water (data/world.json).
 * M4b 5d: beyond the first sighting (1000 m), so a fight grows out of contacts, not all at once.
 */
const SPAWN_MIN_M = WORLD.spawnMinM ?? 400;
const SPAWN_MAX_M = WORLD.spawnMaxM ?? 800;

/**
 * How many bots for a new battle (M3 step 6c): the number chosen in the panel, or with 0 ("random")
 * a number from ENEMIES.min to ENEMIES.max that follows from the seed.
 */
export function enemiesFor(seed: number, chosen: number): number {
  if (chosen > 0) return chosen;
  return ENEMIES.min + (Math.abs(Math.floor(seed)) % (ENEMIES.max - ENEMIES.min + 1));
}

/** M3 step 7d: how often each class turns up in a battle against bots ("mix"), from data/world.json. */
export const ENEMY_CLASS_WEIGHTS: Readonly<Record<string, number>> = worldJson.enemyClassWeights;

/**
 * The classes of the bots of a new battle (M3 step 7d, your request): `choice` is a class name
 * (all bots of that class) or 'mix' (each one drawn by ENEMY_CLASS_WEIGHTS: sloops most often,
 * a frigate now and then, traders among them). The same seed gives the same lineup.
 */
export function battleClasses(seed: number, count: number, choice: string, weights: Readonly<Record<string, number>> = ENEMY_CLASS_WEIGHTS): string[] {
  if (choice !== 'mix' && SHIP_CLASSES[choice]) return Array.from({ length: count }, () => choice);
  const kinds = Object.keys(weights).filter((k) => SHIP_CLASSES[k] && (weights[k] ?? 0) > 0);
  const total = kinds.reduce((a, k) => a + (weights[k] ?? 0), 0);
  const rng = { rngState: (Math.floor(seed) ^ 0x5bd1e995) >>> 0 || 1 };
  return Array.from({ length: count }, () => {
    let r = nextRandom(rng) * total;
    for (const k of kinds) {
      r -= weights[k] ?? 0;
      if (r <= 0) return k;
    }
    return kinds[kinds.length - 1] ?? 'sloop';
  });
}

/**
 * `enemies`: how many enemy ships (1 to 5). Ship 2 always starts 150 m to starboard (the
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
  // M3 step 7d: flags. You are a pirate (D29); the bots sail under random flags of this battle.
  for (const ship of world.ships) ship.nation = ship.id === 1 ? 'pirates' : nationFor(seed, ship.id);
  return world;
}
