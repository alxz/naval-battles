// M3 step 7c: the player's bow chasers. The gun crew trains the gun on its own: at the nearest ship
// within CHASER_TRAIN_DEG of the bow (and in range); with no ship there the gun points dead ahead.
// Pure logic (no Phaser), so it is tested in chaserAim.test.ts.

import type { ShipState } from '../sim/types';

function wrapRad(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Degrees to train the bow gun off the bow (+ = clockwise, to starboard), 0 when no ship is in the arc. */
export function chaserTrainDeg(me: ShipState, ships: readonly ShipState[], maxDeg: number, rangeM: number): number {
  let best: { distance: number; offDeg: number } | null = null;
  for (const other of ships) {
    if (other.id === me.id || other.sunk) continue;
    const distance = Math.hypot(other.x - me.x, other.y - me.y);
    if (distance > rangeM) continue;
    const offDeg = (wrapRad(Math.atan2(other.y - me.y, other.x - me.x) - me.headingRad) * 180) / Math.PI;
    if (Math.abs(offDeg) > maxDeg) continue;
    if (!best || distance < best.distance) best = { distance, offDeg };
  }
  return best ? best.offDeg : 0;
}

/** A point turned about the ship by `deg` degrees (where a trained gun's ball lands). */
export function turnAbout(centre: { x: number; y: number }, p: { x: number; y: number }, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - centre.x;
  const dy = p.y - centre.y;
  return { x: centre.x + dx * Math.cos(a) - dy * Math.sin(a), y: centre.y + dx * Math.sin(a) + dy * Math.cos(a) };
}
