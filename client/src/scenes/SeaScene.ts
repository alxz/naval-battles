import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { bearingDegToHeadingRad, headingRadToBearingDeg } from '../sim/angles';
import { SHIP_CLASSES } from '../sim/data';
import { Simulation } from '../sim/simulation';
import { sailingInfo } from '../sim/step';
import type { ShipState } from '../sim/types';
import { createWorld } from '../sim/world';
import { autoZoom } from '../view/autoZoom';
import { combatCameraCentre, nearest, smoothToward } from '../view/combatCamera';
import type { Point } from '../view/combatCamera';
import type { PixelLayout } from '../view/pixelLayout';
import { Compass } from './Compass';
import { EdgeMarkers } from './EdgeMarkers';
import type { Contact } from './EdgeMarkers';
import { Hud } from './Hud';
import { RangeRings } from './RangeRings';
import { ScreenFit } from './ScreenFit';
import { PLAYER_HULL, TARGET_HULL, makeShipTextures, shipTextureKey } from './ShipArt';
import { TouchControls } from './TouchControls';
import { TuningPanel, releaseFocus } from './TuningPanel';
import { Wake } from './Wake';

const PLAYER_ID = 1;
const TARGET_ID = 2;
const SAIL_STEP = 0.25; // W / S change the sails by 25% per key press
const MAX_FRAME_SECONDS = 0.25; // ignore longer pauses (e.g. after a tab switch)

type KeyMap = Record<'W' | 'A' | 'S' | 'D' | 'Z' | 'X', Phaser.Input.Keyboard.Key>;

/**
 * The sea, set up for the M1 scale test (plan section 4.1, decision O3).
 * This scene only does three things:
 *  1. reads the keys and turns them into commands,
 *  2. asks the simulation to move on in time,
 *  3. draws what the simulation says, with the sizes set in the tuning panel.
 * All the rules live in `sim/`.
 */
export class SeaScene extends Phaser.Scene {
  private sim!: Simulation;
  private screenFit!: ScreenFit;
  private panel!: TuningPanel;
  private shipImages: Phaser.GameObjects.Image[] = [];
  private water!: Phaser.GameObjects.TileSprite;
  private wake!: Wake;
  private rings!: RangeRings;
  private markers!: EdgeMarkers;
  private hud!: Hud;
  private compass!: Compass;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: KeyMap;
  private touch: TouchControls | null = null;
  private lastRudder = 0;
  private cameraCentre: Point | null = null; // metres
  private zoomGoal = 1; // the whole zoom step we are heading for
  private shownZoom = 1; // the zoom on the screen now (between steps only while changing)

  constructor() {
    super('Sea');
  }

  create(): void {
    this.sim = new Simulation(createWorld());
    const isTouch = this.sys.game.device.input.touch;

    makeShipTextures(this);
    this.makeWaterTexture();

    // The water is a tiled picture that stays on the screen and slides when the ship moves.
    this.water = this.add.tileSprite(0, 0, 640, 360, 'water').setOrigin(0, 0).setScrollFactor(0);
    this.wake = new Wake(this);
    this.rings = new RangeRings(this);
    for (const ship of this.sim.world.ships) {
      const hull = ship.id === PLAYER_ID ? PLAYER_HULL : TARGET_HULL;
      this.shipImages.push(this.add.image(0, 0, shipTextureKey(ship.shipClass, hull)).setDepth(2));
    }
    this.markers = new EdgeMarkers(this);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available');
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D,Z,X') as KeyMap;

    // On phones and tablets there is no keyboard, so show buttons.
    if (isTouch) {
      this.touch = new TouchControls(
        this,
        (direction) => this.changeSails(direction),
        () => this.stepZoom(),
      );
    }
    this.hud = new Hud(this, isTouch);
    this.compass = new Compass(this); // last: drawn on top of everything

    // Integer pixel scaling: measure the screen now and after every resize.
    this.screenFit = new ScreenFit(this, (layout) => this.onLayout(layout));

    this.panel = new TuningPanel(
      {
        pixelsPerMetre: viewJson.pixelsPerMetre,
        zoom: viewJson.zoomSteps[0] ?? 1,
        logicalHeight: this.screenFit.targetHeight,
        speedScale: 1,
        combatCamera: true,
        autoZoom: viewJson.autoZoom,
        closeFightRange: viewJson.closeFightRange,
        rangeRings: true,
        targetClass: 'sloop',
        windFromBearingDeg: Math.round(headingRadToBearingDeg(this.sim.world.wind.fromRad) * 10) / 10,
        windStrength: this.sim.world.wind.strength,
      },
      {
        onLogicalHeight: (h) => this.screenFit.setTargetHeight(h),
        onSpeedScale: (s) => (this.sim.tuning.speedScale = s),
        onPlaceTarget: (d) => this.placeTarget(d),
        onTargetClass: () => this.placeTarget(this.targetDistance()),
        onWind: (fromBearingDeg, strength) =>
          this.sim.queueCommand({ type: 'setWind', fromRad: bearingDegToHeadingRad(fromBearingDeg), strength }),
      },
      isTouch,
    );
    this.screenFit.apply();

    // A click or tap on the sea gives the keyboard back to the game (see releaseFocus).
    this.input.on('pointerdown', () => releaseFocus());
  }

  update(_time: number, delta: number): void {
    this.readInput();
    const v = this.panel.values;

    // 1. Let the simulation catch up with real time.
    const seconds = Math.min(delta / 1000, MAX_FRAME_SECONDS);
    const alpha = this.sim.update(seconds);

    // 2. Zoom. Sailing: your zoom (keys, button, slider). Enemy near and auto zoom on:
    //    the largest whole step that shows both ships. The change is smoothed over ~0.25 s.
    const cam = this.cameras.main;
    this.zoomGoal = this.chooseZoom();
    const k = 1 - Math.exp(-seconds / viewJson.zoomSmoothing);
    this.shownZoom += (this.zoomGoal - this.shownZoom) * k;
    if (Math.abs(this.zoomGoal - this.shownZoom) < 0.01) this.shownZoom = this.zoomGoal;

    // Screen pixels per game metre = base scale x zoom (plan section 4.0).
    const s = v.pixelsPerMetre * this.shownZoom;
    const halfW = cam.width / 2 / s; // half the view, in metres
    const halfH = cam.height / 2 / s;

    // 3. Draw every ship between the last two steps, so the motion looks smooth.
    const poses = this.sim.world.ships.map((_ship, i) => this.sim.pose(i, alpha));
    this.sim.world.ships.forEach((ship, i) => {
      const pose = poses[i];
      const image = this.shipImages[i];
      if (!pose || !image) return;
      const hull = ship.id === PLAYER_ID ? PLAYER_HULL : TARGET_HULL;
      const key = shipTextureKey(ship.shipClass, hull);
      if (image.texture.key !== key) image.setTexture(key);
      image.setPosition(pose.x * s, pose.y * s).setRotation(pose.headingRad).setScale(s);
    });

    const me = poses[0];
    const myShip = this.sim.world.ships[0];
    if (!me || !myShip) return;
    this.wake.update(seconds, me.x, me.y, me.headingRad, myShip.speed, s);
    this.rings.visible = v.rangeRings;
    this.rings.update(me.x, me.y, me.headingRad, s);

    // 4. The camera: at your ship, or pulled toward the nearest enemy (combat camera).
    const enemies = poses.slice(1);
    const goal = v.combatCamera
      ? combatCameraCentre(me, nearest(me, enemies), halfW, halfH, {
          range: viewJson.combatCameraRange,
          keepInside: viewJson.combatCameraKeepInside,
        })
      : { x: me.x, y: me.y };
    this.cameraCentre = this.cameraCentre
      ? smoothToward(this.cameraCentre, goal, seconds, viewJson.combatCameraSmoothing)
      : goal;
    cam.centerOn(this.cameraCentre.x * s, this.cameraCentre.y * s);

    // The water slides under the camera. Whole zoom steps keep the water pixels even.
    const z = this.shownZoom;
    this.water.setTileScale(z);
    this.water.tilePositionX = cam.scrollX / z;
    this.water.tilePositionY = cam.scrollY / z;

    // 5. Edge markers for ships within sighting range that are off the screen.
    const contacts: Contact[] = [];
    for (const p of enemies) {
      const distance = Math.hypot(p.x - me.x, p.y - me.y);
      if (distance > viewJson.sightingRange) continue;
      contacts.push({ screenX: p.x * s - cam.scrollX, screenY: p.y * s - cam.scrollY, distance });
    }
    this.markers.update(contacts, cam.width, cam.height);

    // 6. Numbers.
    const layout = this.screenFit.layout;
    this.panel.info.pixelScale = `x${layout.pixelScale} (${layout.width} x ${layout.height})`;
    this.panel.info.view = `${Math.round(halfW * 2)} x ${Math.round(halfH * 2)}`;
    this.panel.info.zoomNow = `x${this.zoomGoal}${this.zoomGoal !== v.zoom ? ' (auto)' : ''}`;
    const wind = this.sim.world.wind;
    const params = SHIP_CLASSES[myShip.shipClass];
    const sailing = params ? sailingInfo(myShip, params, wind) : { twaDeg: 0, share: 0, noGoDeg: 0 };
    this.compass.update({
      headingRad: me.headingRad,
      windFromRad: wind.fromRad,
      windStrength: wind.strength,
      noGoDeg: sailing.noGoDeg,
      twaDeg: sailing.twaDeg,
    });
    this.hud.update(myShip, this.sim.world.tick, {
      viewWidthM: halfW * 2,
      viewHeightM: halfH * 2,
      pixelScale: layout.pixelScale,
      logicalWidth: layout.width,
      logicalHeight: layout.height,
      zoom: this.zoomGoal,
      targetDistance: this.targetDistance(),
    }, sailing, wind);
  }

  /** Which whole zoom step to show now. */
  private chooseZoom(): number {
    const v = this.panel.values;
    const me = this.ship(PLAYER_ID);
    if (!v.autoZoom || !me) return v.zoom;
    const others = this.sim.world.ships.filter((sh) => sh.id !== PLAYER_ID);
    const enemy = nearest(me, others);
    if (!enemy || Math.hypot(enemy.x - me.x, enemy.y - me.y) > viewJson.combatCameraRange) return v.zoom;
    const cam = this.cameras.main;
    return autoZoom(this.zoomGoal, viewJson.zoomSteps, me, enemy, {
      widthPx: cam.width,
      heightPx: cam.height,
      pixelsPerMetre: v.pixelsPerMetre,
      keepInside: viewJson.combatCameraKeepInside,
      marginPx: viewJson.autoZoomMarginPx,
      spareToZoomInPx: viewJson.autoZoomSpareInPx,
      closeFightRange: v.closeFightRange,
      closeFightRangeSpare: viewJson.closeFightRangeSpare,
    });
  }

  /** The screen got a new logical size: resize the camera, water and buttons. */
  private onLayout(layout: PixelLayout): void {
    this.cameras.main.setSize(layout.width, layout.height);
    this.water.setSize(layout.width, layout.height);
    this.touch?.layout(layout.width, layout.height);
    this.compass.layout(layout.width, layout.height, this.screenFit.isPhone);
  }

  /** Keys -> commands. Rudder is held; sails change one step per key press. */
  private readInput(): void {
    const left = this.keys.A.isDown || this.cursors.left.isDown || (this.touch?.left ?? false);
    const right = this.keys.D.isDown || this.cursors.right.isDown || (this.touch?.right ?? false);
    const rudder = left === right ? 0 : right ? 1 : 0 - 1;
    if (rudder !== this.lastRudder) {
      this.lastRudder = rudder;
      this.sim.queueCommand({ type: 'setRudder', shipId: PLAYER_ID, value: rudder });
    }

    const more = Phaser.Input.Keyboard.JustDown(this.keys.W) || Phaser.Input.Keyboard.JustDown(this.cursors.up);
    const less = Phaser.Input.Keyboard.JustDown(this.keys.S) || Phaser.Input.Keyboard.JustDown(this.cursors.down);
    if (more) this.changeSails(1);
    if (less) this.changeSails(-1);

    // Zoom is only about the picture, so it does not go through the simulation.
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.setZoom(this.panel.values.zoom + 1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this.setZoom(this.panel.values.zoom - 1);
  }

  private setZoom(zoom: number): void {
    const z = Math.max(1, Math.min(4, Math.round(zoom)));
    this.panel.setZoom(z);
    this.touch?.setZoomLabel(z);
  }

  /** The zoom button on touch screens: go through the zoom steps from view.json. */
  private stepZoom(): void {
    const steps = viewJson.zoomSteps;
    const i = steps.indexOf(this.panel.values.zoom);
    this.setZoom(steps[(i + 1) % steps.length] ?? 1);
  }

  /** One step more or less sail. Used by the keys and by the touch buttons. */
  private changeSails(direction: 1 | -1): void {
    const sails = this.ship(PLAYER_ID)?.sailLevel ?? 0;
    this.sim.queueCommand({ type: 'setSails', shipId: PLAYER_ID, value: sails + direction * SAIL_STEP });
  }

  /** Put the target on your starboard beam, `distance` metres away, parallel to you. */
  private placeTarget(distance: number): void {
    const me = this.ship(PLAYER_ID);
    if (!me) return;
    const side = me.headingRad + Math.PI / 2; // starboard (clockwise from the bow)
    this.sim.queueCommand({
      type: 'placeShip',
      shipId: TARGET_ID,
      x: me.x + Math.cos(side) * distance,
      y: me.y + Math.sin(side) * distance,
      headingRad: me.headingRad,
      shipClass: this.panel.values.targetClass,
    });
  }

  private targetDistance(): number {
    const me = this.ship(PLAYER_ID);
    const target = this.ship(TARGET_ID);
    if (!me || !target) return 0;
    return Math.hypot(target.x - me.x, target.y - me.y);
  }

  private ship(id: number): ShipState | undefined {
    return this.sim.world.ships.find((s) => s.id === id);
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
}
