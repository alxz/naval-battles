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

/**
 * Your idea of 24 Nov: a battle has at least one pirate among the bots. `nations[i]` and `isTrader[i]` belong to bot i.
 * With none, the first warship (else the first bot) becomes a pirate; a pirate on a trader is swapped onto a warship
 * when there is one that is not a pirate. Pure: returns the new nations (seeded input in, same output).
 */
export function withOnePirate(nations: readonly Nation[], isTrader: readonly boolean[]): Nation[] {
  const out = [...nations];
  if (out.length === 0) return out;
  const warships = out.map((_n, i) => i).filter((i) => !isTrader[i]);
  if (!out.includes('pirates')) {
    out[warships[0] ?? 0] = 'pirates';
    return out;
  }
  // A black flag only on traders, a warship free: the first such pirate trades places with that warship.
  if (warships.some((i) => out[i] === 'pirates')) return out;
  const w = warships[0];
  const t = out.findIndex((n) => n === 'pirates');
  if (w !== undefined && t >= 0) [out[w], out[t]] = [out[t]!, out[w]!];
  return out;
}

/** M4b step 5b-2 (D82): the flag a pirate hides behind: a nation of its own, never the black flag. Same seed and ship, same flag. */
export function falseFlagFor(seed: number, shipId: number): Nation {
  const honest = NATIONS.filter((n) => n !== 'pirates');
  return honest[Math.floor(Math.abs(Math.sin(Math.floor(seed) * 12.9898 + (shipId + 1) * 78.233)) * 10000) % honest.length]!;
}

/**
 * The flag an observer sees. A pirate under a false flag shows it until it comes within `hoistM`, then runs up the black
 * one. A ship with no false flag shows its own.
 */
export function shownNation(ship: { nation?: string; falseFlag?: string }, distanceM: number, hoistM: number): string | undefined {
  return ship.falseFlag && distanceM > hoistM ? ship.falseFlag : ship.nation;
}
