import { describe, expect, it } from 'vitest';
import { barColour, hudLayout, overlaps, touchButtonRects } from './hudLayout';
import type { Rect } from './hudLayout';

// Logical screen sizes we use: computer, iPad, iPhone (landscape).
const screens = {
  computer: { w: 683, h: 384, touch: false },
  ipad: { w: 590, h: 410, touch: true },
  iphone: { w: 520, h: 240, touch: true },
  iphoneWide: { w: 633, h: 292, touch: true },
};

function inside(r: Rect, w: number, h: number): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
}

describe('hudLayout', () => {
  for (const [name, sc] of Object.entries(screens)) {
    it(`${name}: panels on the screen and not on top of each other`, () => {
      const l = hudLayout(sc.w, sc.h, sc.touch);
      for (const r of [l.ship, l.target, l.guns]) expect(inside(r, sc.w, sc.h)).toBe(true);
      expect(overlaps(l.ship, l.target)).toBe(false);
      expect(overlaps(l.ship, l.guns)).toBe(false);
      expect(overlaps(l.target, l.guns)).toBe(false);
    });
  }

  for (const name of ['ipad', 'iphone', 'iphoneWide'] as const) {
    it(`${name}: no panel under a touch button, buttons do not overlap`, () => {
      const sc = screens[name];
      const l = hudLayout(sc.w, sc.h, true);
      const buttons = Object.values(touchButtonRects(sc.w, sc.h));
      for (const b of buttons) {
        expect(inside(b, sc.w, sc.h)).toBe(true);
        for (const r of [l.ship, l.target, l.guns]) expect(overlaps(b, r)).toBe(false);
      }
      for (let i = 0; i < buttons.length; i++)
        for (let j = i + 1; j < buttons.length; j++) expect(overlaps(buttons[i]!, buttons[j]!)).toBe(false);
    });
  }

  it('the gun-up button is straight above the gun-down button', () => {
    const b = touchButtonRects(590, 410);
    expect(b.gunsUp.x).toBe(b.gunsDown.x);
    expect(b.gunsUp.y).toBeLessThan(b.gunsDown.y);
  });
});

describe('barColour', () => {
  it('green, yellow, red', () => {
    expect(barColour(0.8)).toBe(0x5cc85a);
    expect(barColour(0.4)).toBe(0xf2c94c);
    expect(barColour(0.1)).toBe(0xe0533d);
  });
});
