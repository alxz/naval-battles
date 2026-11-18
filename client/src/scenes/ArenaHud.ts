import Phaser from 'phaser';
import { SHIP_CLASSES } from '../sim/data';
import type { Pose } from '../sim/simulation';
import type { World } from '../sim/types';
import { textStyle } from './text';
import { panelCovers, overlaps } from '../view/hudLayout';
import type { Rect } from '../view/hudLayout';

/** The table's plate: darker on a computer, lighter on touch screens (M3 step 4c). */
const PLATE_ALPHA = 0.45;
const PLATE_ALPHA_TOUCH = 0.25;
/** With a ship under it the table becomes this see-through; how fast it fades. */
const COVERED_ALPHA = 0.2;
const FADE_PER_SECOND = 6;

/** What the arena table needs to know about the screen each frame. */
export interface ArenaScreen {
  ships: readonly { x: number; y: number }[]; // ship centres on the screen (logical px)
  avoid: Rect; // the target card: the table moves below it when they would overlap (a narrow window)
  seconds: number;
}

const MAX_SHIPS = 8;

export interface ArenaButtons {
  onNext: () => void; // follow the next ship (Space)
  onSpeed: () => void; // x1 -> x2 -> x4 -> x8 (T)
  onLog: () => void; // download the log (L)
  onLeave: () => void; // back to a normal battle
}

/**
 * What you see in the auto-bot arena (M3 step 2), over the normal HUD of the ship you follow:
 *   - a name over every ship: "#3 Black Gull 12" (number, name, wins); the one you follow in yellow;
 *   - the score table (most wins first), the time and the speed;
 *   - buttons: NEXT (follow the next ship), the speed, LOG (download), LEAVE.
 * Drag the sea (or W A S D / arrows) to look round freely; NEXT or Space follows a ship again.
 */
export class ArenaHud {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly board: Phaser.GameObjects.Text;
  private readonly buttons: Phaser.GameObjects.Text[] = [];
  private readonly speedButton: Phaser.GameObjects.Text;
  private shown = false;
  private touch: boolean;

  private height = 0;
  private fade = 1;

  constructor(scene: Phaser.Scene, touch: boolean, actions: ArenaButtons) {
    this.touch = touch;
    this.plate = scene.add.graphics().setScrollFactor(0).setDepth(100);
    // Names over the ships: in the world (they scroll with the sea), above the ships (depth 2).
    for (let i = 0; i < MAX_SHIPS; i++) {
      this.labels.push(scene.add.text(0, 0, '', textStyle('small')).setOrigin(0.5, 1).setDepth(3).setVisible(false));
    }
    this.board = scene.add.text(0, 0, '', textStyle('small', '#e8f1f7')).setScrollFactor(0).setDepth(104).setVisible(false);
    const button = (label: string, action: () => void): Phaser.GameObjects.Text => {
      const t = scene.add
        .text(0, 0, label, { ...textStyle('main', '#1b1b1b'), backgroundColor: '#ffe066', padding: { x: 5, y: 4 } })
        .setScrollFactor(0)
        .setDepth(105)
        .setVisible(false)
        .setInteractive();
      t.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        action();
      });
      this.buttons.push(t);
      return t;
    };
    button('NEXT', actions.onNext);
    this.speedButton = button('x1', actions.onSpeed);
    button('LOG', actions.onLog);
    button('LEAVE', actions.onLeave);
  }

  layout(_width: number, height: number): void {

    this.height = height;
  }

  setShown(on: boolean): void {
    this.shown = on;
    this.plate.setVisible(on);
    this.board.setVisible(on);
    for (const b of this.buttons) b.setVisible(on);
    if (!on) for (const l of this.labels) l.setVisible(false);
  }

  /** Is this screen point on one of the arena buttons? (Then a drag there does not move the view.) */
  onButton(x: number, y: number): boolean {
    return this.shown && this.buttons.some((b) => b.getBounds().contains(x, y));
  }

  update(world: World, poses: readonly Pose[], s: number, focusId: number, following: boolean, timeScale: number, clockText: string, screen: ArenaScreen): void {
    if (!this.shown || !world.arena) return;
    const arena = world.arena;
    // Names over the ships.
    this.labels.forEach((label, i) => {
      const ship = world.ships[i];
      const pose = poses[i];
      const pilot = arena.pilots.find((p) => p.shipId === ship?.id);
      if (!ship || !pose || !pilot || ship.sunk) {
        label.setVisible(false);
        return;
      }
      const length = SHIP_CLASSES[ship.shipClass]?.length ?? 30;
      label
        .setVisible(true)
        .setText(`#${pilot.number} ${pilot.name} ${pilot.wins}`)
        .setColor(ship.id === focusId ? '#ffe066' : '#ffffff')
        .setPosition(Math.round(pose.x * s), Math.round((pose.y - length * 0.75) * s));
    });

    // The score table.
    const sorted = [...arena.pilots].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    // A phone has little room: the best three, and the ship you follow if it is not among them.
    const rows = this.touch ? sorted.filter((p, i) => i < 3 || p.shipId === focusId) : sorted;
    const lines = [
      `AUTO-BOT  ${arena.peace ? 'PEACE' : 'WAR'}  ${clockText}  x${timeScale}`,
      `wins ${arena.totalWins}${following ? '' : '   free view: NEXT to follow'}`,
      ...rows.map((p) => {
        const ship = world.ships.find((sh) => sh.id === p.shipId);
        const mark = p.shipId === focusId ? '>' : ' ';
        return `${mark}#${p.number} ${p.name.padEnd(12)} ${(ship?.shipClass ?? '').slice(0, 5).padEnd(5)} ${String(p.wins).padStart(3)} ${String(p.losses).padStart(3)}${ship?.sunk ? ' sunk' : ''}`;
      }),
    ];
    this.board.setText(lines.join('\n'));
    // Place: computer under the top-left icons; touch under the ship and target panels.
    const x = 8;
    let y = this.touch ? 96 : 30;
    this.board.setPosition(x + 4, y + 3);
    let b = this.board.getBounds();
    // A narrow window: the target card at the top right would cover the table, so it goes under the card.
    if (!this.touch && overlaps({ x, y, w: b.width + 8, h: b.height + 6 }, screen.avoid)) {
      y = screen.avoid.y + screen.avoid.h + 6;
      this.board.setPosition(x + 4, y + 3);
      b = this.board.getBounds();
    }
    const plateRect = { x, y, w: b.width + 8, h: b.height + 6 };
    // See-through while a ship sails under the table (M3 step 4c), like the HUD panels.
    const goal = panelCovers(plateRect, screen.ships) ? COVERED_ALPHA : 1;
    this.fade += (goal - this.fade) * Math.min(1, screen.seconds * FADE_PER_SECOND);
    this.plate.clear();
    this.plate.fillStyle(0x000000, this.touch ? PLATE_ALPHA_TOUCH : PLATE_ALPHA);
    this.plate.fillRect(plateRect.x, plateRect.y, plateRect.w, plateRect.h);
    this.plate.setAlpha(this.fade);
    this.board.setAlpha(Math.max(0.35, this.fade));

    // Buttons: in a row under the table (computer) or along the bottom (touch: the ship buttons are hidden).
    this.speedButton.setText(`x${timeScale}`);
    let bx = x;
    const by = this.touch ? this.height - 30 : y + b.height + 12;
    for (const button of this.buttons) {
      button.setPosition(bx, by);
      bx += button.width + 6;
    }
    // The buttons fade too when a ship is under them (they still work).
    const buttonsRect = { x, y: by, w: bx - x, h: this.buttons[0]?.height ?? 16 };
    const buttonAlpha = panelCovers(buttonsRect, screen.ships) ? 0.45 : 1;
    for (const button of this.buttons) button.setAlpha(buttonAlpha);
  }
}
