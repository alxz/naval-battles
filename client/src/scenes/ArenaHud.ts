import Phaser from 'phaser';
import { pilotScore } from '../sim/arena';
import { SHIP_CLASSES } from '../sim/data';
import type { Pose } from '../sim/simulation';
import type { World } from '../sim/types';
import { paint, textStyle } from './text';
import { shipLabel } from '../view/wanted';
import { botTag } from '../view/botTag';
import { shipBar } from '../view/shipBar';
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
  ship: Rect; // my ship panel: on a touch screen the buttons go under it (the panel is 64 px high on an iPad)
  avoid: Rect; // the target card: the table moves below it when they would overlap (a narrow window)
  seconds: number;
  known: readonly { shown: boolean }[]; // M4b step 4: names only over ships the screen shows (bot's eyes)
  botEyes: boolean; // the EYES button: BOT = what the watched bot sees, ALL = everything
}

const MAX_SHIPS = 12; // name labels (the arena has up to 10 bots since M3 step 7e)

export interface ArenaButtons {
  onNext: () => void; // follow the next ship (Space)
  onSpeed: () => void; // x1 -> x2 -> x4 -> x8 (T)
  onLog: () => void; // download the log (L)
  onLeave: () => void; // back to a normal battle
  onEyes: () => void; // M4b step 4: everything / what the watched bot sees (B)
}

/**
 * What you see in the auto-bot arena (M3 step 2), over the normal HUD of the ship you follow:
 *   - a name over every ship: "#3 Black Gull 12" (number, name, wins); the one you follow in yellow;
 *   - the score table (most wins first), the time and the speed;
 *   - buttons: NEXT (follow the next ship), the speed, SEE ALL / SEE BOT (M4b step 4: everything, or what the
 *     watched bot sees; B), LOG (download), LEAVE (above the table, M3 step 7f);
 *   - the table is one line (time, speed, wins); a tap on it opens the full table.
 * Drag the sea (or W A S D / arrows) to look round freely; NEXT or Space follows a ship again.
 */
export class ArenaHud {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly board: Phaser.GameObjects.Text;
  private readonly buttons: Phaser.GameObjects.Text[] = [];
  private readonly speedButton: Phaser.GameObjects.Text;
  private readonly eyesButton: Phaser.GameObjects.Text;
  private shown = false;
  private touch: boolean;

  private fade = 1;
  private bottomY = 0;
  private rightX = 0;
  private topY = 0; // the right edge of the table's plate (the help text H goes to its right, M3 step 7f)
  private open = false; // the full table is open (a tap on the one-line summary opens / closes it)

  constructor(scene: Phaser.Scene, touch: boolean, actions: ArenaButtons) {
    this.touch = touch;
    this.plate = scene.add.graphics().setScrollFactor(0).setDepth(100);
    // Names over the ships: in the world (they scroll with the sea), above the ships (depth 2).
    for (let i = 0; i < MAX_SHIPS; i++) {
      this.labels.push(scene.add.text(0, 0, '', textStyle('small')).setDepth(3).setVisible(false));
    }
    this.board = scene.add.text(0, 0, '', textStyle('small', '#e8f1f7')).setScrollFactor(0).setDepth(104).setVisible(false).setInteractive();
    // M3 step 7f: the table is one line; a tap on it opens the full table, another tap closes it.
    this.board.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.open = !this.open;
    });
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
    this.eyesButton = button('SEE ALL', actions.onEyes);
    button('LOG', actions.onLog);
    button('LEAVE', actions.onLeave);
  }

  layout(_width: number, _height: number): void {
    // (the places are worked out every frame in update)
  }

  setShown(on: boolean): void {
    this.shown = on;
    this.plate.setVisible(on);
    this.board.setVisible(on);
    for (const b of this.buttons) b.setVisible(on);
    if (!on) for (const l of this.labels) l.setVisible(false);
  }

  /** The bottom of the table and its buttons (screen y), so the help text (H) can go below; 0 when hidden. */
  bottom(): number {
    return this.shown ? this.bottomY : 0;
  }

  /** The right edge of the table's plate (screen x; 0 when hidden): the help text (H) goes to its right. */
  right(): number {
    return this.shown ? this.rightX : 0;
  }

  /** The top of the table's plate (screen y). */
  top(): number {
    return this.shown ? this.topY : 0;
  }

  /** Is this screen point on one of the arena buttons or the table? (Then a drag there does not move the view.) */
  onButton(x: number, y: number): boolean {
    return this.shown && (this.buttons.some((b) => b.getBounds().contains(x, y)) || this.board.getBounds().contains(x, y));
  }

  update(world: World, poses: readonly Pose[], s: number, focusId: number, following: boolean, timeScale: number, clockText: string, screen: ArenaScreen): void {
    if (!this.shown || !world.arena) return;
    const arena = world.arena;
    // Names over the ships.
    this.labels.forEach((label, i) => {
      const ship = world.ships[i];
      const pose = poses[i];
      const pilot = arena.pilots.find((p) => p.shipId === ship?.id);
      if (!ship || !pose || !pilot || ship.sunk || !(screen.known[i]?.shown ?? true)) {
        label.setVisible(false);
        return;
      }
      const params = SHIP_CLASSES[ship.shipClass];
      // An offender of a port's peace: "WANTED: ..." in red until it is pardoned (M3 step 6c).
      const tag = screen.botEyes ? '' : botTag(world.bots.find((b) => b.shipId === ship.id), arena.pilots); // what it is doing (D75), only for SEE ALL
      const look = shipLabel(ship, `#${pilot.number} ${pilot.name} ${pilot.wins}${tag ? ` ${tag}` : ''}`, ship.id === focusId ? '#ffe066' : '#ffffff');
      paint(label.setVisible(true), look.text, look.colour);
      // Above the ship's bars (whole pixels: a text centred on a half pixel shimmers).
      const top = params ? shipBar(params, pose.x, pose.y, pose.headingRad, 1, s).y - 3 : Math.round(pose.y * s) - 30;
      label.setPosition(Math.round(pose.x * s - label.width / 2), Math.round(top - label.height));
    });

    // The score table.
    const sorted = [...arena.pilots].sort((a, b) => pilotScore(b) - pilotScore(a) || a.losses - b.losses);
    // A phone has little room: the best three, and the ship you follow if it is not among them.
    const rows = this.touch ? sorted.filter((p, i) => i < 3 || p.shipId === focusId) : sorted;
    // M3 step 7f: one line by default ("+" = tap to open); the full table on a tap.
    const summary = `ARENA ${clockText}  SPEED x${timeScale}  WINS ${arena.totalWins}${arena.peace ? '  PEACE' : ''}  ${this.open ? '-' : '+'}`;
    const lines = !this.open ? [summary, ...(following ? [] : ['free view: NEXT to follow'])] : [
      summary,
      ...(following ? [] : ['free view: NEXT to follow']),
      `${' '.repeat(23)}  W   E   L`, // wins, escapes (M3 step 7a), losses
      ...rows.map((p) => {
        const ship = world.ships.find((sh) => sh.id === p.shipId);
        const mark = p.shipId === focusId ? '>' : ' ';
        return `${mark}#${p.number} ${p.name.padEnd(12)} ${(ship?.shipClass ?? '').slice(0, 5).padEnd(5)} ${String(p.wins).padStart(3)} ${String(p.escapes ?? 0).padStart(3)} ${String(p.losses).padStart(3)}${ship?.sunk ? ' sunk' : ''}`;
      }),
    ];
    this.board.setText(lines.join('\n'));
    // Place: the buttons first (computer under the top-left icons; touch under the ship and target panels),
    // the table under them (M3 step 7f).
    const x = 8;
    this.speedButton.setText(`x${timeScale}`);
    this.eyesButton.setText(screen.botEyes ? 'SEE BOT' : 'SEE ALL');
    let bx = x;
    const by = this.touch ? screen.ship.y + screen.ship.h + 4 : 30;
    for (const button of this.buttons) {
      button.setPosition(bx, by);
      bx += button.width + 6;
    }
    const buttonsRect = { x, y: by, w: bx - x, h: this.buttons[0]?.height ?? 16 };
    let y = by + buttonsRect.h + 6;
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

    this.topY = y;
    this.rightX = plateRect.x + plateRect.w;
    this.bottomY = plateRect.y + plateRect.h + 8;
    const buttonAlpha = panelCovers(buttonsRect, screen.ships) ? 0.45 : 1;
    for (const button of this.buttons) button.setAlpha(buttonAlpha);
  }
}
