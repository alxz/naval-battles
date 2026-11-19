// Finding a way round the land (M3 step 6c).
//
// Until now a bot steered straight at its goal and turned away when land came near (avoidLand).
// That fails where the land lies between: a harbour at the end of an inlet, a deep bay, the far
// side of an island. Your logs: bots circling for minutes in the Isla Verde harbour, or nosing
// into the bay north-west of it, because the straight line to the enemy or to the inlet crossed land.
//
// So the sea is cut into square cells (a "water grid", made once for a set of islands):
//   a cell is open when its middle is at least `clearanceM` metres from any land.
// A* (the classic shortest-path search) then finds a chain of open cells from the ship to the goal,
// and the chain is pulled tight into a few straight legs (each leg stays on open cells).
// Bots use it only when the straight line to the goal is blocked; in open sea nothing changes.

import { WORLD } from './data';
import type { Island } from './types';

export interface WaterGrid {
  cellM: number;
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  /** 1 = open water (far enough from land), 0 = land or too close to it. */
  open: Uint8Array;
}

export interface Point {
  x: number;
  y: number;
}

/** Cell size and room to the shore of the bots' grid. */
export const GRID_CELL_M = 10;
export const GRID_CLEARANCE_M = 16;

/**
 * The water grid of these islands: every cell whose middle is on land is closed, then every cell
 * within `clearanceM` of a closed one is closed too (a disc round each land cell).
 */
export function buildWaterGrid(islands: readonly Island[], cellM = GRID_CELL_M, clearanceM = GRID_CLEARANCE_M): WaterGrid {
  // The whole sea (data/world.json), and any land beyond it.
  let minX = WORLD.minX;
  let minY = WORLD.minY;
  let maxX = WORLD.maxX;
  let maxY = WORLD.maxY;
  for (const island of islands)
    for (const p of island.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  const cols = Math.max(1, Math.ceil((maxX - minX) / cellM));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cellM));
  const land = new Uint8Array(cols * rows);
  // Land: scan each island row by row (where the row's middle line crosses the island's edges).
  for (const island of islands) {
    const poly = island.points;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of poly) {
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    const r0 = Math.max(0, Math.floor((y0 - minY) / cellM));
    const r1 = Math.min(rows - 1, Math.ceil((y1 - minY) / cellM));
    for (let r = r0; r <= r1; r++) {
      const y = minY + (r + 0.5) * cellM;
      const xs: number[] = [];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j]!;
        const b = poly[i]!;
        if (a.y > y !== b.y > y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k]! - minX) / cellM - 0.5));
        const c1 = Math.min(cols - 1, Math.floor((xs[k + 1]! - minX) / cellM - 0.5));
        for (let c = c0; c <= c1; c++) land[r * cols + c] = 1;
      }
    }
    // Thin things (a pier, a moored boat) may miss every cell middle: close the cells their corners are in.
    for (const p of poly) {
      const c = Math.floor((p.x - minX) / cellM);
      const r = Math.floor((p.y - minY) / cellM);
      if (c >= 0 && c < cols && r >= 0 && r < rows) land[r * cols + c] = 1;
    }
  }
  // Room to the shore: a disc of radius clearanceM round each land cell.
  const reach = Math.ceil(clearanceM / cellM);
  const disc: number[][] = [];
  for (let dr = -reach; dr <= reach; dr++)
    for (let dc = -reach; dc <= reach; dc++) if (Math.hypot(dr, dc) * cellM <= clearanceM) disc.push([dr, dc]);
  const open = new Uint8Array(cols * rows).fill(1);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!land[r * cols + c]) continue;
      for (const [dr, dc] of disc) {
        const rr = r + dr!;
        const cc = c + dc!;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) open[rr * cols + cc] = 0;
      }
    }
  return { cellM, minX, minY, cols, rows, open };
}

const grids = new WeakMap<readonly Island[], WaterGrid>();

/** The bots' grid for this set of islands, made the first time it is asked for. */
export function waterGridFor(islands: readonly Island[]): WaterGrid {
  let grid = grids.get(islands);
  if (!grid) {
    grid = buildWaterGrid(islands);
    grids.set(islands, grid);
  }
  return grid;
}

function cellOf(g: WaterGrid, x: number, y: number): { c: number; r: number } {
  return { c: Math.floor((x - g.minX) / g.cellM), r: Math.floor((y - g.minY) / g.cellM) };
}

/** Is this point in an open cell? (Outside the grid counts as closed.) */
export function isOpenAt(g: WaterGrid, x: number, y: number): boolean {
  const { c, r } = cellOf(g, x, y);
  return c >= 0 && c < g.cols && r >= 0 && r < g.rows && g.open[r * g.cols + c] === 1;
}

/**
 * Does the straight line from a to b stay on open cells? Checked every half cell.
 * The first and last `skipM` metres are not checked (a ship may lie close to a shore, a goal may be in a harbour).
 */
export function lineIsOpen(g: WaterGrid, a: Point, b: Point, skipM = 0): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(length / (g.cellM / 2));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const along = t * length;
    if (along < skipM || length - along < skipM) continue;
    if (!isOpenAt(g, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

/** The nearest open cell to a point (rings of growing size), or null if none within `maxCells`. */
function nearestOpenCell(g: WaterGrid, x: number, y: number, maxCells = 30): number | null {
  const { c, r } = cellOf(g, x, y);
  for (let ring = 0; ring <= maxCells; ring++) {
    let best: number | null = null;
    let bestD = Infinity;
    for (let dr = -ring; dr <= ring; dr++)
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= g.rows || cc < 0 || cc >= g.cols || !g.open[rr * g.cols + cc]) continue;
        const d = dr * dr + dc * dc;
        if (d < bestD) {
          bestD = d;
          best = rr * g.cols + cc;
        }
      }
    if (best !== null) return best;
  }
  return null;
}

function middleOf(g: WaterGrid, cell: number): Point {
  return { x: g.minX + ((cell % g.cols) + 0.5) * g.cellM, y: g.minY + (Math.floor(cell / g.cols) + 0.5) * g.cellM };
}

/** A small binary heap of cell numbers, ordered by a score array. */
class Heap {
  private items: number[] = [];
  private readonly score: Float64Array;
  constructor(score: Float64Array) {
    this.score = score;
  }
  get size(): number {
    return this.items.length;
  }
  push(cell: number): void {
    const a = this.items;
    a.push(cell);
    let i = a.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (this.score[a[up]!]! <= this.score[a[i]!]!) break;
      [a[up], a[i]] = [a[i]!, a[up]!];
      i = up;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.score[a[l]!]! < this.score[a[m]!]!) m = l;
        if (r < a.length && this.score[a[r]!]! < this.score[a[m]!]!) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

/**
 * The way from `from` to `to` over open water: a list of points (turning points, then the goal),
 * not counting the start. Null if there is no way (or the search gave up after `maxCells` cells).
 * A start or goal on a closed cell (close to a shore) begins and ends at the nearest open cell.
 */
export function findRoute(g: WaterGrid, from: Point, to: Point, maxCells = 60000): Point[] | null {
  const start = nearestOpenCell(g, from.x, from.y);
  const goal = nearestOpenCell(g, to.x, to.y);
  if (start === null || goal === null) return null;
  const n = g.cols * g.rows;
  const cost = new Float64Array(n).fill(Infinity);
  const score = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const gc = goal % g.cols;
  const gr = Math.floor(goal / g.cols);
  const guess = (cell: number): number => {
    const dc = Math.abs((cell % g.cols) - gc);
    const dr = Math.abs(Math.floor(cell / g.cols) - gr);
    return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr); // octile distance, in cells
  };
  cost[start] = 0;
  score[start] = guess(start);
  const heap = new Heap(score);
  heap.push(start);
  let seen = 0;
  while (heap.size > 0) {
    const cell = heap.pop();
    if (done[cell]) continue;
    done[cell] = 1;
    if (cell === goal) break;
    if (++seen > maxCells) return null;
    const c = cell % g.cols;
    const r = Math.floor(cell / g.cols);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= g.rows || cc < 0 || cc >= g.cols) continue;
        const next = rr * g.cols + cc;
        if (!g.open[next] || done[next]) continue;
        // A diagonal step may not cut a closed corner.
        if (dr !== 0 && dc !== 0 && (!g.open[r * g.cols + cc] || !g.open[rr * g.cols + c])) continue;
        const step = dr !== 0 && dc !== 0 ? Math.SQRT2 : 1;
        const tentative = cost[cell]! + step;
        if (tentative < cost[next]!) {
          cost[next] = tentative;
          came[next] = cell;
          score[next] = tentative + guess(next);
          heap.push(next);
        }
      }
  }
  if (!done[goal]) return null;
  const cells: number[] = [];
  for (let cell = goal; cell !== -1; cell = came[cell]!) cells.push(cell);
  cells.reverse();
  // Pull the chain tight: from each turning point, go to the farthest cell still in a straight open line.
  const points = cells.map((cell) => middleOf(g, cell));
  const route: Point[] = [];
  let at = 0;
  while (at < points.length - 1) {
    let far = at + 1;
    for (let k = at + 2; k < points.length; k++) {
      if (!lineIsOpen(g, points[at]!, points[k]!)) break;
      far = k;
    }
    route.push(points[far]!);
    at = far;
  }
  if (route.length === 0) route.push(middleOf(g, goal));
  return route;
}
