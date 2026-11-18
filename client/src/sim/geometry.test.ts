import { describe, expect, it } from 'vitest';
import { bounds, distanceToSegment, pointInPolygon } from './geometry';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];
// An "L" shape: the corner at (7, 7) is outside (the cut-out part).
const ell = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 4 },
  { x: 4, y: 4 },
  { x: 4, y: 10 },
  { x: 0, y: 10 },
];

describe('pointInPolygon', () => {
  it('inside and outside a square', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: -1, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 5, y: 11 }, square)).toBe(false);
  });

  it('works for a shape with a dent', () => {
    expect(pointInPolygon({ x: 2, y: 8 }, ell)).toBe(true);
    expect(pointInPolygon({ x: 8, y: 2 }, ell)).toBe(true);
    expect(pointInPolygon({ x: 7, y: 7 }, ell)).toBe(false);
  });
});

describe('bounds', () => {
  it('finds the box around the L shape', () => {
    expect(bounds(ell)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
});

describe('distanceToSegment', () => {
  it('is the distance to the nearest point of the segment, ends included', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBe(3); // beside it
    expect(distanceToSegment({ x: -4, y: 3 }, a, b)).toBe(5); // past the end a: 3-4-5
    expect(distanceToSegment({ x: 13, y: 4 }, a, b)).toBe(5); // past the end b
    expect(distanceToSegment({ x: 3, y: 4 }, a, a)).toBe(5); // a "segment" that is a point
  });
});
