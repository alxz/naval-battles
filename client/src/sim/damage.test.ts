import { describe, expect, it } from 'vitest';
import { damageHull } from './damage';
import { createWorld } from './world';

describe('damageHull', () => {
  it('step 4b: the sunk event keeps how the ship sailed the moment before (for the arena log)', () => {
    const w = createWorld(1);
    const ship = w.ships[0]!;
    ship.speed = 5.5;
    ship.sailLevel = 0.75;
    w.events = [];
    damageHull(w, ship, ship.hull + 1, 2, []);
    expect(ship.sunk).toBe(true);
    expect(ship.speed).toBe(0);
    const e = w.events.find((x) => x.type === 'sunk');
    expect(e).toMatchObject({ type: 'sunk', shipId: ship.id, byShipId: 2, speedBefore: 5.5, sailLevelBefore: 0.75 });
  });
});
