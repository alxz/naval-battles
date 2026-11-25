// M4b step 5d (D75): the list of the other ships of a battle, for the player's screen. It follows D68: the screen
// knows only what the player's ship knows. A ship is "seen" while it is on the screen (knownShips), "sunk" (struck
// through) only if the player saw it go down, otherwise "unknown" ("?"): the player does not learn from the list
// that an unseen ship sank, or what class it is before he has met it. Pure: no Phaser (scenes/Roster.ts draws it).
import type { Known } from './knownShips';
import type { ShipState } from '../sim/types';

export interface RosterMemory {
  met: Set<number>; // ships that were on the screen at some time (their class is known now)
  sunk: Set<number>; // ships seen sunk
}

export type RosterState = 'seen' | 'sunk' | 'unknown';

export interface RosterRow {
  id: number;
  name: string;
  state: RosterState;
}

export function newRosterMemory(): RosterMemory {
  return { met: new Set(), sunk: new Set() };
}

/** `known[i]` belongs to `ships[i]` (knownShips). Call it every frame; the viewer's own ship is not listed. */
export function updateRosterMemory(memory: RosterMemory, ships: readonly ShipState[], known: readonly Known[], viewerId: number): void {
  ships.forEach((ship, i) => {
    if (ship.id === viewerId) return;
    const k = known[i];
    if (!k || !(k.shown || k.dot)) return;
    memory.met.add(ship.id);
    if (ship.sunk && k.shown) memory.sunk.add(ship.id);
  });
}

/** How the list names a ship now: "SHIP 5" until the player has met it, then "SLOOP 5". */
export function rosterName(ship: Pick<ShipState, 'id' | 'shipClass'>, memory: RosterMemory): string {
  return memory.met.has(ship.id) ? `${ship.shipClass.toUpperCase()} ${ship.id}` : `SHIP ${ship.id}`;
}

export function rosterRows(ships: readonly ShipState[], known: readonly Known[], memory: RosterMemory, viewerId: number): RosterRow[] {
  const rows: RosterRow[] = [];
  ships.forEach((ship, i) => {
    if (ship.id === viewerId) return;
    const k = known[i];
    const name = rosterName(ship, memory);
    const state: RosterState = ship.sunk ? (memory.sunk.has(ship.id) ? 'sunk' : 'unknown') : k && (k.shown || k.dot) ? 'seen' : 'unknown';
    rows.push({ id: ship.id, name, state });
  });
  return rows;
}

/** The one-line form for a phone: "FOES 3/5" = ships not seen sunk / all of them. */
export function rosterSummary(rows: readonly RosterRow[]): string {
  return `FOES ${rows.filter((r) => r.state !== 'sunk').length}/${rows.length}`;
}
