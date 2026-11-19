import { describe, expect, it } from 'vitest';
import { headingRadToBearingDeg, twaDeg } from './angles';
import { TARGET_START_DISTANCE, createWorld, enemiesFor } from './world';
import { ENEMIES } from './data';

describe('createWorld', () => {
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
    // Starboard is 90 deg clockwise from the bow.
    expect(Math.atan2(dy, dx)).toBeCloseTo(me!.headingRad + Math.PI / 2);
  });

  it('starts with the trade wind from the ENE', () => {
    expect(headingRadToBearingDeg(createWorld().wind.fromRad)).toBeCloseTo(67.5);
  });

  it('your start course is not in irons', () => {
    const w = createWorld();
    expect(twaDeg(w.ships[0]!.headingRad, w.wind.fromRad)).toBeGreaterThan(90);
  });
});

describe('enemiesFor (M3 step 6c)', () => {
  it('the panel number when set; else 3 to 5 from the seed, every count possible', () => {
    expect(enemiesFor(123, 2)).toBe(2);
    const counts = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map((seed) => enemiesFor(seed, 0)));
    expect([...counts].sort()).toEqual([ENEMIES.min, ENEMIES.min + 1, ENEMIES.max]);
  });
  it('a world with five enemies has six ships, each in open water', () => {
    const world = createWorld(77, 5);
    expect(world.ships).toHaveLength(6);
  });
});
