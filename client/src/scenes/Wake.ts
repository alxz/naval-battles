import Phaser from 'phaser';

const SPACING = 1.5; // metres of travel between two puffs of foam
const STERN_LIFE = 5; // seconds the foam behind the stern lives
const ARM_LIFE = 3.5; // seconds the two bow waves live
const ARM_SPREAD = 0.22; // the bow waves move sideways at this share of the ship's speed
const MIN_SPEED = 0.5; // m/s: a ship slower than this leaves no wake
const POOL_SIZE = 600;

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
 * The wake of every ship: a band of small foam specks behind the stern that widens and fades,
 * and two faint bow waves. A faster ship leaves a brighter, longer wake.
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
      // Foam behind the stern: a few small specks across the width of the hull, each a little
      // different (Math.random is fine here: this is only a picture). They widen and fade.
      const specks = 2 + (Math.random() < strength ? 1 : 0);
      for (let i = 0; i < specks; i++) {
        const across = (Math.random() - 0.5) * ship.beam * 0.8;
        const back = ship.length * (0.42 + Math.random() * 0.12);
        this.push({
          x: ship.x - cos * back - sin * across,
          y: ship.y - sin * back + cos * across,
          vx: -sin * across * 0.06,
          vy: cos * across * 0.06,
          age: 0,
          life: STERN_LIFE * (0.5 + 0.5 * strength) * (0.7 + Math.random() * 0.6),
          size: 1.5 + Math.random() * 2.5,
          alpha: (0.12 + 0.2 * strength) * (0.6 + Math.random() * 0.4),
          grow: 1.6 + Math.random(),
        });
      }
      // The two bow waves: faint, they start at the shoulders of the bow and move out sideways.
      for (const side of [-1, 1]) {
        const out = ARM_SPREAD * ship.speed * side;
        this.push({
          x: ship.x + cos * ship.length * 0.25 - sin * ship.beam * 0.45 * side,
          y: ship.y + sin * ship.length * 0.25 + cos * ship.beam * 0.45 * side,
          vx: -sin * out,
          vy: cos * out,
          age: 0,
          life: ARM_LIFE * (0.5 + 0.5 * strength),
          size: 1.5 + Math.random(),
          alpha: 0.05 + 0.09 * strength,
          grow: 1.8,
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
