import Phaser from 'phaser';
import { Simulation } from '../sim/simulation';
import { createWorld } from '../sim/world';

const SHIP_LENGTH = 30; // pixels
const SHIP_WIDTH = 14; // pixels
const PIXELS_PER_METRE = 2; // our scale rule: 1 m = 2 px
const SAIL_STEP = 0.25; // W / S change the sails by 25% per key press
const MAX_FRAME_SECONDS = 0.25; // ignore longer pauses (e.g. after a tab switch)

type KeyMap = Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

/**
 * The sea. This scene only does three things:
 *  1. reads the keys and turns them into commands,
 *  2. asks the simulation to move on in time,
 *  3. draws what the simulation says.
 * All the rules live in `sim/`.
 */
export class SeaScene extends Phaser.Scene {
  private sim!: Simulation;
  private ship!: Phaser.GameObjects.Image;
  private water!: Phaser.GameObjects.TileSprite;
  private hud!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: KeyMap;
  private lastRudder = 0;

  constructor() {
    super('Sea');
  }

  create(): void {
    this.sim = new Simulation(createWorld());

    this.makeWaterTexture();
    this.makeShipTexture();

    // The water is a tiled picture that stays on the screen and slides when the ship moves.
    this.water = this.add.tileSprite(0, 0, 640, 360, 'water').setOrigin(0, 0).setScrollFactor(0);
    this.ship = this.add.image(0, 0, 'ship-placeholder');

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available');
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D') as KeyMap;

    this.hud = this.add
      .text(8, 8, '', { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' })
      .setScrollFactor(0);
  }

  update(_time: number, delta: number): void {
    this.readInput();

    // 1. Let the simulation catch up with real time.
    const seconds = Math.min(delta / 1000, MAX_FRAME_SECONDS);
    const alpha = this.sim.update(seconds);

    // 2. Draw the ship between the last two steps, so the motion looks smooth.
    const pose = this.sim.pose(0, alpha);
    this.ship.setPosition(pose.x * PIXELS_PER_METRE, pose.y * PIXELS_PER_METRE);
    this.ship.setRotation(pose.heading);

    // 3. The camera follows the ship; the water slides under it.
    const cam = this.cameras.main;
    cam.centerOn(this.ship.x, this.ship.y);
    this.water.tilePositionX = cam.scrollX;
    this.water.tilePositionY = cam.scrollY;

    this.drawHud();
  }

  /** Keys -> commands. Rudder is held; sails change one step per key press. */
  private readInput(): void {
    const left = this.keys.A.isDown || this.cursors.left.isDown;
    const right = this.keys.D.isDown || this.cursors.right.isDown;
    const rudder = left === right ? 0 : right ? 1 : 0 - 1;
    if (rudder !== this.lastRudder) {
      this.lastRudder = rudder;
      this.sim.queueCommand({ type: 'setRudder', shipId: 1, value: rudder });
    }

    const sails = this.sim.world.ships[0]?.sailLevel ?? 0;
    const more = Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.cursors.up);
    const less = Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.cursors.down);
    if (more) this.sim.queueCommand({ type: 'setSails', shipId: 1, value: sails + SAIL_STEP });
    if (less) this.sim.queueCommand({ type: 'setSails', shipId: 1, value: sails - SAIL_STEP });
  }

  private drawHud(): void {
    const s = this.sim.world.ships[0];
    if (!s) return;
    const degrees = ((s.heading * 180) / Math.PI + 360) % 360;
    this.hud.setText(
      [
        'Naval-Battles M1 - sailing',
        'A / D rudder   W / S sails',
        `sails ${Math.round(s.sailLevel * 100)}%   speed ${s.speed.toFixed(1)} m/s`,
        `heading ${degrees.toFixed(0)} deg   tick ${this.sim.world.tick}`,
      ].join('\n'),
    );
  }

  /** A 64x64 tile of blue water with a few light wave marks. */
  private makeWaterTexture(): void {
    const g = this.make.graphics(new Phaser.Math.Vector2(0, 0), false);
    g.fillStyle(0x1d5b8f, 1);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x2f78ad, 1);
    g.fillRect(6, 10, 8, 1);
    g.fillRect(40, 22, 10, 1);
    g.fillRect(18, 40, 8, 1);
    g.fillRect(50, 54, 8, 1);
    g.generateTexture('water', 64, 64);
    g.destroy();
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
