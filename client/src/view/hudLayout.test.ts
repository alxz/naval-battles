import { describe, expect, it } from 'vitest';
import { AMMO_ROW_H, barColour, hudLayout, overlaps, panelCovers, touchButtonRects } from './hudLayout';
import type { Rect } from './hudLayout';

// Logical screen sizes we use: computer, iPad, iPhone (landscape).
const screens = {
  computer: { w: 683, h: 384, touch: false },
  ipad: { w: 590, h: 410, touch: true },
  iphone: { w: 520, h: 240, touch: true },
  iphoneWide: { w: 633, h: 292, touch: true },
  computerTall: { w: 320, h: 427, touch: false }, // a browser window taller than wide (M3 step 4c)
  computerTall2: { w: 480, h: 640, touch: false },
};

function inside(r: Rect, w: number, h: number): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
}

describe('hudLayout', () => {
  for (const [name, sc] of Object.entries(screens)) {
    it(`${name}: panels on the screen and not on top of each other`, () => {
      const l = hudLayout(sc.w, sc.h, sc.touch);
      for (const r of [l.ship, l.target, l.guns, l.sound, l.chart]) expect(inside(r, sc.w, sc.h)).toBe(true);
      for (const r of [l.ship, l.target, l.guns]) {
        expect(overlaps(l.sound, r)).toBe(false);
        expect(overlaps(l.chart, r)).toBe(false);
      }
      expect(overlaps(l.sound, l.chart)).toBe(false);
      expect(inside(l.minimap, sc.w, sc.h)).toBe(true);
      for (const r of [l.ship, l.target, l.guns, l.sound]) expect(overlaps(l.minimap, r)).toBe(false);
      expect(overlaps(l.ship, l.target)).toBe(false);
      expect(overlaps(l.ship, l.guns)).toBe(false);
      expect(overlaps(l.target, l.guns)).toBe(false);
      if (!sc.touch) {
        // The ammunition row above the guns panel is free too (M3 step 4c).
        const ammoRow = { x: l.guns.x, y: l.guns.y - AMMO_ROW_H, w: l.guns.w, h: AMMO_ROW_H };
        for (const r of [l.ship, l.target, l.minimap]) expect(overlaps(ammoRow, r)).toBe(false);
        expect(l.status.y).toBeLessThan(sc.touch ? sc.h : Math.min(l.ship.y, ammoRow.y));
      }
    });
  }

  it('computer: the target card at the top right; a tall window stacks the guns above my ship', () => {
    const wide = hudLayout(683, 384, false);
    expect(wide.target.x + wide.target.w).toBe(683 - 8);
    expect(wide.narrow).toBe(false);
    const tall = hudLayout(320, 427, false);
    expect(tall.narrow).toBe(true);
    expect(tall.guns.y + tall.guns.h).toBeLessThanOrEqual(tall.ship.y);
  });

  for (const name of ['ipad', 'iphone', 'iphoneWide'] as const) {
    it(`${name}: no panel under a touch button, buttons do not overlap`, () => {
      const sc = screens[name];
      const l = hudLayout(sc.w, sc.h, true);
      const buttons = [...Object.values(touchButtonRects(sc.w, sc.h)), l.sound, l.chart];
      for (const b of buttons) {
        expect(inside(b, sc.w, sc.h)).toBe(true);
        for (const r of [l.ship, l.target, l.guns]) expect(overlaps(b, r)).toBe(false);
      }
      // The big minimap (M3 step 4b) is under no button and at least twice a button wide.
      for (const btn of [...Object.values(touchButtonRects(sc.w, sc.h)), l.sound, l.autoZoom, l.spyglass]) expect(overlaps(l.minimap, btn)).toBe(false);
      expect(l.minimap.w).toBeGreaterThanOrEqual(2 * l.buttonSize);
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

describe('phone button layout (your mock-up, 24 Nov)', () => {
  const b = touchButtonRects(844, 390);
  it('the bottom row: "<" and "L" at the left edge, "R" and ">" at the right edge, all on one line', () => {
    expect(b.rudderLeft.x).toBeLessThan(b.firePort.x);
    expect(b.fireStarboard.x).toBeLessThan(b.rudderRight.x);
    expect(b.rudderRight.x + b.rudderRight.w).toBeLessThanOrEqual(844 - 10);
    for (const r of [b.firePort, b.fireStarboard, b.rudderRight]) expect(r.y).toBe(b.rudderLeft.y);
  });
  it('the second row: "-" and the shot kind at the left; "B" and gun down at the right', () => {
    expect(b.sailsLess.x).toBe(b.rudderLeft.x);
    expect(b.ammo.x).toBe(b.firePort.x);
    expect(b.fireBow.x).toBe(b.fireStarboard.x);
    expect(b.gunsDown.x).toBe(b.rudderRight.x);
    for (const r of [b.ammo, b.fireBow, b.gunsDown]) expect(r.y).toBe(b.sailsLess.y);
    expect(b.sailsLess.y).toBeLessThan(b.rudderLeft.y);
  });
  it('"+" is straight above "-"', () => {
    expect(b.sailsMore.x).toBe(b.sailsLess.x);
    expect(b.sailsMore.y).toBeLessThan(b.sailsLess.y);
  });
});

describe('panelCovers', () => {
  const panel = { x: 100, y: 100, w: 50, h: 20 };
  it('a ship under the panel or close to its edge counts; one far away does not', () => {
    expect(panelCovers(panel, [{ x: 120, y: 110 }])).toBe(true);
    expect(panelCovers(panel, [{ x: 90, y: 110 }], 18)).toBe(true); // 10 px left of the edge: its hull reaches in
    expect(panelCovers(panel, [{ x: 40, y: 110 }, { x: 300, y: 300 }])).toBe(false);
    expect(panelCovers(panel, [])).toBe(false);
  });
});

describe('barColour', () => {
  it('green, yellow, red', () => {
    expect(barColour(0.8)).toBe(0x5cc85a);
    expect(barColour(0.4)).toBe(0xf2c94c);
    expect(barColour(0.1)).toBe(0xe0533d);
  });
});
