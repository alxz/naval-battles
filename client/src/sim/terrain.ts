/**
 * M3 step 7b (your idea: a ball fired across an island must not reach the ship behind it):
 * how high the land is, so that a ball that flies into a hill or a cliff stops there.
 *
 * A simple first version: an island rises from its beach (beachM) by `slope` metres per metre
 * inland, up to maxM. A small islet stays low, a big island has a high middle. The reef at the
 * edge of the chart, piers and moored boats are low (lowM). The heights live in a grid of cellM
 * cells, made once per set of islands (like the bots' water grid).
 */
import worldJson from '../data/world.json';
import type { Island } from './types';

export interface TerrainParams {
  cellM: number;
  slope: number; // metres of height per metre inland
  maxM: number; // the highest hill
  beachM: number; // the height at the shore
  lowM: number; // reef rocks, piers, boats
}

export const TERRAIN: TerrainParams = worldJson.terrain;

export interface TerrainGrid {
  cellM: number;
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  /** Height of the land in each cell, metres; 0 = water. */
  height: Float32Array;
}

/** Is (x, y) inside the polygon? (Ray casting.) */
function inside(poly: readonly { x: number; y: number }[], x: number, y: number): boolean {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]!;
    const b = poly[i]!;
    if (a.y > y !== b.y > y && x < a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)) yes = !yes;
  }
  return yes;
}

/** The heights of these islands (cell middles inside an island are land). */
export function buildTerrain(islands: readonly Island[], p: TerrainParams = TERRAIN): TerrainGrid {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const island of islands)
    for (const q of island.points) {
      minX = Math.min(minX, q.x);
      minY = Math.min(minY, q.y);
      maxX = Math.max(maxX, q.x);
      maxY = Math.max(maxY, q.y);
    }
  if (!Number.isFinite(minX)) return { cellM: p.cellM, minX: 0, minY: 0, cols: 0, rows: 0, height: new Float32Array(0) };
  const cellM = p.cellM;
  const cols = Math.max(1, Math.ceil((maxX - minX) / cellM) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / cellM) + 1);
  const kind = new Uint8Array(cols * rows); // 0 water, 1 low (reef, structure), 2 island
  for (const island of islands) {
    const low = island.kind === 'reef' || island.kind === 'structure';
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const q of island.points) {
      x0 = Math.min(x0, q.x);
      y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x);
      y1 = Math.max(y1, q.y);
    }
    const c0 = Math.max(0, Math.floor((x0 - minX) / cellM));
    const c1 = Math.min(cols - 1, Math.ceil((x1 - minX) / cellM));
    const r0 = Math.max(0, Math.floor((y0 - minY) / cellM));
    const r1 = Math.min(rows - 1, Math.ceil((y1 - minY) / cellM));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (kind[i] === 2) continue;
        if (inside(island.points, minX + (c + 0.5) * cellM, minY + (r + 0.5) * cellM)) kind[i] = low ? Math.max(kind[i]!, 1) : 2;
      }
  }
  // Distance inland: from every island cell to the nearest cell that is not island (two sweeps).
  const dist = new Float32Array(cols * rows);
  for (let i = 0; i < dist.length; i++) dist[i] = kind[i] === 2 ? 1e9 : 0;
  const relax = (r: number, c: number, dr: number, dc: number, w: number): void => {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return;
    const d = dist[rr * cols + cc]! + w;
    if (d < dist[r * cols + c]!) dist[r * cols + c] = d;
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      relax(r, c, 0, -1, 1);
      relax(r, c, -1, 0, 1);
      relax(r, c, -1, -1, Math.SQRT2);
      relax(r, c, -1, 1, Math.SQRT2);
    }
  for (let r = rows - 1; r >= 0; r--)
    for (let c = cols - 1; c >= 0; c--) {
      relax(r, c, 0, 1, 1);
      relax(r, c, 1, 0, 1);
      relax(r, c, 1, 1, Math.SQRT2);
      relax(r, c, 1, -1, Math.SQRT2);
    }
  const height = new Float32Array(cols * rows);
  for (let i = 0; i < height.length; i++) {
    if (kind[i] === 1) height[i] = p.lowM;
    else if (kind[i] === 2) height[i] = Math.min(p.maxM, p.beachM + Math.max(0, dist[i]! - 0.5) * cellM * p.slope);
  }
  return { cellM, minX, minY, cols, rows, height };
}

const grids = new WeakMap<readonly Island[], TerrainGrid>();

/** The terrain of this set of islands, made the first time it is asked for. */
export function terrainFor(islands: readonly Island[]): TerrainGrid {
  let t = grids.get(islands);
  if (!t) {
    t = buildTerrain(islands);
    grids.set(islands, t);
  }
  return t;
}

/** The height of the land at (x, y), metres (0 over water). */
export function landHeight(t: TerrainGrid, x: number, y: number): number {
  const c = Math.floor((x - t.minX) / t.cellM);
  const r = Math.floor((y - t.minY) / t.cellM);
  if (c < 0 || c >= t.cols || r < 0 || r >= t.rows) return 0;
  return t.height[r * t.cols + c]!;
}

/**
 * Does the land block a ball flying from a to b (heights z, metres)? Checked every half cell
 * along the way; the ball's height is taken in a straight line between the two ends (a step of a
 * ball is short, so its arc does not matter). Returns the first blocked point, or null.
 */
export function ballBlocked(t: TerrainGrid, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): { x: number; y: number; z: number } | null {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (t.cellM / 2)));
  for (let k = 1; k <= steps; k++) {
    const f = k / steps;
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    const z = a.z + (b.z - a.z) * f;
    const h = landHeight(t, x, y);
    if (h > 0 && z < h) return { x, y, z };
  }
  return null;
}
