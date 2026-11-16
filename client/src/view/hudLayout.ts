// Where the HUD panels go (M2 step 5, the new HUD). Plain numbers, no Phaser, so it can be tested.
//
//   computer:  sound and chart buttons top left; target card top centre; my ship bottom left; guns bottom centre;
//              debug text top left under the sound button (hidden until H).
//   touch:     my ship top left (the bottom corners hold the buttons), then the zoom, sound and chart buttons;
//              target card under those buttons; guns bottom centre, between the two button groups; debug text under my ship.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudLayout {
  ship: Rect;
  target: Rect;
  guns: Rect;
  /** Top left corner of the debug text. */
  debugX: number;
  debugY: number;
  /** The sound on/off button. */
  sound: Rect;
  /** The chart (sea map) button, right of the sound button. On touch screens it is as big as the minimap, which sits on it. */
  chart: Rect;
  /** The minimap: bottom right on a computer; on touch screens it takes the place of the chart button. */
  minimap: Rect;
  /** Size of a touch button (0 on a computer). */
  buttonSize: number;
}

export const HUD_MARGIN = 8;
/** Space between touch buttons and from the screen edge. */
export const BUTTON_MARGIN = 10;
const SHIP_W = 160; // room for the speed in the 16 px pixel font
const SHIP_H = 64;
const TARGET_W = 168; // "merchantman  110 m" in the 8 px pixel font
const TARGET_H = 30;
const GUNS_H = 46;
const MINIMAP_W = 132; // computer: 6 x 4 km at 22 px per km
const MINIMAP_H = 88;
const GUNS_W_COMPUTER = 210; // room for the small +/- gun icons
const GUNS_W_TOUCH = 180;

/** Touch button size: a bit under a fifth of the screen height, at most 48 logical pixels. */
export function touchButtonSize(height: number): number {
  return Math.round(Math.min(48, height * 0.17));
}

/** The zoom button (touch) sits to the right of my ship panel; its left edge. */
export function zoomButtonX(): number {
  return HUD_MARGIN + SHIP_W + HUD_MARGIN;
}

/** The small buttons at the top on touch screens (zoom, sound) are this big. */
export function smallButtonSize(height: number): number {
  return Math.round(touchButtonSize(height) * 0.75);
}

/** Computer: the sound icon (16 px) in the top left corner. */
const SOUND_ICON = 16;

export function hudLayout(width: number, height: number, touch: boolean): HudLayout {
  const m = HUD_MARGIN;
  const buttonSize = touch ? touchButtonSize(height) : 0;
  const gunsW = touch ? GUNS_W_TOUCH : GUNS_W_COMPUTER;
  const ship: Rect = touch
    ? { x: m, y: m, w: SHIP_W, h: SHIP_H }
    : { x: m, y: height - m - SHIP_H, w: SHIP_W, h: SHIP_H };
  // Touch: the sound button sits right of the zoom button. Computer: a small icon in the corner.
  const z = smallButtonSize(height);
  const sound: Rect = touch ? { x: zoomButtonX() + z + m, y: m, w: z, h: z } : { x: m, y: m, w: SOUND_ICON, h: SOUND_ICON };
  const chart: Rect = touch
    ? { x: sound.x + sound.w + m, y: sound.y, w: Math.round(z * 1.5), h: z } // the sea is 3 : 2
    : { x: sound.x + sound.w + 6, y: sound.y, w: sound.w, h: sound.h };
  const minimap: Rect = touch ? chart : { x: width - m - MINIMAP_W, y: height - m - MINIMAP_H, w: MINIMAP_W, h: MINIMAP_H };
  // Computer: the target card in the top middle. Touch: under the zoom and sound buttons
  // (the top right corner holds the collapsed tuning panel, which covered the card on the iPhone).
  const target: Rect = touch
    ? { x: zoomButtonX(), y: m + z + 4, w: TARGET_W, h: TARGET_H }
    : { x: Math.round(width / 2 - TARGET_W / 2), y: m, w: TARGET_W, h: TARGET_H };
  const guns: Rect = { x: Math.round(width / 2 - gunsW / 2), y: height - m - GUNS_H, w: gunsW, h: GUNS_H };
  return {
    ship,
    target,
    guns,
    debugX: m,
    debugY: touch ? ship.y + ship.h + 22 : m + SOUND_ICON + 8,
    sound,
    chart,
    minimap,
    buttonSize,
  };
}

/** Do two rectangles overlap? (For tests and layout checks.) */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Room around a ship's centre that counts as "the ship" when we check what a panel covers (logical px). */
export const SHIP_CLEARANCE_PX = 18;

/**
 * Is any of these points (ship centres on the screen, logical px) under this panel?
 * Then the HUD makes the panel see-through, so a panel never hides a ship.
 */
export function panelCovers(r: Rect, points: readonly { x: number; y: number }[], clearance = SHIP_CLEARANCE_PX): boolean {
  return points.some((p) => p.x > r.x - clearance && p.x < r.x + r.w + clearance && p.y > r.y - clearance && p.y < r.y + r.h + clearance);
}

/** Colour of a hull bar: green above half, yellow above a quarter, red below. */
export function barColour(share: number): number {
  if (share > 0.5) return 0x5cc85a;
  if (share > 0.25) return 0xf2c94c;
  return 0xe0533d;
}

export type ButtonName =
  | 'rudderLeft'
  | 'rudderRight'
  | 'firePort'
  | 'fireStarboard'
  | 'sailsLess'
  | 'sailsMore'
  | 'gunsDown'
  | 'gunsUp'
  | 'zoom';

/**
 * Touch buttons (their top left corners and sizes):
 *   left group:   row 1 (bottom) rudder < >,  row 2 fire L R
 *   right group:  row 1 sails - +,  above "+" a column: gun down (row 2), gun up (row 3)
 *   zoom:         small, at the top, right of my ship panel
 */
export function touchButtonRects(width: number, height: number): Record<ButtonName, Rect> {
  const s = touchButtonSize(height);
  const m = BUTTON_MARGIN;
  const row = (n: number): number => height - n * (s + m); // top of row n (1 = bottom)
  const left = (n: number): number => m + (n - 1) * (s + m); // column n from the left
  const right = (n: number): number => width - n * (s + m); // column n from the right
  const z = smallButtonSize(height);
  const at = (x: number, y: number, size = s): Rect => ({ x, y, w: size, h: size });
  return {
    rudderLeft: at(left(1), row(1)),
    rudderRight: at(left(2), row(1)),
    firePort: at(left(1), row(2)),
    fireStarboard: at(left(2), row(2)),
    sailsLess: at(right(2), row(1)),
    sailsMore: at(right(1), row(1)),
    gunsDown: at(right(1), row(2)),
    gunsUp: at(right(1), row(3)),
    zoom: at(zoomButtonX(), HUD_MARGIN, z),
  };
}
