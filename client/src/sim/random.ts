// A seeded random number generator (mulberry32).
// "Seeded" means: the same start number (seed) always gives the same list of numbers.
// Its whole state is one integer kept in the world, so a saved game or a test
// repeats exactly the same "random" events. Never use Math.random() in sim/.

/** Next random number in 0 <= r < 1. Advances `world.rngState`. */
export function nextRandom(state: { rngState: number }): number {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A random number between -1 and 1. */
export function nextSigned(state: { rngState: number }): number {
  return nextRandom(state) * 2 - 1;
}
