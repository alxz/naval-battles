import Phaser from 'phaser';

const SPACING = 1.6; // metres of travel between two puffs of foam
const STERN_LIFE = 4.5; // seconds the foam behind the stern lives
const ARM_LIFE = 6; // seconds the two bow waves live
const ARM_SPREAD = 0.36; // the bow waves move sideways at this share of the ship's speed
const MIN_SPEED = 0.5; // m/s: a ship slower than this leaves no wake
const POOL_SIZE = 320;

interface FoamDot {
  x: number; // metres
  y: number;
  vx: number; // metres per second (the bow waves spread sideways)
  vy: number;
  age: number; // seconds
  life: number;
  size: number; // metres across when new
  alpha: number; // when new
  grow: number; // how many times bigger at the end of its life
}

/** A ship that leaves a wake: where it is (metres), where it points, how fast and how big it is. */
export interface WakeShip {
  id: number;
  x: number;
  y: number;
  headingRad: number;
  speed: number;
  length: number;
  beam: number;
}

/**
 * The wake of every ship: a "V" of two bow waves that spread and fade, and a band of foam
 * behind the stern that widens. A faster ship leaves a brighter, longer wake.
 * It is only a picture: the simulation knows nothing about it.
 */
export class Wake {
  private dots: FoamDot[] = [];
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private readonly travelled = new Map<number, number>();

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists('foam')) {
      const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture('foam', 8, 8);
      g.destroy();
    }
    for (let i = 0; i < POOL_SIZE; i++) this.sprites.push(scene.add.image(0, 0, 'foam').setDepth(0.8).setVisible(false));
  }

  /** Forget all foam (a new battle). */
  clear(): void {
    this.dots = [];
    this.travelled.clear();
  }

  /** Call every frame. `dt` is real time in seconds; `maxSpeed` scales the brightness. */
  update(dt: number, ships: readonly WakeShip[], pxPerMetre: number): void {
    for (const ship of ships) {
      const gone = (this.travelled.get(ship.id) ?? 0) + ship.speed * dt;
      if (ship.speed <= MIN_SPEED || gone < SPACING) {
        this.travelled.set(ship.id, gone);
        continue;
      }
      this.travelled.set(ship.id, 0);
      const cos = Math.cos(ship.headingRad);
      const sin = Math.sin(ship.headingRad);
      const strength = Math.min(1, ship.speed / 8); // 0..1
      // Foam behind the stern: as wide as the hull, it widens as it fades.
      this.push({
        x: ship.x - cos * ship.length * 0.45,
        y: ship.y - sin * ship.length * 0.45,
        vx: 0,
        vy: 0,
        age: 0,
        life: STERN_LIFE * (0.6 + 0.4 * strength),
        size: ship.beam * 0.55,
        alpha: 0.3 + 0.35 * strength,
        grow: 2.2,
      });
      // The two bow waves: they start at the shoulders of the bow and move out sideways.
      for (const side of [-1, 1]) {
        const out = ARM_SPREAD * ship.speed * side;
        this.push({
          x: ship.x + cos * ship.length * 0.3 - sin * ship.beam * 0.4 * side,
          y: ship.y + sin * ship.length * 0.3 + cos * ship.beam * 0.4 * side,
          vx: -sin * out,
          vy: cos * out,
          age: 0,
          life: ARM_LIFE * (0.5 + 0.5 * strength),
          size: 3 + ship.beam * 0.12,
          alpha: 0.3 + 0.4 * strength,
          grow: 1.6,
        });
      }
    }

    for (const dot of this.dots) {
      dot.age += dt;
      dot.x += dot.vx * dt;
      dot.y += dot.vy * dt;
    }
    this.dots = this.dots.filter((d) => d.age < d.life);

    this.sprites.forEach((sprite, i) => {
      const dot = this.dots[i];
      if (!dot) {
        sprite.setVisible(false);
        return;
      }
      const t = dot.age / dot.life; // 0 = new, 1 = gone
      sprite
        .setVisible(true)
        .setPosition(dot.x * pxPerMetre, dot.y * pxPerMetre)
        .setAlpha(dot.alpha * (1 - t))
        .setScale(((dot.size * pxPerMetre) / 8) * (1 + t * (dot.grow - 1)));
    });
  }

  private push(dot: FoamDot): void {
    if (this.dots.length >= POOL_SIZE) this.dots.shift();
    this.dots.push(dot);
  }
}
