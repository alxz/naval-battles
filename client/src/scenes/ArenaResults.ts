import Phaser from 'phaser';
import type { ResultRow } from '../view/arenaResults';
import { showShip } from './ShipArt';
import type { ArtChoice } from './ShipArt';
import { textStyle } from './text';
import type { TextKind } from './text';

const PODIUM = 3;
const PLACE_COLOURS = ['#ffd84a', '#d8dde3', '#d9935a']; // gold, silver, bronze

/**
 * The arena's results (M3 step 4c): opened by LEAVE (and once when the arena reaches peace).
 * The best three bots side by side, each with a picture of its ship, its place (I, II, III),
 * name, class, wins and losses and how well it shot; the others in a short table below.
 * Buttons: EXIT (back to a normal battle) and BACK (keep watching).
 */
export class ArenaResults {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly places: Phaser.GameObjects.Text[] = [];
  private readonly names: Phaser.GameObjects.Text[] = [];
  private readonly ships: Phaser.GameObjects.Image[] = [];
  private readonly rest: Phaser.GameObjects.Text;
  private readonly exit: Phaser.GameObjects.Text;
  private readonly back: Phaser.GameObjects.Text;
  private readonly blocker: Phaser.GameObjects.Zone;
  private shown = false;
  private width = 640;
  private height = 360;

  constructor(scene: Phaser.Scene, onExit: () => void, onBack: () => void) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(140);
    // Catches taps on the dim background, so they do not reach the sea or the arena buttons.
    this.blocker = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setScrollFactor(0).setDepth(140).setInteractive();
    this.blocker.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
    const text = (kind: TextKind, colour: string): Phaser.GameObjects.Text =>
      scene.add.text(0, 0, '', textStyle(kind, colour)).setOrigin(0.5, 0).setScrollFactor(0).setDepth(142);
    this.title = text('big', '#ffe066').setText('ARENA RESULTS');
    this.sub = text('small', '#cfe6f7');
    for (let i = 0; i < PODIUM; i++) {
      this.places.push(text('big', PLACE_COLOURS[i] ?? '#ffffff'));
      this.names.push(text('small', '#ffffff').setAlign('center'));
      this.ships.push(scene.add.image(0, 0, '__DEFAULT').setScrollFactor(0).setDepth(141));
    }
    this.rest = text('small', '#cfe6f7').setAlign('left').setOrigin(0.5, 0);
    const button = (label: string, action: () => void): Phaser.GameObjects.Text => {
      const t = scene.add
        .text(0, 0, label, { ...textStyle('main', '#1b1b1b'), backgroundColor: '#ffe066', padding: { x: 6, y: 4 } })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(143)
        .setInteractive();
      t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        action();
      });
      return t;
    };
    this.exit = button('EXIT', onExit);
    this.back = button('BACK', onBack);
    this.hide();
  }

  isShown(): boolean {
    return this.shown;
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  hide(): void {
    this.shown = false;
    for (const o of [this.g, this.title, this.sub, this.rest, this.exit, this.back, ...this.places, ...this.names, ...this.ships]) o.setVisible(false);
    this.blocker.setVisible(false).disableInteractive();
  }

  /** Show the results. `art`: the ship pictures in use (0 = boxes). */
  show(rows: readonly ResultRow[], line: string, art: ArtChoice): void {
    this.shown = true;
    const w = this.width;
    const h = this.height;
    const compact = h < 300; // a phone
    const panelW = Math.min(w - 16, 420);
    const panelH = Math.min(h - 16, compact ? 220 : 300);
    const px = Math.round(w / 2 - panelW / 2);
    const py = Math.round(h / 2 - panelH / 2);
    this.g.clear().setVisible(true);
    this.g.fillStyle(0x000000, 0.55);
    this.g.fillRect(0, 0, w, h);
    this.g.fillStyle(0x0d2233, 0.94);
    this.g.fillRoundedRect(px, py, panelW, panelH, 8);
    this.g.lineStyle(1, 0xffe066, 0.8);
    this.g.strokeRoundedRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1, 8);
    this.blocker.setPosition(0, 0).setSize(w, h).setVisible(true).setInteractive();

    this.title.setVisible(true).setStyle(textStyle(compact ? 'main' : 'big', '#ffe066')).setPosition(w / 2, py + 8);
    this.sub.setVisible(true).setText(line).setPosition(w / 2, py + (compact ? 22 : 32));

    // The podium: second, first, third from left to right (the winner in the middle, a little higher).
    const colW = Math.floor(panelW / PODIUM);
    const order = [1, 0, 2];
    const shipY = py + (compact ? 78 : 112);
    order.forEach((rank, col) => {
      const row = rows[rank];
      const cx = px + colW * col + colW / 2;
      const lift = rank === 0 ? (compact ? 3 : 6) : 0;
      const place = this.places[rank];
      const name = this.names[rank];
      const image = this.ships[rank];
      if (!row || !place || !name || !image) {
        place?.setVisible(false);
        name?.setVisible(false);
        image?.setVisible(false);
        return;
      }
      place.setVisible(true).setText(row.roman).setStyle(textStyle(compact ? 'main' : 'big', PLACE_COLOURS[rank] ?? '#fff')).setPosition(cx, py + (compact ? 36 : 52) - lift);
      // The ship seen from a little above, bow to the lower right; the winner yellow, the others red.
      showShip(image, row.shipClass, rank === 0 ? 'player' : 'enemy', art, true, 0, 0, Math.PI / 4, compact ? 0.7 : 1);
      image.setVisible(true).setPosition(Math.round(cx), Math.round(shipY - lift));
      const shot = `${Math.round(row.hitsPerBall * 100)}%`;
      name
        .setVisible(true)
        .setText(`#${row.number} ${row.name}\n${row.shipClass}\n${row.wins} wins  ${row.losses} lost\nhits ${shot}`)
        .setPosition(cx, shipY + (compact ? 30 : 46));
    });

    // The others: one short line each.
    const others = rows.slice(PODIUM).map((r) => `${r.roman.padEnd(3)} #${r.number} ${r.name.padEnd(12)} ${r.wins} / ${r.losses}`);
    this.rest.setVisible(others.length > 0 && !compact).setText(others.join('\n')).setPosition(w / 2, shipY + 104);

    const by = py + panelH - (compact ? 22 : 28);
    this.exit.setVisible(true).setPosition(w / 2 - 40, by);
    this.back.setVisible(true).setPosition(w / 2 + 40, by);
  }
}
