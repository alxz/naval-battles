import Phaser from 'phaser';
import { TEXT_RESOLUTION } from './text';

export type BannerKind = 'win' | 'lose';

const SHOW_AFTER_SECONDS = 1.5; // let the sinking play out a moment first

/**
 * The end of a duel: a plate in the middle of the screen with
 *   VICTORY! / YOUR SHIP IS LOST
 *   one line about what happened
 *   a "sail again" button (tap / click it, or press Enter)
 * The scene decides when to show it and what "sail again" does.
 */
export class Banner {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly line: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Zone;
  private kind: BannerKind | null = null;
  private wait = 0;
  private width = 640;
  private height = 360;

  constructor(scene: Phaser.Scene, onAgain: () => void) {
    // Drawn above the HUD; text after the plate (see the note about Text after Graphics in RangeRings.ts).
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(130);
    const text = (size: number, colour: string): Phaser.GameObjects.Text =>
      scene.add
        .text(0, 0, '', { fontFamily: 'monospace', fontSize: `${size}px`, fontStyle: 'bold', color: colour, resolution: TEXT_RESOLUTION })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(131);
    this.title = text(22, '#ffe066');
    this.line = text(10, '#ffffff');
    this.button = text(11, '#1b1b1b').setText('SAIL AGAIN');
    this.hit = scene.add.zone(0, 0, 10, 10).setScrollFactor(0).setDepth(132).setInteractive();
    this.hit.on('pointerdown', () => {
      if (this.isShown()) onAgain();
    });
    this.hide();
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Ask for the banner; it appears after a short pause. Asking again changes nothing. */
  request(kind: BannerKind, line: string): void {
    if (this.kind !== null) return;
    this.kind = kind;
    this.wait = SHOW_AFTER_SECONDS;
    this.title.setText(kind === 'win' ? 'VICTORY!' : 'YOUR SHIP IS LOST');
    this.title.setColor(kind === 'win' ? '#ffe066' : '#ff8070');
    this.line.setText(line);
  }

  hide(): void {
    this.kind = null;
    this.g.clear();
    for (const o of [this.title, this.line, this.button]) o.setVisible(false);
    this.hit.disableInteractive();
  }

  isShown(): boolean {
    return this.kind !== null && this.wait <= 0;
  }

  update(seconds: number, touch: boolean): void {
    if (this.kind === null) return;
    this.wait -= seconds;
    if (this.wait > 0) return;
    const w = 240;
    const h = 100;
    const x = Math.round(this.width / 2 - w / 2);
    const y = Math.round(this.height / 2 - h / 2 - 20);
    const g = this.g;
    g.clear();
    g.fillStyle(0x000000, 0.72);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, this.kind === 'win' ? 0xffe066 : 0xff8070, 0.8);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 10);
    const bw = 150;
    const bh = 22;
    const bx = Math.round(this.width / 2 - bw / 2);
    const by = y + h - bh - 12;
    g.fillStyle(0xffe066, 1);
    g.fillRoundedRect(bx, by, bw, bh, 6);
    this.title.setPosition(this.width / 2, y + 24).setVisible(true);
    this.line.setPosition(this.width / 2, y + 46).setVisible(true);
    this.button.setText(touch ? 'SAIL AGAIN' : 'SAIL AGAIN (Enter)').setPosition(this.width / 2, by + bh / 2).setVisible(true);
    this.hit.setPosition(bx + bw / 2, by + bh / 2).setSize(bw, bh);
    if (!this.hit.input?.enabled) this.hit.setInteractive();
    this.hit.input?.hitArea.setTo(0, 0, bw, bh);
  }
}
