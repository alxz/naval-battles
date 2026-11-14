import { describe, expect, it } from 'vitest';
import { TARGET_START_DISTANCE, createWorld } from './world';

describe('createWorld (scale test)', () => {
  it('has your ship and a moored target', () => {
    const w = createWorld();
    expect(w.ships.map((s) => s.id)).toEqual([1, 2]);
    expect(w.ships[1]!.sailLevel).toBe(0);
  });

  it('puts the target on your starboard beam at the start distance', () => {
    const [me, target] = createWorld().ships;
    const dx = target!.x - me!.x;
    const dy = target!.y - me!.y;
    expect(Math.hypot(dx, dy)).toBeCloseTo(TARGET_START_DISTANCE);
    // Starboard of a ship heading east (0 rad) is south, which is +y.
    expect(Math.atan2(dy, dx)).toBeCloseTo(Math.PI / 2);
  });
});
