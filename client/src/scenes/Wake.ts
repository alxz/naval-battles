import Phaser from 'phaser';

const LIFE = 2.5; // seconds a foam dot lives
const SPACING = 1.5; // metres of travel between two dots
const STERN_OFFSET = 7; // metres behind the ship's centre
const POOL_SIZE = 40;

interface FoamDot {
  x: number; // metres
  y: number; // metres
  age: number; // seconds
}

/**
 * A trail of fading foam dots behind the ship. It is only a picture: the simulation
 * knows nothing about it. It makes the motion easy to see on a plain sea.
 */
export class Wake {
  private dots: FoamDot[] = [];
  private sprites: Phaser.GameObjects.Image[] = [];
  private travelled = 0;

  constructor(scene: Phaser.Scene) {
    const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture('foam', 6, 6);
    g.destroy();

    for (let i = 0; i < POOL_SIZE; i++) {
      this.sprites.push(scene.add.image(0, 0, 'foam').setVisible(false));
    }
  }

  /** Call every frame. `dt` is real time in seconds; the position is in metres. */
  update(dt: number, x: number, y: number, heading: number, speed: number, pxPerMetre: number): void {
    this.travelled += speed * dt;
    if (speed > 0.5 && this.travelled >= SPACING && this.dots.length < POOL_SIZE) {
      this.travelled = 0;
      this.dots.push({
        x: x - Math.cos(heading) * STERN_OFFSET,
        y: y - Math.sin(heading) * STERN_OFFSET,
        age: 0,
      });
    }

    for (const dot of this.dots) dot.age += dt;
    this.dots = this.dots.filter((d) => d.age < LIFE);

    this.sprites.forEach((sprite, i) => {
      const dot = this.dots[i];
      if (!dot) {
        sprite.setVisible(false);
        return;
      }
      const t = dot.age / LIFE; // 0 = new, 1 = gone
      sprite
        .setVisible(true)
        .setPosition(dot.x * pxPerMetre, dot.y * pxPerMetre)
        .setAlpha(0.7 * (1 - t))
        .setScale((pxPerMetre / 2) * (0.8 + t * 1.2));
    });
  }
}
