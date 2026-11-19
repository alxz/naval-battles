import Phaser from 'phaser';
import { DAMAGE } from '../sim/data';
import { lawRange } from '../sim/law';
import { PORTS } from '../sim/port';

const SAFE = 0x9be89a;
const LAW = 0xff6a55;

/**
 * What you see of a port at sea: a dotted ring round its safe water (no fighting inside)
 * and a red-and-white buoy at the anchorage, where a ship stops to be repaired.
 * While your ship is an offender of a port (port law), a red ring shows how far its shore guns
 * fire at you. A picture only; the rules are in sim/port.ts and sim/law.ts.
 */
export class PortMarks {
  /** Per port: the still parts (anchorage circle, buoy), the turning ring, the shore-gun ring. */
  private readonly marks: { still: Phaser.GameObjects.Graphics; ring: Phaser.GameObjects.Graphics; law: Phaser.GameObjects.Graphics }[] = [];
  private drawnScale = Number.NaN;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < PORTS.length; i++) {
      this.marks.push({ still: scene.add.graphics().setDepth(0.9), ring: scene.add.graphics().setDepth(0.9), law: scene.add.graphics().setDepth(0.9) });
    }
  }

  /**
   * `offenderPort`: the index of the port whose law the watched ship broke, or -1.
   * M3 step 6e (speed): the rings are drawn once per zoom round (0, 0) and only turned every frame
   * (before, 72 dashes a port were drawn again in every frame).
   */
  update(pxPerMetre: number, seconds: number, offenderPort = -1): void {
    const s = pxPerMetre;
    if (s !== this.drawnScale) {
      this.drawnScale = s;
      this.draw(s);
    }
    const turn = seconds * 0.02;
    PORTS.forEach((port, index) => {
      const m = this.marks[index];
      if (!m) return;
      const x = port.x * s;
      const y = port.y * s;
      m.still.setPosition(x, y);
      m.ring.setPosition(x, y).setRotation(turn);
      m.law.setPosition(x, y).setRotation(-turn * 2).setVisible(index === offenderPort);
    });
  }

  private draw(s: number): void {
    for (const m of this.marks) {
      // The ring: short dashes that creep slowly round, so it reads as a line on the water.
      const r = DAMAGE.port.safeRange * s;
      const dashes = 72;
      m.ring.clear().lineStyle(1, SAFE, 0.5);
      for (let i = 0; i < dashes; i++) {
        const a = (i / dashes) * Math.PI * 2;
        const b = a + (Math.PI * 2) / dashes / 2;
        m.ring.lineBetween(Math.cos(a) * r, Math.sin(a) * r, Math.cos(b) * r, Math.sin(b) * r);
      }
      // The anchorage: a faint circle and a buoy.
      const g = m.still.clear();
      g.lineStyle(1, SAFE, 0.35);
      g.strokeCircle(0, 0, DAMAGE.port.dockRange * s);
      g.fillStyle(0x1b1b1b, 1);
      g.fillRect(-3, -4, 7, 8);
      g.fillStyle(0xe0533d, 1);
      g.fillRect(-2, -3, 5, 3);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-2, 0, 5, 3);
      // The reach of the shore guns (shown while you are an offender of this port): get beyond this
      // ring, and stay there, to be pardoned.
      const reach = lawRange() * s;
      const marks = 96;
      m.law.clear().lineStyle(1, LAW, 0.7);
      for (let i = 0; i < marks; i++) {
        const a = (i / marks) * Math.PI * 2;
        const b = a + (Math.PI * 2) / marks / 2;
        m.law.lineBetween(Math.cos(a) * reach, Math.sin(a) * reach, Math.cos(b) * reach, Math.sin(b) * reach);
      }
    }
  }
}
