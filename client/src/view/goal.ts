// D77 (24 Nov): a goal in Solo. Each battle against bots gets one random goal, so a battle has a meaning:
//   - sink the pirate <name> (the named ship must go down by YOUR guns or ram), or
//   - sink 3 ships (counted: only ships you sank).
// It is a meta rule of the screen, not of the sea: the simulation does not know about it (it reads the world's
// events only). Pure: no Phaser (scenes/Roster.ts draws the line, scenes/SeaScene.ts shows the banner).
// Later (after M3b): carry cargo or a passenger from port A to port B (a new kind, same state).
import type { ShipState } from '../sim/types';

export type Goal = { kind: 'sinkPirate'; targetId: number } | { kind: 'sinkShips'; count: number };
export type GoalStatus = 'open' | 'done' | 'failed';

export interface GoalState {
  goal: Goal;
  sunk: number; // ships you sank in this battle
  status: GoalStatus;
}

/** How many ships "sink N ships" asks for at most. */
export const GOAL_SHIPS = 3;

/**
 * The goal of a battle, from the seed. A pirate among the bots (there is one in every battle, D76) is the goal in
 * about half the battles; else, or with fewer than GOAL_SHIPS bots, it is "sink N ships" with N = min(3, bots).
 * Returns null when there are no bots.
 */
export function chooseGoal(seed: number, ships: readonly ShipState[], playerId: number): GoalState | null {
  const bots = ships.filter((s) => s.id !== playerId);
  if (bots.length === 0) return null;
  const pirates = bots.filter((s) => s.nation === 'pirates');
  const roll = Math.abs(Math.floor(seed)) % 2 === 0;
  if (pirates.length > 0 && roll) {
    const target = pirates[Math.abs(Math.floor(seed / 2)) % pirates.length]!;
    return { goal: { kind: 'sinkPirate', targetId: target.id }, sunk: 0, status: 'open' };
  }
  return { goal: { kind: 'sinkShips', count: Math.min(GOAL_SHIPS, bots.length) }, sunk: 0, status: 'open' };
}

/**
 * A ship went down. Returns the new status when it changed (done / failed), else null.
 * `afloatOthers`: bots still afloat after this one (to tell when "sink N" can no longer be reached).
 */
export function noteSunk(state: GoalState, shipId: number, byShipId: number, playerId: number, afloatOthers: number): GoalStatus | null {
  if (state.status !== 'open') return null;
  const mine = byShipId === playerId;
  if (mine) state.sunk++;
  const g = state.goal;
  if (g.kind === 'sinkPirate' && shipId === g.targetId) {
    state.status = mine ? 'done' : 'failed'; // another ship's guns took your prize
    return state.status;
  }
  if (g.kind === 'sinkShips') {
    if (state.sunk >= g.count) state.status = 'done';
    else if (state.sunk + afloatOthers < g.count) state.status = 'failed';
    return state.status === 'open' ? null : state.status;
  }
  return null;
}

/** The one line for the screen. `nameOf(id)`: how the roster names that ship now ("SHIP 5" until met, then "SLOOP 5"). */
export function goalLine(state: GoalState | null, nameOf: (id: number) => string): string {
  if (!state) return '';
  const g = state.goal;
  if (g.kind === 'sinkPirate') {
    const name = `PIRATE ${nameOf(g.targetId)}`;
    return state.status === 'done' ? `GOAL DONE: ${name} SUNK` : state.status === 'failed' ? `GOAL LOST: ${name} SUNK BY ANOTHER` : `GOAL: SINK THE ${name}`;
  }
  const n = `${Math.min(state.sunk, g.count)}/${g.count}`;
  return state.status === 'done' ? `GOAL DONE: ${g.count} SHIPS SUNK` : state.status === 'failed' ? `GOAL LOST: ONLY ${state.sunk} OF ${g.count} SUNK` : `GOAL: SINK ${g.count} SHIPS ${n}`;
}

/** The word on the victory banner: "GOAL DONE" or "" (no line when there was no goal or it was lost). */
export function goalBannerWord(state: GoalState | null, nameOf: (id: number) => string): string {
  return state && state.status === 'done' ? goalLine(state, nameOf) : '';
}
