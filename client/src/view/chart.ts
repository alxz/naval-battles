// The chart (sea map), "Open Sea" package A. Plain data and plain functions, no Phaser.
//
// What the chart knows is what you have seen:
//   - an island appears once it has been on your screen;
//   - the reef round the sea is known from the start (it is the edge of the chart);
//   - an enemy is drawn where you saw it last. While it is on the screen the mark follows it;
//     when it leaves the screen the mark stays where it was and turns pale.
// This knowledge lives in the scene for now. When saves come (M6) it moves into the saved game.

import { bounds } from '../sim/geometry';
import type { Island, ShipState, WorldBounds } from '../sim/types';
import type { Rect } from './hudLayout';

/** A rectangle of sea in game metres (what the screen shows). */
export interface SeaRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Where a ship was when we last saw it. */
export interface Sighting {
  shipId: number;
  shipClass: string;
  x: number;
  y: number;
  headingRad: number;
  inSight: boolean; // on the screen now
  sunk: boolean;
}

export interface ChartState {
  known: string[]; // names of the islands seen so far
  sightings: Sighting[];
}

/**
 * A new chart. The big islands are on it from the start (other captains charted them long ago),
 * and so is the port's island; the small ones you find yourself.
 */
export function newChart(islands: readonly Island[] = []): ChartState {
  return { known: islands.filter((i) => i.kind === 'big' || i.port !== undefined).map((i) => i.name), sightings: [] };
}

function inside(p: { x: number; y: number }, r: SeaRect): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

/** Add every island that shows on the screen now (its box reaches into the view). */
export function discover(state: ChartState, islands: readonly Island[], view: SeaRect): void {
  for (const island of islands) {
    if (island.kind === 'reef' || island.kind === 'structure' || state.known.includes(island.name)) continue;
    const b = bounds(island.points);
    if (b.minX <= view.maxX && b.maxX >= view.minX && b.minY <= view.maxY && b.maxY >= view.minY) state.known.push(island.name);
  }
}

/** Is this island on the chart? The reef always is. */
export function isKnown(state: ChartState, island: Island): boolean {
  return island.kind === 'reef' || state.known.includes(island.name);
}

/**
 * Update the marks of the other ships: one on the screen is marked where it is now;
 * one off the screen keeps its old mark (if it has one) and is no longer "in sight".
 */
export function updateSightings(state: ChartState, others: readonly ShipState[], view: SeaRect): void {
  for (const ship of others) {
    const old = state.sightings.find((s) => s.shipId === ship.id);
    if (inside(ship, view)) {
      const now: Sighting = { shipId: ship.id, shipClass: ship.shipClass, x: ship.x, y: ship.y, headingRad: ship.headingRad, inSight: true, sunk: ship.sunk };
      if (old) Object.assign(old, now);
      else state.sightings.push(now);
    } else if (old) {
      old.inSight = false;
    }
  }
}

/** Forget the marks of these ships (wrecks that have melted away). */
export function forget(state: ChartState, shipIds: readonly number[]): void {
  if (shipIds.length > 0) state.sightings = state.sightings.filter((s) => !shipIds.includes(s.shipId));
}

/** How the sea fits into a panel on the screen: metres -> panel pixels, keeping the shape. */
export interface ChartFit {
  scale: number; // pixels per metre
  x: number; // screen x of the sea's west edge
  y: number; // screen y of the sea's north edge
}

export function chartFit(world: WorldBounds, panel: Rect): ChartFit {
  const w = world.maxX - world.minX;
  const h = world.maxY - world.minY;
  const scale = Math.min(panel.w / w, panel.h / h);
  return { scale, x: panel.x + (panel.w - w * scale) / 2, y: panel.y + (panel.h - h * scale) / 2 };
}

/** A place in the sea (metres) as a point on the chart (screen pixels). */
export function toChart(fit: ChartFit, world: WorldBounds, p: { x: number; y: number }): { x: number; y: number } {
  return { x: fit.x + (p.x - world.minX) * fit.scale, y: fit.y + (p.y - world.minY) * fit.scale };
}

/** The other way (M3 step 7c: a click on the minimap): a point on the chart as a place in the sea, kept inside the sea. */
export function fromChart(fit: ChartFit, world: WorldBounds, p: { x: number; y: number }): { x: number; y: number } {
  const x = world.minX + (p.x - fit.x) / fit.scale;
  const y = world.minY + (p.y - fit.y) / fit.scale;
  return { x: Math.max(world.minX, Math.min(world.maxX, x)), y: Math.max(world.minY, Math.min(world.maxY, y)) };
}

/**
 * The part of the sea the camera shows, as a rectangle on the chart or minimap (M3 step 4b):
 * centre and half sizes in metres. Clipped to the sea, so it never leaves the map; at least 2 x 2 pixels.
 */
export function viewFrame(
  fit: ChartFit,
  world: WorldBounds,
  centre: { x: number; y: number },
  halfW: number,
  halfH: number,
): Rect {
  const left = Math.max(world.minX, centre.x - halfW);
  const right = Math.min(world.maxX, centre.x + halfW);
  const top = Math.max(world.minY, centre.y - halfH);
  const bottom = Math.min(world.maxY, centre.y + halfH);
  const a = toChart(fit, world, { x: left, y: top });
  const b = toChart(fit, world, { x: Math.max(left, right), y: Math.max(top, bottom) });
  const x = Math.round(a.x);
  const y = Math.round(a.y);
  return { x, y, w: Math.max(2, Math.round(b.x) - x), h: Math.max(2, Math.round(b.y) - y) };
}
