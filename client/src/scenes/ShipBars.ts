import Phaser from 'phaser';
import { SHIP_CLASSES } from '../sim/data';
import type { ShipState } from '../sim/types';
import { barColour } from '../view/hudLayout';
import { BAR_HEIGHT_PX, shipBar } from '../view/shipBar';
import { textStyle } from './text';
import { sailShare, crewShare } from '../sim/condition';
import { FLAG_COLOURS, FLAGS } from '../view/flags';
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

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(2.5);
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
  ): void {
    const g = this.g;
    g.clear();
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
      t.setVisible(true).setText(look.text).setColor(look.colour);
      t.setPosition(Math.round(bar.x + bar.width / 2 - t.width / 2), Math.round(bar.y - 3 - t.height));
    });
    if (!visible) return;
    ships.forEach((ship, i) => {
      const pose = poses[i];
      const params = SHIP_CLASSES[ship.shipClass];
      if (!pose || !params || ship.sunk || hidden(i)) return;
      const share = ship.hull / params.hullPoints;
      const bar = shipBar(params, pose.x, pose.y, pose.headingRad, share, s);
      g.fillStyle(0x10161c, 0.75).fillRect(bar.x - 1, bar.y - 1, bar.width + 2, BAR_HEIGHT_PX + 2);
      if (bar.filled > 0) g.fillStyle(barColour(share), 1).fillRect(bar.x, bar.y, bar.filled, BAR_HEIGHT_PX);
      const nation = flag(i);
      if (!nation) return;
      // The arena (D47): the observer sees everything. Sails (canvas) and crew (blue) under the hull
      // bar, half the width each, and the ship's flag to the left of the bars.
      const half = Math.floor((bar.width - 1) / 2);
      const y2 = bar.y + BAR_HEIGHT_PX + 2;
      g.fillStyle(0x10161c, 0.75).fillRect(bar.x - 1, y2 - 1, bar.width + 2, SMALL_BAR_PX + 2);
      const sails = Math.round(half * Math.min(1, Math.max(0, sailShare(ship))));
      const crew = Math.round(half * Math.min(1, Math.max(0, crewShare(ship))));
      if (sails > 0) g.fillStyle(BAR_ICONS.sails.colour, 1).fillRect(bar.x, y2, sails, SMALL_BAR_PX);
      if (crew > 0) g.fillStyle(BAR_ICONS.crew.colour, 1).fillRect(bar.x + bar.width - half, y2, crew, SMALL_BAR_PX);
      const rows = FLAGS[nation];
      const fx = bar.x - (rows[0]?.length ?? 9) - 4;
      const fy = bar.y - 1;
      g.fillStyle(FLAG_COLOURS['S'] ?? 0, 1).fillRect(fx - 1, fy - 1, (rows[0]?.length ?? 9) + 2, rows.length + 2);
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          const colour = FLAG_COLOURS[row[c] ?? '.'];
          if (colour !== undefined) g.fillStyle(colour, 1).fillRect(fx + c, fy + r, 1, 1);
        }
      });
    });
  }
}
