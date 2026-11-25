// M4b step 5b-2 (your test of 25 Nov): faster time in Solo while the sea around you is empty. Pure, no Phaser.
// x1 -> x2 -> x4 -> x1 (T, or the speed button on a touch screen). The speed drops to x1 by itself while any ship is in
// view or heard within soloSlowRangeM (view.json), and goes back to the chosen one when the sea is empty again.
import { visibleContacts } from '../sim/perception';
import type { World } from '../sim/types';

export const SOLO_SPEEDS: readonly number[] = [1, 2, 4];

/** The next chosen speed: 1 -> 2 -> 4 -> 1. */
export function nextSoloSpeed(chosen: number): number {
  const i = SOLO_SPEEDS.indexOf(chosen);
  return SOLO_SPEEDS[(i + 1) % SOLO_SPEEDS.length] ?? 1;
}

/**
 * True if my ship sees (or hears) another ship within `rangeM` right now (your test of 25 Nov: not at the edge of
 * sight, 1,000+ m, where a bot needs minutes to come, but about 600 m).
 */
export function somebodyInView(world: World, myId: number, rangeM: number): boolean {
  const me = world.ships.find((s) => s.id === myId);
  if (!me) return false;
  return visibleContacts(world, myId).some((c) => Math.hypot(c.x - me.x, c.y - me.y) <= rangeM);
}

/** The speed to run at: the chosen one, but x1 when a ship is near or the player is sunk or in a fight. */
export function effectiveSoloSpeed(chosen: number, inView: boolean): number {
  return inView ? 1 : chosen;
}

/** The words next to the ship panel: '' at x1 chosen; "TIME x4" when running; "TIME x4 - SLOW: SHIP NEAR" when held back. */
export function soloSpeedNote(chosen: number, inView: boolean): string {
  if (chosen <= 1) return '';
  return inView ? `TIME x${chosen} - SLOW: SHIP NEAR` : `TIME x${chosen}`;
}
