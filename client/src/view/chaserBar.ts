// The reload bars of the chasers in the guns panel (computer, M3 step 7e): one thin bar for the bow chaser and one for
// the stern chaser, in the middle at the top of the panel, up to half as long as the panel. A ship without that gun has no bar.

import type { Rect } from './hudLayout';

export const CHASER_BAR_H = 3;
export const CHASER_BAR_GAP = 2;
const TOP = 3;

export interface ChaserGun {
  guns: number; // how many of this chaser the ship has (0 = no bar)
  left: number; // reload seconds left (0 = loaded)
  total: number; // the full reload time, seconds
}

export interface ChaserBar {
  side: 'bow' | 'stern';
  track: Rect; // the dark bar
  fill: Rect; // the part that is loaded
  ready: boolean;
}

/** The bars to draw, from the top of the guns panel down: the bow chaser, then the stern chaser. */
export function chaserBars(panel: Rect, bow: ChaserGun, stern: ChaserGun): ChaserBar[] {
  const out: ChaserBar[] = [];
  const w = Math.floor(panel.w / 2);
  const x = panel.x + Math.floor((panel.w - w) / 2);
  let y = panel.y + TOP;
  for (const [side, gun] of [['bow', bow], ['stern', stern]] as const) {
    if (gun.guns <= 0) continue;
    const done = gun.left <= 0 ? 1 : Math.max(0, Math.min(1, 1 - gun.left / Math.max(gun.total, gun.left)));
    out.push({ side, track: { x, y, w, h: CHASER_BAR_H }, fill: { x, y, w: Math.round(w * done), h: CHASER_BAR_H }, ready: gun.left <= 0 });
    y += CHASER_BAR_H + CHASER_BAR_GAP;
  }
  return out;
}
