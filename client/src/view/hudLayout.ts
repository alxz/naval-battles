// Where the HUD panels go (M2 step 5, the new HUD). Plain numbers, no Phaser, so it can be tested.
//
//   computer:  target card top centre; my ship bottom left; guns bottom centre;
//              debug text top left (hidden until H).
//   touch:     target card top centre; my ship top left (the bottom corners hold the buttons);
//              guns bottom centre, between the two button groups; debug text under my ship.

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
  /** Size of a touch button (0 on a computer). */
  buttonSize: number;
}

export const HUD_MARGIN = 8;
/** Space between touch buttons and from the screen edge. */
export const BUTTON_MARGIN = 10;
const SHIP_W = 150;
const SHIP_H = 64;
const TARGET_W = 150;
const TARGET_H = 30;
const GUNS_H = 46;
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

export function hudLayout(width: number, height: number, touch: boolean): HudLayout {
  const m = HUD_MARGIN;
  const buttonSize = touch ? touchButtonSize(height) : 0;
  const gunsW = touch ? GUNS_W_TOUCH : GUNS_W_COMPUTER;
  const ship: Rect = touch
    ? { x: m, y: m, w: SHIP_W, h: SHIP_H }
    : { x: m, y: height - m - SHIP_H, w: SHIP_W, h: SHIP_H };
  // The target card stays in the middle, but never under the zoom button on touch screens.
  const zoomRight = touch ? zoomButtonX() + Math.round(buttonSize * 0.75) + m : 0;
  const target: Rect = { x: Math.max(Math.round(width / 2 - TARGET_W / 2), zoomRight), y: m, w: TARGET_W, h: TARGET_H };
  const guns: Rect = { x: Math.round(width / 2 - gunsW / 2), y: height - m - GUNS_H, w: gunsW, h: GUNS_H };
  return {
    ship,
    target,
    guns,
    debugX: m,
    debugY: touch ? ship.y + ship.h + 22 : m,
    buttonSize,
  };
}

/** Do two rectangles overlap? (For tests and layout checks.) */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
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
  const z = Math.round(s * 0.75);
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
