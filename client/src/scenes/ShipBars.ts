import { roughHull } from '../sim/perception';
import Phaser from 'phaser';
import { SHIP_CLASSES } from '../sim/data';
import type { ShipState } from '../sim/types';
import { barColour } from '../view/hudLayout';
import { BAR_HEIGHT_PX, shipBar } from '../view/shipBar';
import { paint, textStyle } from './text';
import { sailShare, crewShare } from '../sim/condition';
import { FLAG_COLOURS, FLAGS, NATIONS } from '../view/flags';
import type { Nation } from '../view/flags';
import { BAR_ICONS } from '../view/barIcons';

/** A label over a ship (M3 step 6c: "WANTED: ..." over an offender), or null for none. */
export type ShipLabel = { text: string; colour: string } | null;
const MAX_LABELS = 8;
/** The arena's sails and crew bars are this many pixels high. */
const SMALL_BAR_PX = 2;

/**
 * A small hull bar over every floating ship, so you can see at a glance which enemy is hurt
 * (the bots already know). A picture only: one Graphics, cleared and redrawn every frame, above
 * the ships and below the HUD. Colours as in the HUD (green, yellow, red).
 */
export class ShipBars {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly flags: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(2.5);
    // The flags are drawn once into small pictures (M3 step 6e, speed: before, every pixel of every
    // flag was drawn again in every frame, about 2,900 drawing commands a frame in the arena).
    for (const nation of NATIONS) {
      const key = `flag-${nation}`;
      if (scene.textures.exists(key)) continue;
      const rows = FLAGS[nation];
      const w = (rows[0]?.length ?? 9) + 2;
      const h = rows.length + 2;
      const fg = scene.make.graphics({}, false);
      fg.fillStyle(FLAG_COLOURS['S'] ?? 0, 1).fillRect(0, 0, w, h);
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          const colour = FLAG_COLOURS[row[c] ?? '.'];
          if (colour !== undefined) fg.fillStyle(colour, 1).fillRect(1 + c, 1 + r, 1, 1);
        }
      });
      fg.generateTexture(key, w, h);
      fg.destroy();
    }
    for (let i = 0; i < MAX_LABELS; i++) this.flags.push(scene.add.image(0, 0, `flag-${NATIONS[0]}`).setOrigin(0, 0).setDepth(2.5).setVisible(false));
    for (let i = 0; i < MAX_LABELS; i++) this.labels.push(scene.add.text(0, 0, '', textStyle('small')).setDepth(3).setVisible(false));
  }

  /** `poses[i]` is where ship i is drawn; `hidden(i)` skips a ship (your own, which has its own panel). */
  update(
    ships: readonly ShipState[],
    poses: readonly ({ x: number; y: number; headingRad: number } | undefined)[],
    s: number,
    visible: boolean,
    hidden: (i: number) => boolean,
    label: (i: number) => ShipLabel = () => null,
    flag: (i: number) => Nation | null = () => null,
    detail: (i: number) => 0 | 1 | 2 = () => 1,
    dot: (i: number) => boolean = () => false,
  ): void {
    const g = this.g;
    g.clear();
    // M4b step 3: a ship at the edge of sight (level 1) is only a dark dot.
    ships.forEach((ship, i) => {
      const pose = poses[i];
      if (pose && !ship.sunk && dot(i)) g.fillStyle(0x0b1016, 0.9).fillRect(Math.round(pose.x * s) - 2, Math.round(pose.y * s) - 2, 4, 4);
    });
    // Labels (shown even with the bars switched off): on whole pixels, above the bar's place.
    this.labels.forEach((t, i) => {
      const ship = ships[i];
      const pose = poses[i];
      const params = ship ? SHIP_CLASSES[ship.shipClass] : undefined;
      const look = ship && !ship.sunk ? label(i) : null;
      if (!ship || !pose || !params || !look) {
        t.setVisible(false);
        return;
      }
      const bar = shipBar(params, pose.x, pose.y, pose.headingRad, 1, s);
      paint(t.setVisible(true), look.text, look.colour);
      t.setPosition(Math.round(bar.x + bar.width / 2 - t.width / 2), Math.round(bar.y - 3 - t.height));
    });
    for (const f of this.flags) f.setVisible(false);
    if (!visible) return;
    ships.forEach((ship, i) => {
      const pose = poses[i];
      const params = SHIP_CLASSES[ship.shipClass];
      // M3 step 7d (D41 numbers): 0 = too far to tell, 1 = only the hull bar, 2 = hull, sails and crew.
      const level = detail(i);
      if (!pose || !params || ship.sunk || hidden(i) || level === 0) return;
      // M4b step 5a: from 200-450 m only the overall look of the ship (quarters), as the bots see it.
      const share = level === 1 ? roughHull(ship.hull / params.hullPoints) : ship.hull / params.hullPoints;
      const bar = shipBar(params, pose.x, pose.y, pose.headingRad, share, s);
      g.fillStyle(0x10161c, 0.75).fillRect(bar.x - 1, bar.y - 1, bar.width + 2, BAR_HEIGHT_PX + 2);
      if (bar.filled > 0) g.fillStyle(barColour(share), 1).fillRect(bar.x, bar.y, bar.filled, BAR_HEIGHT_PX);
      if (level === 2) {
        // Close enough to see the rigging and the deck (the arena observer sees it everywhere, D47):
        // sails (canvas) and crew (blue) under the hull bar, half the width each.
        const half = Math.floor((bar.width - 1) / 2);
        const y2 = bar.y + BAR_HEIGHT_PX + 2;
        g.fillStyle(0x10161c, 0.75).fillRect(bar.x - 1, y2 - 1, bar.width + 2, SMALL_BAR_PX + 2);
        const sails = Math.round(half * Math.min(1, Math.max(0, sailShare(ship))));
        const crew = Math.round(half * Math.min(1, Math.max(0, crewShare(ship))));
        if (sails > 0) g.fillStyle(BAR_ICONS.sails.colour, 1).fillRect(bar.x, y2, sails, SMALL_BAR_PX);
        if (crew > 0) g.fillStyle(BAR_ICONS.crew.colour, 1).fillRect(bar.x + bar.width - half, y2, crew, SMALL_BAR_PX);
      }
      // The ship's flag to the left of the bars.
      const nation = flag(i);
      if (!nation) return;
      const rows = FLAGS[nation];
      const fx = bar.x - (rows[0]?.length ?? 9) - 4;
      const fy = bar.y - 3; // the 8-pixel flag stands beside the bars (M3 step 7a)
      this.flags[i]?.setTexture(`flag-${nation}`).setPosition(fx - 1, fy - 1).setVisible(true);
    });
  }
}
