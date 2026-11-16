import Phaser from 'phaser';
import { edgeMarker } from '../view/edgeMarker';
import type { Rect } from '../view/hudLayout';
import { textStyle } from './text';

const MARGIN = 14; // pixels from the screen edge
const POOL = 8;

/** A ship to point at: its screen position (pixels) and its distance from you (metres). */
export interface Contact {
  screenX: number;
  screenY: number;
  distance: number;
}

/**
 * Red triangles at the screen edge for ships you cannot see, with their distance.
 * Drawn in screen space (they do not move with the camera).
 */
export class EdgeMarkers {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(90);
    for (let i = 0; i < POOL; i++) {
      this.labels.push(
        scene.add
          .text(0, 0, '', textStyle('small'))
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(91)
          .setVisible(false),
      );
    }
  }

  /** `avoid`: HUD panels; a distance that would be written on one of them is left out (the triangle stays). */
  update(contacts: readonly Contact[], width: number, height: number, avoid: readonly Rect[] = []): void {
    const g = this.g;
    g.clear();
    this.labels.forEach((l) => l.setVisible(false));

    let used = 0;
    for (const c of contacts) {
      const m = edgeMarker(c.screenX, c.screenY, width, height, MARGIN);
      if (!m || used >= POOL) continue;
      const cos = Math.cos(m.angle);
      const sin = Math.sin(m.angle);
      // A triangle pointing toward the ship.
      const tip = { x: m.x + cos * 8, y: m.y + sin * 8 };
      const left = { x: m.x - sin * 6, y: m.y + cos * 6 };
      const right = { x: m.x + sin * 6, y: m.y - cos * 6 };
      g.fillStyle(0xe04a3a, 0.9);
      g.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);

      // The distance, a little inside the screen from the triangle.
      const label = this.labels[used];
      const lx = m.x - cos * 16;
      const ly = m.y - sin * 12;
      const hidden = avoid.some((r) => lx > r.x - 22 && lx < r.x + r.w + 22 && ly > r.y - 6 && ly < r.y + r.h + 6);
      label
        ?.setText(`${Math.round(c.distance)} m`)
        .setPosition(lx, ly)
        .setVisible(!hidden);
      used += 1;
    }
  }
}
