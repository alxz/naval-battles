// Pure helper: the automatic combat zoom. Positions in game metres, screen sizes in logical pixels.
import { combatCameraCentre } from './combatCamera';
import type { Point } from './combatCamera';

export interface ZoomFitOptions {
  widthPx: number; // the screen, in logical pixels
  heightPx: number;
  pixelsPerMetre: number; // at zoom x1
  keepInside: number; // the combat camera rule (0.8 = your ship stays in the middle 80%)
  marginPx: number; // the enemy must be at least this far inside the screen edge
  spareToZoomInPx: number; // extra room needed before zooming in (stops flip-flopping)
  closeFightRange: number; // metres: zoom in past the smallest step only when the enemy is this close
  closeFightRangeSpare: number; // metres: once zoomed in, stay until the enemy is this much farther
}

/** Would the combat camera show both ships at this zoom? */
export function fitsAtZoom(player: Point, enemy: Point, zoom: number, o: ZoomFitOptions, marginPx: number): boolean {
  const s = o.pixelsPerMetre * zoom;
  const halfW = o.widthPx / 2 / s;
  const halfH = o.heightPx / 2 / s;
  const c = combatCameraCentre(player, enemy, halfW, halfH, { range: Infinity, keepInside: o.keepInside });
  const m = marginPx / s;
  return Math.abs(enemy.x - c.x) <= halfW - m && Math.abs(enemy.y - c.y) <= halfH - m;
}

/**
 * The largest whole zoom step that still shows you and the enemy together.
 * Close fight (enemy within `closeFightRange`) -> big ships (x2); farther away -> x1.
 * Zooming in needs some spare room and staying zoomed in has a little extra range,
 * so the view does not jump back and forth when the distance hovers near a limit.
 */
export function autoZoom(current: number, steps: readonly number[], player: Point, enemy: Point, o: ZoomFitOptions): number {
  const sorted = [...steps].sort((a, b) => b - a);
  const smallest = sorted[sorted.length - 1] ?? 1;
  const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  for (const z of sorted) {
    if (z === smallest) return z;
    const zoomingIn = z > current;
    const range = zoomingIn ? o.closeFightRange : o.closeFightRange + o.closeFightRangeSpare;
    if (distance > range) continue;
    const margin = zoomingIn ? o.marginPx + o.spareToZoomInPx : o.marginPx;
    if (fitsAtZoom(player, enemy, z, o, margin)) return z;
  }
  return smallest;
}
