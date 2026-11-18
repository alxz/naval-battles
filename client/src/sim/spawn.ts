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
  for (let i = 0; i < 300; i++) {
    const angle = nextRandom(rng) * Math.PI * 2;
    const distance = minD + (maxD - minD) * nextRandom(rng);
    const x = near.x + Math.cos(angle) * distance;
    const y = near.y + Math.sin(angle) * distance;
    if (others.some((o) => Math.hypot(o.x - x, o.y - y) < SHIP_GAP_M)) continue;
    if (!isOpenWater(x, y, params, islands, world)) continue;
    return { x, y };
  }
  return null;
}

/**
 * Is this a good place for a ship: inside the sea, away from the reef at its edge, and with
 * `clearanceM` of free water round the hull (the land test of "a fat ship": a square of
 * length + 2 x clearance, so it holds whatever way the ship points).
 * The one question every way of putting a ship into the world asks.
 */
export function isOpenWater(
  x: number,
  y: number,
  params: ShipParams,
  islands: readonly Island[],
  world: WorldBounds = WORLD,
  clearanceM: number = CLEARANCE_M,
  edgeM: number = EDGE_M,
): boolean {
  const edge = world.reefWidth + edgeM;
  if (x < world.minX + edge || x > world.maxX - edge || y < world.minY + edge || y > world.maxY - edge) return false;
  const side = params.length + 2 * clearanceM;
  const fat: ShipParams = { ...params, length: side, beam: side };
  return !touchesLand({ x, y, headingRad: 0 } as ShipState, fat, islands);
}

/**
 * The nearest good place to (x, y): the spot itself if it is fine, else rings of 16 points,
 * 40 m apart, out to `maxRadiusM`. No random numbers: the same call gives the same answer.
 * For a ship that is put somewhere by hand (the test buttons): it never ends up on land.
 * Returns null if there is no room within the radius.
 */
export function nearestOpenWater(
  x: number,
  y: number,
  params: ShipParams,
  islands: readonly Island[],
  world: WorldBounds = WORLD,
  maxRadiusM = 800,
): { x: number; y: number } | null {
  // A hand-placed ship needs less room than a spawned one: 10 m of water, and the reef itself is the edge.
  const ok = (px: number, py: number): boolean => isOpenWater(px, py, params, islands, world, 10, 20);
  if (ok(x, y)) return { x, y };
  for (let r = 40; r <= maxRadiusM; r += 40) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (ok(px, py)) return { x: px, y: py };
    }
  }
  return null;
}

/**
 * The last resort when random tries fail: walk over the whole sea in a grid of `stepM` metres
 * (starting at a seeded offset, so ships do not all pile up in one corner) and return the first
 * good place that is `gapM` away from every other ship. Null if the sea is really full.
 */
export function gridSpot(
  rng: { rngState: number },
  islands: readonly Island[],
  params: ShipParams,
  others: readonly { x: number; y: number }[],
  gapM: number,
  stepM = 250,
  world: WorldBounds = WORLD,
): { x: number; y: number } | null {
  const columns = Math.max(1, Math.floor((world.maxX - world.minX) / stepM));
  const rows = Math.max(1, Math.floor((world.maxY - world.minY) / stepM));
  const total = columns * rows;
  const start = Math.floor(nextRandom(rng) * total);
  for (let n = 0; n < total; n++) {
    const index = (start + n) % total;
    const x = world.minX + stepM / 2 + (index % columns) * stepM;
    const y = world.minY + stepM / 2 + Math.floor(index / columns) * stepM;
    if (others.some((o) => Math.hypot(o.x - x, o.y - y) < gapM)) continue;
    if (isOpenWater(x, y, params, islands, world)) return { x, y };
  }
  return null;
}
