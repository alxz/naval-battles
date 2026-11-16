// Where to put a ship: a random place in open water ("Open Sea" package B).

import { WORLD } from './data';
import { touchesLand } from './land';
import { nextRandom } from './random';
import type { Island, ShipParams, ShipState, WorldBounds } from './types';

const CLEARANCE_M = 60; // free water round the new ship
const SHIP_GAP_M = 200; // at least this far from every other ship
const EDGE_M = 150; // and from the reef at the edge of the sea

/**
 * A random spot between `minD` and `maxD` metres from `near`, in open water, clear of the
 * land, the edge of the sea and other ships. Uses the seeded generator, so the same seed
 * gives the same spots. Returns null if no free spot was found in 300 tries.
 */
export function openWaterSpot(
  rng: { rngState: number },
  islands: readonly Island[],
  near: { x: number; y: number },
  minD: number,
  maxD: number,
  params: ShipParams,
  others: readonly ShipState[] = [],
  world: WorldBounds = WORLD,
): { x: number; y: number } | null {
  // A "fat" ship for the land test: CLEARANCE_M of water on every side.
  const fat: ShipParams = { ...params, length: params.length + 2 * CLEARANCE_M, beam: params.length + 2 * CLEARANCE_M };
  const edge = world.reefWidth + EDGE_M;
  for (let i = 0; i < 300; i++) {
    const angle = nextRandom(rng) * Math.PI * 2;
    const distance = minD + (maxD - minD) * nextRandom(rng);
    const x = near.x + Math.cos(angle) * distance;
    const y = near.y + Math.sin(angle) * distance;
    if (x < world.minX + edge || x > world.maxX - edge || y < world.minY + edge || y > world.maxY - edge) continue;
    if (others.some((o) => Math.hypot(o.x - x, o.y - y) < SHIP_GAP_M)) continue;
    const probe = { x, y, headingRad: 0 } as ShipState;
    if (touchesLand(probe, fat, islands)) continue;
    return { x, y };
  }
  return null;
}
