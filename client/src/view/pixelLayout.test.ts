import { describe, expect, it } from 'vitest';
import { isPhoneScreen, pixelLayout } from './pixelLayout';

describe('pixelLayout', () => {
  it('Full HD browser window, target height 360', () => {
    const l = pixelLayout(1920, 960, 1, 360);
    expect(l.pixelScale).toBe(3); // 960 / 360 = 2.67 -> 3
    expect(l.height).toBe(320);
    expect(l.width).toBe(640);
    expect(l.cssZoom).toBe(3);
  });

  it('iPhone in landscape (CSS 844 x 390, dpr 3), target height 240', () => {
    const l = pixelLayout(844, 390, 3, 240);
    expect(l.pixelScale).toBe(5); // 1170 / 240 = 4.9 -> 5
    expect(l.height).toBe(234);
    expect(l.width).toBe(507);
    expect(l.cssZoom).toBeCloseTo(5 / 3);
  });

  it('always a whole pixel scale, never below 1', () => {
    const l = pixelLayout(300, 100, 1, 360);
    expect(l.pixelScale).toBe(1);
    expect(Number.isInteger(pixelLayout(1234, 567, 2.5, 300).pixelScale)).toBe(true);
  });

  it('covers the whole window (no black bars)', () => {
    const l = pixelLayout(1366, 650, 1, 360);
    expect(l.width * l.pixelScale).toBeGreaterThanOrEqual(1366);
    expect(l.height * l.pixelScale).toBeGreaterThanOrEqual(650);
  });
});

describe('isPhoneScreen', () => {
  it('iPhone yes, iPad and computer no', () => {
    expect(isPhoneScreen(844, 390, true, 500)).toBe(true);
    expect(isPhoneScreen(1180, 820, true, 500)).toBe(false);
    expect(isPhoneScreen(800, 400, false, 500)).toBe(false);
  });
});
