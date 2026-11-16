import Phaser from 'phaser';
import { compassPoint, headingRadToBearingDeg } from '../sim/angles';
import { GUNS, SHIP_CLASSES } from '../sim/data';
import type { SailingInfo } from '../sim/step';
import type { ShipState, Side, Wind } from '../sim/types';
import { barColour, hudLayout } from '../view/hudLayout';
import type { HudLayout, Rect } from '../view/hudLayout';
import { Compass } from './Compass';
import { ICON_SIZE } from './icons';
import { TEXT_RESOLUTION } from './text';

const SAIL_PIPS = 4; // the sails go 0, 25, 50, 75, 100 %
const PANEL_ALPHA = 0.55;
const GAUGE_SPREAD_DEG = 60; // the gauge draws 0-10 degrees of elevation as 0-60 degrees, so it is easy to see
const READY = 0xffe066;

/** What the HUD shows about the target (null = no target). */
export interface TargetInfo {
  shipClass: string;
  distance: number; // metres
  hull: number;
  hullMax: number;
  sunk: boolean;
}

/** Everything the HUD needs in one frame. */
export interface HudData {
  ship: ShipState;
  hullMax: number;
  sailing: SailingInfo;
  wind: Wind;
  rangeM: number; // where the guns land now (lying still), metres from the ship
  target: TargetInfo | null;
  debug: boolean; // show the debug text
  debugLines: string[];
}

/**
 * The HUD (heads-up display): three small panels on dark plates, so they can be read
 * over the moving sea. Places come from `hudLayout` (view/hudLayout.ts).
 *   my ship:  compass, speed, sail pips, hull bar (and IN IRONS / AGROUND when it happens)
 *   target:   class, distance, hull bar
 *   guns:     port and starboard (yellow = loaded; a grey pie fills while reloading),
 *             an elevation gauge with the angle and the range;
 *             on a computer also the gun up / down icons with their keys (+ and -), which can be clicked
 * The debug text (all the numbers, keys) shows with H on a computer or the panel switch.
 */
export class Hud {
  /** True while the mouse holds a gun icon (computer). */
  raise = false;
  lower = false;
  private readonly touch: boolean;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly compass: Compass;
  private readonly speed: Phaser.GameObjects.Text;
  private readonly unit: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly targetText: Phaser.GameObjects.Text;
  private readonly elevation: Phaser.GameObjects.Text;
  private readonly range: Phaser.GameObjects.Text;
  private readonly sideText: Record<Side, Phaser.GameObjects.Text>;
  private readonly keyHints: Phaser.GameObjects.Text[] = [];
  private readonly gunIcons: Phaser.GameObjects.Image[] = [];
  private readonly debugText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private l: HudLayout = hudLayout(640, 360, false);

  constructor(scene: Phaser.Scene, touch: boolean) {
    this.touch = touch;
    // Order matters (see the note about Text after Graphics in RangeRings.ts): the plates
    // and bars first, then the compass, then all text and icons on top.
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.compass = new Compass(scene);
    const text = (size: number, colour = '#ffffff', bold = false): Phaser.GameObjects.Text =>
      scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: `${size}px`,
          fontStyle: bold ? 'bold' : 'normal',
          color: colour,
          resolution: TEXT_RESOLUTION,
        })
        .setScrollFactor(0)
        .setDepth(104);
    this.speed = text(18, '#ffffff', true);
    this.unit = text(9, '#cfe6f7').setText('m/s');
    this.status = text(10, '#ff8070', true);
    this.targetText = text(10);
    this.elevation = text(12, '#ffffff', true);
    this.range = text(10, '#cfe6f7');
    this.sideText = { port: text(10, '#1b1b1b', true).setOrigin(0.5), starboard: text(10, '#1b1b1b', true).setOrigin(0.5) };
    this.debugText = text(10);
    this.hint = text(9, '#cfe6f7').setAlpha(0.7);

    if (!touch) {
      // Computer: the gun icons are a reminder of the keys, and they can be clicked too.
      for (const [key, label, hold] of [
        ['icon-gun-up', '+', (down: boolean) => (this.raise = down)],
        ['icon-gun-down', '-', (down: boolean) => (this.lower = down)],
      ] as const) {
        const icon = scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(104).setInteractive();
        icon.on('pointerdown', () => hold(true));
        for (const ev of ['pointerup', 'pointerout', 'pointerupoutside']) icon.on(ev, () => hold(false));
        this.gunIcons.push(icon);
        this.keyHints.push(text(10, '#cfe6f7', true).setText(label));
      }
    }
  }

  /** The screen got a new logical size: move the panels. */
  layout(width: number, height: number): void {
    const l = hudLayout(width, height, this.touch);
    this.l = l;
    const s = l.ship;
    this.compass.place(s.x + 32, s.y + s.h / 2, 26);
    this.speed.setPosition(s.x + 64, s.y + 5);
    this.unit.setPosition(s.x + 112, s.y + 13);
    // Status: just outside my ship panel (above it on a computer, below it on touch).
    this.status.setPosition(s.x + 2, this.touch ? s.y + s.h + 4 : s.y - 15);
    const t = l.target;
    this.targetText.setPosition(t.x + 8, t.y + 4);
    const gn = l.guns;
    this.sideText.port.setPosition(gn.x + 20, gn.y + gn.h / 2);
    this.sideText.starboard.setPosition(gn.x + gn.w - 20, gn.y + gn.h / 2);
    this.elevation.setPosition(gn.x + 80, gn.y + 7);
    this.range.setPosition(gn.x + 80, gn.y + 25);
    this.gunIcons.forEach((icon, i) => icon.setPosition(gn.x + 136, gn.y + 5 + i * (ICON_SIZE + 4)));
    this.keyHints.forEach((hint, i) => hint.setPosition(gn.x + 155, gn.y + 7 + i * (ICON_SIZE + 4)));
    this.debugText.setPosition(l.debugX, l.debugY);
    this.hint.setPosition(l.debugX, l.debugY);
  }

  update(d: HudData): void {
    const { ship, sailing } = d;
    const l = this.l;
    const g = this.g;
    g.clear();

    // --- Plates ---
    for (const r of [l.ship, l.guns, ...(d.target ? [l.target] : [])]) {
      g.fillStyle(0x000000, PANEL_ALPHA);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 6);
    }

    // --- My ship ---
    const s = l.ship;
    this.compass.update({
      headingRad: ship.headingRad,
      windFromRad: d.wind.fromRad,
      windStrength: d.wind.strength,
      noGoDeg: sailing.noGoDeg,
      twaDeg: sailing.twaDeg,
    });
    this.speed.setText(ship.speed.toFixed(1));
    // Sail icon and pips: filled = sails set.
    const px = s.x + 64;
    const py = s.y + 30;
    g.fillStyle(0xf2e8c9, 1);
    g.fillRect(px, py, 1, 12);
    g.fillTriangle(px + 2, py, px + 2, py + 11, px + 10, py + 11);
    const set = Math.round(ship.sailLevel * SAIL_PIPS);
    for (let i = 0; i < SAIL_PIPS; i++) {
      const x = px + 16 + i * 14;
      if (i < set) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x, py + 1, 10, 10);
      } else {
        g.lineStyle(1, 0xffffff, 0.5);
        g.strokeRect(x + 0.5, py + 1.5, 9, 9);
      }
    }
    this.bar(g, { x: px, y: s.y + s.h - 12, w: s.w - 64 - 8, h: 5 }, ship.hull / Math.max(1, d.hullMax));
    const inIrons = sailing.twaDeg < sailing.noGoDeg;
    this.status.setText(ship.aground ? 'AGROUND!' : inIrons ? 'IN IRONS!' : ship.sunk ? 'SUNK!' : '');

    // --- Target ---
    this.targetText.setVisible(d.target !== null);
    if (d.target) {
      const t = l.target;
      const tg = d.target;
      this.targetText.setText(`${tg.shipClass}  ${tg.sunk ? 'SUNK' : `${Math.round(tg.distance)} m`}`);
      this.bar(g, { x: t.x + 8, y: t.y + t.h - 10, w: t.w - 16, h: 5 }, tg.sunk ? 0 : tg.hull / Math.max(1, tg.hullMax));
    }

    // --- Guns ---
    const gn = l.guns;
    this.side(g, 'port', gn.x + 20, gn.y + gn.h / 2, ship.reloadPort, d);
    this.side(g, 'starboard', gn.x + gn.w - 20, gn.y + gn.h / 2, ship.reloadStarboard, d);
    this.gauge(g, gn.x + 46, gn.y + gn.h - 9, 26, ship.elevationDeg);
    this.elevation.setText(`${ship.elevationDeg.toFixed(1)}°`);
    this.range.setText(`${Math.round(d.rangeM)} m`);

    // --- Debug text (H) ---
    this.debugText.setVisible(d.debug).setText(d.debug ? d.debugLines.join('\n') : '');
    this.hint.setVisible(!d.debug).setText(this.touch ? '' : 'H  help & debug');
    if (d.debug) {
      const b = this.debugText.getBounds();
      g.fillStyle(0x000000, PANEL_ALPHA);
      g.fillRoundedRect(b.x - 4, b.y - 3, b.width + 8, b.height + 6, 6);
    }
  }

  /** A hull bar: dark track, coloured fill. */
  private bar(g: Phaser.GameObjects.Graphics, r: Rect, share: number): void {
    const f = Math.max(0, Math.min(1, share));
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(barColour(f), 1);
    g.fillRect(r.x, r.y, Math.round(r.w * f), r.h);
  }

  /**
   * One broadside: a yellow disc with the key when loaded; while reloading, a dark disc
   * whose grey pie fills up, with the seconds left.
   */
  private side(g: Phaser.GameObjects.Graphics, side: Side, x: number, y: number, left: number, d: HudData): void {
    const r = 12;
    const text = this.sideText[side];
    const key = this.touch ? (side === 'port' ? 'L' : 'R') : side === 'port' ? 'Q' : 'E';
    if (left <= 0) {
      g.fillStyle(READY, 1);
      g.fillCircle(x, y, r);
      text.setColor('#1b1b1b').setText(key);
      return;
    }
    const total = SHIP_CLASSES[d.ship.shipClass]?.reloadSeconds ?? left;
    const done = Math.max(0, 1 - left / Math.max(total, left));
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(x, y, r);
    g.fillStyle(0x9aa5ad, 0.8);
    g.beginPath();
    g.slice(x, y, r, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2, false);
    g.fillPath();
    g.lineStyle(1, 0x9aa5ad, 1);
    g.strokeCircle(x, y, r);
    text.setColor('#ffffff').setText(String(Math.ceil(left)));
  }

  /** Elevation gauge: a wedge (0-10 degrees drawn 6x wider) with ticks at 0, 5, 10 degrees and a needle. */
  private gauge(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, elevationDeg: number): void {
    const toAngle = (deg: number): number => -((deg / GUNS.maxElevationDeg) * GAUGE_SPREAD_DEG * Math.PI) / 180;
    // The whole range 0-10 degrees as a faint wedge, the part up to the current angle brighter.
    g.fillStyle(0xffffff, 0.12);
    g.beginPath();
    g.slice(x, y, r, toAngle(GUNS.maxElevationDeg), 0, false);
    g.fillPath();
    g.fillStyle(READY, 0.25);
    g.beginPath();
    g.slice(x, y, r, toAngle(elevationDeg), 0, false);
    g.fillPath();
    g.lineStyle(1, 0xffffff, 0.5);
    for (const deg of [0, 5, 10]) {
      const a = toAngle(deg);
      g.lineBetween(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4), x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    const a = toAngle(elevationDeg);
    g.lineStyle(2, READY, 1);
    g.lineBetween(x, y, x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2));
    g.fillStyle(READY, 1);
    g.fillCircle(x, y, 2);
  }
}

/** The debug lines: keys and every number we used while tuning. */
export function debugLines(info: {
  ship: ShipState;
  sailing: SailingInfo;
  wind: Wind;
  tick: number;
  rangeM: number;
  ballsFired: number;
  hullHits: number;
  gunsPerSide: number;
  viewWidthM: number;
  viewHeightM: number;
  zoom: number;
  logicalWidth: number;
  logicalHeight: number;
  pixelScale: number;
}): string[] {
  const deg = (n: number): string => String(Math.round(n) % 360).padStart(3, '0');
  const bearing = headingRadToBearingDeg(info.ship.headingRad);
  const windFrom = headingRadToBearingDeg(info.wind.fromRad);
  const salvos = info.ballsFired / Math.max(1, info.gunsPerSide);
  // Short lines (at most 38 characters), so the box stays left of the target card.
  return [
    'A / D rudder     W / S sails',
    'Q / E fire port / starboard',
    '+ / - guns up / down',
    'Z / X zoom   M sound   H hide this',
    '',
    `heading ${deg(bearing)} ${compassPoint(bearing)}   sails ${Math.round(info.ship.sailLevel * 100)}%`,
    `speed ${info.ship.speed.toFixed(1)} m/s`,
    `wind from ${deg(windFrom)} ${compassPoint(windFrom)}, strength ${info.wind.strength.toFixed(2)}`,
    `wind angle ${Math.round(info.sailing.twaDeg)}, sail power ${Math.round(info.sailing.share * 100)}%`,
    `guns ${info.ship.elevationDeg.toFixed(1)}/${GUNS.maxElevationDeg} deg -> ${Math.round(info.rangeM)} m`,
    info.ballsFired === 0 ? 'hits: no shots yet' : `hits ${info.hullHits} / ${info.ballsFired} balls`,
    info.ballsFired === 0 ? '' : `   = ${(info.hullHits / salvos).toFixed(2)} per salvo of ${info.gunsPerSide}`,
    `view ${Math.round(info.viewWidthM)} x ${Math.round(info.viewHeightM)} m, zoom x${info.zoom}`,
    `screen ${info.logicalWidth} x ${info.logicalHeight}, pixel x${info.pixelScale}`,
    `tick ${info.tick}`,
  ];
}
