import { PORTS } from '../sim/port';
import Phaser from 'phaser';
import { compassPoint, headingRadToBearingDeg } from '../sim/angles';
import { ISLANDS, WORLD } from '../sim/data';
import { bounds } from '../sim/geometry';
import type { ShipState, Wind } from '../sim/types';
import { chartFit, isKnown, toChart } from '../view/chart';
import type { ChartState } from '../view/chart';
import { textStyle } from './text';

const PAPER = 0xe6d5a8;
const PAPER_EDGE = 0x5a4326;
const SEA = 0xd9dcc0;
const INK = 0x5a4326;
const LAND = 0xb99a5b;
const REEF = 0x9a8a68;
const GRID_METRES = 1000;
const NAME_MIN_METRES = 300; // only islands at least this wide get their name written

/**
 * The chart: a sea map on parchment, opened and closed with C or the chart button.
 * It shows what you have seen (view/chart.ts): the reef round the sea, the islands you have
 * discovered, your ship (yellow arrow), and the other ships where you saw them last: red
 * while they are on your screen, pale with a "?" once they have sailed out of sight.
 * The game goes on while the chart is open.
 */
export class Chart {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly foot: Phaser.GameObjects.Text;
  private readonly windText: Phaser.GameObjects.Text;
  private readonly scaleText: Phaser.GameObjects.Text;
  private readonly names: Phaser.GameObjects.Text[];
  private readonly marks: Phaser.GameObjects.Text[] = [];
  private readonly closeZone: Phaser.GameObjects.Zone;
  private readonly scene: Phaser.Scene;
  private open = false;
  private width = 640;
  private height = 360;
  private top = 14; // the paper starts below the small buttons, so they stay visible

  constructor(scene: Phaser.Scene, touch: boolean, onClose: () => void) {
    this.scene = scene;
    // Above the HUD and the touch buttons (100-111), below the end-of-duel banner (130).
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(120);
    const text = (colour: string): Phaser.GameObjects.Text => scene.add.text(0, 0, '', textStyle('small', colour)).setScrollFactor(0).setDepth(122);
    this.title = scene.add.text(0, 0, 'CHART', textStyle('main', '#5a4326')).setScrollFactor(0).setDepth(122);
    this.foot = text('#5a4326').setText(touch ? 'tap the chart to close' : 'C or click: close');
    this.windText = text('#5a4326');
    this.scaleText = text('#5a4326').setText('1 km');
    this.names = ISLANDS.map((island) => text('#3d2c17').setText(island.kind === 'reef' ? '' : island.name).setOrigin(0.5, 0.5));
    // A click or tap anywhere on the chart closes it (the chart button stays on top and works too).
    this.closeZone = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setScrollFactor(0).setDepth(121).setInteractive();
    this.closeZone.on('pointerdown', () => {
      if (this.open) onClose();
    });
    this.setOpen(false);
  }

  /** `top`: the first free pixel row under the sound and chart buttons. */
  layout(width: number, height: number, top: number): void {
    this.width = width;
    this.height = height;
    this.top = top;
  }

  isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.g.clear();
    for (const t of [this.title, this.foot, this.windText, this.scaleText, ...this.names, ...this.marks]) t.setVisible(false);
    if (open) this.closeZone.setInteractive();
    else this.closeZone.disableInteractive();
  }

  update(state: ChartState, me: ShipState, wind: Wind): void {
    if (!this.open) return;
    const g = this.g;
    g.clear();
    const margin = 14;
    const paper = { x: margin, y: this.top, w: this.width - 2 * margin, h: this.height - this.top - margin };
    this.closeZone.setPosition(paper.x, paper.y).setSize(paper.w, paper.h);
    this.closeZone.input?.hitArea.setTo(0, 0, paper.w, paper.h);
    g.fillStyle(PAPER, 0.96);
    g.fillRoundedRect(paper.x, paper.y, paper.w, paper.h, 6);
    g.lineStyle(2, PAPER_EDGE, 1);
    g.strokeRoundedRect(paper.x + 1, paper.y + 1, paper.w - 2, paper.h - 2, 6);

    // The sea, fitted into the paper with room for the title above and the notes below.
    const fit = chartFit(WORLD, { x: paper.x + 8, y: paper.y + 20, w: paper.w - 16, h: paper.h - 38 });
    const at = (p: { x: number; y: number }): { x: number; y: number } => toChart(fit, WORLD, p);
    const nw = at({ x: WORLD.minX, y: WORLD.minY });
    const se = at({ x: WORLD.maxX, y: WORLD.maxY });
    g.fillStyle(SEA, 1);
    g.fillRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    g.lineStyle(1, INK, 0.18);
    for (let x = Math.ceil(WORLD.minX / GRID_METRES) * GRID_METRES; x < WORLD.maxX; x += GRID_METRES) g.lineBetween(at({ x, y: 0 }).x, nw.y, at({ x, y: 0 }).x, se.y);
    for (let y = Math.ceil(WORLD.minY / GRID_METRES) * GRID_METRES; y < WORLD.maxY; y += GRID_METRES) g.lineBetween(nw.x, at({ x: 0, y }).y, se.x, at({ x: 0, y }).y);

    // Land: the reef, and the islands you have seen.
    ISLANDS.forEach((island, i) => {
      const name = this.names[i];
      const known = isKnown(state, island);
      name?.setVisible(false);
      if (!known) return;
      const points = island.points.map((p) => {
        const c = at(p);
        return new Phaser.Math.Vector2(c.x, c.y);
      });
      g.fillStyle(island.kind === 'reef' ? REEF : LAND, 1);
      g.fillPoints(points, true);
      if (island.kind === 'reef') return;
      g.lineStyle(1, INK, 0.9);
      g.strokePoints(points, true, true);
      const b = bounds(island.points);
      if (name && b.maxX - b.minX >= NAME_MIN_METRES) {
        const c = at({ x: (b.minX + b.maxX) / 2, y: b.maxY });
        name.setPosition(Math.round(c.x), Math.round(c.y) + 6).setVisible(true);
      }
    });

    // The port (every captain knows where it is): an anchor-red square in a white ring.
    for (const port of PORTS) {
      const c = at(port);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(Math.round(c.x), Math.round(c.y), 4);
      g.lineStyle(1, INK, 1);
      g.strokeCircle(Math.round(c.x), Math.round(c.y), 4);
      g.fillStyle(0xc0392b, 1);
      g.fillRect(Math.round(c.x) - 2, Math.round(c.y) - 2, 4, 4);
    }

    // The other ships, where you saw them last.
    state.sightings.forEach((s, i) => {
      const c = at(s);
      const colour = s.sunk ? 0x6b6b6b : 0xc0392b;
      this.arrow(g, c.x, c.y, s.headingRad, 4, colour, s.inSight ? 1 : 0.4);
      let mark = this.marks[i];
      if (!mark) {
        mark = this.scene.add.text(0, 0, '', textStyle('small', '#8a2a20')).setScrollFactor(0).setDepth(122);
        this.marks[i] = mark;
      }
      mark.setText(s.sunk ? 'sunk' : s.inSight ? '' : '?').setPosition(Math.round(c.x) - 3, Math.round(c.y) - 14).setVisible(true);
    });
    for (let i = state.sightings.length; i < this.marks.length; i++) this.marks[i]?.setVisible(false);

    // Your ship: a yellow arrow with a dark edge.
    const mine = at(me);
    this.arrow(g, mine.x, mine.y, me.headingRad, 6, 0x3d2c17, 1);
    this.arrow(g, mine.x, mine.y, me.headingRad, 4, 0xffc21a, 1);

    // Notes: title, wind, scale bar, how to close.
    this.title.setPosition(paper.x + 8, paper.y + 7).setVisible(true);
    const from = headingRadToBearingDeg(wind.fromRad);
    this.windText.setText(`wind from ${compassPoint(from)}`).setVisible(true);
    this.windText.setPosition(paper.x + paper.w - 8 - this.windText.width, paper.y + 7);
    const barX = paper.x + 8;
    const barY = paper.y + paper.h - 9;
    const km = 1000 * fit.scale;
    g.lineStyle(1, INK, 1);
    g.lineBetween(barX, barY, barX + km, barY);
    g.lineBetween(barX, barY - 2, barX, barY + 2);
    g.lineBetween(barX + km, barY - 2, barX + km, barY + 2);
    this.scaleText.setPosition(Math.round(barX + km + 4), barY - 5).setVisible(true);
    this.foot.setVisible(true);
    this.foot.setPosition(paper.x + paper.w - 8 - this.foot.width, paper.y + paper.h - 14);
  }

  /** A small arrow head pointing along `headingRad`. */
  private arrow(g: Phaser.GameObjects.Graphics, x: number, y: number, headingRad: number, size: number, colour: number, alpha: number): void {
    const cos = Math.cos(headingRad);
    const sin = Math.sin(headingRad);
    g.fillStyle(colour, alpha);
    g.fillTriangle(
      x + cos * size * 1.6, y + sin * size * 1.6,
      x - cos * size + sin * size * 0.9, y - sin * size - cos * size * 0.9,
      x - cos * size - sin * size * 0.9, y - sin * size + cos * size * 0.9,
    );
  }
}
