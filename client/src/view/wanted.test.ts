import { describe, expect, it } from 'vitest';
import { battleName, isWanted, shipLabel, WANTED_COLOUR } from './wanted';
import type { ShipState } from '../sim/types';

const ship = (extra: Partial<ShipState> = {}): ShipState => ({
  id: 3, shipClass: 'sloop', x: 0, y: 0, headingRad: 0, speed: 0, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 0,
  reloadPort: 0, reloadStarboard: 0, hull: 48, sunk: false, battleSkill: 4, team: 1, repairing: false, ...extra,
});

describe('WANTED labels', () => {
  it('a law-abiding ship: its name in the given colour; an offender: WANTED in red until pardoned', () => {
    expect(shipLabel(ship(), '#3 Black Gull 2', '#ffffff')).toEqual({ text: '#3 Black Gull 2', colour: '#ffffff' });
    const offender = ship({ offender: { port: 0, forgiveLeft: 45 } });
    expect(isWanted(offender)).toBe(true);
    expect(shipLabel(offender, '#3 Black Gull 2', '#ffffff')).toEqual({ text: 'WANTED: #3 Black Gull 2', colour: WANTED_COLOUR });
    expect(isWanted({ ...offender, sunk: true })).toBe(false);
  });
  it('names in a battle against bots', () => {
    expect(battleName(ship({ id: 1 }), 1)).toBe('YOU');
    expect(battleName(ship(), 1)).toBe('SLOOP 3');
  });
});
