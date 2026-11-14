import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { TEXT_RESOLUTION } from './text';

/**
 * Distance rings around your ship (100, 150, 200 m) and a light preview of the
 * broadside arcs (±25° from each beam). Only a picture for the scale test:
 * it shows how much of the gun range fits on the screen.
 */
export class RangeRings {
  visible = true;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1);
    this.labels = viewJson.rangeRings.map((r) =>
      scene.add
        .text(0, 0, `${r} m`, { fontFamily: 'monospace', fontSize: '9px', color: '#d8ecff', resolution: TEXT_RESOLUTION })
        .setOrigin(0.5, 1)
        .setAlpha(0.8)
        // Above the ships. (Text drawn right after a Graphics and before a ship broke the
        // ship's picture in our headless test with Phaser 4.2.1, so we keep this order.)
        .setDepth(3),
    );
  }

  /** x, y in game metres; s = screen pixels per metre. */
  update(x: number, y: number, heading: number, s: number): void {
    const g = this.g;
    g.clear();
    for (const label of this.labels) label.setVisible(this.visible);
    if (!this.visible) return;

    const px = x * s;
    const py = y * s;
    const rings = viewJson.rangeRings;
    const maxRange = Math.max(...rings);

    // Broadside arcs, port and starboard.
    const arc = (viewJson.fireArcPreviewDeg * Math.PI) / 180;
    g.fillStyle(0xffe08a, 0.1);
    for (const side of [Math.PI / 2, -Math.PI / 2]) {
      const centre = heading + side;
      g.beginPath();
      g.slice(px, py, maxRange * s, centre - arc, centre + arc, false);
      g.fillPath();
    }

    // The rings, with their distance written on top.
    g.lineStyle(1, 0xd8ecff, 0.45);
    rings.forEach((r, i) => {
      g.strokeCircle(px, py, r * s);
      this.labels[i]?.setPosition(px, py - r * s - 1);
    });
  }
}
