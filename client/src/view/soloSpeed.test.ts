import { describe, expect, it } from 'vitest';
import { effectiveSoloSpeed, nextSoloSpeed, somebodyInView, soloSpeedNote } from './soloSpeed';
import { createWorld } from '../sim/world';

describe('Solo time speed (M4b step 5b-2)', () => {
  it('T goes x1 -> x2 -> x4 -> x1', () => {
    expect([1, 2, 4].map(nextSoloSpeed)).toEqual([2, 4, 1]);
    expect(nextSoloSpeed(8)).toBe(1); // an unknown value goes back to x1
  });
  it('a ship in view holds the speed at x1; an empty sea gives the chosen speed back', () => {
    expect(effectiveSoloSpeed(4, true)).toBe(1);
    expect(effectiveSoloSpeed(4, false)).toBe(4);
    expect(effectiveSoloSpeed(1, false)).toBe(1);
  });
  it('the note says what runs and why it is held back', () => {
    expect(soloSpeedNote(1, false)).toBe('');
    expect(soloSpeedNote(1, true)).toBe('');
    expect(soloSpeedNote(2, false)).toBe('TIME x2');
    expect(soloSpeedNote(4, true)).toBe('TIME x4 - SLOW: SHIP NEAR');
  });

  it('only a ship within the range holds the speed back', () => {
    const w = createWorld(3, 2);
    const me = w.ships[0]!;
    me.x = 0;
    me.y = 0;
    w.sight = [{ shipId: me.id, contacts: [{ id: 2, level: 1, levelNow: 1, visible: true, x: 1000, y: 0, seenTick: 0, firstTick: 0 }] }];
    expect(somebodyInView(w, me.id, 600)).toBe(false);
    expect(somebodyInView(w, me.id, 1100)).toBe(true);
    w.sight[0]!.contacts[0]!.x = 500;
    expect(somebodyInView(w, me.id, 600)).toBe(true);
    w.sight[0]!.contacts[0]!.visible = false; // only a last known place: not near
    expect(somebodyInView(w, me.id, 600)).toBe(false);
  });
});
