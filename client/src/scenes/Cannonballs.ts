import Phaser from 'phaser';
import artJson from '../data/shipArt.json';
import type { Ball, SimEvent } from '../sim/types';

/** Screen pixels up per metre of height: the same number the ship pictures were drawn with. */
const HEIGHT_SCALE = artJson.heightScale;

const SPLASH_SECONDS = 0.7;
const FLASH_SECONDS = 0.15;

interface Fading {
  image: Phaser.GameObjects.Image;
  age: number;
  life: number;
  grow: number; // how much bigger it gets over its life
}

/**
 * Draws cannonballs with the "3D feel" (plan, confirmed decisions):
 * the shadow sits on the water at (x, y), the ball is drawn higher up the screen by its height z.
 * Also plays splashes and muzzle flashes from the simulation's events.
 */
export class Cannonballs {
  private readonly scene: Phaser.Scene;
  private readonly balls = new Map<number, { ball: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }>();
  private readonly fading: Fading[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.makeTextures();
  }

  /** Start splashes and flashes. x, y in metres; s = screen pixels per metre. */
  play(events: readonly SimEvent[], s: number): void {
    for (const e of events) {
      if (e.type === 'splash') this.addFading('splash', e.x, e.y, s, SPLASH_SECONDS, 2.5);
      if (e.type === 'gunFired') this.addFading('flash', e.x, e.y, s, FLASH_SECONDS, 1.5);
      // Hits: brown splinters from the hull, a white puff of torn canvas from the rigging.
      // Drawn on the water spot below the hit, raised by its height like the balls.
      if (e.type === 'hit') this.addFading(e.zone === 'hull' ? 'splinters' : 'canvas', e.x, e.y - e.z * HEIGHT_SCALE, s, 0.6, 2);
      if (e.type === 'sunk') this.addFading('splash', e.x, e.y, s, 2.5, 8);
    }
  }

  /**
   * Draw the balls in flight. `ahead` = seconds since the last simulation step:
   * the ball is drawn a little further along its path, so it moves smoothly between steps.
   */
  update(balls: readonly Ball[], ahead: number, s: number, dt: number): void {
    const alive = new Set<number>();
    for (const b of balls) {
      alive.add(b.id);
      let pair = this.balls.get(b.id);
      if (!pair) {
        pair = {
          shadow: this.scene.add.image(0, 0, 'ball-shadow').setDepth(1.5).setAlpha(0.35),
          ball: this.scene.add.image(0, 0, 'ball').setDepth(4),
        };
        this.balls.set(b.id, pair);
      }
      const x = b.x + b.vx * ahead;
      const y = b.y + b.vy * ahead;
      const z = Math.max(0, b.z + b.vz * ahead);
      pair.shadow.setPosition(x * s, y * s).setScale(Math.max(1, s));
      pair.ball.setPosition(x * s, (y - z * HEIGHT_SCALE) * s).setScale(Math.max(1, s));
    }
    for (const [id, pair] of this.balls) {
      if (alive.has(id)) continue;
      pair.ball.destroy();
      pair.shadow.destroy();
      this.balls.delete(id);
    }

    for (const f of this.fading) {
      f.age += dt;
      const t = Math.min(1, f.age / f.life);
      f.image.setAlpha(1 - t).setScale(Math.max(1, s) * (1 + f.grow * t));
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i]!;
      if (f.age >= f.life) {
        f.image.destroy();
        this.fading.splice(i, 1);
      }
    }
  }

  private addFading(key: string, x: number, y: number, s: number, life: number, grow: number): void {
    const image = this.scene.add.image(x * s, y * s, key).setDepth(3).setScale(Math.max(1, s));
    this.fading.push({ image, age: 0, life, grow });
  }

  private makeTextures(): void {
    if (this.scene.textures.exists('ball')) return;
    const g = this.scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(0, 0, 3, 3);
    g.generateTexture('ball', 3, 3);
    g.clear();
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, 3, 2);
    g.generateTexture('ball-shadow', 3, 2);
    g.clear();
    g.lineStyle(1, 0xffffff, 1);
    g.strokeCircle(4, 4, 3);
    g.fillStyle(0xffffff, 0.6);
    g.fillRect(3, 3, 3, 3);
    g.generateTexture('splash', 9, 9);
    g.clear();
    g.fillStyle(0x6b3f1d, 1);
    for (const [x, y] of [[0, 2], [3, 0], [6, 3], [2, 6], [5, 6], [3, 3]]) g.fillRect(x!, y!, 2, 2);
    g.generateTexture('splinters', 8, 8);
    g.clear();
    g.fillStyle(0xf5f0e0, 1);
    g.fillCircle(4, 4, 3);
    g.fillStyle(0xffffff, 1);
    g.fillRect(1, 1, 2, 2);
    g.generateTexture('canvas', 8, 8);
    g.clear();
    g.fillStyle(0xfff1a8, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture('flash', 7, 7);
    g.destroy();
  }
}
