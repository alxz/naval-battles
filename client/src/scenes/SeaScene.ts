import Phaser from 'phaser';
import { Simulation } from '../sim/simulation';
import { createWorld } from '../sim/world';
import { Hud } from './Hud';
import { TouchControls } from './TouchControls';
import { Wake } from './Wake';

const SHIP_LENGTH = 30; // pixels
const SHIP_WIDTH = 14; // pixels
const BASE_PIXELS_PER_METRE = 2; // our scale rule: 1 m = 2 px (at zoom 1)
const ZOOMS = [1, 1.5, 2, 3]; // the steps for the Z / X keys
const SAIL_STEP = 0.25; // W / S change the sails by 25% per key press
const MAX_FRAME_SECONDS = 0.25; // ignore longer pauses (e.g. after a tab switch)

type KeyMap = Record<'W' | 'A' | 'S' | 'D' | 'Z' | 'X', Phaser.Input.Keyboard.Key>;

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
  private wake!: Wake;
  private hud!: Hud;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: KeyMap;
  private touch: TouchControls | null = null;
  private lastRudder = 0;
  private zoomIndex = 0;

  constructor() {
    super('Sea');
  }

  create(): void {
    this.sim = new Simulation(createWorld());

    // Phones and tablets get a closer view and the big HUD.
    const isTouch = this.sys.game.device.input.touch;
    this.zoomIndex = isTouch ? ZOOMS.indexOf(2) : 0;

    this.makeWaterTexture();
    this.makeShipTexture();

    // The water is a tiled picture that stays on the screen and slides when the ship moves.
    this.water = this.add.tileSprite(0, 0, 640, 360, 'water').setOrigin(0, 0).setScrollFactor(0);
    this.wake = new Wake(this);
    this.ship = this.add.image(0, 0, 'ship-placeholder').setDepth(2);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available');
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D,Z,X') as KeyMap;

    // On phones and tablets there is no keyboard, so show buttons.
    if (isTouch) {
      this.touch = new TouchControls(this, (direction) => this.changeSails(direction));
    }
    this.hud = new Hud(this, isTouch);
  }

  update(_time: number, delta: number): void {
    this.readInput();

    // 1. Let the simulation catch up with real time.
    const seconds = Math.min(delta / 1000, MAX_FRAME_SECONDS);
    const alpha = this.sim.update(seconds);

    // 2. Draw the ship between the last two steps, so the motion looks smooth.
    const zoom = ZOOMS[this.zoomIndex] ?? 1;
    const pxPerMetre = BASE_PIXELS_PER_METRE * zoom;
    const pose = this.sim.pose(0, alpha);
    this.ship.setPosition(pose.x * pxPerMetre, pose.y * pxPerMetre);
    this.ship.setRotation(pose.heading);
    this.ship.setScale(zoom);

    const speed = this.sim.world.ships[0]?.speed ?? 0;
    this.wake.update(seconds, pose.x, pose.y, pose.heading, speed, pxPerMetre);

    // 3. The camera follows the ship; the water slides under it.
    const cam = this.cameras.main;
    cam.centerOn(this.ship.x, this.ship.y);
    this.water.setTileScale(zoom);
    this.water.tilePositionX = cam.scrollX / zoom;
    this.water.tilePositionY = cam.scrollY / zoom;

    const ship = this.sim.world.ships[0];
    if (ship) this.hud.update(ship, this.sim.world.tick);
  }

  /** Keys -> commands. Rudder is held; sails change one step per key press. */
  private readInput(): void {
    const left = this.keys.A.isDown || this.cursors.left.isDown || (this.touch?.left ?? false);
    const right = this.keys.D.isDown || this.cursors.right.isDown || (this.touch?.right ?? false);
    const rudder = left === right ? 0 : right ? 1 : 0 - 1;
    if (rudder !== this.lastRudder) {
      this.lastRudder = rudder;
      this.sim.queueCommand({ type: 'setRudder', shipId: 1, value: rudder });
    }

    const more = Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.cursors.up);
    const less = Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.cursors.down);
    if (more) this.changeSails(1);
    if (less) this.changeSails(-1);

    // Zoom is only about the picture, so it does not go through the simulation.
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.zoomIndex = Math.min(this.zoomIndex + 1, ZOOMS.length - 1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this.zoomIndex = Math.max(this.zoomIndex - 1, 0);
  }

  /** One step more or less sail. Used by the keys and by the touch buttons. */
  private changeSails(direction: 1 | -1): void {
    const sails = this.sim.world.ships[0]?.sailLevel ?? 0;
    this.sim.queueCommand({ type: 'setSails', shipId: 1, value: sails + direction * SAIL_STEP });
  }

  /** A 64x64 tile of blue water with a few light wave marks. */
  private makeWaterTexture(): void {
    const g = this.make.graphics(new Phaser.Math.Vector2(0, 0), false);
    g.fillStyle(0x1d5b8f, 1);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x3a86b9, 1);
    g.fillRect(6, 10, 12, 2);
    g.fillRect(40, 22, 14, 2);
    g.fillRect(18, 40, 12, 2);
    g.fillRect(48, 54, 12, 2);
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
