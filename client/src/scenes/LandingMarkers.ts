import Phaser from 'phaser';
import { predictLanding, reloadLeft } from '../sim/guns';
import { STEP_SECONDS } from '../sim/step';
import type { ShipParams, ShipState, Side } from '../sim/types';

/**
 * A small cross on the water where each broadside would land now (plan 4.4).
 * Yellow = loaded, grey = reloading. It already includes your own speed.
 * (The ellipse for the random error comes with accuracy in a later step.)
 */
export class LandingMarkers {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    // Depth 1.2: after the range rings, before the ships, with no text in between
    // (see the note about Text after Graphics in RangeRings.ts).
    this.g = scene.add.graphics().setDepth(1.2);
  }

  update(ship: ShipState, params: ShipParams, s: number): void {
    const g = this.g;
    g.clear();
    for (const side of ['port', 'starboard'] as Side[]) {
      const p = predictLanding(ship, params, side, STEP_SECONDS);
      const ready = reloadLeft(ship, side) <= 0;
      const x = p.x * s;
      const y = p.y * s;
      const r = 4 + 2 * s;
      g.lineStyle(2, ready ? 0xffe066 : 0x9aa5ad, ready ? 0.95 : 0.6);
      g.lineBetween(x - r, y - r, x + r, y + r);
      g.lineBetween(x - r, y + r, x + r, y - r);
    }
  }
}
