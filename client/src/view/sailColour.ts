import sailsJson from '../data/sails.json';
import { hashUnit } from '../sim/renegade';

/** One entry of a sail colour list (data/sails.json): a tint that multiplies the white cloth layer. */
export interface SailChoice {
  name: string;
  tint: string; // '#rrggbb'
  weight: number;
}

/** '#rrggbb' to the number Phaser's setTint wants. */
export function tintNumber(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

const SAIL_SALT = 0x5a11;

/** Picks an entry by weight from a number 0..1 (pure, so it is testable). */
export function pickSail(list: SailChoice[], unit: number): SailChoice {
  const total = list.reduce((sum, c) => sum + c.weight, 0);
  let left = unit * total;
  for (const c of list) {
    if (left < c.weight) return c;
    left -= c.weight;
  }
  return list[list.length - 1]!;
}

/**
 * The tint of a ship's sails (D78). Ordinary ships: canvas, cream or grey-brown by lot, traders sometimes tanned;
 * the lot is an integer hash of the seed and the ship id, so it is the same in every browser and the same life
 * after life. Black sails belong to renegades only (a hidden pirate keeps ordinary sails: that is the disguise).
 */
export function sailTint(seed: number, shipId: number, trader: boolean, renegade: boolean): number {
  if (renegade) return tintNumber(sailsJson.black);
  const list = trader ? sailsJson.trader : sailsJson.warship;
  return tintNumber(pickSail(list, hashUnit(seed, shipId, SAIL_SALT)).tint);
}
