import { describe, expect, it } from 'vitest';
import { cameraCircleRadius, circleCamera, nearest, smoothToward } from './combatCamera';


describe('circleCamera (D43)', () => {
  it('stays still while the ship is inside the circle', () => {
    expect(circleCamera({ x: 0, y: 0 }, { x: 30, y: 40 }, 60)).toEqual({ x: 0, y: 0 });
  });
  it('is pulled along so the ship stays on the edge', () => {
    const c = circleCamera({ x: 0, y: 0 }, { x: 0, y: 100 }, 60);
    expect(c.x).toBeCloseTo(0, 9);
    expect(c.y).toBeCloseTo(40, 9);
  });
  it('radius 0: right on the ship', () => {
    expect(circleCamera({ x: 5, y: 5 }, { x: 50, y: -20 }, 0)).toEqual({ x: 50, y: -20 });
  });
  it('the radius: 2.5 hull lengths, but never more than the given share of the shorter half-view', () => {
    expect(cameraCircleRadius(36, 300, 200, 2.5, 0.4)).toBeCloseTo(80, 9);
    expect(cameraCircleRadius(84, 300, 200, 2.5, 0.4)).toBeCloseTo(80, 9); // 210 m would not fit: 40% of 200
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
