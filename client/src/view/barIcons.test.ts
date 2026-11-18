import { describe, expect, it } from 'vitest';
import { BAR_ICONS, barIconHeight, barIconPixels, barIconWidth } from './barIcons';
import type { BarIconName } from './barIcons';

const names: BarIconName[] = ['hull', 'sails', 'crew'];

describe('barIcons (M3 step 4b)', () => {
  it('every icon is small (at most 6 x 4) and only uses # and .', () => {
    for (const n of names) {
      expect(barIconWidth(n)).toBeLessThanOrEqual(6);
      expect(barIconHeight(n)).toBeLessThanOrEqual(4);
      for (const row of BAR_ICONS[n].rows) expect(row).toMatch(/^[#.]+$/);
    }
  });

  it('pixels are listed from the top left; each icon has some', () => {
    expect(barIconPixels('crew')[0]).toEqual({ x: 1, y: 0 });
    for (const n of names) expect(barIconPixels(n).length).toBeGreaterThan(3);
  });

  it('three different colours', () => {
    expect(new Set(names.map((n) => BAR_ICONS[n].colour)).size).toBe(3);
  });
});
