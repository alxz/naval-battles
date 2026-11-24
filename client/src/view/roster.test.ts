import { describe, expect, it } from 'vitest';
import { newRosterMemory, rosterRows, rosterSummary, updateRosterMemory } from './roster';
import type { Known } from './knownShips';
import type { ShipState } from '../sim/types';

function ship(id: number, shipClass = 'sloop', sunk = false): ShipState {
  return { id, shipClass, x: 0, y: 0, headingRad: 0, speed: 0, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: 10, sunk, battleSkill: 4, team: id, repairing: false };
}
const SHOWN: Known = { shown: true, dot: false, level: 4, detail: 2 };
const DOT: Known = { shown: false, dot: true, level: 1, detail: 0 };
const NONE: Known = { shown: false, dot: false, level: 0, detail: 0 };

describe('roster (D75, follows D68)', () => {
  it('an unmet ship is "SHIP n", unknown; once on the screen it shows its class and is seen', () => {
    const memory = newRosterMemory();
    const ships = [ship(1), ship(2, 'frigate')];
    expect(rosterRows(ships, [SHOWN, NONE], memory, 1)).toEqual([{ id: 2, name: 'SHIP 2', state: 'unknown' }]);
    updateRosterMemory(memory, ships, [SHOWN, SHOWN], 1);
    expect(rosterRows(ships, [SHOWN, SHOWN], memory, 1)).toEqual([{ id: 2, name: 'FRIGATE 2', state: 'seen' }]);
    updateRosterMemory(memory, ships, [SHOWN, NONE], 1);
    expect(rosterRows(ships, [SHOWN, NONE], memory, 1)[0]).toEqual({ id: 2, name: 'FRIGATE 2', state: 'unknown' });
  });

  it('struck through only when the player saw it sink; a ship that sank out of sight stays "?"', () => {
    const memory = newRosterMemory();
    const sunk = [ship(1), ship(2, 'brigantine', true), ship(3, 'sloop', true)];
    updateRosterMemory(memory, sunk, [SHOWN, SHOWN, NONE], 1);
    const rows = rosterRows(sunk, [SHOWN, SHOWN, NONE], memory, 1);
    expect(rows.map((r) => r.state)).toEqual(['sunk', 'unknown']);
    expect(rows[1]!.name).toBe('SHIP 3'); // never met
    expect(rosterSummary(rows)).toBe('FOES 1/2');
  });

  it('a dot (level 1) counts as met and seen', () => {
    const memory = newRosterMemory();
    const ships = [ship(1), ship(2)];
    updateRosterMemory(memory, ships, [SHOWN, DOT], 1);
    expect(rosterRows(ships, [SHOWN, DOT], memory, 1)[0]!.state).toBe('seen');
  });
});
