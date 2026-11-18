// Where the HUD panels go (M2 step 5, the new HUD). Plain numbers, no Phaser, so it can be tested.
//
//   computer:  sound and chart buttons top left; target card top centre; my ship bottom left; guns bottom centre;
//              debug text top left under the sound button (hidden until H).
//   touch:     my ship top left (smaller on a phone); the zoom and sound buttons in the middle of the top
//              edge; under my ship, only in a fight, a short target card. The minimap (it is also the chart
//              button) at the right edge under the tuning gear. Fire buttons L R above the rudder; they show
//              the reload, so there is no guns panel; the gun angle and range sit left of the gun buttons.
//              Debug text under the target card.

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
  /** The chart (sea map) button, right of the sound button. On touch screens at the right edge under the gear (shown when the minimap is off). */
  chart: Rect;
  /** The minimap: bottom right on a computer; on touch screens top right, left of the right column of buttons. */
  minimap: Rect;
  /** Size of a touch button (0 on a computer). */
  buttonSize: number;
  /** The spyglass icon (computer; on touch screens the spyglass is a TouchControls button: same rect). */
  spyglass: Rect;
  /** The automatic combat zoom on / off: an icon on a computer, a small button on touch screens. */
  autoZoom: Rect;
  /** A phone: my ship panel is drawn smaller (see Hud.ts). */
  compact: boolean;
}

export const HUD_MARGIN = 8;
/** Space between touch buttons and from the screen edge. */
export const BUTTON_MARGIN = 10;
const SHIP_W = 160; // room for the speed in the 16 px pixel font
const SHIP_H = 64;
const SHIP_W_COMPACT = 112; // phone: a small compass and the speed in the 8 px font
const SHIP_H_COMPACT = 44;
const TARGET_W = 168; // "merchantman  110 m" in the 8 px pixel font
const TARGET_W_TOUCH = 112; // touch: the same in the narrow 8 px font (Silkscreen)
const TARGET_H_TOUCH = 22;
const TARGET_H = 30;
const GUNS_H = 46;
const MINIMAP_W = 108; // computer: 6 x 4 km at 18 px per km
const MINIMAP_H = 72;
/** Touch: the minimap is this many buttons wide (M3 step 4b: it was one, too small on a phone). */
const MINIMAP_TOUCH_SCALE = 2.4;
/** Touch: the target card shows only when the enemy is this close (metres); farther away the edge arrows tell the distance. */
export const TARGET_CARD_RANGE_TOUCH = 400;
const GUNS_W_COMPUTER = 210; // room for the small +/- gun icons
const GUNS_TOUCH_H = 26; // touch: two short lines, the angle and the range
const GUNS_TOUCH_EXTRA = 6; // "10.0°" needs a little more than a button's width
const GEAR_H = 32; // touch: the tuning gear in the top right corner is about this high

/** Touch button size: a bit under a fifth of the screen height, at most 48 logical pixels. */
export function touchButtonSize(height: number): number {
  return Math.round(Math.min(48, height * 0.17));
}

/** A phone (a low screen): the HUD uses its small forms. */
export function isCompact(height: number): boolean {
  return height < 300;
}

/** The zoom button (touch) sits to the right of my ship panel; its left edge. */
export function zoomButtonX(width: number, height: number): number {
  // Three small buttons in the middle of the top edge: spyglass, sound, auto zoom.
  return Math.round(width / 2 - smallButtonSize(height) * 1.5 - HUD_MARGIN);
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
  const gunsW = GUNS_W_COMPUTER;
  const compact = touch && isCompact(height);
  const ship: Rect = touch
    ? { x: m, y: m, w: compact ? SHIP_W_COMPACT : SHIP_W, h: compact ? SHIP_H_COMPACT : SHIP_H }
    : { x: m, y: height - m - SHIP_H, w: SHIP_W, h: SHIP_H };
  // Touch: the sound button sits right of the zoom button. Computer: a small icon in the corner.
  const z = smallButtonSize(height);
  const sound: Rect = touch ? { x: zoomButtonX(width, height) + z + m, y: m, w: z, h: z } : { x: m, y: m, w: SOUND_ICON, h: SOUND_ICON };
  // Touch: the minimap (the sea is 3 : 2) at the right edge, under the tuning gear.
  const b = touchButtonRects(width, height);
  // Touch, minimap off: the chart button sits at the right edge under the tuning gear.
  const chartButton: Rect = { x: width - m - buttonSize, y: GEAR_H + 2, w: buttonSize, h: Math.round((buttonSize * 2) / 3) };
  const chart: Rect = touch ? chartButton : { x: sound.x + sound.w + 6, y: sound.y, w: sound.w, h: sound.h };
  const spyglass: Rect = touch ? { x: zoomButtonX(width, height), y: m, w: z, h: z } : { x: chart.x + chart.w + 6, y: chart.y, w: chart.w, h: chart.h };
  const autoZoom: Rect = touch ? { x: sound.x + sound.w + m, y: m, w: z, h: z } : { x: spyglass.x + spyglass.w + 6, y: chart.y, w: chart.w, h: chart.h };
  // Touch (M3 step 4b): a big minimap at the top right, left of the right column of buttons;
  // as wide as MINIMAP_TOUCH_SCALE buttons, but never onto the small buttons in the top middle.
  const mapRight = b.sailsMore.x - 4;
  const mapW = Math.max(buttonSize, Math.min(Math.round(buttonSize * MINIMAP_TOUCH_SCALE), mapRight - (autoZoom.x + autoZoom.w + m)));
  const minimap: Rect = touch
    ? { x: mapRight - mapW, y: m, w: mapW, h: Math.round((mapW * 2) / 3) }
    : { x: width - m - MINIMAP_W, y: height - m - MINIMAP_H, w: MINIMAP_W, h: MINIMAP_H };
  // Computer: the target card in the top middle. Touch: at the left edge, under my ship.
  const target: Rect = touch
    ? { x: m, y: ship.y + ship.h + 4, w: TARGET_W_TOUCH, h: TARGET_H_TOUCH }
    : { x: Math.round(width / 2 - TARGET_W / 2), y: m, w: TARGET_W, h: TARGET_H };
  const guns: Rect = touch
    ? { x: b.sailsLess.x - GUNS_TOUCH_EXTRA, y: b.gunsUp.y + buttonSize - GUNS_TOUCH_H, w: buttonSize + GUNS_TOUCH_EXTRA, h: GUNS_TOUCH_H }
    : { x: Math.round(width / 2 - gunsW / 2), y: height - m - GUNS_H, w: gunsW, h: GUNS_H };
  return {
    ship,
    target,
    guns,
    debugX: m,
    debugY: touch ? target.y + target.h + 18 : m + SOUND_ICON + 8,
    sound,
    chart,
    minimap,
    spyglass,
    autoZoom,
    buttonSize,
    compact,
  };
}

/** Do two rectangles overlap? (For tests and layout checks.) */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Room around a ship's centre that counts as "the ship" when we check what a panel covers (logical px). */
export const SHIP_CLEARANCE_PX = 22; // ships are 1.2x bigger since M3 step 1 (D39)

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
  | 'ammo'
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
    ammo: at(left(1), row(3)), // above "L": the kind of shot (M3 step 4)
    zoom: at(zoomButtonX(width, height), HUD_MARGIN, z),
  };
}
