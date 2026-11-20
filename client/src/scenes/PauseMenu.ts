import Phaser from 'phaser';
import { textStyle } from './text';

/**
 * The pause window (M3 step 7c): ESC on a computer, the "II" button on a touch screen.
 *   PAUSED
 *   the statistics (the scene gives the lines: the battle's ships, or the arena table)
 *   RESUME   SAVE LOG   END GAME
 * The scene stops the simulation while it is open and decides what the buttons do.
 */
export class PauseMenu {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly blocker: Phaser.GameObjects.Zone; // eats taps on the sea behind the window
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly buttons: { text: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Zone }[] = [];
  private shown = false;
  private width = 640;
  private height = 360;

  constructor(scene: Phaser.Scene, onResume: () => void, onSave: () => void, onEnd: () => void) {
    // Above the HUD and the banner; the texts after the plate (see the note about Text after Graphics in RangeRings.ts).
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(140);
    this.blocker = scene.add.zone(0, 0, 10, 10).setOrigin(0).setScrollFactor(0).setDepth(140);
    this.title = scene.add.text(0, 0, 'PAUSED', textStyle('big', '#ffe066')).setOrigin(0.5, 0).setScrollFactor(0).setDepth(141);
    this.body = scene.add.text(0, 0, '', { ...textStyle('main', '#cfe6f7'), lineSpacing: 4 }).setScrollFactor(0).setDepth(141);
    for (const [label, action] of [
      ['RESUME', onResume],
      ['SAVE LOG', onSave],
      ['END GAME', onEnd],
    ] as const) {
      const text = scene.add.text(0, 0, label, textStyle('main', '#1b1b1b')).setOrigin(0.5).setScrollFactor(0).setDepth(142);
      const hit = scene.add.zone(0, 0, 10, 10).setScrollFactor(0).setDepth(142);
      hit.on('pointerdown', () => {
        if (this.shown) action();
      });
      this.buttons.push({ text, hit });
    }
    this.hide();
  }

  isShown(): boolean {
    return this.shown;
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.shown) this.draw();
  }

  /** Open the window (or refresh its lines while it is open). */
  show(lines: readonly string[], touch: boolean): void {
    this.shown = true;
    // Capitals: the canvas joins a lower-case "fl" into one letter (fluyt), which breaks the columns.
    this.body.setText(lines.join('\n').toUpperCase());
    this.buttons[0]?.text.setText(touch ? 'RESUME' : 'RESUME (ESC)');
    this.draw();
  }

  hide(): void {
    this.shown = false;
    this.g.clear().setVisible(false);
    this.blocker.disableInteractive();
    for (const o of [this.title, this.body]) o.setVisible(false);
    for (const b of this.buttons) {
      b.text.setVisible(false);
      b.hit.disableInteractive();
    }
  }

  private draw(): void {
    const w = this.width;
    const h = this.height;
    const bh = 20;
    const gap = 8;
    const bws = this.buttons.map((b) => Math.round(b.text.width) + 16);
    const rowW = bws.reduce((a, b) => a + b, 0) + gap * (bws.length - 1);
    const panelW = Math.min(w - 8, Math.max(rowW, Math.round(this.body.width)) + 24);
    const panelH = Math.min(h - 8, 40 + Math.round(this.body.height) + 12 + bh + 12);
    const px = Math.round(w / 2 - panelW / 2);
    const py = Math.round(h / 2 - panelH / 2);
    const g = this.g.clear().setVisible(true);
    g.fillStyle(0x000000, 0.45);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0x0d2233, 0.92);
    g.fillRoundedRect(px, py, panelW, panelH, 8);
    g.lineStyle(1, 0xffe066, 0.8);
    g.strokeRoundedRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1, 8);
    this.blocker.setPosition(0, 0).setSize(w, h);
    if (!this.blocker.input?.enabled) this.blocker.setInteractive();
    this.blocker.input?.hitArea.setTo(0, 0, w, h);
    this.title.setPosition(Math.round(w / 2), py + 12).setVisible(true);
    this.body.setPosition(px + 12, py + 40).setVisible(true);
    // The buttons in a row along the bottom of the window.
    let x = Math.round(w / 2 - rowW / 2);
    const y = py + panelH - bh - 12;
    this.buttons.forEach((b, i) => {
      const bw = bws[i] ?? 80;
      g.fillStyle(i === 0 ? 0xffe066 : i === 1 ? 0xcfe6f7 : 0xff9d8a, 1);
      g.fillRoundedRect(x, y, bw, bh, 6);
      b.text.setPosition(x + bw / 2, y + bh / 2 + 1).setVisible(true);
      b.hit.setPosition(x + bw / 2, y + bh / 2).setSize(bw, bh);
      if (!b.hit.input?.enabled) b.hit.setInteractive();
      b.hit.input?.hitArea.setTo(0, 0, bw, bh);
      x += bw + gap;
    });
  }
}
