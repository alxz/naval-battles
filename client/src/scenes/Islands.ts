import Phaser from 'phaser';
import { ISLANDS } from '../sim/data';
import { bounds } from '../sim/geometry';
import type { Island } from '../sim/types';

const RIM = 14; // metres of light shallow water drawn around the sand (only a picture)

/**
 * Draws every island once into a texture at 1 pixel per game metre, then shows it as an
 * image that the scene scales like the ships. (A picture made once is cheaper than a
 * Graphics object redrawn every frame, and it keeps pixel art crisp at whole zoom steps.)
 * The land for collisions is the sand edge: exactly the polygon in islands.json.
 */
export class Islands {
  private readonly images: { image: Phaser.GameObjects.Image; minX: number; minY: number }[] = [];

  constructor(scene: Phaser.Scene) {
    ISLANDS.forEach((island, i) => {
      const key = `island-${i}`;
      const box = bounds(island.points);
      const minX = box.minX - RIM;
      const minY = box.minY - RIM;
      this.drawTexture(scene, key, island, minX, minY, box.maxX + RIM - minX, box.maxY + RIM - minY);
      const image = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(0.5);
      this.images.push({ image, minX, minY });
    });
  }

  /** s = screen pixels per metre. */
  update(s: number): void {
    for (const { image, minX, minY } of this.images) image.setPosition(minX * s, minY * s).setScale(s);
  }

  private drawTexture(scene: Phaser.Scene, key: string, island: Island, minX: number, minY: number, w: number, h: number): void {
    const centre = island.points.reduce((c, p) => ({ x: c.x + p.x / island.points.length, y: c.y + p.y / island.points.length }), { x: 0, y: 0 });
    // The island polygon, moved into the texture and grown or shrunk around its centre.
    const shape = (grow: number): Phaser.Math.Vector2[] =>
      island.points.map((p) => {
        const dx = p.x - centre.x;
        const dy = p.y - centre.y;
        const len = Math.hypot(dx, dy) || 1;
        return new Phaser.Math.Vector2(Math.round(p.x + (dx / len) * grow - minX), Math.round(p.y + (dy / len) * grow - minY));
      });

    const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
    g.fillStyle(0x4f9fcf, 1); // shallow water
    g.fillPoints(shape(RIM), true);
    g.fillStyle(0xe8d29a, 1); // sand: the real shore line
    g.fillPoints(shape(0), true);
    g.fillStyle(0x5f9e4b, 1); // trees and grass
    g.fillPoints(shape(-14), true);
    g.fillStyle(0x4c8a3c, 1);
    g.fillPoints(shape(-34), true);
    g.generateTexture(key, Math.ceil(w), Math.ceil(h));
    g.destroy();
  }
}
