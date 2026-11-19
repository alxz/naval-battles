import Phaser from 'phaser';
import { assetUrl } from '../assets';
import { ISLANDS } from '../sim/data';
import { bounds } from '../sim/geometry';
import type { Island } from '../sim/types';

const RIM = 14; // metres of light shallow water drawn around the sand (only a picture)
const REEF_TILE = 60; // pixels: one square of reef picture, repeated along the strips

/** Load the pictures of the generated islands (tools/make_islands.py). Call in preload. */
export function loadIslandPictures(scene: Phaser.Scene): void {
  for (const island of ISLANDS) {
    if (island.picture) scene.load.image(pictureKey(island), assetUrl(`assets/islands/${island.picture.file}`));
  }
}

function pictureKey(island: Island): string {
  return `island-${island.picture?.file ?? island.name}`;
}

/** Something drawn at a place in the sea: moved and scaled with the zoom. */
interface Placed {
  object: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
  x: number; // metres, top left corner
  y: number;
}

/**
 * Draws the land, all at 1 pixel per game metre and scaled like the ships:
 *   generated islands  their ready pictures (sand, grass, trees, mountains, rivers)
 *   hand-made islands  drawn once into a texture from the polygon (sand and two greens)
 *   the reef           a small square of rocks and foam, repeated along each strip
 * The land for collisions is always the polygon, never the picture.
 */
export class Islands {
  private readonly placed: Placed[] = [];

  constructor(scene: Phaser.Scene) {
    this.makeReefTile(scene);
    ISLANDS.forEach((island, i) => {
      if (island.kind === 'structure') return; // piers and moored boats: already in the island's picture
      const box = bounds(island.points);
      if (island.kind === 'reef') {
        const strip = scene.add.tileSprite(0, 0, box.maxX - box.minX, box.maxY - box.minY, 'reef').setOrigin(0, 0).setDepth(0.5);
        this.placed.push({ object: strip, x: box.minX, y: box.minY });
      } else if (island.picture) {
        const image = scene.add.image(0, 0, pictureKey(island)).setOrigin(0, 0).setDepth(0.5);
        this.placed.push({ object: image, x: island.picture.x, y: island.picture.y });
      } else {
        const key = `island-drawn-${i}`;
        const minX = box.minX - RIM;
        const minY = box.minY - RIM;
        this.drawTexture(scene, key, island, minX, minY, box.maxX + RIM - minX, box.maxY + RIM - minY);
        const image = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(0.5);
        this.placed.push({ object: image, x: minX, y: minY });
      }
    });
  }

  /** s = screen pixels per metre. */
  update(s: number): void {
    for (const { object, x, y } of this.placed) object.setPosition(x * s, y * s).setScale(s);
  }

  /** The reef: pale shallow water with dark rocks and white foam. A fixed pattern, so it never flickers. */
  private makeReefTile(scene: Phaser.Scene): void {
    if (scene.textures.exists('reef')) return;
    const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
    g.fillStyle(0x3f86b4, 1);
    g.fillRect(0, 0, REEF_TILE, REEF_TILE);
    // A simple repeatable "random": the same numbers every time, so the picture is the same on every device.
    let seed = 1650;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(next() * (REEF_TILE - 8)) + 2;
      const y = Math.floor(next() * (REEF_TILE - 8)) + 2;
      const size = 2 + Math.floor(next() * 4);
      g.fillStyle(0xdfeef7, 1); // foam round the rock
      g.fillRect(x - 1, y - 1, size + 2, size + 1);
      g.fillStyle(0x3c4a52, 1); // the rock
      g.fillRect(x, y, size, size - 1);
      g.fillStyle(0x566871, 1); // its lit top left
      g.fillRect(x, y, Math.max(1, size - 2), 1);
    }
    g.generateTexture('reef', REEF_TILE, REEF_TILE);
    g.destroy();
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
