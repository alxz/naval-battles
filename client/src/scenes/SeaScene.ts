import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { bearingDegToHeadingRad, headingRadToBearingDeg } from '../sim/angles';
import { SHIP_CLASSES } from '../sim/data';
import { Simulation } from '../sim/simulation';
import { circleRudder } from '../sim/circle';
import type { Circle } from '../sim/circle';
import { STEP_SECONDS, sailingInfo } from '../sim/step';
import { GUNS } from '../sim/data';
import { predictLanding } from '../sim/guns';
import type { ShipParams, ShipState } from '../sim/types';
import { createWorld } from '../sim/world';
import { autoZoom } from '../view/autoZoom';
import { combatCameraCentre, nearest, smoothToward } from '../view/combatCamera';
import type { Point } from '../view/combatCamera';
import type { PixelLayout } from '../view/pixelLayout';
import { Cannonballs } from './Cannonballs';
import { EdgeMarkers } from './EdgeMarkers';
import type { Contact } from './EdgeMarkers';
import { Hud, debugLines } from './Hud';
import { makeHudIcons } from './icons';
import { Islands } from './Islands';
import { LandingMarkers } from './LandingMarkers';
import { RangeRings } from './RangeRings';
import { ScreenFit } from './ScreenFit';
import { loadShipSheets, makeShipTextures, showShip } from './ShipArt';
import { TouchControls } from './TouchControls';
import { TuningPanel, releaseFocus } from './TuningPanel';
import { Wake } from './Wake';

const PLAYER_ID = 1;
const TARGET_ID = 2;
const SAIL_STEP = 0.25; // W / S change the sails by 25% per key press
const MAX_FRAME_SECONDS = 0.25; // ignore longer pauses (e.g. after a tab switch)

type KeyMap = Record<'W' | 'A' | 'S' | 'D' | 'Z' | 'X' | 'Q' | 'E' | 'R' | 'F' | 'H', Phaser.Input.Keyboard.Key>;

/**
 * Keys for the guns up / down: "+" and "-" on the main keyboard and on the number pad.
 * Browsers disagree on the codes of the main keys (Chrome/Safari 187/189, Firefox 61/173), so we take both.
 */
const RAISE_KEY_CODES = [187, 61, 107];
const LOWER_KEY_CODES = [189, 173, 109];

const ELEVATION_DEG_PER_SECOND = 4; // R / F held

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
  private islands!: Islands;
  private cannonballs!: Cannonballs;
  private markers2!: LandingMarkers;
  private elevationDeg = 5; // what the keys ask for; sent as a command when it changes
  private rings!: RangeRings;
  private markers!: EdgeMarkers;
  private hud!: Hud;
  private raiseKeys: Phaser.Input.Keyboard.Key[] = [];
  private lowerKeys: Phaser.Input.Keyboard.Key[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: KeyMap;
  private touch: TouchControls | null = null;
  private lastRudder = 0;
  private cameraCentre: Point | null = null; // metres
  private zoomGoal = 1; // the whole zoom step we are heading for
  private shownZoom = 1; // the zoom on the screen now (between steps only while changing)
  private targetCircle: Circle | null = null; // the circle the moving target sails round
  private ballsFired = 0; // your balls since the last reset (for the hit count)
  private hullHits = 0;

  constructor() {
    super('Sea');
  }

  preload(): void {
    loadShipSheets(this);
  }

  create(): void {
    this.sim = new Simulation(createWorld());
    const isTouch = this.sys.game.device.input.touch;

    makeShipTextures(this);
    this.makeWaterTexture();

    // The water is a tiled picture that stays on the screen and slides when the ship moves.
    this.water = this.add.tileSprite(0, 0, 640, 360, 'water').setOrigin(0, 0).setScrollFactor(0);
    this.wake = new Wake(this);
    this.islands = new Islands(this);
    this.rings = new RangeRings(this);
    this.markers2 = new LandingMarkers(this);
    this.cannonballs = new Cannonballs(this);
    for (const ship of this.sim.world.ships) {
      const owner = ship.id === PLAYER_ID ? 'player' : 'enemy';
      this.shipImages.push(this.add.image(0, 0, `box-${ship.shipClass}-${owner}`).setDepth(2));
    }
    this.markers = new EdgeMarkers(this);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available');
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D,Z,X,Q,E,R,F,H') as KeyMap;
    this.raiseKeys = RAISE_KEY_CODES.map((code) => keyboard.addKey(code));
    this.lowerKeys = LOWER_KEY_CODES.map((code) => keyboard.addKey(code));
    makeHudIcons(this);

    // On phones and tablets there is no keyboard, so show buttons.
    if (isTouch) {
      this.touch = new TouchControls(
        this,
        (direction) => this.changeSails(direction),
        () => this.stepZoom(),
        (side) => this.sim.queueCommand({ type: 'fire', shipId: PLAYER_ID, side }),
      );
    }
    this.hud = new Hud(this, isTouch); // last: drawn on top of everything

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
        shipArt: 16,
        detailAtZoom: true,
        rangeRings: true,
        targetClass: 'sloop',
        targetMoving: true,
        targetSailsPercent: 30,
        targetCircleRadius: 150,
        windFromBearingDeg: Math.round(headingRadToBearingDeg(this.sim.world.wind.fromRad) * 10) / 10,
        windStrength: this.sim.world.wind.strength,
        windDrift: true,
        debugText: false,
      },
      {
        onLogicalHeight: (h) => this.screenFit.setTargetHeight(h),
        onSpeedScale: (s) => (this.sim.tuning.speedScale = s),
        onPlaceTarget: (d) => this.placeTarget(d),
        onTargetClass: () => this.placeTarget(this.targetDistance()),
        onWindDrift: (on) => (this.sim.tuning.windDrift = on),
        onTargetCircle: () => (this.targetCircle = null),
        onResetHits: () => {
          this.ballsFired = 0;
          this.hullHits = 0;
        },
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
    const v = this.panel.values;
    const seconds = Math.min(delta / 1000, MAX_FRAME_SECONDS);
    this.readInput(seconds);
    this.steerTarget();

    // 1. Let the simulation catch up with real time.
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
      const owner = ship.id === PLAYER_ID ? 'player' : 'enemy';
      showShip(image, ship.shipClass, owner, v.shipArt, v.detailAtZoom, pose.x, pose.y, pose.headingRad, s);
      // A sunk ship fades into the sea (it stays as a faint wreck); a placed one is solid again.
      image.setAlpha(ship.sunk ? Math.max(0.2, image.alpha - seconds * 0.3) : 1);
    });

    this.islands.update(s);
    const events = this.sim.takeEvents();
    for (const e of events) {
      if (e.type === 'gunFired' && e.shipId === PLAYER_ID) this.ballsFired++;
      if (e.type === 'hit' && e.byShipId === PLAYER_ID && e.zone === 'hull') this.hullHits++;
    }
    this.cannonballs.play(events, s);
    this.cannonballs.update(this.sim.world.balls, alpha * STEP_SECONDS, s, seconds);

    const me = poses[0];
    const myShip = this.sim.world.ships[0];
    if (!me || !myShip) return;
    this.wake.update(seconds, me.x, me.y, me.headingRad, myShip.speed, s);
    this.rings.visible = v.rangeRings;
    this.rings.update(me.x, me.y, me.headingRad, s);
    const myParams = SHIP_CLASSES[myShip.shipClass];
    if (myParams) this.markers2.update(myShip, myParams, s, this.sim.world.wind.strength);

    // 4. The camera: at your ship, or pulled toward the nearest enemy (combat camera).
    // Enemies: every other ship that is still afloat.
    const enemies = poses.filter((_p, i) => i > 0 && !this.sim.world.ships[i]?.sunk);
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
    const target = this.ship(TARGET_ID);
    const rangeM = params ? gunRange(myShip, params) : 0;
    this.hud.update({
      ship: myShip,
      hullMax: params?.hullPoints ?? 1,
      sailing,
      wind,
      rangeM,
      target: target
        ? {
            shipClass: target.shipClass,
            distance: this.targetDistance(),
            hull: target.hull,
            hullMax: SHIP_CLASSES[target.shipClass]?.hullPoints ?? 1,
            sunk: target.sunk,
          }
        : null,
      debug: v.debugText,
      debugLines: v.debugText
        ? debugLines({
            ship: myShip,
            sailing,
            wind,
            tick: this.sim.world.tick,
            rangeM,
            ballsFired: this.ballsFired,
            hullHits: this.hullHits,
            gunsPerSide: params?.gunsPerSide ?? 1,
            viewWidthM: halfW * 2,
            viewHeightM: halfH * 2,
            zoom: this.zoomGoal,
            logicalWidth: layout.width,
            logicalHeight: layout.height,
            pixelScale: layout.pixelScale,
          })
        : [],
    });
  }

  /** Which whole zoom step to show now. */
  private chooseZoom(): number {
    const v = this.panel.values;
    const me = this.ship(PLAYER_ID);
    if (!v.autoZoom || !me) return v.zoom;
    const others = this.sim.world.ships.filter((sh) => sh.id !== PLAYER_ID && !sh.sunk);
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
    this.hud.layout(layout.width, layout.height);
  }

  /** Keys -> commands. Rudder and elevation are held; sails change one step per key press. */
  private readInput(seconds: number): void {
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

    // Guns: Q fires the port (left) broadside, E the starboard (right) one;
    // + / - (or R / F, or the gun icons) raise and lower the guns.
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.sim.queueCommand({ type: 'fire', shipId: PLAYER_ID, side: 'port' });
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.sim.queueCommand({ type: 'fire', shipId: PLAYER_ID, side: 'starboard' });
    const up = this.keys.R.isDown || this.raiseKeys.some((k) => k.isDown) || this.hud.raise || (this.touch?.raise ?? false);
    const down = this.keys.F.isDown || this.lowerKeys.some((k) => k.isDown) || this.hud.lower || (this.touch?.lower ?? false);
    const raise = (up ? 1 : 0) - (down ? 1 : 0);
    if (raise !== 0) {
      const next = Math.max(0, Math.min(GUNS.maxElevationDeg, this.elevationDeg + raise * ELEVATION_DEG_PER_SECOND * seconds));
      if (next !== this.elevationDeg) {
        this.elevationDeg = next;
        this.sim.queueCommand({ type: 'setElevation', shipId: PLAYER_ID, valueDeg: next });
      }
    }

    // H shows or hides the debug text (keys and all the numbers).
    if (Phaser.Input.Keyboard.JustDown(this.keys.H)) this.panel.toggleDebugText();

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
    const x = me.x + Math.cos(side) * distance;
    const y = me.y + Math.sin(side) * distance;
    this.sim.queueCommand({ type: 'placeShip', shipId: TARGET_ID, x, y, headingRad: me.headingRad, shipClass: this.panel.values.targetClass });
    this.targetCircle = this.circleFrom(x, y, me.headingRad);
  }

  /**
   * The moving target (M2 step 3): it sails slowly round a circle that starts where it is
   * and lies to its starboard side, so it first sails away from you. Like any ship it is
   * steered only by commands. Not a bot yet: it does not care about you (step 4).
   */
  private steerTarget(): void {
    const v = this.panel.values;
    const target = this.ship(TARGET_ID);
    const params = target ? SHIP_CLASSES[target.shipClass] : undefined;
    if (!target || !params || target.sunk) return;
    const sails = v.targetMoving ? v.targetSailsPercent / 100 : 0;
    if (Math.abs(target.sailLevel - sails) > 1e-6) this.sim.queueCommand({ type: 'setSails', shipId: TARGET_ID, value: sails });
    let rudder = 0;
    if (v.targetMoving) {
      this.targetCircle ??= this.circleFrom(target.x, target.y, target.headingRad);
      rudder = circleRudder(target, params, this.sim.world.wind, this.targetCircle);
    }
    if (Math.abs(target.rudder - rudder) > 0.01) this.sim.queueCommand({ type: 'setRudder', shipId: TARGET_ID, value: rudder });
  }

  /** A circle through (x, y) whose centre lies to the starboard of a ship heading this way. */
  private circleFrom(x: number, y: number, headingRad: number): Circle {
    const r = this.panel.values.targetCircleRadius;
    const side = headingRad + Math.PI / 2;
    return { x: x + Math.cos(side) * r, y: y + Math.sin(side) * r, radiusM: r, tacking: false };
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

/** How far the guns reach now, lying still (metres from the ship's centre to the landing point). */
function gunRange(ship: ShipState, params: ShipParams): number {
  const p = predictLanding({ ...ship, speed: 0 }, params, 'starboard', STEP_SECONDS);
  return Math.hypot(p.x - ship.x, p.y - ship.y);
}
