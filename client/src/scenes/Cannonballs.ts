import Phaser from 'phaser';
import artJson from '../data/shipArt.json';
import { sideAngleRad } from '../sim/guns';
import type { Ball, SimEvent, WindNow } from '../sim/types';

/** Screen pixels up per metre of height: the same number the ship pictures were drawn with. */
const HEIGHT_SCALE = artJson.heightScale;

const SPLASH_SECONDS = 0.7;
const FLASH_SECONDS = 0.15;

const SMOKE_SECONDS = 3.6;
const SMOKE_DRIFT = 8; // m/s at full wind strength
const SMOKE_BLAST = 3; // m/s: the puff first leaves the gun port outward
const SMOKE_OUT = 4; // metres outside the hull where it starts
const BUBBLES = 10; // small splashes around a sinking ship

/** A short effect: placed in game metres (so it stays put when the zoom changes), it may drift. */
interface Fading {
  image: Phaser.GameObjects.Image;
  x: number; // metres
  y: number;
  vx: number; // metres per second
  vy: number;
  age: number; // seconds; below 0 = waiting to start
  life: number;
  grow: number; // how much bigger it gets over its life
  alpha: number; // starting alpha
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

  /**
   * Start the effects of the simulation's events. x, y in metres; s = screen pixels per metre.
   *   gunFired  a flash, then two puffs of gun smoke that drift downwind and fade
   *   splash    a ring of water
   *   hit       brown splinters (hull) or a white puff of torn canvas (rigging), raised by the height of the hit
   *   sunk      a big ring and bubbles for two seconds
   * Random numbers here only change the picture, never the game, so Math.random is fine.
   */
  play(events: readonly SimEvent[], s: number, wind: WindNow, headingOf: (shipId: number) => number | undefined): void {
    const downwind = wind.fromRad + Math.PI;
    const drift = SMOKE_DRIFT * wind.strength;
    for (const e of events) {
      if (e.type === 'splash') this.addFading('splash', e.x, e.y, s, SPLASH_SECONDS, 2.5);
      if (e.type === 'gunFired') {
        this.addFading('flash', e.x, e.y, s, FLASH_SECONDS, 1.5);
        // The smoke leaves the gun port outward (a blast), then the wind carries it away.
        const heading = headingOf(e.shipId);
        const out = heading === undefined ? downwind : sideAngleRad(heading, e.side);
        for (let i = 0; i < 2; i++) {
          const jitter = (Math.random() - 0.5) * 0.8;
          const speed = drift * (0.7 + Math.random() * 0.6);
          const blast = SMOKE_BLAST * (0.6 + Math.random() * 0.8);
          this.addFading(
            'smoke',
            e.x + Math.cos(out) * SMOKE_OUT + (Math.random() - 0.5) * 3,
            e.y + Math.sin(out) * SMOKE_OUT - 2 + (Math.random() - 0.5) * 3,
            s,
            SMOKE_SECONDS * (0.8 + Math.random() * 0.4),
            2,
            {
              vx: Math.cos(downwind + jitter) * speed + Math.cos(out) * blast,
              vy: Math.sin(downwind + jitter) * speed + Math.sin(out) * blast - 0.6, // and it rises a little (up the screen)
              alpha: 0.45,
              delay: i * 0.05,
            },
          );
        }
      }
      if (e.type === 'hit') this.addFading(e.zone === 'hull' ? 'splinters' : 'canvas', e.x, e.y - e.z * HEIGHT_SCALE, s, 0.6, 2);
      if (e.type === 'sunk') {
        this.addFading('splash', e.x, e.y, s, 2.5, 8);
        for (let i = 0; i < BUBBLES; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 12;
          this.addFading('splash', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, s, 0.6, 1.2, { delay: 0.2 + Math.random() * 2, alpha: 0.7 });
        }
      }
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
      if (f.age < 0) continue; // not started yet
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      const t = Math.min(1, f.age / f.life);
      f.image
        .setVisible(true)
        .setPosition(f.x * s, f.y * s)
        .setAlpha(f.alpha * (1 - t))
        .setScale(Math.max(1, s) * (1 + f.grow * t));
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i]!;
      if (f.age >= f.life) {
        f.image.destroy();
        this.fading.splice(i, 1);
      }
    }
  }

  private addFading(
    key: string,
    x: number,
    y: number,
    s: number,
    life: number,
    grow: number,
    more: { vx?: number; vy?: number; alpha?: number; delay?: number } = {},
  ): void {
    const delay = more.delay ?? 0;
    const image = this.scene.add.image(x * s, y * s, key).setDepth(key === 'smoke' ? 3.5 : 3).setScale(Math.max(1, s)).setVisible(delay <= 0);
    this.fading.push({ image, x, y, vx: more.vx ?? 0, vy: more.vy ?? 0, age: -delay, life, grow, alpha: more.alpha ?? 1 });
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
    g.clear();
    // Gun smoke: a soft grey puff (a darker edge, a lighter middle).
    g.fillStyle(0xbfc3c7, 1);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0xdfe2e4, 1);
    g.fillCircle(4, 4, 3);
    g.generateTexture('smoke', 11, 11);
    g.destroy();
  }
}
