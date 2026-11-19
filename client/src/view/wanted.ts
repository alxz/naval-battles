// The label over a ship (M3 step 6c, your idea): a ship that broke a port's peace and is not
// pardoned yet carries "WANTED: " before its name, in red, for as long as the port remembers.
// Pure: no Phaser here (scenes/ArenaHud.ts and scenes/ShipBars.ts draw it).

import type { ShipState } from '../sim/types';

export const WANTED_PREFIX = 'WANTED: ';
export const WANTED_COLOUR = '#ff4a4a';

/** Is this ship wanted now (an offender of some port, not sunk)? */
export function isWanted(ship: ShipState): boolean {
  return ship.offender !== undefined && !ship.sunk;
}

/** The label text and colour: the name, or "WANTED: name" in red; `colour` is used when not wanted. */
export function shipLabel(ship: ShipState, name: string, colour: string): { text: string; colour: string } {
  return isWanted(ship) ? { text: `${WANTED_PREFIX}${name}`, colour: WANTED_COLOUR } : { text: name, colour };
}

/** The name of a ship in a battle against bots (no arena names there): you, or the class and number. */
export function battleName(ship: ShipState, playerId: number): string {
  return ship.id === playerId ? 'YOU' : `${ship.shipClass.toUpperCase()} ${ship.id}`;
}
