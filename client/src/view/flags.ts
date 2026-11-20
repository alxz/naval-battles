// Small national flags over the ships in the arena (D47, M3 step 6b): the arena's observer sees
// everything, and a flag tells the bots apart at a glance. For now each bot gets a random nation;
// real nations with their own ships and ports come with the world (M5).
// Pure: rows of letters (one letter = one screen pixel); scenes/ShipBars.ts draws them.

// M3 step 7b: the nations live in the rules now (sim/nation.ts: a black flag frightens traders).
export { NATIONS, nationFor } from '../sim/nation';
export type { Nation } from '../sim/nation';
import type { Nation } from '../sim/nation';

/** The colours of the letters ('.' = nothing). */
export const FLAG_COLOURS: Readonly<Record<string, number>> = {
  W: 0xf4f0e4, // white
  R: 0xc0242c, // red
  C: 0xe0202a, // the bright red of the Burgundy cross
  B: 0x23408e, // blue
  O: 0xe07a1c, // the orange of the Dutch "Prince's flag"
  K: 0x141414, // black
  G: 0xe9c46a, // gold
  S: 0x8a8070, // the edge
};

/**
 * 12 x 8 pixels each (M3 step 7a; 9 x 6 before: the thin Spanish cross was hard to see).
 * At this size every flag is one bold shape that reads at a glance.
 */
export const FLAGS: Readonly<Record<Nation, readonly string[]>> = {
  // England: the red cross of St George on white, two pixels thick.
  england: ['WWWWWRRWWWWW', 'WWWWWRRWWWWW', 'WWWWWRRWWWWW', 'RRRRRRRRRRRR', 'RRRRRRRRRRRR', 'WWWWWRRWWWWW', 'WWWWWRRWWWWW', 'WWWWWRRWWWWW'],
  // Spain: the Cross of Burgundy, a bold "ragged" red saltire (knots on its arms) on white,
  // with a gold crown where the arms cross.
  spain: ['CCWWWWWWWWCC', 'WCCCWWWWCCCW', 'WWCCCWWCCCWW', 'WWWCCGGCCWWW', 'WWWCCGGCCWWW', 'WWCCCWWCCCWW', 'WCCCWWWWCCCW', 'CCWWWWWWWWCC'],
  // France: the white flag of the royal navy with a big gold lily.
  france: ['WWWWWWWWWWWW', 'WWWWWGGWWWWW', 'WWWWGGGGWWWW', 'WWGWWGGWWGWW', 'WWGGGGGGGGWW', 'WWWWWGGWWWWW', 'WWWWGWWGWWWW', 'WWWWWWWWWWWW'],
  // The Netherlands: the Prince's flag, orange, white and blue.
  netherlands: ['OOOOOOOOOOOO', 'OOOOOOOOOOOO', 'OOOOOOOOOOOO', 'WWWWWWWWWWWW', 'WWWWWWWWWWWW', 'BBBBBBBBBBBB', 'BBBBBBBBBBBB', 'BBBBBBBBBBBB'],
  // Pirates: black, a white skull over crossed bones.
  pirates: ['KKKKKKKKKKKK', 'KKKKWWWWKKKK', 'KKKWKWWKWKKK', 'KKKWWWWWWKKK', 'KKKKWKKWKKKK', 'KKWWKKKKWWKK', 'KKKKWWWWKKKK', 'KKWWKKKKWWKK'],
};
