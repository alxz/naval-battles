import Phaser from 'phaser';
import { WORLD } from '../sim/data';
import type { WindNow } from '../sim/types';

const BANKS = 5; // fog banks on the whole sea
const PUFFS = 16; // soft blobs in one bank
const ALPHA = 0.3; // one puff; where puffs overlap the fog is thicker
const TEXTURE = 64; // pixels; one puff is drawn this big and then stretched
const MARGIN = 900; // metres beyond the edge of the sea before a bank comes back on the other side

interface Bank {
  x: number; // metres, the middle of the bank
  y: number;
  speed: number; // each bank drifts at its own share of the wind
  /** `along`: metres down the wind from the middle; `across`: to the side. A bank is long and narrow, like a band of sea fog. */
  puffs: { along: number; across: number; size: number; image: Phaser.GameObjects.Image }[];
}

/**
 * Fog banks ("Open Sea" package C): a few long bands (about 1-1.5 km) that drift down the wind and
 * half hide ships and islands under them. Simple first: this is only a picture. Bots see
 * through fog, and so do the chart sightings; fog that blinds everybody is a later step.
 * (Math.random is fine here: nothing in the simulation depends on the fog.)
 */
export class Fog {
  private readonly banks: Bank[] = [];

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists('fog')) {
      // A soft round puff out of 2 x 2 pixel squares: thick in the middle, dotted at the edge.
      const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
      const half = TEXTURE / 2;
      for (let y = 0; y < TEXTURE; y += 2) {
        for (let x = 0; x < TEXTURE; x += 2) {
          const r = Math.hypot(x + 1 - half, y + 1 - half) / half;
          const thick = (1 - r) * 1.5 + (Math.random() - 0.5) * 0.3;
          if (thick <= 0) continue;
          g.fillStyle(0xe9eef0, Math.min(1, Math.ceil(thick * 4) / 4));
          g.fillRect(x, y, 2, 2);
        }
      }
      g.generateTexture('fog', TEXTURE, TEXTURE);
      g.destroy();
    }
    const spanX = WORLD.maxX - WORLD.minX;
    const spanY = WORLD.maxY - WORLD.minY;
    for (let i = 0; i < BANKS; i++) {
      const bank: Bank = { x: WORLD.minX + Math.random() * spanX, y: WORLD.minY + Math.random() * spanY, speed: 0.7 + Math.random() * 0.6, puffs: [] };
      const length = 900 + Math.random() * 700;
      for (let k = 0; k < PUFFS; k++) {
        const t = k / (PUFFS - 1) - 0.5; // -0.5 .. 0.5 along the band
        bank.puffs.push({
          along: t * length + (Math.random() - 0.5) * 80,
          across: (Math.random() - 0.5) * 220 * (1 - Math.abs(t)), // thinner at the ends
          size: 260 + Math.random() * 200 * (1 - Math.abs(t)),
          image: scene.add.image(0, 0, 'fog').setDepth(40).setAlpha(ALPHA),
        });
      }
      this.banks.push(bank);
    }
  }

  /** Call every frame. `dt` in seconds; the banks drift where the wind blows. */
  update(dt: number, wind: WindNow, pxPerMetre: number, visible: boolean): void {
    const to = wind.fromRad + Math.PI; // the wind blows FROM fromRad
    const drift = 3 + 7 * wind.strength; // m/s
    for (const bank of this.banks) {
      bank.x += Math.cos(to) * drift * bank.speed * dt;
      bank.y += Math.sin(to) * drift * bank.speed * dt;
      // Off one side of the sea: come back on the other.
      const spanX = WORLD.maxX - WORLD.minX + 2 * MARGIN;
      const spanY = WORLD.maxY - WORLD.minY + 2 * MARGIN;
      if (bank.x < WORLD.minX - MARGIN) bank.x += spanX;
      if (bank.x > WORLD.maxX + MARGIN) bank.x -= spanX;
      if (bank.y < WORLD.minY - MARGIN) bank.y += spanY;
      if (bank.y > WORLD.maxY + MARGIN) bank.y -= spanY;
      for (const puff of bank.puffs) {
        // The band lies along the wind (it follows the wind when it veers).
        const x = bank.x + Math.cos(to) * puff.along - Math.sin(to) * puff.across;
        const y = bank.y + Math.sin(to) * puff.along + Math.cos(to) * puff.across;
        puff.image
          .setVisible(visible)
          .setPosition(Math.round(x * pxPerMetre), Math.round(y * pxPerMetre))
          .setScale((puff.size * pxPerMetre) / TEXTURE);
      }
    }
  }

  /** Put one bank here (for tests and screenshots). */
  moveBank(x: number, y: number): void {
    const bank = this.banks[0];
    if (bank) Object.assign(bank, { x, y });
  }
}
