// Small pixel icons of the three kinds of shot for the computer HUD (M3 step 4c), with how many
// broadsides of each are left above them; the loaded kind gets a yellow frame. Pure: no Phaser.
// The colours match the flying balls (view/ballLook.ts): round black, chain brown, grape red and black.

import { ammoLeftOf, loadableAmmo } from '../sim/ammo';
import { AMMO } from '../sim/data';
import type { AmmoType, ShipState } from '../sim/types';

/** Pixel rows; each letter is a colour from AMMO_ICON_COLOURS, '.' is empty. */
export const AMMO_ICON_ROWS: Readonly<Record<AmmoType, readonly string[]>> = {
  round: [
    '.kkk.', //
    'kgkkk',
    'kkkkk',
    'kkkkk',
    '.kkk.',
  ],
  chain: [
    'bb...bb', //
    'bbdddbb',
    'bb...bb',
  ],
  grape: [
    '.r.r.', //
    'rkrkr',
    '.rkr.',
    'rkrkr',
    '.r.r.',
  ],
};

export const AMMO_ICON_COLOURS: Readonly<Record<string, number>> = {
  k: 0x1a1a1a, // iron
  g: 0x9a9a9a, // a glint
  b: 0x8a5226, // chain shot halves
  d: 0x3a2412, // the chain
  r: 0xd23a2a, // grape: red bag...
};

/** The lit pixels of an icon with their colours, from its top left corner. */
export function ammoIconPixels(type: AmmoType): { x: number; y: number; colour: number }[] {
  const out: { x: number; y: number; colour: number }[] = [];
  AMMO_ICON_ROWS[type].forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = AMMO_ICON_COLOURS[row[x] ?? '.'];
      if (c !== undefined) out.push({ x, y, colour: c });
    }
  });
  return out;
}

export function ammoIconSize(type: AmmoType): { w: number; h: number } {
  const rows = AMMO_ICON_ROWS[type];
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

/** One slot of the ammunition row: its key (1 2 3), what is left ("" for round shot: not counted until M5). */
export interface AmmoSlot {
  type: AmmoType;
  key: string;
  count: string;
  loaded: boolean; // the guns load this kind now
  empty: boolean; // none left
}

export function ammoSlots(ship: ShipState): AmmoSlot[] {
  const loaded = loadableAmmo(ship);
  return AMMO.order.map((type, i) => {
    const left = ammoLeftOf(ship, type);
    return {
      type,
      key: String(i + 1),
      count: Number.isFinite(left) ? String(left) : '',
      loaded: type === loaded,
      empty: left <= 0,
    };
  });
}
