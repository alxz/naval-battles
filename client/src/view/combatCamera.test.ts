import { describe, expect, it } from 'vitest';
import { combatCameraCentre, nearest, smoothToward } from './combatCamera';

const options = { range: 400, keepInside: 0.8 };

describe('combatCameraCentre', () => {
  it('looks at your ship when there is no enemy', () => {
    expect(combatCameraCentre({ x: 5, y: 6 }, null, 320, 180, options)).toEqual({ x: 5, y: 6 });
  });

  it('looks at your ship when the enemy is out of range', () => {
    expect(combatCameraCentre({ x: 0, y: 0 }, { x: 500, y: 0 }, 320, 180, options)).toEqual({ x: 0, y: 0 });
  });

  it('looks halfway between the ships when both fit', () => {
    expect(combatCameraCentre({ x: 0, y: 0 }, { x: 0, y: 150 }, 320, 180, options)).toEqual({ x: 0, y: 75 });
  });

  it('keeps your ship inside the middle 80% of the screen', () => {
    // Enemy 300 m south; view half height 120 m -> the camera may move only 96 m.
    const c = combatCameraCentre({ x: 0, y: 0 }, { x: 0, y: 300 }, 260, 120, options);
    expect(c.y).toBeCloseTo(96);
  });
});

describe('nearest', () => {
  it('finds the closest point', () => {
    expect(nearest({ x: 0, y: 0 }, [{ x: 9, y: 0 }, { x: 0, y: 3 }, { x: 5, y: 5 }])).toEqual({ x: 0, y: 3 });
  });

  it('returns null for an empty list', () => {
    expect(nearest({ x: 0, y: 0 }, [])).toBeNull();
  });
});

describe('smoothToward', () => {
  it('covers about 63% of the way after one time constant', () => {
    let p = { x: 0, y: 0 };
    for (let i = 0; i < 60; i++) p = smoothToward(p, { x: 100, y: 0 }, 1 / 60, 1);
    expect(p.x).toBeCloseTo(63.2, 0);
  });

  it('jumps straight to the goal with time constant 0', () => {
    expect(smoothToward({ x: 0, y: 0 }, { x: 7, y: 8 }, 0.016, 0)).toEqual({ x: 7, y: 8 });
  });
});
