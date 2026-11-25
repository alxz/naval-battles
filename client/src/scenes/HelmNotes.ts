import type Phaser from 'phaser';
import { paint, textStyle } from './text';

/** Two lines next to my ship panel: the autopilot (D73) and the bosun (24 Nov). Words from view/helmNotes.ts. */
export class HelmNotes {
  private readonly auto: Phaser.GameObjects.Text;
  private readonly bosun: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.auto = scene.add.text(0, 0, '', textStyle('small', '#9fe870')).setScrollFactor(0).setDepth(104);
    this.bosun = scene.add.text(0, 0, '', textStyle('small', '#ffd27a')).setScrollFactor(0).setDepth(104);
    this.auto.setShadow(1, 1, '#000000', 0, false, true);
    this.bosun.setShadow(1, 1, '#000000', 0, false, true);
  }

  /** `at`: the AUTO line. `bosunAt`: the bosun's line, its middle at x when `centred` (a phone: bottom middle), else above AUTO. */
  update(auto: string, bosun: string, at: { x: number; y: number }, bosunAt?: { x: number; y: number }): void {
    paint(this.auto.setVisible(auto !== ''), auto).setPosition(at.x, at.y);
    paint(this.bosun.setVisible(bosun !== ''), bosun);
    if (bosunAt) this.bosun.setAlign('center').setOrigin(0.5, 0).setPosition(Math.round(bosunAt.x), bosunAt.y);
    else this.bosun.setAlign('left').setOrigin(0, 0).setPosition(at.x, at.y - (auto !== '' ? 10 : 0));
  }
}
