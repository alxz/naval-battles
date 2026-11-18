// A small hull bar over a ship (picture only): where it goes, how wide, how full.
// Pure: no Phaser here; scenes/ShipBars.ts draws it.

import artJson from '../data/shipArt.json';
import type { ShipParams } from '../sim/types';

/** The bar is this many screen pixels high, and never narrower or wider than these. */
export const BAR_HEIGHT_PX = 3;
export const BAR_MIN_WIDTH_PX = 16;
export const BAR_MAX_WIDTH_PX = 48;
/** Free pixels between the top of the ship and the bar. */
export const BAR_GAP_PX = 5;

export interface BarBox {
  x: number; // left edge, screen pixels (whole numbers: the game draws on a pixel grid)
  y: number; // top edge
  width: number;
  filled: number; // pixels of the width that are full (at least 1 while the ship floats)
}

/**
 * The bar of a ship at the world place (x, y) metres, seen at `s` screen pixels per metre.
 * Over the highest part of the ship: its masts (drawn `heightScale` up the screen) or its bow or
 * stern, whichever is higher for this heading. `share` is hull / full hull, 0..1.
 */
export function shipBar(params: ShipParams, x: number, y: number, headingRad: number, share: number, s: number): BarBox {
  const width = Math.round(Math.min(BAR_MAX_WIDTH_PX, Math.max(BAR_MIN_WIDTH_PX, params.length * 0.5 * s)));
  const reach = (params.length / 2) * Math.abs(Math.sin(headingRad)) + params.beam / 2;
  const mast = params.mastHeight * artJson.heightScale;
  const top = Math.max(reach, mast) * s + BAR_GAP_PX;
  const clamped = Math.min(1, Math.max(0, share));
  return {
    x: Math.round(x * s - width / 2),
    y: Math.round(y * s - top - BAR_HEIGHT_PX),
    width,
    filled: clamped > 0 ? Math.max(1, Math.round(width * clamped)) : 0,
  };
}
