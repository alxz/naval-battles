import type Phaser from 'phaser';
import type { RosterRow } from '../view/roster';
import { rosterSummary } from '../view/roster';
import { paint, textStyle } from './text';

const MAX_ROWS = 10;
const LINE_H = 10;
const COLOURS = { seen: '#ffffff', sunk: '#8a8a8a', unknown: '#c9d4dc' } as const;

/**
 * M4b step 5d (D75): who is still in the battle. A computer: a list under the target card (the name; "?" when the
 * ship is not in sight; a sunk ship struck through in grey). A phone: one line, "FOES 3/5", beside my ship panel.
 * What the rows say comes from view/roster.ts (it follows what the player's ship knows).
 */
export class Roster {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly strike: Phaser.GameObjects.Graphics;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly summary: Phaser.GameObjects.Text;
  private readonly goal: Phaser.GameObjects.Text; // D77: the goal of the battle, in yellow

  private readonly touch: boolean;

  constructor(scene: Phaser.Scene, touch: boolean) {
    this.touch = touch;
    this.plate = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.strike = scene.add.graphics().setScrollFactor(0).setDepth(106);
    for (let i = 0; i < MAX_ROWS; i++) this.rows.push(scene.add.text(0, 0, '', textStyle('small')).setScrollFactor(0).setDepth(104).setVisible(false));
    this.summary = scene.add.text(0, 0, '', textStyle('small')).setScrollFactor(0).setDepth(104).setVisible(false);
    this.goal = scene.add.text(0, 0, '', textStyle('small', '#ffe066')).setScrollFactor(0).setDepth(104).setVisible(false);
    this.goal.setShadow(1, 1, '#000000', 0, false, true);
  }

  hide(): void {
    this.plate.clear();
    this.strike.clear();
    this.summary.setVisible(false);
    this.goal.setVisible(false);
    for (const r of this.rows) r.setVisible(false);
  }

  /** `at`: top left corner of the list (a computer), or of the one line (a phone). */
  update(rows: readonly RosterRow[], at: { x: number; y: number }, goalText = ''): void {
    this.plate.clear();
    this.strike.clear();
    if (rows.length === 0) return this.hide();
    if (this.touch) {
      for (const r of this.rows) r.setVisible(false);
      paint(this.summary.setVisible(true), rosterSummary(rows)).setPosition(at.x, at.y);
      paint(this.goal.setVisible(goalText !== ''), goalText).setPosition(at.x, at.y + 24); // under AUTO (y + 12)
      return;
    }
    this.summary.setVisible(false);
    paint(this.goal.setVisible(goalText !== ''), goalText).setPosition(at.x + 2, at.y);
    const top = at.y + (goalText !== '' ? LINE_H + 2 : 0); // the list starts under the goal line
    const shown = rows.slice(0, MAX_ROWS);
    let width = 0;
    shown.forEach((row, i) => {
      const text = this.rows[i]!;
      paint(text.setVisible(true), `${row.name}${row.state === 'unknown' ? ' ?' : ''}`, COLOURS[row.state]).setPosition(at.x + 4, top + 3 + i * LINE_H);
      width = Math.max(width, text.width);
    });
    for (let i = shown.length; i < MAX_ROWS; i++) this.rows[i]!.setVisible(false);
    this.plate.fillStyle(0x000000, 0.35);
    this.plate.fillRect(at.x, at.y, Math.max(width + 8, goalText !== '' ? this.goal.width + 4 : 0), shown.length * LINE_H + 6 + (top - at.y));
    this.strike.fillStyle(0xcfcfcf, 1);
    shown.forEach((row, i) => {
      if (row.state === 'sunk') this.strike.fillRect(at.x + 3, top + 3 + i * LINE_H + 4, this.rows[i]!.width + 2, 1);
    });
  }
}
