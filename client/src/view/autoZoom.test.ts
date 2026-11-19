import { describe, expect, it } from 'vitest';
import { autoZoom } from './autoZoom';

// closeFightRange 1000: only the "both ships fit" rule decides in the first tests.
const computer = {
  widthPx: 700,
  heightPx: 400,
  pixelsPerMetre: 1,
  marginPx: 36,
  spareToZoomInPx: 24,
  closeFightRange: 1000,
  closeFightRangeSpare: 20,
};
const phone = { ...computer, widthPx: 507, heightPx: 234 };
const me = { x: 0, y: 0 };
const steps = [1, 2];

describe('autoZoom', () => {
  // The camera circle (D43): the view may be centred on your ship, so both must fit from there.
  it('computer: enemy 60 m to the side -> x2 (big ships)', () => {
    expect(autoZoom(1, steps, me, { x: 0, y: 60 }, computer)).toBe(2);
  });

  it('computer: enemy 200 m to the side -> x1 (both must fit)', () => {
    expect(autoZoom(2, steps, me, { x: 0, y: 200 }, computer)).toBe(1);
  });

  it('no flip-flop: at 75 m it stays at x2 if already there, but does not zoom in from x1', () => {
    const enemy = { x: 0, y: 75 };
    expect(autoZoom(2, steps, me, enemy, computer)).toBe(2);
    expect(autoZoom(1, steps, me, enemy, computer)).toBe(1);
  });

  it('phone: the short screen side limits x2 to close fights', () => {
    expect(autoZoom(1, steps, me, { x: 0, y: 60 }, phone)).toBe(1);
    expect(autoZoom(2, steps, me, { x: 0, y: 35 }, phone)).toBe(2);
  });

  it('phone: enemy along the long side fits at x2 from farther away', () => {
    expect(autoZoom(2, steps, me, { x: 100, y: 0 }, phone)).toBe(2);
  });

  it('falls back to the smallest step when nothing fits', () => {
    expect(autoZoom(2, steps, me, { x: 0, y: 900 }, computer)).toBe(1);
  });

  it('close-fight range: no x2 for an enemy 150 m away even if it would fit', () => {
    const o = { ...computer, closeFightRange: 120 };
    expect(autoZoom(1, steps, me, { x: 150, y: 0 }, o)).toBe(1);
    expect(autoZoom(1, steps, me, { x: 110, y: 0 }, o)).toBe(2);
  });

  it('close-fight range: once at x2, it stays a little longer (no flip-flop)', () => {
    const o = { ...computer, closeFightRange: 120 };
    expect(autoZoom(2, steps, me, { x: 130, y: 0 }, o)).toBe(2);
    expect(autoZoom(1, steps, me, { x: 130, y: 0 }, o)).toBe(1);
    expect(autoZoom(2, steps, me, { x: 150, y: 0 }, o)).toBe(1);
  });
});
