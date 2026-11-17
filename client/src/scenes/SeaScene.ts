import { PORTS, inSafeWater } from '../sim/port';
import { Fog } from './Fog';
import { Spyglass } from './Spyglass';
import { PortMarks } from './PortMarks';
import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { bearingDegToHeadingRad, headingRadToBearingDeg } from '../sim/angles';
import { DAMAGE, ISLANDS, SHIP_CLASSES } from '../sim/data';
import { touchesLand } from '../sim/land';
import { openWaterSpot } from '../sim/spawn';
import { Simulation } from '../sim/simulation';
import { circleRudder } from '../sim/circle';
import type { Circle } from '../sim/circle';
import { STEP_SECONDS, sailingInfo } from '../sim/step';
import { GUNS } from '../sim/data';
import { predictLanding, reloadLeft } from '../sim/guns';
import type { ShipParams, ShipState, Side, SimEvent } from '../sim/types';
import { createWorld } from '../sim/world';
import { autoZoom } from '../view/autoZoom';
import { discover, newChart, updateSightings } from '../view/chart';
import { hudLayout, touchButtonRects } from '../view/hudLayout';
import type { ChartState } from '../view/chart';
import { combatCameraCentre, nearest, smoothToward } from '../view/combatCamera';
import type { Point } from '../view/combatCamera';
import type { PixelLayout } from '../view/pixelLayout';
import { Cannonballs } from './Cannonballs';
import { EdgeMarkers } from './EdgeMarkers';
import type { Contact } from './EdgeMarkers';
import { Banner } from './Banner';
import { Chart } from './Chart';
import { Minimap } from './Minimap';
import { Sounds, loadSounds } from './Sounds';
import { Hud, debugLines } from './Hud';
import { makeHudIcons } from './icons';
import { Islands, loadIslandPictures } from './Islands';
import { LandingMarkers } from './LandingMarkers';
import { RangeRings } from './RangeRings';
import { ScreenFit } from './ScreenFit';
import { loadShipSheets, makeShipTextures, showShip } from './ShipArt';
import { TouchControls } from './TouchControls';
import { TuningPanel, releaseFocus } from './TuningPanel';
import { Wake } from './Wake';
import { ArenaHud } from './ArenaHud';
import { createArenaWorld } from '../sim/arena';
import { ArenaLog, clock } from '../view/arenaLog';

const PLAYER_ID = 1;
const TARGET_ID = 2;
const SAIL_STEP = 0.25; // W / S change the sails by 25% per key press
const MAX_FRAME_SECONDS = 0.25; // ignore longer pauses (e.g. after a tab switch)

type KeyMap = Record<'W' | 'A' | 'S' | 'D' | 'Z' | 'X' | 'Q' | 'E' | 'R' | 'F' | 'H' | 'M' | 'C' | 'V' | 'T' | 'L' | 'SPACE', Phaser.Input.Keyboard.Key>;

/** The auto-bot arena (M3 step 2): time speeds, how fast the free view moves (screen px per second), where the log is kept. */
const ARENA_SPEEDS = [1, 2, 4, 8];
const FREE_VIEW_PX_PER_SECOND = 500;
const ARENA_LOG_KEY = 'naval-arena-log';

/** Juice (M2 step 6): how long a hit ship flashes white, and how the view shakes (ms, share of the view). */
const HIT_FLASH_SECONDS = 0.1;
const SHAKE_MY_HIT = { ms: 170, intensity: 0.006 };
const SHAKE_MY_GUN = { ms: 70, intensity: 0.0015 };
const SHAKE_SINK = { ms: 320, intensity: 0.004 };

/**
 * Keys for the guns up / down: "+" and "-" on the main keyboard and on the number pad.
 * Browsers disagree on the codes of the main keys (Chrome/Safari 187/189, Firefox 61/173), so we take both.
 */
const RAISE_KEY_CODES = [187, 61, 107];
const LOWER_KEY_CODES = [189, 173, 109];

const ELEVATION_DEG_PER_SECOND = 4; // + / - held (the bot uses the same rate, data/bots.json)
const START_BOT_DISTANCE = 400; // metres, to windward (the panel button "put 400 m upwind")
const BOT_SPAWN_MIN = 400; // bots appear at random places this far from you...
const BOT_SPAWN_MAX = 800; // ...at most
const SHAKE_COLLISION = { ms: 260, intensity: 0.009 };

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
  private banner!: Banner;
  private chart!: Chart;
  private minimap!: Minimap;
  private portMarks!: PortMarks;
  private fog!: Fog;
  private escKey!: Phaser.Input.Keyboard.Key;
  private started = false; // false until the first duel has been set up
  private chartState: ChartState = newChart(ISLANDS); // what you have seen so far (view/chart.ts)
  private sounds!: Sounds;
  private hitFlash: number[] = []; // seconds of white flash left, per ship index
  private enterKey!: Phaser.Input.Keyboard.Key;
  private raiseKeys: Phaser.Input.Keyboard.Key[] = [];
  private lowerKeys: Phaser.Input.Keyboard.Key[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: KeyMap;
  private touch: TouchControls | null = null;
  private lastRudder = 0;
  private cameraCentre: Point | null = null; // metres
  private spyglassLeft = 0; // seconds of looking through the spyglass left (0 = not looking)
  private spyglass!: Spyglass;
  private zoomGoal = 1; // the whole zoom step we are heading for
  private shownZoom = 1; // the zoom on the screen now (between steps only while changing)
  private targetCircle: Circle | null = null; // the circle the moving target sails round
  private ballsFired = 0; // your balls since the last reset (for the hit count)
  private sunkBy = 0; // the ship that sank you (for the banner)
  private enemyBalls = 0; // the enemy's balls this duel (for the banner)
  private enemyHullHits = 0; // its hull hits on you this duel
  private myDuelHullHits = 0; // your hull hits this duel (the panel's hit count can be reset by hand)
  private hullHits = 0;
  // --- The auto-bot arena (M3 step 2) ---
  private arena = false; // true: no player ship, every ship is a bot (sim/arena.ts); you watch
  private focusIndex = 0; // the ship the camera and the HUD follow (index in world.ships); 0 = yours in a battle
  private autoFocus = true; // follow the bot with the most wins (until you pick one with NEXT / Space)
  private freeView: Point | null = null; // metres: you dragged the view away from the ships
  private timeScale = 1;
  private arenaHud!: ArenaHud;
  private arenaLog = new ArenaLog();
  private arenaStartedAt = '';
  private arenaModes = new Map<number, string>(); // the last bot mode written to the log
  private logSaveSeconds = 0;

  constructor() {
    super('Sea');
  }

  preload(): void {
    loadShipSheets(this);
    loadSounds(this);
    loadIslandPictures(this);
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
    this.spyglass = new Spyglass(this);
    this.portMarks = new PortMarks(this);
    this.fog = new Fog(this);
    this.rings = new RangeRings(this);
    this.markers2 = new LandingMarkers(this);
    this.cannonballs = new Cannonballs(this);
    this.markers = new EdgeMarkers(this);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available');
    }
    this.cursors = keyboard.createCursorKeys();
    this.keys = keyboard.addKeys('W,A,S,D,Z,X,Q,E,R,F,H,M,C,V,T,L,SPACE') as KeyMap;
    this.raiseKeys = RAISE_KEY_CODES.map((code) => keyboard.addKey(code));
    this.lowerKeys = LOWER_KEY_CODES.map((code) => keyboard.addKey(code));
    this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    makeHudIcons(this);

    // On phones and tablets there is no keyboard, so show buttons.
    if (isTouch) {
      this.touch = new TouchControls(
        this,
        (direction) => this.changeSails(direction),
        () => this.toggleSpyglass(),
        (side) => this.firePlayer(side),
      );
    }
    this.sounds = new Sounds(this);
    this.hud = new Hud(
      this,
      isTouch,
      () => this.panel.toggleSound(),
      () => this.chart.setOpen(!this.chart.isOpen()),
      () => this.toggleSpyglass(),
      () => this.panel.setAutoZoom(!this.panel.values.autoZoom),
    );
    // Mouse wheel: roll to zoom in and out (this turns the automatic combat zoom off: you took over);
    // press the wheel to look through the spyglass.
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (dy === 0) return;
      this.panel.setAutoZoom(false);
      this.stepManualZoom(dy < 0 ? 1 : -1);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) this.toggleSpyglass();
    });
    this.arenaHud = new ArenaHud(this, isTouch, {
      onNext: () => this.nextFocus(),
      onSpeed: () => this.nextSpeed(),
      onLog: () => this.downloadLog(),
      onLeave: () => this.leaveArena(),
    });
    // The arena: drag the sea to look round (the view leaves the ships until NEXT / Space).
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.arena || !p.isDown || p.middleButtonDown() || this.arenaHud.onButton(p.x, p.y)) return;
      const s = this.panel.values.pixelsPerMetre * this.shownZoom;
      const from = this.freeView ?? this.cameraCentre ?? { x: 0, y: 0 };
      this.freeView = { x: from.x - (p.x - p.prevPosition.x) / s, y: from.y - (p.y - p.prevPosition.y) / s };
    });
    this.chart = new Chart(this, isTouch, () => this.chart.setOpen(false));
    this.minimap = new Minimap(this, isTouch, () => this.chart.setOpen(!this.chart.isOpen()));
    this.banner = new Banner(this, () => this.restart()); // last: drawn on top of everything

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
        shipArt: 32, // decided 15 Nov (D33): 32 directions
        detailAtZoom: true,
        rangeRings: true,
        targetClass: 'sloop',
        targetBehaviour: 'bot',
        targetSailsPercent: 30,
        targetCircleRadius: 150,
        windFromBearingDeg: Math.round(headingRadToBearingDeg(this.sim.world.wind.fromRad) * 10) / 10,
        windStrength: this.sim.world.wind.strength,
        windDrift: true,
        debugText: false,
        minimap: true,
        fog: true,
        enemyCount: 3,
        sound: true,
        volume: 0.7,
        screenShake: true,
        arenaSpeed: 1,
      },
      {
        onLogicalHeight: (h) => this.screenFit.setTargetHeight(h),
        onSpeedScale: (s) => (this.sim.tuning.speedScale = s),
        onPlaceTarget: (d) => this.placeTarget(d),
        onTargetClass: () => this.placeTarget(this.targetDistance()),
        onWindDrift: (on) => (this.sim.tuning.windDrift = on),
        onTargetCircle: () => (this.targetCircle = null),
        onTargetBehaviour: () => (this.targetCircle = null),
        onRestart: () => this.restart(),
        onArena: () => this.enterArena(),
        onLeaveArena: () => this.leaveArena(),
        onArenaSpeed: (x) => (this.timeScale = x),
        onDownloadLog: () => this.downloadLog(),
        onPlaceUpwind: (d) => this.placeTargetUpwind(d || START_BOT_DISTANCE),
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
    this.restart(); // the first duel: bots at random places

    // A click or tap on the sea gives the keyboard back to the game (see releaseFocus).
    this.input.on('pointerdown', () => releaseFocus());
  }

  update(_time: number, delta: number): void {
    const v = this.panel.values;
    const seconds = Math.min(delta / 1000, MAX_FRAME_SECONDS);
    if (this.arena) this.readArenaInput(seconds);
    else {
      this.readInput(seconds);
      this.steerTarget();
    }

    // 1. Let the simulation catch up with real time (the arena can run faster).
    const alpha = this.sim.update(seconds * (this.arena ? this.timeScale : 1));
    if (this.arena) this.pickFocus();

    // 2. Zoom. Sailing: your zoom (keys, button, slider). Enemy near and auto zoom on:
    //    the largest whole step that shows both ships. The change is smoothed over ~0.25 s.
    const cam = this.cameras.main;
    this.spyglassLeft = Math.max(0, this.spyglassLeft - seconds);
    this.touch?.setSpyglass(this.spyglassLeft > 0);
    this.spyglass.update(this.spyglassLeft > 0, seconds, cam.width, cam.height);
    this.zoomGoal = this.spyglassLeft > 0 ? viewJson.spyglassZoom : this.chooseZoom();
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
      const owner = i === this.focusIndex ? 'player' : 'enemy';
      showShip(image, ship.shipClass, owner, v.shipArt, v.detailAtZoom, pose.x, pose.y, pose.headingRad, s);
      // A sunk ship fades into the sea (it stays as a faint wreck); a placed one is solid again.
      image.setAlpha(ship.sunk ? Math.max(0.2, image.alpha - seconds * 0.3) : 1);
      // A hit ship flashes white for a moment (fill tint), then shows its colours again.
      const flash = (this.hitFlash[i] ?? 0) - seconds;
      this.hitFlash[i] = flash;
      if (flash > 0) image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else image.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });

    this.islands.update(s);
    const watched = this.sim.world.ships[this.focusIndex];
    this.portMarks.update(s, this.time.now / 1000, watched?.offender && !watched.sunk ? watched.offender.port : -1);
    this.fog.update(seconds, this.sim.world.wind, s, v.fog);
    const events = this.sim.takeEvents();
    if (this.arena) this.recordArena(events, seconds);
    for (const e of events) {
      if (this.arena) break; // the battle counters are for your own ship only
      if (e.type === 'gunFired' && e.shipId === PLAYER_ID) this.ballsFired++;
      if (e.type === 'hit' && e.byShipId === PLAYER_ID && e.zone === 'hull') this.hullHits++;
      if (e.type === 'gunFired' && e.shipId !== PLAYER_ID) this.enemyBalls++;
      if (e.type === 'hit' && e.byShipId !== PLAYER_ID && e.shipId === PLAYER_ID && e.zone === 'hull') this.enemyHullHits++;
      if (e.type === 'sunk' && e.shipId === PLAYER_ID) this.sunkBy = e.byShipId;
      if (e.type === 'hit' && e.byShipId === PLAYER_ID && e.zone === 'hull') this.myDuelHullHits++;
    }
    this.playJuice(events, halfW);
    this.cannonballs.play(events, s, this.sim.world.wind, (id) => this.ship(id)?.headingRad);
    this.cannonballs.update(this.sim.world.balls, alpha * STEP_SECONDS, s, seconds);

    const me = poses[this.focusIndex];
    const myShip = this.sim.world.ships[this.focusIndex];
    if (!me || !myShip) return;
    // Every ship that floats leaves a wake.
    const wakeShips = this.sim.world.ships.flatMap((ship, i) => {
      const pose = poses[i];
      const cls = SHIP_CLASSES[ship.shipClass];
      if (!pose || !cls || ship.sunk) return [];
      return [{ id: ship.id, x: pose.x, y: pose.y, headingRad: pose.headingRad, speed: ship.speed, length: cls.length, beam: cls.beam }];
    });
    this.wake.update(seconds, wakeShips, s);
    this.rings.visible = v.rangeRings;
    this.rings.labelsVisible = this.touch === null;
    this.touch?.setReload(myShip.reloadPort, myShip.reloadStarboard);
    this.rings.update(me.x, me.y, me.headingRad, s);
    const myParams = SHIP_CLASSES[myShip.shipClass];
    if (myParams) this.markers2.update(myShip, myParams, s, this.sim.world.wind.strength, seconds);

    // 4. The camera: at your ship, or pulled toward the nearest enemy (combat camera).
    // Enemies: every other ship that is still afloat.
    const enemies = poses.filter((_p, i) => i !== this.focusIndex && !this.sim.world.ships[i]?.sunk);
    const goal = v.combatCamera
      ? combatCameraCentre(me, nearest(me, enemies), halfW, halfH, {
          range: viewJson.combatCameraRange,
          keepInside: viewJson.combatCameraKeepInside,
        })
      : { x: me.x, y: me.y };
    if (this.freeView) {
      // The arena's free view: W A S D / arrows move it too.
      this.cameraCentre = this.freeView;
    } else this.cameraCentre = this.cameraCentre
      ? smoothToward(this.cameraCentre, goal, seconds, viewJson.combatCameraSmoothing)
      : goal;
    cam.centerOn(this.cameraCentre.x * s, this.cameraCentre.y * s);

    // The water slides under the camera. Whole zoom steps keep the water pixels even.
    const z = this.shownZoom;
    this.water.setTileScale(z);
    this.water.tilePositionX = cam.scrollX / z;
    this.water.tilePositionY = cam.scrollY / z;

    // The chart learns what is on the screen now: islands, and where the other ships are.
    const seaView = {
      minX: this.cameraCentre.x - halfW,
      maxX: this.cameraCentre.x + halfW,
      minY: this.cameraCentre.y - halfH,
      maxY: this.cameraCentre.y + halfH,
    };
    discover(this.chartState, ISLANDS, seaView);
    updateSightings(this.chartState, this.sim.world.ships.filter((_sh, i) => i !== this.focusIndex), seaView);
    this.chart.update(this.chartState, myShip, this.sim.world.wind);

    // 5. Edge markers for ships within sighting range that are off the screen.
    const contacts: Contact[] = [];
    for (const p of enemies) {
      const distance = Math.hypot(p.x - me.x, p.y - me.y);
      if (distance > viewJson.sightingRange) continue;
      contacts.push({ screenX: p.x * s - cam.scrollX, screenY: p.y * s - cam.scrollY, distance });
    }
    const hudRects = hudLayout(cam.width, cam.height, this.touch !== null);
    const buttonRects = this.touch ? Object.values(touchButtonRects(cam.width, cam.height)) : [];
    this.markers.update(contacts, cam.width, cam.height, [hudRects.ship, hudRects.target, hudRects.guns, hudRects.minimap, hudRects.sound, ...buttonRects]);

    // 6. Numbers.
    const layout = this.screenFit.layout;
    this.panel.info.pixelScale = `x${layout.pixelScale} (${layout.width} x ${layout.height})`;
    this.panel.info.view = `${Math.round(halfW * 2)} x ${Math.round(halfH * 2)}`;
    this.panel.info.zoomNow = `x${this.zoomGoal}${this.spyglassLeft > 0 ? ' (spyglass)' : this.zoomGoal !== v.zoom ? ' (auto)' : ''}`;
    const wind = this.sim.world.wind;
    const params = SHIP_CLASSES[myShip.shipClass];
    const sailing = params ? sailingInfo(myShip, params, wind) : { twaDeg: 0, share: 0, noGoDeg: 0 };
    const target = this.nearestEnemy(myShip) ?? this.ship(TARGET_ID);
    const rangeM = params ? gunRange(myShip, params) : 0;
    // Ship centres on the screen: a HUD panel over one of them turns see-through.
    const shipsOnScreen = poses.map((p) => ({ x: p.x * s - cam.scrollX, y: p.y * s - cam.scrollY }));
    this.minimap.update(v.minimap, this.chartState, myShip, shipsOnScreen, seconds, this.panel.openWidthCss() / layout.cssZoom);
    this.hud.update({
      soundOn: v.sound,
      autoZoomOn: v.autoZoom,
      spyglassOn: this.spyglassLeft > 0,
      minimapOn: v.minimap,
      repairSeaShare: DAMAGE.repair.seaMaxShare,
      repairPortShare: PORTS.length > 0 ? DAMAGE.port.maxShare : 0,
      safeWater: inSafeWater(myShip.x, myShip.y),
      offender: !myShip.offender ? 'no' : myShip.offender.forgiveLeft < DAMAGE.port.law.forgiveSeconds ? 'outside' : 'inside',
      pardonSeconds: myShip.offender?.forgiveLeft ?? 0,
      ships: shipsOnScreen,
      seconds,
      ship: myShip,
      hullMax: params?.hullPoints ?? 1,
      sailing,
      wind,
      rangeM,
      target: target
        ? {
            shipClass: target.shipClass,
            distance: Math.hypot(target.x - myShip.x, target.y - myShip.y),
            hull: target.hull,
            hullMax: SHIP_CLASSES[target.shipClass]?.hullPoints ?? 1,
            sunk: target.sunk,
            repairing: target.repairing,
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
          }).concat(this.botLine())
        : [],
    });

    // 7. The end of the duel: a banner, then "sail again" (button or Enter).
    if (this.arena) {
      this.arenaHud.update(this.sim.world, poses, s, myShip.id, this.freeView === null, this.timeScale, clock(this.sim.world.tick * STEP_SECONDS));
      return;
    }
    const foes = this.sim.world.ships.filter((sh) => sh.id !== PLAYER_ID);
    if (myShip.sunk) this.banner.request('lose', this.sunkBy < 0 ? 'Sunk by the shore guns' : `Sunk by the pirate ${this.ship(this.sunkBy)?.shipClass ?? 'ship'}`, this.duelStats());
    else if (v.targetBehaviour === 'bot' && foes.length > 0 && foes.every((sh) => sh.sunk)) {
      this.banner.request('win', foes.length === 1 ? `Enemy ${foes[0]?.shipClass ?? 'ship'} sunk` : `All ${foes.length} enemies sunk`, this.duelStats());
    }
    this.banner.update(seconds, this.touch !== null);
    if (this.banner.isShown() && Phaser.Input.Keyboard.JustDown(this.enterKey)) this.restart();
  }

  /** Which whole zoom step to show now. */
  private chooseZoom(): number {
    const v = this.panel.values;
    const me = this.sim.world.ships[this.focusIndex];
    if (!v.autoZoom || !me || this.freeView) return v.zoom;
    const others = this.sim.world.ships.filter((sh) => sh.id !== me.id && !sh.sunk);
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
    this.arenaHud.layout(layout.width, layout.height);
    this.banner.layout(layout.width, layout.height);
    const buttons = hudLayout(layout.width, layout.height, this.touch !== null).sound;
    this.chart.layout(layout.width, layout.height, buttons.y + buttons.h + 6);
    this.minimap.layout(layout.width, layout.height);
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.firePlayer('port');
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.firePlayer('starboard');
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) this.panel.toggleSound();
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.chart.setOpen(!this.chart.isOpen());
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.chart.setOpen(false);
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this.stepManualZoom(1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this.stepManualZoom(-1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.V)) this.toggleSpyglass();
  }

  /** One step in or out through view.json manualZoomSteps (keys Z / X, the mouse wheel). */
  private stepManualZoom(direction: 1 | -1): void {
    const steps = viewJson.manualZoomSteps;
    const now = this.panel.values.zoom;
    let i = steps.findIndex((z) => z >= now - 1e-6);
    if (i < 0) i = steps.length - 1;
    const next = steps[Math.max(0, Math.min(steps.length - 1, i + direction))] ?? 1;
    this.panel.setZoom(next);
  }

  /**
   * The spyglass (V, or the button at the top on touch screens): the view zooms out
   * for spyglassSeconds, so you see far. Again to put it away sooner.
   */
  private toggleSpyglass(): void {
    this.spyglassLeft = this.spyglassLeft > 0 ? 0 : viewJson.spyglassSeconds;
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

  /** "3:42  hits: you 9  enemy 7" for the banner (fun check 1 wants duel times and hits). */
  private duelStats(): string {
    const seconds = Math.round(this.sim.world.tick * STEP_SECONDS);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return `${time}  hits: you ${this.myDuelHullHits}  enemy ${this.enemyHullHits}`;
  }

  /** Fire a broadside. A loaded battery also leaves a ghost cross where it was aimed. */
  private firePlayer(side: Side): void {
    const me = this.ship(PLAYER_ID);
    const params = me ? SHIP_CLASSES[me.shipClass] : undefined;
    this.sim.queueCommand({ type: 'fire', shipId: PLAYER_ID, side });
    if (!me || !params || me.sunk || reloadLeft(me, side) > 0) return;
    const p = predictLanding(me, params, side, STEP_SECONDS);
    this.markers2.addGhost(p.x, p.y, p.seconds + 0.8);
  }

  /**
   * Sounds, screen shake and hit flashes for this frame's events (M2 step 6).
   * We listen from the middle of the view, so the pan matches what you see.
   */
  private playJuice(events: readonly SimEvent[], halfWidthM: number): void {
    const v = this.panel.values;
    this.sounds.enabled = v.sound;
    this.sounds.volume = v.volume;
    const me = this.sim.world.ships[this.focusIndex];
    const myId = this.arena ? -1 : PLAYER_ID; // the arena does not shake the view
    const ear = this.cameraCentre ?? (me ? { x: me.x, y: me.y } : { x: 0, y: 0 });
    const cam = this.cameras.main;
    const shake = (how: { ms: number; intensity: number }): void => {
      if (v.screenShake) cam.shake(how.ms, how.intensity);
    };
    for (const e of events) {
      switch (e.type) {
        case 'gunFired':
          this.sounds.play('cannon', e.x, e.y, ear, halfWidthM, 0.8, 150);
          if (e.shipId === myId) shake(SHAKE_MY_GUN);
          break;
        case 'shoreFired':
          this.sounds.play('cannon', e.x, e.y, ear, halfWidthM, 1, 60);
          break;
        case 'splash':
          this.sounds.play('splash', e.x, e.y, ear, halfWidthM, 0.35, 250);
          break;
        case 'hit': {
          // Hits on your own ship are right under your ear, so they are played softer (your feedback, 15 Nov).
          const own = e.shipId === me?.id ? 0.55 : 1;
          this.sounds.play(e.zone === 'hull' ? 'hit_wood' : 'hit_canvas', e.x, e.y, ear, halfWidthM, (e.zone === 'hull' ? 0.6 : 0.5) * own, 200);
          const index = this.sim.world.ships.findIndex((sh) => sh.id === e.shipId);
          if (index >= 0) this.hitFlash[index] = HIT_FLASH_SECONDS;
          if (e.shipId === myId && e.zone === 'hull') shake(SHAKE_MY_HIT);
          break;
        }
        case 'collision': {
          // Two hulls crash together: a loud crack, both ships flash, the view jumps if you are one of them.
          this.sounds.play('hit_wood', e.x, e.y, ear, halfWidthM, 1, 80);
          for (const id of [e.shipA, e.shipB]) {
            const index = this.sim.world.ships.findIndex((sh) => sh.id === id);
            if (index >= 0) this.hitFlash[index] = HIT_FLASH_SECONDS * 2;
          }
          if (e.shipA === myId || e.shipB === myId) shake(SHAKE_COLLISION);
          break;
        }
        case 'sunk':
          this.sounds.play('sink', e.x, e.y, ear, halfWidthM, 1, 50);
          if (!this.arena) shake(SHAKE_SINK);
          break;
      }
    }
  }

  /** One line per bot for the debug text: "bot 2 engage, port side". */
  private botLine(): string[] {
    return this.sim.world.bots.map((bot) => {
      const ship = this.ship(bot.shipId);
      if (ship?.sunk) return `bot ${bot.shipId} sunk`;
      return `bot ${bot.shipId} ${bot.mode}${bot.side ? `, ${bot.side} side` : ''}${bot.tack !== 0 ? `, tack ${bot.tack > 0 ? '+' : '-'}` : ''}`;
    });
  }

  /** The nearest enemy still afloat. */
  private nearestEnemy(me: ShipState): ShipState | undefined {
    let best: ShipState | undefined;
    for (const sh of this.sim.world.ships) {
      if (sh.id === me.id || sh.sunk) continue;
      if (!best || Math.hypot(sh.x - me.x, sh.y - me.y) < Math.hypot(best.x - me.x, best.y - me.y)) best = sh;
    }
    return best;
  }

  /** Put the target `distance` metres to windward of you, heading for you. */
  private placeTargetUpwind(distance: number): void {
    const me = this.ship(PLAYER_ID);
    if (!me) return;
    const from = this.sim.world.wind.fromRad;
    const x = me.x + Math.cos(from) * distance;
    const y = me.y + Math.sin(from) * distance;
    this.sim.queueCommand({ type: 'placeShip', shipId: TARGET_ID, x, y, headingRad: from + Math.PI, shipClass: this.panel.values.targetClass });
    this.targetCircle = null;
  }

  /**
   * Start a duel: a fresh world, the same settings from the panel.
   *   - You start where the last duel ended (easier to find your way on the chart); the very
   *     first time, at the start place of the sea.
   *   - In "bot" mode each bot appears at a random place in open water, 400-800 m from you.
   * A new seed each time, so every duel is different. (The time of day is only used here,
   * on the screen side, to pick the seed; inside the simulation everything follows from it.)
   */
  private restart(): void {
    if (this.arena) {
      this.startArena();
      return;
    }
    const v = this.panel.values;
    const last = this.started ? this.ship(PLAYER_ID) : undefined;
    const botMode = v.targetBehaviour === 'bot';
    const seed = (Date.now() & 0x7fffffff) || 1;
    this.sim = new Simulation(createWorld(seed, botMode ? v.enemyCount : 1));
    this.sim.tuning.speedScale = v.speedScale;
    this.sim.tuning.windDrift = v.windDrift;
    this.sim.queueCommand({ type: 'setWind', fromRad: bearingDegToHeadingRad(v.windFromBearingDeg), strength: v.windStrength });
    const world = this.sim.world;
    const me = world.ships[0];
    const sloop = SHIP_CLASSES['sloop'];
    if (me && sloop) {
      // Where the last duel ended, if that is open water (a ship that sank on the shore starts at the old place).
      if (last && !touchesLand({ ...me, x: last.x, y: last.y, headingRad: last.headingRad }, sloop, ISLANDS)) {
        this.sim.queueCommand({ type: 'placeShip', shipId: PLAYER_ID, x: last.x, y: last.y, headingRad: last.headingRad, shipClass: 'sloop' });
      }
      const here = last ?? me;
      if (botMode) {
        const placed: ShipState[] = [{ ...me, x: here.x, y: here.y }];
        for (const bot of world.ships.slice(1)) {
          const shipClass = bot.id === TARGET_ID ? v.targetClass : 'sloop';
          const spot = openWaterSpot(world, ISLANDS, here, BOT_SPAWN_MIN, BOT_SPAWN_MAX, SHIP_CLASSES[shipClass] ?? sloop, placed);
          if (!spot) continue;
          placed.push({ ...bot, x: spot.x, y: spot.y });
          this.sim.queueCommand({ type: 'placeShip', shipId: bot.id, x: spot.x, y: spot.y, headingRad: Math.atan2(here.y - spot.y, here.x - spot.x), shipClass });
        }
      }
    }
    this.sim.update(0.05); // one step: the wind and the places take effect
    this.started = true;
    this.rebuildShipImages();
    this.wake.clear();
    this.elevationDeg = this.ship(PLAYER_ID)?.elevationDeg ?? 5;
    this.lastRudder = 0;
    this.ballsFired = 0;
    this.hullHits = 0;
    this.enemyBalls = 0;
    this.enemyHullHits = 0;
    this.myDuelHullHits = 0;
    this.sunkBy = 0;
    this.targetCircle = null;
    this.cameraCentre = null;
    this.banner.hide();
    this.hitFlash = [];
    this.chartState.sightings = []; // a new duel: the islands you know stay on the chart, the old ship marks go
  }

  /** One picture per ship of the world (the number of ships can change between duels). */
  private rebuildShipImages(): void {
    for (const image of this.shipImages) image.destroy();
    this.shipImages = this.sim.world.ships.map((ship) => {
      const owner = ship.id === PLAYER_ID ? 'player' : 'enemy';
      return this.add.image(0, 0, `box-${ship.shipClass}-${owner}`).setDepth(2);
    });
  }

  /**
   * What the target does (panel "behaviour"):
   *   bot     the computer fights you with every enemy ship (sim/bot.ts); the scene only switches it on
   *   circle  it sails slowly round a circle (M2 step 3), steered from here by commands
   *   moored  it lies still
   */
  private steerTarget(): void {
    if (this.arena) return; // the arena's bots steer themselves (sim/arena.ts)
    const v = this.panel.values;
    const target = this.ship(TARGET_ID);
    const params = target ? SHIP_CLASSES[target.shipClass] : undefined;
    if (!target || !params) return;
    // In "bot" mode the computer sails every enemy ship; in the other modes none.
    for (const sh of this.sim.world.ships) {
      if (sh.id === PLAYER_ID) continue;
      const isBot = this.sim.world.bots.some((b) => b.shipId === sh.id);
      if ((v.targetBehaviour === 'bot') !== isBot) {
        this.sim.queueCommand({ type: 'setBot', shipId: sh.id, enemyId: v.targetBehaviour === 'bot' ? PLAYER_ID : null });
      }
    }
    if (v.targetBehaviour === 'bot' || target.sunk) return;
    const circling = v.targetBehaviour === 'circle';
    const sails = circling ? v.targetSailsPercent / 100 : 0;
    if (Math.abs(target.sailLevel - sails) > 1e-6) this.sim.queueCommand({ type: 'setSails', shipId: TARGET_ID, value: sails });
    let rudder = 0;
    if (circling) {
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

  // ---------------------------------------------------------------- the auto-bot arena (M3 step 2)

  /** Into the arena: a fresh sea with ARENA.bots bots; you watch. */
  private enterArena(): void {
    this.arena = true;
    this.touch?.setShipButtonsVisible(false);
    this.arenaHud.setShown(true);
    this.startArena();
  }

  /** Back to a normal battle with your own ship. */
  private leaveArena(): void {
    this.saveLog();
    this.arena = false;
    this.focusIndex = 0;
    this.freeView = null;
    this.timeScale = 1;
    this.panel.setArenaSpeed(1);
    this.touch?.setShipButtonsVisible(true);
    this.arenaHud.setShown(false);
    this.started = false; // start at the sea's start place, not where some bot was
    this.restart();
  }

  private startArena(): void {
    const v = this.panel.values;
    const seed = (Date.now() & 0x7fffffff) || 1;
    this.sim = new Simulation(createArenaWorld(seed));
    this.sim.tuning.speedScale = v.speedScale;
    this.sim.tuning.windDrift = v.windDrift;
    this.sim.update(0.05);
    this.rebuildShipImages();
    this.wake.clear();
    this.hitFlash = [];
    this.focusIndex = 0;
    this.autoFocus = true;
    this.freeView = null;
    this.cameraCentre = null;
    this.banner.hide();
    this.chartState.sightings = [];
    this.arenaModes.clear();
    this.arenaLog = new ArenaLog();
    this.arenaStartedAt = new Date().toLocaleString();
    const pilots = this.sim.world.arena?.pilots ?? [];
    this.arenaLog.add(0, `arena started with ${pilots.length} bots (seed ${seed}):`);
    for (const p of pilots) {
      const ship = this.ship(p.shipId);
      this.arenaLog.add(0, `   #${p.number} ${p.name}, ${ship?.shipClass ?? '?'}, at (${Math.round(ship?.x ?? 0)}, ${Math.round(ship?.y ?? 0)})`);
    }
  }

  /** The arena's keys: Space = follow the next ship, W A S D / arrows = move the view, T = time speed, L = log. */
  private readArenaInput(seconds: number): void {
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.SPACE)) this.nextFocus();
    if (Phaser.Input.Keyboard.JustDown(k.T)) this.nextSpeed();
    if (Phaser.Input.Keyboard.JustDown(k.L)) this.downloadLog();
    if (Phaser.Input.Keyboard.JustDown(k.M)) this.panel.toggleSound();
    if (Phaser.Input.Keyboard.JustDown(k.C)) this.chart.setOpen(!this.chart.isOpen());
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.chart.setOpen(false);
    if (Phaser.Input.Keyboard.JustDown(k.H)) this.panel.toggleDebugText();
    if (Phaser.Input.Keyboard.JustDown(k.Z)) this.stepManualZoom(1);
    if (Phaser.Input.Keyboard.JustDown(k.X)) this.stepManualZoom(-1);
    if (Phaser.Input.Keyboard.JustDown(k.V)) this.toggleSpyglass();
    const dx = (k.D.isDown || this.cursors.right.isDown ? 1 : 0) - (k.A.isDown || this.cursors.left.isDown ? 1 : 0);
    const dy = (k.S.isDown || this.cursors.down.isDown ? 1 : 0) - (k.W.isDown || this.cursors.up.isDown ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const s = this.panel.values.pixelsPerMetre * this.shownZoom;
      const from = this.freeView ?? this.cameraCentre ?? { x: 0, y: 0 };
      const step = (FREE_VIEW_PX_PER_SECOND * seconds) / s;
      this.freeView = { x: from.x + dx * step, y: from.y + dy * step };
    }
  }

  /** NEXT / Space: follow the next ship afloat (by number); this stops the automatic choice. */
  private nextFocus(): void {
    const ships = this.sim.world.ships;
    if (ships.length === 0) return;
    this.autoFocus = false;
    this.freeView = null;
    for (let k = 1; k <= ships.length; k++) {
      const i = (this.focusIndex + k) % ships.length;
      if (!ships[i]?.sunk) {
        this.focusIndex = i;
        break;
      }
    }
    this.cameraCentre = null;
  }

  /** x1 -> x2 -> x4 -> x8 -> x1 (T, or the speed button). */
  private nextSpeed(): void {
    const i = ARENA_SPEEDS.indexOf(this.timeScale);
    this.timeScale = ARENA_SPEEDS[(i + 1) % ARENA_SPEEDS.length] ?? 1;
    this.panel.setArenaSpeed(this.timeScale);
  }

  /**
   * Whom to follow: by default the bot with the most wins (it changes as the scores change);
   * after NEXT the ship you picked. A sunk ship is left for the next one afloat.
   */
  private pickFocus(): void {
    const world = this.sim.world;
    const arena = world.arena;
    if (!arena) return;
    if (this.autoFocus) {
      const best = [...arena.pilots].filter((p) => !this.ship(p.shipId)?.sunk).sort((a, b) => b.wins - a.wins || a.losses - b.losses)[0];
      const i = best ? world.ships.findIndex((s) => s.id === best.shipId) : -1;
      if (i >= 0 && i !== this.focusIndex) {
        this.focusIndex = i;
        this.cameraCentre = null;
      }
    } else if (world.ships[this.focusIndex]?.sunk) {
      this.nextFocus();
    }
  }

  /** Write this frame's arena events to the log, and a line when a bot flees or sails to port. */
  private recordArena(events: readonly SimEvent[], seconds: number): void {
    const world = this.sim.world;
    this.arenaLog.record(world, events);
    for (const bot of world.bots) {
      if (this.arenaModes.get(bot.shipId) === bot.mode) continue;
      this.arenaModes.set(bot.shipId, bot.mode);
      this.arenaLog.modeChanged(world, bot.shipId, bot.mode);
    }
    this.logSaveSeconds += seconds;
    if (this.logSaveSeconds > 20) this.saveLog();
  }

  /** Keep the log in the browser (it can come back empty: private windows, cleared data). */
  private saveLog(): void {
    this.logSaveSeconds = 0;
    if (!this.sim.world.arena) return;
    try {
      localStorage.setItem(ARENA_LOG_KEY, this.arenaLog.text(this.sim.world, this.arenaStartedAt));
    } catch {
      // no storage here: the download still works
    }
  }

  /** The log as a text file: naval-arena-log-2026-11-16-1830.txt */
  private downloadLog(): void {
    const world = this.sim.world;
    const text = world.arena ? this.arenaLog.text(world, this.arenaStartedAt) : (safeRead(ARENA_LOG_KEY) ?? 'No arena log yet: start the auto-bot arena first.\n');
    const d = new Date();
    const two = (n: number): string => String(n).padStart(2, '0');
    const name = `naval-arena-log-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.txt`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** For headless tests (dev build): the arena log as text. */
  arenaLogText(): string {
    return this.arenaLog.text(this.sim.world, this.arenaStartedAt);
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

/** localStorage can throw (private windows, blocked storage). */
function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** How far the guns reach now, lying still (metres from the ship's centre to the landing point). */
function gunRange(ship: ShipState, params: ShipParams): number {
  const p = predictLanding({ ...ship, speed: 0 }, params, 'starboard', STEP_SECONDS);
  return Math.hypot(p.x - ship.x, p.y - ship.y);
}
