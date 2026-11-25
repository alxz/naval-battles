import { describe, expect, it } from 'vitest';
import type { ShipState } from '../sim/types';
import { chooseGoal, goalBannerWord, goalLine, noteSunk } from './goal';

const ship = (id: number, nation: string): ShipState => ({ id, nation }) as unknown as ShipState;
const names = (id: number): string => `SHIP ${id}`;
const fleet = [ship(1, 'england'), ship(2, 'spain'), ship(3, 'pirates'), ship(4, 'france'), ship(5, 'netherlands')];

describe('chooseGoal (D77)', () => {
  it('no bots, no goal', () => {
    expect(chooseGoal(4, [ship(1, 'england')], 1)).toBeNull();
  });
  it('an even seed with a pirate asks to sink that pirate', () => {
    const s = chooseGoal(4, fleet, 1)!;
    expect(s.goal).toEqual({ kind: 'sinkPirate', targetId: 3 });
  });
  it('an odd seed asks to sink 3 ships; fewer bots, fewer ships', () => {
    expect(chooseGoal(5, fleet, 1)!.goal).toEqual({ kind: 'sinkShips', count: 3 });
    expect(chooseGoal(5, fleet.slice(0, 3), 1)!.goal).toEqual({ kind: 'sinkShips', count: 2 });
  });
  it('the same seed gives the same goal', () => {
    expect(chooseGoal(12345, fleet, 1)).toEqual(chooseGoal(12345, fleet, 1));
  });
  it('without a pirate every seed gives "sink N ships"', () => {
    const none = fleet.filter((s) => s.nation !== 'pirates');
    expect(chooseGoal(4, none, 1)!.goal.kind).toBe('sinkShips');
  });
});

describe('noteSunk (D77)', () => {
  it('the pirate sunk by you: done', () => {
    const s = chooseGoal(4, fleet, 1)!;
    expect(noteSunk(s, 2, 1, 1, 3)).toBeNull(); // another ship: nothing
    expect(noteSunk(s, 3, 1, 1, 2)).toBe('done');
  });
  it('the pirate sunk by another ship: the goal is lost', () => {
    const s = chooseGoal(4, fleet, 1)!;
    expect(noteSunk(s, 3, 2, 1, 3)).toBe('failed');
  });
  it('sink 3: counts only your kills; done at the third', () => {
    const s = chooseGoal(5, fleet, 1)!;
    expect(noteSunk(s, 2, 1, 1, 3)).toBeNull();
    expect(noteSunk(s, 3, 4, 1, 2)).toBeNull(); // sunk by a bot: not counted
    expect(noteSunk(s, 4, 1, 1, 1)).toBeNull();
    expect(s.sunk).toBe(2);
    expect(noteSunk(s, 5, 1, 1, 0)).toBe('done');
  });
  it('sink 3: lost when too few ships are left to reach it', () => {
    const s = chooseGoal(5, fleet, 1)!;
    expect(noteSunk(s, 2, 3, 1, 2)).toBe('failed'); // you sank none and only 2 are afloat: 3 can no longer be reached
    expect(s.status).toBe('failed');
  });
  it('after done or lost nothing changes', () => {
    const s = chooseGoal(4, fleet, 1)!;
    noteSunk(s, 3, 1, 1, 2);
    expect(noteSunk(s, 2, 1, 1, 1)).toBeNull();
    expect(s.status).toBe('done');
  });
});

describe('goalLine (D77)', () => {
  it('words for every state', () => {
    const p = chooseGoal(4, fleet, 1)!;
    expect(goalLine(p, names)).toBe('GOAL: SINK THE PIRATE SHIP 3');
    const t = chooseGoal(5, fleet, 1)!;
    expect(goalLine(t, names)).toBe('GOAL: SINK 3 SHIPS 0/3');
    expect(goalLine(null, names)).toBe('');
    expect(goalBannerWord(t, names)).toBe('');
    noteSunk(p, 3, 1, 1, 2);
    expect(goalBannerWord(p, names)).toBe('GOAL DONE: PIRATE SHIP 3 SUNK');
  });
});
