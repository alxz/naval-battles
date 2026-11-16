import Phaser from 'phaser';
import { DAMAGE } from '../sim/data';
import { PORTS } from '../sim/port';

const SAFE = 0x9be89a;

/**
 * What you see of a port at sea: a dotted ring round its safe water (no fighting inside)
 * and a red-and-white buoy at the anchorage, where a ship stops to be repaired.
 * A picture only; the rules are in sim/port.ts.
 */
export class PortMarks {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(0.9);
  }

  update(pxPerMetre: number, seconds: number): void {
    const g = this.g;
    g.clear();
    const s = pxPerMetre;
    for (const port of PORTS) {
      // The ring: short dashes that creep slowly round, so it reads as a line on the water.
      const r = DAMAGE.port.safeRange * s;
      const dashes = 72;
      const turn = (seconds * 0.02) % ((Math.PI * 2) / dashes);
      g.lineStyle(1, SAFE, 0.5);
      for (let i = 0; i < dashes; i++) {
        const a = turn + (i / dashes) * Math.PI * 2;
        const b = a + (Math.PI * 2) / dashes / 2;
        g.lineBetween(port.x * s + Math.cos(a) * r, port.y * s + Math.sin(a) * r, port.x * s + Math.cos(b) * r, port.y * s + Math.sin(b) * r);
      }
      // The anchorage: a faint circle and a buoy.
      g.lineStyle(1, SAFE, 0.35);
      g.strokeCircle(port.x * s, port.y * s, DAMAGE.port.dockRange * s);
      const x = Math.round(port.x * s);
      const y = Math.round(port.y * s);
      g.fillStyle(0x1b1b1b, 1);
      g.fillRect(x - 3, y - 4, 7, 8);
      g.fillStyle(0xe0533d, 1);
      g.fillRect(x - 2, y - 3, 5, 3);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - 2, y, 5, 3);
    }
  }
}
