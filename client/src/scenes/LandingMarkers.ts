import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { gunsOn, landingSpread, predictLanding, reloadLeft, sideAngleRad } from '../sim/guns';
import { turnAbout } from '../view/chaserAim';
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
  /** Ghost crosses: where a broadside was aimed when it was fired. They fade while the balls fly. */
  private readonly ghosts: { x: number; y: number; age: number; life: number }[] = [];

  constructor(scene: Phaser.Scene) {
    // Depth 1.2: after the range rings, before the ships, with no text in between
    // (see the note about Text after Graphics in RangeRings.ts).
    this.g = scene.add.graphics().setDepth(1.2);
  }

  /** Leave a ghost cross at (x, y) metres for `seconds` (the flight time plus a moment). */
  addGhost(x: number, y: number, seconds: number): void {
    this.ghosts.push({ x, y, age: 0, life: seconds });
  }

  update(ship: ShipState, params: ShipParams, s: number, windStrength: number, dt: number, bowTrainDeg = 0): void {
    const g = this.g;
    g.clear();
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const ghost = this.ghosts[i]!;
      ghost.age += dt;
      if (ghost.age >= ghost.life) {
        this.ghosts.splice(i, 1);
        continue;
      }
      const r = 3 + 2 * s;
      const x = ghost.x * s;
      const y = ghost.y * s;
      g.lineStyle(1, 0xffffff, 0.5 * (1 - ghost.age / ghost.life));
      g.lineBetween(x - r, y - r, x + r, y + r);
      g.lineBetween(x - r, y + r, x + r, y - r);
    }
    // M3 step 7c: the bow chaser: a small diamond where its ball would land (trained on a ship in its arc).
    if (gunsOn(params, 'bow') > 0) {
      const p = turnAbout(ship, predictLanding(ship, params, 'bow', STEP_SECONDS), bowTrainDeg);
      const ready = reloadLeft(ship, 'bow') <= 0;
      const x = p.x * s;
      const y = p.y * s;
      const r = 3 + 1.5 * s;
      g.lineStyle(2, ready ? 0xffe066 : 0x9aa5ad, ready ? 0.9 : 0.5);
      g.strokePoints([new Phaser.Math.Vector2(x, y - r), new Phaser.Math.Vector2(x + r, y), new Phaser.Math.Vector2(x, y + r), new Phaser.Math.Vector2(x - r, y)], true);
    }
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
