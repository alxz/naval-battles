import Phaser from 'phaser';
import { textStyle } from './text';

/**
 * Touch screens held upright (M3 step 4c): the game needs a wide screen, so it asks you to turn
 * the device sideways and waits (the sea stops) until you do. A phone drawn in pixels, an arrow
 * round it, and two short lines of text, over a dark sea.
 */
export class TurnDevice {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private shown = false;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(200).setVisible(false);
    this.text = scene.add
      .text(0, 0, 'TURN YOUR DEVICE\nSIDEWAYS', { ...textStyle('main', '#ffe066'), align: 'center' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false);
  }

  isShown(): boolean {
    return this.shown;
  }

  /** Show or hide it for this screen size (logical px). */
  update(on: boolean, width: number, height: number): void {
    this.shown = on;
    this.g.setVisible(on);
    this.text.setVisible(on);
    if (!on) return;
    const g = this.g.clear();
    g.fillStyle(0x0b1c2a, 1);
    g.fillRect(0, 0, width, height);
    const cx = Math.round(width / 2);
    const cy = Math.round(height / 2) - 20;
    // The phone lying sideways (the way to hold it), with its screen and a button.
    g.fillStyle(0xcfe6f7, 1);
    g.fillRoundedRect(cx - 28, cy - 16, 56, 32, 5);
    g.fillStyle(0x1d4e6e, 1);
    g.fillRect(cx - 22, cy - 12, 44, 24);
    g.fillStyle(0x0b1c2a, 1);
    g.fillRect(cx + 23, cy - 2, 3, 4);
    // A quarter-circle arrow over it: turn.
    g.lineStyle(2, 0xffe066, 1);
    g.beginPath();
    g.arc(cx, cy, 40, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(300), false);
    g.strokePath();
    const end = { x: cx + 40 * Math.cos(Phaser.Math.DegToRad(300)), y: cy + 40 * Math.sin(Phaser.Math.DegToRad(300)) };
    g.fillStyle(0xffe066, 1);
    g.fillTriangle(end.x + 6, end.y + 1, end.x - 4, end.y - 5, end.x - 1, end.y + 7);
    this.text.setPosition(cx, cy + 50);
  }
}
