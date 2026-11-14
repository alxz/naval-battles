import { describe, expect, it } from 'vitest';
import { headingRadToBearingDeg, twaDeg } from './angles';
import { TARGET_START_DISTANCE, createWorld } from './world';

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
