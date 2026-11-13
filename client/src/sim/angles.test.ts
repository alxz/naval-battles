import { describe, expect, it } from 'vitest';
import { normalizeAngle } from './angles';

describe('normalizeAngle', () => {
  it('keeps small angles unchanged', () => {
    expect(normalizeAngle(1)).toBeCloseTo(1);
    expect(normalizeAngle(-1)).toBeCloseTo(-1);
  });

  it('wraps angles larger than PI', () => {
    expect(normalizeAngle(3 * Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
  });

  it('wraps angles smaller than -PI', () => {
    expect(normalizeAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it('treats a full turn as zero', () => {
    expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0);
  });
});