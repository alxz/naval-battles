import { reloadSecondsOf } from '../sim/guns';
import Phaser from 'phaser';
import { compassPoint, headingRadToBearingDeg } from '../sim/angles';
import { GUNS } from '../sim/data';
import type { SailingInfo } from '../sim/step';
import type { ShipState, Side, Wind } from '../sim/types';
import { TARGET_CARD_RANGE_TOUCH, barColour, hudLayout, panelCovers } from '../view/hudLayout';
import type { HudLayout, Rect } from '../view/hudLayout';
import { Compass } from './Compass';
import { ICON_SIZE } from './icons';
import { BAR_ICONS, barIconHeight, barIconPixels, barIconWidth } from '../view/barIcons';
import type { BarIconName } from '../view/barIcons';
import { textStyle } from './text';
import type { TextKind } from './text';

const SAIL_PIPS = 4; // the sails go 0, 25, 50, 75, 100 %
const PANEL_ALPHA = 0.55; // dark plates on a computer
const PANEL_ALPHA_TOUCH = 0.34;
const TARGET_ALPHA_TOUCH = 0.12; // the target card on touch screens: lighter still // lighter on phones and tablets, where the sea is smaller
const COVERED_ALPHA = 0.25; // a panel with a ship under it becomes this see-through
const FADE_PER_SECOND = 6; // how fast it fades in and out
const GAUGE_SPREAD_DEG = 60; // the gauge draws 0-10 degrees of elevation as 0-60 degrees, so it is easy to see
const READY = 0xffe066;
const SAILS_COLOUR = 0xf2e8c9; // canvas
const CREW_COLOUR = 0x8fd3ff;

/** What the HUD shows about the target (null = no target). */
export interface TargetInfo {
  shipClass: string;
  distance: number; // metres
  hull: number;
  hullMax: number;
  sunk: boolean;
  repairing: boolean;
  sailShare: number; // 0..1 (M3 step 4)
  crewShare: number; // 0..1
}

/** Everything the HUD needs in one frame. */
export interface HudData {
  ship: ShipState;
  hullMax: number;
  sailShare: number; // my sails 0..1 (M3 step 4)
  crewShare: number; // my crew 0..1
  ammoLabel: string; // the loaded kind of shot (computer: above the guns panel)
  sailing: SailingInfo;
  wind: Wind;
  rangeM: number; // where the guns land now (lying still), metres from the ship
  target: TargetInfo | null;
  debug: boolean; // show the debug text
  debugLines: string[];
  soundOn: boolean;
  autoZoomOn: boolean; // the automatic combat zoom (its button shows on / off)
  spyglassOn: boolean; // looking through the spyglass (its icon is lit)
  minimapOn: boolean; // on touch screens the minimap sits where the chart button is
  repairSeaShare: number; // repair at sea mends up to this share of the hull (a tick on the bar)
  repairPortShare: number; // a port mends up to this share (a second tick); 0 = the sea has no port
  safeWater: boolean; // my ship is in the safe water of a port
  /** Port law: 'inside' = I am an offender within reach of the shore guns; 'outside' = out of reach, waiting for the pardon. */
  offender: 'no' | 'inside' | 'outside';
  pardonSeconds: number; // seconds until the pardon (when 'outside')
  ships: { x: number; y: number }[]; // ship centres on the screen (logical px): panels over them fade
  seconds: number; // since the last frame
}

type PanelName = 'ship' | 'target' | 'guns';

/**
 * The HUD (heads-up display): three small panels on dark plates, so they can be read
 * over the moving sea. Places come from `hudLayout` (view/hudLayout.ts).
 *   my ship:  compass, speed, sail pips, hull bar (and IN IRONS / AGROUND when it happens)
 *   target:   class, distance, hull bar
 *   guns:     computer: port and starboard (yellow = loaded; a grey pie fills while reloading),
 *             an elevation gauge with the angle and the range, and the gun up / down icons with
 *             their keys (+ and -), which can be clicked;
 *             touch: only the angle and the range, next to the gun buttons (the fire buttons show the reload)
 * On touch screens the target card shows only in a fight (enemy within TARGET_CARD_RANGE_TOUCH).
 * The debug text (all the numbers, keys) shows with H on a computer or the panel switch.
 * A sound button (speaker icon) shows whether the sound is on; click or tap it to switch.
 * A chart button (map icon) opens and closes the sea chart (scenes/Chart.ts).
 * When a ship passes under a panel, the panel fades to see-through, so it never hides a ship.
 * Text uses the pixel fonts of text.ts, on whole pixels.
 */
export class Hud {
  /** True while the mouse holds a gun icon (computer). */
  raise = false;
  lower = false;
  private readonly touch: boolean;
  /** One Graphics per panel, so a whole panel can fade. */
  private readonly gfx: Record<PanelName | 'debug' | 'sound', Phaser.GameObjects.Graphics>;
  private readonly fade: Record<PanelName, number> = { ship: 1, target: 1, guns: 1 };
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
  private readonly soundIcon: Phaser.GameObjects.Image;
  private readonly chartIcon: Phaser.GameObjects.Image;
  private readonly spyglassIcon: Phaser.GameObjects.Image;
  private readonly autoZoomIcon: Phaser.GameObjects.Image;
  private readonly debugText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly ammoText: Phaser.GameObjects.Text;
  private l: HudLayout = hudLayout(640, 360, false);

  constructor(
    scene: Phaser.Scene,
    touch: boolean,
    onToggleSound: () => void,
    onToggleChart: () => void,
    onToggleSpyglass: () => void,
    onToggleAutoZoom: () => void,
  ) {
    this.touch = touch;
    // Order matters (see the note about Text after Graphics in RangeRings.ts): the plates
    // and bars first, then the compass, then all text and icons on top.
    const graphics = (): Phaser.GameObjects.Graphics => scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.gfx = { ship: graphics(), target: graphics(), guns: graphics(), debug: graphics(), sound: graphics() };
    this.compass = new Compass(scene);
    const text = (kind: TextKind, colour = '#ffffff'): Phaser.GameObjects.Text =>
      scene.add.text(0, 0, '', textStyle(kind, colour)).setScrollFactor(0).setDepth(104);
    this.speed = text('big');
    this.unit = text('small', '#cfe6f7').setText('m/s');
    this.status = text('main', '#ff8070');
    this.targetText = text('main');
    this.elevation = text('main');
    this.range = text('main', '#cfe6f7');
    this.sideText = { port: text('main', '#1b1b1b').setOrigin(0.5), starboard: text('main', '#1b1b1b').setOrigin(0.5) };
    this.debugText = text('small');
    this.ammoText = text('small', '#ffe9a8').setOrigin(0.5, 1);
    this.hint = text('small', '#cfe6f7').setAlpha(0.75);

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
        this.keyHints.push(text('main', '#cfe6f7').setText(label));
      }
    }
    this.soundIcon = scene.add.image(0, 0, 'icon-sound-on').setScrollFactor(0).setDepth(104).setInteractive();
    this.soundIcon.on('pointerdown', () => onToggleSound());
    // Depth 126: above the open chart (120-122), so the same button closes it.
    this.chartIcon = scene.add.image(0, 0, 'icon-chart').setScrollFactor(0).setDepth(126).setInteractive();
    this.chartIcon.on('pointerdown', () => onToggleChart());
    // The spyglass: an icon on a computer (touch screens have their own button for it).
    this.spyglassIcon = scene.add.image(0, 0, 'icon-spyglass').setScrollFactor(0).setDepth(104).setInteractive().setVisible(!touch);
    this.spyglassIcon.on('pointerdown', () => onToggleSpyglass());
    this.autoZoomIcon = scene.add.image(0, 0, 'icon-autozoom-on').setScrollFactor(0).setDepth(104).setInteractive();
    this.autoZoomIcon.on('pointerdown', () => onToggleAutoZoom());
  }

  /** The screen got a new logical size: move the panels. */
  layout(width: number, height: number): void {
    const l = hudLayout(width, height, this.touch);
    this.l = l;
    const s = l.ship;
    if (l.compact) {
      // Phone: a small compass and the speed in the 8 px font.
      this.compass.place(s.x + 22, s.y + s.h / 2, 18);
      this.speed.setStyle(textStyle('main')).setPosition(s.x + 46, s.y + 5);
    } else {
      this.compass.place(s.x + 32, s.y + s.h / 2, 26);
      this.speed.setStyle(textStyle('big')).setPosition(s.x + 64, s.y + 7);
    }
    const t = l.target;
    // Status: just outside the panels (above my ship on a computer, below the target card on touch).
    this.status.setPosition(s.x + 2, this.touch ? t.y + t.h + 5 : s.y - 14);
    if (this.touch) this.targetText.setStyle(textStyle('small')).setPosition(t.x + 6, t.y + 3);
    else this.targetText.setPosition(t.x + 8, t.y + 6);
    const gn = l.guns;
    this.sideText.port.setPosition(gn.x + 20, gn.y + gn.h / 2).setVisible(!this.touch);
    this.sideText.starboard.setPosition(gn.x + gn.w - 20, gn.y + gn.h / 2).setVisible(!this.touch);
    if (this.touch) {
      // Two short lines, right-aligned to the edge of the button column.
      this.elevation.setOrigin(1, 0).setPosition(gn.x + gn.w - 3, gn.y + 4);
      this.range.setOrigin(1, 0).setPosition(gn.x + gn.w - 3, gn.y + 15);
    } else {
      this.elevation.setPosition(gn.x + 80, gn.y + 11);
      this.range.setPosition(gn.x + 80, gn.y + 27);
    }
    this.gunIcons.forEach((icon, i) => icon.setPosition(gn.x + 136, gn.y + 5 + i * (ICON_SIZE + 4)));
    // Computer: the loaded shot just above the guns panel (touch screens have a button for it).
    this.ammoText.setPosition(gn.x + gn.w / 2, gn.y - 3).setVisible(!this.touch);
    this.keyHints.forEach((hint, i) => hint.setPosition(gn.x + 157, gn.y + 9 + i * (ICON_SIZE + 4)));
    const so = l.sound;
    this.soundIcon.setPosition(so.x + so.w / 2, so.y + so.h / 2).setScale(Math.max(1, Math.floor((so.w * 0.8) / ICON_SIZE)));
    this.debugText.setPosition(l.debugX, l.debugY);
    const ch = l.chart;
    this.chartIcon.setPosition(ch.x + ch.w / 2, ch.y + ch.h / 2).setScale(Math.max(1, Math.floor((ch.w * 0.8) / ICON_SIZE)));
    const place = (icon: Phaser.GameObjects.Image, r: { x: number; y: number; w: number; h: number }): void => {
      icon.setPosition(r.x + r.w / 2, r.y + r.h / 2).setScale(Math.max(1, Math.floor((r.w * 0.8) / ICON_SIZE)));
    };
    place(this.spyglassIcon, l.spyglass);
    place(this.autoZoomIcon, l.autoZoom);
    this.hint.setPosition(l.autoZoom.x + l.autoZoom.w + 6, ch.y + 4);
  }

  update(d: HudData): void {
    const { ship, sailing } = d;
    const l = this.l;
    // Touch: far enemies get no card (the red arrows at the screen edge tell the distance).
    const target = d.target && this.touch && !d.target.sunk && d.target.distance > TARGET_CARD_RANGE_TOUCH ? null : d.target;
    for (const g of Object.values(this.gfx)) g.clear();
    const plate = this.touch ? PANEL_ALPHA_TOUCH : PANEL_ALPHA;

    // --- See-through panels: fade a panel smoothly while a ship is under it. ---
    const step = Math.min(1, d.seconds * FADE_PER_SECOND);
    for (const name of ['ship', 'target', 'guns'] as PanelName[]) {
      const goal = panelCovers(l[name], d.ships) ? COVERED_ALPHA : 1;
      this.fade[name] += (goal - this.fade[name]) * step;
      this.gfx[name].setAlpha(this.fade[name]);
    }
    this.compass.setAlpha(this.fade.ship);
    for (const t of [this.speed, this.unit]) t.setAlpha(this.fade.ship);
    this.targetText.setAlpha(this.fade.target);
    for (const t of [this.elevation, this.range, this.sideText.port, this.sideText.starboard, ...this.keyHints, ...this.gunIcons]) t.setAlpha(this.fade.guns);

    // --- Plates ---
    const panels: PanelName[] = target ? ['ship', 'guns', 'target'] : ['ship', 'guns'];
    for (const name of panels) {
      const r = l[name];
      this.gfx[name].fillStyle(0x000000, this.touch && name === 'target' ? TARGET_ALPHA_TOUCH : plate);
      this.gfx[name].fillRoundedRect(r.x, r.y, r.w, r.h, 6);
    }

    // --- My ship ---
    const s = l.ship;
    const gs = this.gfx.ship;
    this.compass.update({
      headingRad: ship.headingRad,
      windFromRad: d.wind.fromRad,
      windStrength: d.wind.strength,
      noGoDeg: sailing.noGoDeg,
      twaDeg: sailing.twaDeg,
    });
    this.speed.setText(ship.speed.toFixed(1));
    const c = l.compact;
    this.unit.setPosition(this.speed.x + this.speed.width + 4, s.y + (c ? 6 : 15));
    // Sail icon and pips: filled = sails set. (Phone: smaller.)
    const px = s.x + (c ? 46 : 64);
    const py = s.y + (c ? 17 : 30);
    const pip = c ? 7 : 10;
    gs.fillStyle(0xf2e8c9, 1);
    gs.fillRect(px, py, 1, pip + 2);
    gs.fillTriangle(px + 2, py, px + 2, py + pip + 1, px + pip, py + pip + 1);
    const set = Math.round(ship.sailLevel * SAIL_PIPS);
    for (let i = 0; i < SAIL_PIPS; i++) {
      const x = px + pip + 6 + i * (pip + 4);
      if (i < set) {
        gs.fillStyle(0xffffff, 1);
        gs.fillRect(x, py + 1, pip, pip);
      } else {
        gs.lineStyle(1, 0xffffff, 0.5);
        gs.strokeRect(x + 0.5, py + 1.5, pip - 1, pip - 1);
      }
    }
    // A small hull icon in front of the hull bar (M3 step 4b), so each bar says what it is.
    const hullRow = { x: px, y: s.y + s.h - (c ? 10 : 12), w: s.w - (c ? 46 : 64) - 8, h: c ? 4 : 5 };
    const hullBar = this.withIcon(gs, 'hull', hullRow);
    this.bar(gs, hullBar, ship.hull / Math.max(1, d.hullMax));
    // A tick at the share that repair at sea can reach.
    gs.fillStyle(0xffffff, 0.9);
    gs.fillRect(hullBar.x + Math.round(hullBar.w * d.repairSeaShare), hullBar.y - 2, 1, hullBar.h + 4);
    if (d.repairPortShare > 0) gs.fillRect(hullBar.x + Math.round(hullBar.w * d.repairPortShare), hullBar.y - 2, 1, hullBar.h + 4);
    // Above the hull bar, two short bars side by side: sails (canvas) and crew (blue) (M3 step 4).
    this.conditionBars(gs, { x: hullRow.x, y: hullRow.y - (c ? 5 : 7), w: hullRow.w, h: c ? 2 : 3 }, d.sailShare, d.crewShare);
    const inIrons = sailing.twaDeg < sailing.noGoDeg;
    const law = d.offender === 'inside' ? 'OFFENDER!' : d.offender === 'outside' ? `PARDON ${Math.ceil(d.pardonSeconds)}s` : '';
    const status = ship.sunk ? 'SUNK!' : ship.aground ? 'AGROUND!' : law !== '' ? law : ship.repairing ? 'REPAIRING' : d.safeWater ? 'SAFE WATER' : inIrons ? 'IN IRONS!' : '';
    const colour = status === 'REPAIRING' || status === 'SAFE WATER' ? '#7be07a' : d.offender === 'outside' && status === law ? '#ffd24a' : '#ff8070';
    this.status.setText(status).setColor(colour);

    // --- Target ---
    this.targetText.setVisible(target !== null);
    if (target) {
      const t = l.target;
      const tg = target;
      // "+" after the distance: its crew is repairing.
      this.targetText.setText(`${tg.shipClass}  ${tg.sunk ? 'SUNK' : `${Math.round(tg.distance)} m${tg.repairing ? ' +' : ''}`}`);
      const pad = this.touch ? 6 : 8;
      const row = { x: t.x + pad, y: t.y + t.h - (this.touch ? 8 : 11), w: t.w - 2 * pad, h: this.touch ? 3 : 5 };
      const hb = this.withIcon(this.gfx.target, 'hull', row);
      this.bar(this.gfx.target, hb, tg.sunk ? 0 : tg.hull / Math.max(1, tg.hullMax));
      if (!tg.sunk) this.conditionBars(this.gfx.target, { x: row.x, y: row.y + row.h + 2, w: row.w, h: this.touch ? 1 : 2 }, tg.sailShare, tg.crewShare);
    }

    // --- Guns ---
    const gn = l.guns;
    const gg = this.gfx.guns;
    if (!this.touch) {
      this.side(gg, 'port', gn.x + 20, gn.y + gn.h / 2, ship.reloadPort, d);
      this.side(gg, 'starboard', gn.x + gn.w - 20, gn.y + gn.h / 2, ship.reloadStarboard, d);
      this.gauge(gg, gn.x + 46, gn.y + gn.h - 9, 26, ship.elevationDeg);
    }
    this.elevation.setText(`${ship.elevationDeg.toFixed(1)}°`);
    this.ammoText.setText(`${d.ammoLabel}   1 2 3`).setAlpha(this.fade.guns);
    this.range.setText(`${Math.round(d.rangeM)} m`);

    // --- Sound button: a plate on touch screens (like the other buttons), the icon shows on / off. ---
    this.soundIcon.setTexture(d.soundOn ? 'icon-sound-on' : 'icon-sound-off');
    this.autoZoomIcon.setTexture(d.autoZoomOn ? 'icon-autozoom-on' : 'icon-autozoom-off');
    this.spyglassIcon.setAlpha(d.spyglassOn ? 1 : 0.85).setTint(d.spyglassOn ? 0xffe066 : 0xffffff);
    const mapOnButton = this.touch && d.minimapOn; // the minimap takes the chart button's place
    this.chartIcon.setVisible(!mapOnButton);
    if (this.touch) {
      for (const b of mapOnButton ? [l.sound, l.autoZoom] : [l.sound, l.autoZoom, l.chart]) {
        // (the chart button is in the minimap's place, bottom right)
        this.gfx.sound.fillStyle(0xffffff, 0.22);
        this.gfx.sound.fillRect(b.x, b.y, b.w, b.h);
        this.gfx.sound.lineStyle(1, 0xffffff, 0.6);
        this.gfx.sound.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      }
    }

    // --- Debug text (H) ---
    this.debugText.setVisible(d.debug).setText(d.debug ? d.debugLines.join('\n') : '');
    this.hint.setVisible(!d.debug && !this.touch).setText('C chart   V spyglass   H help');
    if (d.debug) {
      const b = this.debugText.getBounds();
      this.gfx.debug.fillStyle(0x000000, plate);
      this.gfx.debug.fillRoundedRect(b.x - 4, b.y - 3, b.width + 8, b.height + 6, 6);
    }
  }

  /** Sails (canvas colour) and crew (blue): two half-width bars on one line, each with its icon in front. */
  private conditionBars(g: Phaser.GameObjects.Graphics, r: Rect, sails: number, crew: number): void {
    const half = Math.floor((r.w - 3) / 2);
    for (const [x, share, colour, icon] of [
      [r.x, sails, SAILS_COLOUR, 'sails'],
      [r.x + half + 3, crew, CREW_COLOUR, 'crew'],
    ] as const) {
      const b = this.withIcon(g, icon, { x, y: r.y, w: half, h: r.h });
      const f = Math.max(0, Math.min(1, share));
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle(f > 0.25 ? colour : 0xe0533d, 1);
      g.fillRect(b.x, b.y, Math.round(b.w * f), b.h);
    }
  }

  /**
   * Draw a tiny icon (view/barIcons.ts) at the left end of a bar's row, centred on the bar's height,
   * and return the room left for the bar itself (M3 step 4b).
   */
  private withIcon(g: Phaser.GameObjects.Graphics, name: BarIconName, r: Rect): Rect {
    const top = Math.round(r.y + r.h / 2 - barIconHeight(name) / 2);
    g.fillStyle(BAR_ICONS[name].colour, 1);
    for (const p of barIconPixels(name)) g.fillRect(r.x + p.x, top + p.y, 1, 1);
    const room = barIconWidth(name) + 2;
    return { x: r.x + room, y: r.y, w: Math.max(1, r.w - room), h: r.h };
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
    const total = reloadSecondsOf(d.ship);
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
    'Z / X zoom   M sound   C chart',
    'H hide this',
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
