import Phaser from 'phaser';

const SHIP_LENGTH = 30; // pixels
const SHIP_WIDTH = 14; // pixels
const MAX_SPEED = 60; // pixels per second
const ACCELERATION = 30; // pixels per second, per second
const TURN_RATE = 1.6; // radians per second

type KeyMap = Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

/**
 * M0 test scene: a placeholder ship on blue water that you steer with the keys.
 * This is throwaway code. In M1 the movement rules move into `sim/`.
 */
export class SeaScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: KeyMap;
  private heading = 0; // radians; 0 = east, clockwise (the same as the screen)
  private speed = 0; // pixels per second

  constructor() {
    super('Sea');
  }

  create(): void {
    this.makeShipTexture();
    this.ship = this.add.image(320, 180, 'ship-placeholder');

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available');
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D') as KeyMap;

    this.add.text(8, 8, 'Naval-Battles M0 test\nA / D turn, W / S speed', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.keys.A.isDown || this.cursors.left.isDown) {
      this.heading -= TURN_RATE * dt;
    }
    if (this.keys.D.isDown || this.cursors.right.isDown) {
      this.heading += TURN_RATE * dt;
    }
    if (this.keys.W.isDown || this.cursors.up.isDown) {
      this.speed += ACCELERATION * dt;
    }
    if (this.keys.S.isDown || this.cursors.down.isDown) {
      this.speed -= ACCELERATION * dt;
    }
    this.speed = Phaser.Math.Clamp(this.speed, 0, MAX_SPEED);

    this.ship.x += Math.cos(this.heading) * this.speed * dt;
    this.ship.y += Math.sin(this.heading) * this.speed * dt;
    this.ship.rotation = this.heading;

    // Come back on the opposite side of the screen.
    this.ship.x = Phaser.Math.Wrap(this.ship.x, 0, 640);
    this.ship.y = Phaser.Math.Wrap(this.ship.y, 0, 360);
  }

  /** Draws a simple hull shape (bow to the right) and stores it as a texture. */
  private makeShipTexture(): void {
    const g = this.make.graphics(new Phaser.Math.Vector2(0, 0), false);
    g.fillStyle(0x8b5a2b, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(0, 1),
        new Phaser.Math.Vector2(SHIP_LENGTH - 10, 0),
        new Phaser.Math.Vector2(SHIP_LENGTH, SHIP_WIDTH / 2),
        new Phaser.Math.Vector2(SHIP_LENGTH - 10, SHIP_WIDTH),
        new Phaser.Math.Vector2(0, SHIP_WIDTH - 1),
      ],
      true,
    );
    g.fillStyle(0xf2e8c9, 1);
    g.fillRect(SHIP_LENGTH / 2 - 3, 2, 4, SHIP_WIDTH - 4);
    g.generateTexture('ship-placeholder', SHIP_LENGTH, SHIP_WIDTH);
    g.destroy();
  }
}
