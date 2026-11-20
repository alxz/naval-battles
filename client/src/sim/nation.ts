// The flag a ship sails under (D47, M3 step 6b; in the rules since M3 step 7b, because a black
// flag frightens traders more). For now each bot gets a random nation; real nations with their own
// ships and ports come with the world (M5).

export type Nation = 'england' | 'spain' | 'france' | 'netherlands' | 'pirates';

export const NATIONS: readonly Nation[] = ['england', 'spain', 'france', 'netherlands', 'pirates'];

/**
 * A nation for a bot: random, but the same for the same arena or battle (seed) and ship,
 * so a flag does not change while you watch (a sunk bot comes back under its old flag).
 */
export function nationFor(seed: number, shipId: number): Nation {
  let h = (Math.floor(seed) ^ Math.imul(shipId + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return NATIONS[h % NATIONS.length]!;
}

/** A pirate: sails under the black flag. */
export function isPirate(ship: { nation?: string }): boolean {
  return ship.nation === 'pirates';
}
