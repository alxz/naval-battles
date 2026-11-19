import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { textStyle } from './text';

/**
 * Distance rings around your ship (100, 150, 200 m) and a light preview of the
 * broadside arcs (±25° from each beam). Only a picture for the scale test:
 * it shows how much of the gun range fits on the screen.
 */
export class RangeRings {
  visible = true;
  /** The distances written at the rings (off on touch screens: less to read on a small screen). */
  labelsVisible = true;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1);
    this.labels = viewJson.rangeRings.map((r) =>
      scene.add
        .text(0, 0, `${r} m`, textStyle('small', '#d8ecff'))
        .setOrigin(1, 1)
        .setAlpha(viewJson.rangeRingLabelAlpha)
        // Above the ships. (Text drawn right after a Graphics and before a ship broke the
        // ship's picture in our headless test with Phaser 4.2.1, so we keep this order.)
        .setDepth(3),
    );
  }

  /** x, y in game metres; s = screen pixels per metre. */
  update(x: number, y: number, headingRad: number, s: number): void {
    const g = this.g;
    for (const label of this.labels) label.setVisible(this.visible && this.labelsVisible);
    g.setVisible(this.visible);
    if (!this.visible) return;

    const px = x * s;
    const py = y * s;
    const rings = viewJson.rangeRings;
    // M3 step 6e (speed): the rings and arcs are drawn once round (0, 0) for heading 0, and drawn
    // again only when the zoom changes; every frame the picture is only moved and turned.
    if (this.drawnScale !== s) {
      this.drawnScale = s;
      g.clear();
      const maxRange = Math.max(...rings);
      // Broadside arcs, port and starboard.
      const arc = (viewJson.fireArcPreviewDeg * Math.PI) / 180;
      g.fillStyle(0xffe08a, viewJson.fireArcAlpha);
      for (const side of [Math.PI / 2, -Math.PI / 2]) {
        g.beginPath();
        g.slice(0, 0, maxRange * s, side - arc, side + arc, false);
        g.fillPath();
      }
      // The rings. Fainter since M3 step 6b (your test: the rings were too strong over the ships).
      g.lineStyle(1, 0xd8ecff, viewJson.rangeRingAlpha);
      for (const r of rings) g.strokeCircle(0, 0, r * s);
    }
    g.setPosition(px, py).setRotation(headingRad);
    // Their distance written at the upper left (the top centre holds the target card).
    const diag = Math.SQRT1_2;
    rings.forEach((r, i) => this.labels[i]?.setPosition(px - r * s * diag - 1, py - r * s * diag - 1));
  }

  /** The zoom the rings were last drawn for (NaN: not drawn yet). */
  private drawnScale = Number.NaN;
}
