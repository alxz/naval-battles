import { PORTS } from '../sim/port';
import Phaser from 'phaser';
import { ISLANDS, WORLD } from '../sim/data';
import type { ShipState } from '../sim/types';
import { chartFit, isKnown, toChart } from '../view/chart';
import type { ChartState } from '../view/chart';
import { hudLayout, panelCovers } from '../view/hudLayout';
import type { Rect } from '../view/hudLayout';

const COVERED_ALPHA = 0.25;

/**
 * The minimap: the whole sea in a small box, always on the screen (it can be switched off
 * in the tuning panel). It shows the same knowledge as the chart (view/chart.ts): the reef,
 * the islands you have seen, your ship (yellow, with a short line for its heading) and the
 * other ships where you saw them last (red, pale when out of sight).
 * Computer: bottom right. Touch screens: bottom right too, above the "sails less" button.
 * A click or tap on it opens the big chart. Like the HUD panels it fades when a ship is under it.
 */
export class Minimap {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly touch: boolean;
  private home: Rect = { x: 0, y: 0, w: 132, h: 88 };
  private box: Rect = { x: 0, y: 0, w: 132, h: 88 };
  private guns: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private alpha = 1;

  constructor(scene: Phaser.Scene, touch: boolean, onTap: () => void) {
    this.touch = touch;
    // Depth 126 like the chart button: it stays on top of the open chart and closes it again.
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(touch ? 126 : 105);
    this.zone = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setScrollFactor(0).setDepth(127).setInteractive();
    this.zone.on('pointerdown', () => onTap());
  }

  layout(width: number, height: number): void {
    const hud = hudLayout(width, height, this.touch);
    this.home = hud.minimap;
    this.guns = hud.guns;
    this.place(0);
  }

  /** Computer: the open tuning panel covers the right edge, so the minimap moves left of it. */
  private place(coveredRightPx: number): void {
    const shift = this.touch || coveredRightPx <= 0 ? 0 : Math.ceil(coveredRightPx);
    const x = Math.max(0, this.home.x - shift);
    // Pushed onto the guns panel (a narrow window)? Then it sits just above that panel.
    const y = shift > 0 && x < this.guns.x + this.guns.w + 4 ? this.guns.y - this.home.h - 4 : this.home.y;
    if (x === this.box.x && y === this.box.y && this.home.w === this.box.w) return;
    this.box = { ...this.home, x, y };
    this.zone.setPosition(this.box.x, this.box.y).setSize(this.box.w, this.box.h);
    this.zone.input?.hitArea.setTo(0, 0, this.box.w, this.box.h);
  }

  update(visible: boolean, state: ChartState, me: ShipState, shipsOnScreen: readonly { x: number; y: number }[], seconds: number, coveredRightPx = 0): void {
    this.place(coveredRightPx);
    const g = this.g;
    g.clear();
    if (visible) this.zone.setInteractive();
    else this.zone.disableInteractive();
    if (!visible) return;
    const b = this.box;
    const goal = panelCovers(b, shipsOnScreen) ? COVERED_ALPHA : 1;
    this.alpha += (goal - this.alpha) * Math.min(1, seconds * 6);
    g.setAlpha(this.alpha);

    // No plate: only a faint tint and a thin frame, so the sea and ships show through.
    const fit = chartFit(WORLD, { x: b.x, y: b.y, w: b.w, h: b.h });
    const at = (p: { x: number; y: number }): { x: number; y: number } => toChart(fit, WORLD, p);
    const nw = at({ x: WORLD.minX, y: WORLD.minY });
    const se = at({ x: WORLD.maxX, y: WORLD.maxY });
    g.fillStyle(0x0b2a44, 0.22);
    g.fillRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    g.lineStyle(1, 0xcfe6f7, 0.7); // the reef: the frame of the sea
    g.strokeRect(nw.x + 0.5, nw.y + 0.5, se.x - nw.x - 1, se.y - nw.y - 1);

    // Islands you have seen. Small ones are at least one pixel, so they do not vanish.
    g.fillStyle(0xe8d29a, 0.9);
    for (const island of ISLANDS) {
      if (island.kind === 'reef' || !isKnown(state, island)) continue;
      const points = island.points.map((p) => {
        const c = at(p);
        return new Phaser.Math.Vector2(c.x, c.y);
      });
      g.fillPoints(points, true);
      const first = points[0];
      if (first) g.fillRect(Math.round(first.x), Math.round(first.y), 1, 1);
    }

    // The port: a white dot with a red middle.
    for (const port of PORTS) {
      const c = at(port);
      g.fillStyle(0xffffff, 1);
      g.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, 3, 3);
      g.fillStyle(0xe0533d, 1);
      g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1);
    }

    // Other ships where you saw them last.
    for (const s of state.sightings) {
      if (s.sunk) continue;
      const c = at(s);
      g.fillStyle(0xff5040, s.inSight ? 1 : 0.45);
      g.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, 3, 3);
    }

    // You: a yellow dot and a short line where the bow points.
    const c = at(me);
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    g.lineStyle(1, 0xffe066, 1);
    g.lineBetween(x + 0.5, y + 0.5, x + 0.5 + Math.cos(me.headingRad) * 5, y + 0.5 + Math.sin(me.headingRad) * 5);
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 2, y - 2, 5, 5);
    g.fillStyle(0xffe066, 1);
    g.fillRect(x - 1, y - 1, 3, 3);
  }
}
