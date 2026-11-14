import Phaser from 'phaser';
import { TEXT_RESOLUTION } from './text';

/** What the compass shows. All angles in sim radians/degrees as named. */
export interface CompassInfo {
  headingRad: number;
  windFromRad: number;
  windStrength: number; // 0..1
  noGoDeg: number; // half-width of the no-go zone around the wind
  twaDeg: number;
}

/**
 * A small compass rose in a screen corner (north is up, like the sea):
 *  - red wedge: the no-go zone, where the sails give no drive;
 *  - blue arrow: the wind, blowing from one side across the rose (longer = stronger);
 *  - white needle: your heading. It turns red when it points into the no-go zone.
 */
export class Compass {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly north: Phaser.GameObjects.Text;
  private cx = 0;
  private cy = 0;
  private r = 30;

  constructor(scene: Phaser.Scene) {
    // Created last and drawn on top of everything, text after the graphics:
    // see the note about Text after Graphics in RangeRings.ts.
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(102);
    this.north = scene.add
      .text(0, 0, 'N', { fontFamily: 'monospace', fontSize: '9px', color: '#ffffff', resolution: TEXT_RESOLUTION })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(103);
  }

  /** Computer: bottom left corner (the tuning panel is on the right). Phone: right side, between the panel title and the buttons. */
  layout(width: number, height: number, phone: boolean): void {
    this.r = phone ? 26 : 30;
    this.cx = phone ? width - this.r - 12 : this.r + 14;
    this.cy = phone ? Math.round(height * 0.42) : height - this.r - 14;
    this.north.setPosition(this.cx, this.cy - this.r - 1);
  }

  update(info: CompassInfo): void {
    const { cx, cy, r } = this;
    const g = this.g;
    g.clear();

    // Background and ring.
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(cx, cy, r + 2);
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeCircle(cx, cy, r);
    g.lineBetween(cx, cy - r, cx, cy - r + 5); // north tick

    // No-go zone around the direction the wind comes from.
    const noGo = (info.noGoDeg * Math.PI) / 180;
    g.fillStyle(0xe04a3a, 0.35);
    g.beginPath();
    g.slice(cx, cy, r, info.windFromRad - noGo, info.windFromRad + noGo, false);
    g.fillPath();

    // Wind arrow: from the windward edge across the rose, head on the downwind side.
    const len = r * (0.5 + 0.4 * info.windStrength);
    const fx = Math.cos(info.windFromRad);
    const fy = Math.sin(info.windFromRad);
    const tailX = cx + fx * len;
    const tailY = cy + fy * len;
    const headX = cx - fx * len;
    const headY = cy - fy * len;
    g.lineStyle(2, 0x8fd3ff, 1);
    g.lineBetween(tailX, tailY, headX, headY);
    g.fillStyle(0x8fd3ff, 1);
    g.fillTriangle(headX - fx * 5, headY - fy * 5, headX + fy * 4, headY - fx * 4, headX - fy * 4, headY + fx * 4);

    // Heading needle with a small bow triangle.
    const inIrons = info.twaDeg < info.noGoDeg;
    const colour = inIrons ? 0xff5040 : 0xffffff;
    const hx = Math.cos(info.headingRad);
    const hy = Math.sin(info.headingRad);
    const tipX = cx + hx * (r - 3);
    const tipY = cy + hy * (r - 3);
    g.lineStyle(2, colour, 1);
    g.lineBetween(cx - hx * 8, cy - hy * 8, tipX, tipY);
    g.fillStyle(colour, 1);
    g.fillTriangle(tipX + hx * 2, tipY + hy * 2, tipX - hx * 6 + hy * 4, tipY - hy * 6 - hx * 4, tipX - hx * 6 - hy * 4, tipY - hy * 6 + hx * 4);
    g.fillCircle(cx, cy, 2);
  }
}
