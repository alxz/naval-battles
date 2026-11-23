import { describe, expect, it } from 'vitest';
import { knownShips } from './knownShips';
import { createWorld } from '../sim/world';
import { stepWorld } from '../sim/step';
import type { World } from '../sim/types';

function pair(gap: number): World {
  const w = createWorld(7, 1);
  w.ships[0]!.x = 0; w.ships[0]!.y = 0;
  w.ships[1]!.x = gap; w.ships[1]!.y = 0;
  return w;
}
const open = { speedScale: 1, windDrift: false };

describe('knownShips', () => {
  it('the viewer and (until the lists exist) everything is shown', () => {
    const w = pair(5000);
    expect(knownShips(w, 1, false)).toEqual([{ shown: true, dot: false }, { shown: true, dot: false }]);
  });
  it('far away: not drawn; at the edge of sight: a dot; from the silhouette level: drawn', () => {
    for (const [gap, shown, dot] of [[2500, false, false], [900, false, true], [500, true, false], [100, true, false]] as const) {
      const w = pair(gap);
      stepWorld(w, 1 / 30, open, []);
      expect(knownShips(w, 1, false)[1]).toEqual({ shown, dot });
    }
  });
  it('the arena observer sees everything', () => {
    const w = pair(2500);
    stepWorld(w, 1 / 30, open, []);
    expect(knownShips(w, 1, true)[1]).toEqual({ shown: true, dot: false });
  });
  it('a wreck is shown while it is within the longest sight', () => {
    const w = pair(700);
    w.ships[1]!.sunk = true;
    stepWorld(w, 1 / 30, open, []);
    expect(knownShips(w, 1, false)[1]!.shown).toBe(true);
    w.ships[1]!.x = 3000;
    expect(knownShips(w, 1, false)[1]!.shown).toBe(false);
  });
});
