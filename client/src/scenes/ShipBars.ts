import Phaser from 'phaser';
import { SHIP_CLASSES } from '../sim/data';
import type { ShipState } from '../sim/types';
import { barColour } from '../view/hudLayout';
import { BAR_HEIGHT_PX, shipBar } from '../view/shipBar';

/**
 * A small hull bar over every floating ship, so you can see at a glance which enemy is hurt
 * (the bots already know). A picture only: one Graphics, cleared and redrawn every frame, above
 * the ships and below the HUD. Colours as in the HUD (green, yellow, red).
 */
export class ShipBars {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(2.5);
  }

  /** `poses[i]` is where ship i is drawn; `hidden(i)` skips a ship (your own, which has its own panel). */
  update(ships: readonly ShipState[], poses: readonly ({ x: number; y: number; headingRad: number } | undefined)[], s: number, visible: boolean, hidden: (i: number) => boolean): void {
    const g = this.g;
    g.clear();
    if (!visible) return;
    ships.forEach((ship, i) => {
      const pose = poses[i];
      const params = SHIP_CLASSES[ship.shipClass];
      if (!pose || !params || ship.sunk || hidden(i)) return;
      const share = ship.hull / params.hullPoints;
      const bar = shipBar(params, pose.x, pose.y, pose.headingRad, share, s);
      g.fillStyle(0x10161c, 0.75).fillRect(bar.x - 1, bar.y - 1, bar.width + 2, BAR_HEIGHT_PX + 2);
      if (bar.filled > 0) g.fillStyle(barColour(share), 1).fillRect(bar.x, bar.y, bar.filled, BAR_HEIGHT_PX);
    });
  }
}
