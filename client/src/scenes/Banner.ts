import Phaser from 'phaser';
import { textStyle } from './text';
import type { TextKind } from './text';

export type BannerKind = 'win' | 'lose' | 'draw'; // draw: a battle ended with END GAME and no winner (M3 step 7c)

const SHOW_AFTER_SECONDS = 1.5; // let the sinking play out a moment first

/**
 * The end of a duel: a plate in the middle of the screen with
 *   VICTORY! / YOUR SHIP IS LOST
 *   one line about what happened, and the duel in numbers (time, hits)
 *   a "sail again" button (tap / click it, or press Enter)
 * The scene decides when to show it and what "sail again" does.
 */
export class Banner {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly line: Phaser.GameObjects.Text;
  private readonly stats: Phaser.GameObjects.Text;
  private readonly button: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Zone;
  private readonly logButton: Phaser.GameObjects.Text; // M3 step 7d: save the battle log
  private readonly logHit: Phaser.GameObjects.Zone;
  private kind: BannerKind | null = null;
  private wait = 0;
  private width = 640;
  private height = 360;

  constructor(scene: Phaser.Scene, onAgain: () => void, onLog: () => void = () => {}) {
    // Drawn above the HUD; text after the plate (see the note about Text after Graphics in RangeRings.ts).
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(130);
    const text = (kind: TextKind, colour: string): Phaser.GameObjects.Text =>
      scene.add.text(0, 0, '', textStyle(kind, colour)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(131);
    this.title = text('big', '#ffe066');
    this.line = text('main', '#ffffff');
    this.stats = text('main', '#cfe6f7');
    this.button = text('main', '#1b1b1b').setText('SAIL AGAIN');
    this.hit = scene.add.zone(0, 0, 10, 10).setScrollFactor(0).setDepth(132).setInteractive();
    this.hit.on('pointerdown', () => {
      if (this.isShown()) onAgain();
    });
    this.logButton = text('main', '#1b1b1b').setText('SAVE LOG');
    this.logHit = scene.add.zone(0, 0, 10, 10).setScrollFactor(0).setDepth(132).setInteractive();
    this.logHit.on('pointerdown', () => {
      if (this.isShown()) onLog();
    });
    this.hide();
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /** Ask for the banner; it appears after a short pause. Asking again changes nothing. */
  request(kind: BannerKind, line: string, stats: string, title?: string, now = false): void {
    if (this.kind !== null) return;
    this.kind = kind;
    this.wait = now ? 0 : SHOW_AFTER_SECONDS; // END GAME (M3 step 7c): at once
    this.title.setText(title ?? (kind === 'win' ? 'VICTORY!' : kind === 'lose' ? 'YOUR SHIP IS LOST' : 'A DRAW'));
    this.title.setColor(kind === 'win' ? '#ffe066' : kind === 'lose' ? '#ff8070' : '#cfe6f7');
    this.line.setText(line);
    this.stats.setText(stats);
  }

  hide(): void {
    this.kind = null;
    this.g.clear();
    for (const o of [this.title, this.line, this.stats, this.button, this.logButton]) o.setVisible(false);
    this.hit.disableInteractive();
    this.logHit.disableInteractive();
  }

  isShown(): boolean {
    return this.kind !== null && this.wait <= 0;
  }

  update(seconds: number, touch: boolean): void {
    if (this.kind === null) return;
    this.wait -= seconds;
    if (this.wait > 0) return;
    const w = 304;
    const h = 116;
    const x = Math.round(this.width / 2 - w / 2);
    const y = Math.round(this.height / 2 - h / 2 - 20);
    const g = this.g;
    g.clear();
    g.fillStyle(0x000000, 0.72);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, this.kind === 'win' ? 0xffe066 : this.kind === 'lose' ? 0xff8070 : 0xcfe6f7, 0.8);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 10);
    // Two buttons side by side: SAIL AGAIN and (M3 step 7d) SAVE LOG.
    const bw = 168;
    const lw = 96;
    const gap = 8;
    const bh = 20;
    const bx = Math.round(this.width / 2 - (bw + gap + lw) / 2);
    const lx = bx + bw + gap;
    const by = y + h - bh - 12;
    g.fillStyle(0xffe066, 1);
    g.fillRoundedRect(bx, by, bw, bh, 6);
    g.fillStyle(0xcfe6f7, 1);
    g.fillRoundedRect(lx, by, lw, bh, 6);
    const cx = Math.round(this.width / 2);
    this.title.setPosition(cx, y + 14).setVisible(true);
    this.line.setPosition(cx, y + 42).setVisible(true);
    this.stats.setPosition(cx, y + 58).setVisible(true);
    this.button.setText(touch ? 'SAIL AGAIN' : 'SAIL AGAIN (Enter)').setPosition(bx + bw / 2, by + 6).setVisible(true);
    this.hit.setPosition(bx + bw / 2, by + bh / 2).setSize(bw, bh);
    if (!this.hit.input?.enabled) this.hit.setInteractive();
    this.hit.input?.hitArea.setTo(0, 0, bw, bh);
    this.logButton.setPosition(lx + lw / 2, by + 6).setVisible(true);
    this.logHit.setPosition(lx + lw / 2, by + bh / 2).setSize(lw, bh);
    if (!this.logHit.input?.enabled) this.logHit.setInteractive();
    this.logHit.input?.hitArea.setTo(0, 0, lw, bh);
  }
}
