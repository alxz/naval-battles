import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { landingSpread, predictLanding, reloadLeft, sideAngleRad } from '../sim/guns';
import { STEP_SECONDS } from '../sim/step';
import type { ShipParams, ShipState, Side } from '../sim/types';

const ELLIPSE_POINTS = 32;

/**
 * Where each broadside would land now (plan 4.4): a small cross at the aim point and an
 * ellipse around it for the random error. Along the line of fire the ellipse shows the
 * elevation error (long or short); across it the direction error (ahead or behind).
 * At 1 sigma (view.json `landingEllipseSigmas`) about two balls of three stay inside
 * it in each direction. Yellow = loaded, grey = reloading. It includes your own speed.
 */
export class LandingMarkers {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    // Depth 1.2: after the range rings, before the ships, with no text in between
    // (see the note about Text after Graphics in RangeRings.ts).
    this.g = scene.add.graphics().setDepth(1.2);
  }

  update(ship: ShipState, params: ShipParams, s: number, windStrength: number): void {
    const g = this.g;
    g.clear();
    for (const side of ['port', 'starboard'] as Side[]) {
      const p = predictLanding(ship, params, side, STEP_SECONDS);
      const ready = reloadLeft(ship, side) <= 0;
      const colour = ready ? 0xffe066 : 0x9aa5ad;
      const x = p.x * s;
      const y = p.y * s;
      const r = 4 + 2 * s;
      g.lineStyle(2, colour, ready ? 0.95 : 0.6);
      g.lineBetween(x - r, y - r, x + r, y + r);
      g.lineBetween(x - r, y + r, x + r, y - r);

      // The ellipse: its long axis lies along the line of fire.
      const spread = landingSpread(ship, params, side, windStrength, STEP_SECONDS);
      const k = viewJson.landingEllipseSigmas * s;
      const a = spread.alongM * k;
      const b = spread.acrossM * k;
      const out = sideAngleRad(ship.headingRad, side);
      const cos = Math.cos(out);
      const sin = Math.sin(out);
      const points: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < ELLIPSE_POINTS; i++) {
        const t = (i / ELLIPSE_POINTS) * Math.PI * 2;
        const u = Math.cos(t) * a; // along the line of fire
        const v = Math.sin(t) * b; // across it
        points.push(new Phaser.Math.Vector2(x + u * cos - v * sin, y + u * sin + v * cos));
      }
      g.lineStyle(1, colour, ready ? 0.7 : 0.35);
      g.strokePoints(points, true);
    }
  }
}
