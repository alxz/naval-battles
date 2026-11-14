import { describe, expect, it } from 'vitest';
import { edgeMarker } from './edgeMarker';

describe('edgeMarker', () => {
  it('no marker for a ship on the screen', () => {
    expect(edgeMarker(100, 100, 640, 360, 12)).toBeNull();
  });

  it('ship far to the south: marker at the bottom edge, pointing down', () => {
    const m = edgeMarker(320, 2000, 640, 360, 12)!;
    expect(m.x).toBeCloseTo(320);
    expect(m.y).toBeCloseTo(348);
    expect(m.angle).toBeCloseTo(Math.PI / 2);
  });

  it('ship far to the east: marker at the right edge', () => {
    const m = edgeMarker(5000, 180, 640, 360, 12)!;
    expect(m.x).toBeCloseTo(628);
    expect(m.y).toBeCloseTo(180);
    expect(m.angle).toBeCloseTo(0);
  });

  it('ship off a corner: the marker stays inside the screen', () => {
    const m = edgeMarker(-1000, -1000, 640, 360, 12)!;
    expect(m.x).toBeGreaterThanOrEqual(12);
    expect(m.y).toBeCloseTo(12);
  });
});
