// Small national flags over the ships in the arena (D47, M3 step 6b): the arena's observer sees
// everything, and a flag tells the bots apart at a glance. For now each bot gets a random nation;
// real nations with their own ships and ports come with the world (M5).
// Pure: rows of letters (one letter = one screen pixel); scenes/ShipBars.ts draws them.

export type Nation = 'england' | 'spain' | 'france' | 'netherlands' | 'pirates';

export const NATIONS: readonly Nation[] = ['england', 'spain', 'france', 'netherlands', 'pirates'];

/** The colours of the letters ('.' = nothing). */
export const FLAG_COLOURS: Readonly<Record<string, number>> = {
  W: 0xf4f0e4, // white
  R: 0xc0242c, // red
  B: 0x23408e, // blue
  K: 0x141414, // black
  G: 0xe9c46a, // gold
  S: 0x8a8070, // the edge
};

/** 9 x 6 pixels each. */
export const FLAGS: Readonly<Record<Nation, readonly string[]>> = {
  // England: the red cross of St George on white.
  england: ['WWWRRWWWW', 'WWWRRWWWW', 'RRRRRRRRR', 'WWWRRWWWW', 'WWWRRWWWW', 'WWWRRWWWW'],
  // Spain: the Cross of Burgundy, a red saltire on white (as on the port's flag).
  spain: ['RWWWWWWWR', 'WRWWWWWRW', 'WWRRWRRWW', 'WWRRWRRWW', 'WRWWWWWRW', 'RWWWWWWWR'],
  // France: the white flag of the royal navy, with gold lilies.
  france: ['WWWWWWWWW', 'WGWWWWWGW', 'WWWWGWWWW', 'WWWGGGWWW', 'WWWWGWWWW', 'WWWWWWWWW'],
  // The Netherlands: red, white and blue.
  netherlands: ['RRRRRRRRR', 'RRRRRRRRR', 'WWWWWWWWW', 'WWWWWWWWW', 'BBBBBBBBB', 'BBBBBBBBB'],
  // Pirates: black, with a white skull.
  pirates: ['KKKKKKKKK', 'KKKWWWKKK', 'KKWKWKWKK', 'KKKWWWKKK', 'KKWKWKWKK', 'KKKKKKKKK'],
};

/**
 * A nation for a bot of the arena: random, but the same for the same arena (seed) and ship,
 * so a flag does not change while you watch (a sunk bot comes back under its old flag).
 */
export function nationFor(seed: number, shipId: number): Nation {
  let h = (Math.floor(seed) ^ Math.imul(shipId + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return NATIONS[h % NATIONS.length]!;
}
