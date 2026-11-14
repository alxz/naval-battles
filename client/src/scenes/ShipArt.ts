import Phaser from 'phaser';
import { SHIP_CLASSES } from '../sim/data';

/** Hull colours: your ship brown, the target dark red. */
export const PLAYER_HULL = 0x8b5a2b;
export const TARGET_HULL = 0x7a2626;

const MASTS: Record<string, number> = { sloop: 1, brigantine: 2, merchantman: 3, frigate: 3 };

/** The texture name for a ship class in a colour. */
export function shipTextureKey(shipClass: string, hull: number): string {
  return `ship-${shipClass}-${hull.toString(16)}`;
}

/**
 * Draws a placeholder top view for every ship class and colour, at 1 pixel per game metre
 * (a 30 m sloop is 30 x 10 pixels). The scene scales it with pixels per metre x zoom.
 */
export function makeShipTextures(scene: Phaser.Scene): void {
  for (const [id, p] of Object.entries(SHIP_CLASSES)) {
    for (const hull of [PLAYER_HULL, TARGET_HULL]) {
      const key = shipTextureKey(id, hull);
      if (scene.textures.exists(key)) continue;
      const L = p.length;
      const B = p.beam;
      const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
      g.fillStyle(hull, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(0, 1),
          new Phaser.Math.Vector2(L * 0.67, 0),
          new Phaser.Math.Vector2(L, B / 2),
          new Phaser.Math.Vector2(L * 0.67, B),
          new Phaser.Math.Vector2(0, B - 1),
        ],
        true,
      );
      // Sails: one light bar per mast, spread along the hull.
      const masts = MASTS[id] ?? 1;
      g.fillStyle(0xf2e8c9, 1);
      for (let i = 0; i < masts; i++) {
        const x = Math.round((L * (i + 1)) / (masts + 1)) - 2;
        g.fillRect(x, 2, 3, B - 4);
      }
      g.generateTexture(key, L, B);
      g.destroy();
    }
  }
}
