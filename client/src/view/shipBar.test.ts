import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from '../sim/data';
import { BAR_GAP_PX, BAR_MAX_WIDTH_PX, BAR_MIN_WIDTH_PX, shipBar } from './shipBar';

const sloop = SHIP_CLASSES['sloop']!;
const frigate = SHIP_CLASSES['frigate']!;

describe('shipBar', () => {
  it('is centred over the ship, above it, on whole pixels', () => {
    const b = shipBar(sloop, 100, 50, 0, 1, 1);
    expect(Number.isInteger(b.x) && Number.isInteger(b.y)).toBe(true);
    expect(b.x + b.width / 2).toBeCloseTo(100, 0);
    expect(b.y).toBeLessThan(50 - BAR_GAP_PX);
  });

  it('fills by the hull share: full, half, one pixel while afloat, nothing at 0', () => {
    expect(shipBar(sloop, 0, 0, 0, 1, 1).filled).toBe(shipBar(sloop, 0, 0, 0, 1, 1).width);
    const half = shipBar(sloop, 0, 0, 0, 0.5, 1);
    expect(half.filled).toBe(Math.round(half.width * 0.5));
    expect(shipBar(sloop, 0, 0, 0, 0.001, 1).filled).toBe(1);
    expect(shipBar(sloop, 0, 0, 0, 0, 1).filled).toBe(0);
    expect(shipBar(sloop, 0, 0, 0, 7, 1).filled).toBe(shipBar(sloop, 0, 0, 0, 1, 1).width); // never past full
  });

  it('width follows the ship size and the zoom, within the limits', () => {
    expect(shipBar(sloop, 0, 0, 0, 1, 0.1).width).toBe(BAR_MIN_WIDTH_PX);
    expect(shipBar(frigate, 0, 0, 0, 1, 3).width).toBe(BAR_MAX_WIDTH_PX);
    expect(shipBar(frigate, 0, 0, 0, 1, 1).width).toBeGreaterThan(shipBar(sloop, 0, 0, 0, 1, 1).width - 1);
  });

  it('a ship pointing north or south is covered further up than one pointing east', () => {
    const east = shipBar(frigate, 0, 0, 0, 1, 1);
    const north = shipBar(frigate, 0, 0, -Math.PI / 2, 1, 1);
    expect(north.y).toBeLessThanOrEqual(east.y);
  });
});
