import Phaser from 'phaser';
import type { ShipState } from '../sim/types';

const SAIL_PIPS = 4; // the sails go 0, 25, 50, 75, 100 %

/**
 * The numbers on the screen.
 *  - On a computer: small text with all the details.
 *  - On a phone or tablet: a big panel with a large speed number and sail pips.
 *    Fewer words, larger shapes: you read it with a quick glance.
 */
export class Hud {
  private readonly touch: boolean;
  private readonly text: Phaser.GameObjects.Text;
  private readonly speed: Phaser.GameObjects.Text | null = null;
  private readonly unit: Phaser.GameObjects.Text | null = null;
  private readonly gfx: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, touch: boolean) {
    this.touch = touch;

    if (touch) {
      this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(100);
      this.speed = scene.add
        .text(16, 12, '0.0', { fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#ffffff', resolution: 3 })
        .setScrollFactor(0)
        .setDepth(101);
      this.unit = scene.add
        .text(80, 26, 'm/s', { fontFamily: 'monospace', fontSize: '14px', color: '#cfe6f7', resolution: 3 })
        .setScrollFactor(0)
        .setDepth(101);
      this.text = scene.add.text(0, 0, '').setVisible(false);
    } else {
      this.text = scene.add
        .text(8, 8, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', resolution: 2 })
        .setScrollFactor(0)
        .setDepth(100);
    }
  }

  update(ship: ShipState, tick: number): void {
    if (this.touch) {
      this.updateTouch(ship);
      return;
    }
    const degrees = ((ship.heading * 180) / Math.PI + 360) % 360;
    this.text.setText(
      [
        'Naval-Battles M1 - sailing',
        'A / D rudder   W / S sails   Z / X zoom',
        `sails ${Math.round(ship.sailLevel * 100)}%   speed ${ship.speed.toFixed(1)} m/s`,
        `heading ${degrees.toFixed(0)} deg   tick ${tick}`,
      ].join('\n'),
    );
  }

  private updateTouch(ship: ShipState): void {
    const g = this.gfx;
    if (!g || !this.speed || !this.unit) return;
    this.speed.setText(ship.speed.toFixed(1));

    g.clear();
    // Dark panel behind the numbers.
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(8, 8, 118, 68, 8);

    // Sail icon: a small triangle sail on a mast.
    g.fillStyle(0xf2e8c9, 1);
    g.fillRect(21, 46, 2, 22);
    g.fillTriangle(25, 46, 25, 66, 41, 66);

    // Sail pips: filled = sails set.
    const set = Math.round(ship.sailLevel * SAIL_PIPS);
    for (let i = 0; i < SAIL_PIPS; i++) {
      const x = 50 + i * 17;
      if (i < set) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x, 48, 13, 18);
      } else {
        g.lineStyle(2, 0xffffff, 0.5);
        g.strokeRect(x + 1, 49, 11, 16);
      }
    }
  }
}
