import { ammoOf } from '../sim/ammo';
import { crewShare, sailShare } from '../sim/condition';
import { ammoLabel, nextAmmo } from '../view/ammoLabel';
import { ammoSlots } from '../view/ammoIcons';
import { PORTS, inSafeWater } from '../sim/port';
import { Fog } from './Fog';
import { Spyglass } from './Spyglass';
import { PortMarks } from './PortMarks';
import { ShipBars } from './ShipBars';
import type { ShipLabel } from './ShipBars';
import { battleName, isWanted, shipLabel } from '../view/wanted';
import { newRosterMemory, rosterRows, updateRosterMemory } from '../view/roster';
import { Roster } from './Roster';
import { nationFor } from '../view/flags';
import { PerfMeter } from '../view/perfMeter';
import type { Nation } from '../view/flags';
import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { bearingDegToHeadingRad, headingRadToBearingDeg } from '../sim/angles';
import { AMMO, DAMAGE, ISLANDS, SHIP_CLASSES, WORLD } from '../sim/data';
import { touchesLand } from '../sim/land';
import { openWaterSpot } from '../sim/spawn';
import { Simulation } from '../sim/simulation';
import { circleRudder } from '../sim/circle';
import type { Circle } from '../sim/circle';
import { STEP_SECONDS, sailingInfo } from '../sim/step';
import { GUNS } from '../sim/data';
import { gunsOn, predictLanding, reloadLeft } from '../sim/guns';
import { turnAbout } from '../view/chaserAim';
import type { ShipParams, ShipState, Side, SimEvent } from '../sim/types';
import { battleClasses, createWorld, enemiesFor } from '../sim/world';

/** M3 step 7d: a trader this far from you has got away (the battle can end without it). */
const TRADER_GONE_M = 1500;

import { autoZoom } from '../view/autoZoom';
import { discover, forget, newChart, updateSightings } from '../view/chart';
import { wheelAction } from '../view/wheelZoom';
import { knownShips, observerSeesAll, shotSeen } from '../view/knownShips';
import { makeFog } from '../sim/fog';
import { speedScaleFor, wreckAlpha, wreckGone } from '../view/wreck';
import { GEAR_CSS_H, hudLayout, touchButtonRects } from '../view/hudLayout';
import type { ChartState } from '../view/chart';
import { leadOffset, nearest, smoothToward } from '../view/combatCamera';
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
import { ArenaResults } from './ArenaResults';
import { PauseMenu } from './PauseMenu';
import { skillsText } from '../sim/skills';
import { arenaLines, battleLines, battleVerdict, endWords } from '../view/pauseStats';
import type { BattleShipRow } from '../view/pauseStats';
import { TurnDevice } from './TurnDevice';
import { isPortraitTouch } from '../view/pixelLayout';
import { arenaResults } from '../view/arenaResults';
import { ARENA, createArenaWorld } from '../sim/arena';
import { ArenaLog, clock, headerLines, placeText, who } from '../view/arenaLog';

const PLAYER_ID = 1;
const TARGET_ID = 2;
const SAIL_STEP = 0.25; // W / S change the sails by 25% per key press
const MAX_FRAME_SECONDS = 0.25; // ignore longer pauses (e.g. after a tab switch)

type KeyMap = Record<'W' | 'A' | 'S' | 'D' | 'Z' | 'X' | 'SHIFT' | 'Q' | 'E' | 'R' | 'F' | 'H' | 'M' | 'C' | 'V' | 'T' | 'L' | 'B' | 'SPACE', Phaser.Input.Keyboard.Key>;

/** The auto-bot arena (M3 step 2): time speeds, how fast the free view moves (screen px per second), where the log is kept. */
const ARENA_SPEEDS = [1, 2, 4, 8];
const FREE_VIEW_PX_PER_SECOND = 500;
const ARENA_LOG_KEY = 'naval-arena-log';
const BATTLE_LOG_KEY = 'naval-battle-log';
/** The arena: the pointer must move this far (logical px) before the view leaves the ships. */
const DRAG_START_PX = 8;

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
const BOT_SPAWN_MIN = WORLD.spawnMinM ?? 400; // bots appear at random places this far from you (data/world.json)...
const BOT_SPAWN_MAX = WORLD.spawnMaxM ?? 800; // ...at most
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
  private arenaResults!: ArenaResults;
  private pauseMenu!: PauseMenu; // M3 step 7c: ESC
  private paused = false;
  private ended = false; // M3 step 7c: a battle stopped with END GAME stays still under its banner
  private turnDevice!: TurnDevice;
  private peaceShown = false; // the results open by themselves once, when the arena reaches peace
  private chart!: Chart;
  private minimap!: Minimap;
  private portMarks!: PortMarks;
  private shipBars!: ShipBars;
  private fog!: Fog;
  private escKey!: Phaser.Input.Keyboard.Key;
  private started = false; // false until the first duel has been set up
  private chartState: ChartState = newChart(ISLANDS); // what you have seen so far (view/chart.ts)
  private sounds!: Sounds;
  private hitFlash: number[] = []; // seconds of white flash left, per ship index
  private enterKey!: Phaser.Input.Keyboard.Key;
  private raiseKeys: Phaser.Input.Keyboard.Key[] = [];
  private lowerKeys: Phaser.Input.Keyboard.Key[] = [];
  private ammoKeys: Phaser.Input.Keyboard.Key[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: KeyMap;
  private touch: TouchControls | null = null;
  private lastRudder = 0;
  private cameraCentre: Point | null = null; // metres
  private readonly perf = new PerfMeter();
  private arenaSeed = 1; // the arena's seed: it also picks the bots' flags (view/flags.ts)
  private spyglassLeft = 0; // seconds of looking through the spyglass left (0 = not looking)
  private spyglass!: Spyglass;
  private zoomGoal = 1; // the whole zoom step we are heading for
  private shownZoom = 1; // the zoom on the screen now (between steps only while changing)
  private targetCircle: Circle | null = null; // the circle the moving target sails round
  private ballsFired = 0; // your balls since the last reset (for the hit count)
  private cameraLead = { x: 0, y: 0 }; // the smoothed look-ahead of the camera (M3 step 8)
  private wreckAge: number[] = []; // seconds each sunk ship has been a wreck (0 = afloat)
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
  private roster!: Roster; // M4b 5d: who is still in the battle (solo)
  private rosterMemory = newRosterMemory();
  private arenaLog = new ArenaLog();
  private arenaStartedAt = '';
  private battleLog = new ArenaLog(); // M3 step 7d: the log of a battle against bots
  private battleStartedAt = '';
  private battleModes = new Map<number, string>();
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
    this.shipBars = new ShipBars(this);
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
    this.keys = keyboard.addKeys('W,A,S,D,Z,X,SHIFT,Q,E,R,F,H,M,C,V,T,L,B,SPACE') as KeyMap;
    this.raiseKeys = RAISE_KEY_CODES.map((code) => keyboard.addKey(code));
    this.lowerKeys = LOWER_KEY_CODES.map((code) => keyboard.addKey(code));
    this.ammoKeys = [Phaser.Input.Keyboard.KeyCodes.ONE, Phaser.Input.Keyboard.KeyCodes.TWO, Phaser.Input.Keyboard.KeyCodes.THREE].map((code) => keyboard.addKey(code));
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
        () => this.cycleAmmo(),
        () => this.onPauseKey(),
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
    // Mouse wheel: roll to zoom in and out (this turns the automatic combat zoom off: you took over; rolling out at
    // the lowest zoom opens the spyglass for a few seconds);
    // press the wheel to look through the spyglass.
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      // Rolling out at the lowest zoom opens the spyglass look-out for a few seconds (view/wheelZoom.ts).
      const action = wheelAction(dy, this.spyglassLeft > 0, this.panel.values.zoom <= (viewJson.manualZoomSteps[0] ?? 1) + 1e-6);
      if (action === null) return;
      if (action === 'spyglassOn') this.spyglassLeft = viewJson.spyglassSeconds;
      else if (action === 'spyglassOff') this.spyglassLeft = 0;
      else {
        this.panel.setAutoZoom(false);
        this.stepManualZoom(action === 'zoomIn' ? 1 : -1);
      }
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) this.toggleSpyglass();
    });
    this.roster = new Roster(this, isTouch);
    this.arenaHud = new ArenaHud(this, isTouch, {
      onNext: () => this.nextFocus(),
      onSpeed: () => this.nextSpeed(),
      onLog: () => this.downloadLog(),
      onLeave: () => this.showArenaResults(),
      onEyes: () => this.toggleBotEyes(),
    });
    // The arena: drag the sea to look round (the view leaves the ships until NEXT / Space).
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.arena || !p.isDown || p.middleButtonDown() || this.arenaHud.onButton(p.x, p.y)) return;
      // A tap that wobbles a few pixels is not a drag (M3 step 4c: it used to unhook the view).
      if (this.freeView === null && Math.hypot(p.x - p.downX, p.y - p.downY) < DRAG_START_PX) return;
      const s = this.panel.values.pixelsPerMetre * this.shownZoom;
      const from = this.freeView ?? this.cameraCentre ?? { x: 0, y: 0 };
      this.freeView = { x: from.x - (p.x - p.prevPosition.x) / s, y: from.y - (p.y - p.prevPosition.y) / s };
    });
    this.chart = new Chart(this, isTouch, () => this.chart.setOpen(false));
    this.minimap = new Minimap(this, isTouch, (sea) => {
      // M3 step 7c: in the arena a click on the minimap moves the view there (C still opens the chart).
      if (this.arena && !this.chart.isOpen()) this.freeView = sea;
      else this.chart.setOpen(!this.chart.isOpen());
    });
    this.banner = new Banner(this, () => this.restart(), () => this.downloadLog()); // last: drawn on top of everything
    this.turnDevice = new TurnDevice(this);
    this.arenaResults = new ArenaResults(
      this,
      () => {
        this.arenaResults.hide();
        this.leaveArena();
      },
      () => this.arenaResults.hide(),
      () => this.downloadLog(),
    );
    this.pauseMenu = new PauseMenu(
      this,
      () => this.setPaused(false),
      () => this.downloadLog(),
      () => this.endGame(),
    );

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
        shipBars: true,
        enemyCount: 0,
        botClasses: 'mix',
        sound: true,
        volume: 0.7,
        screenShake: true,
        arenaSpeed: 1,
        arenaBots: ARENA.bots,
        botEyes: false,
      },
      {
        onLogicalHeight: (h) => this.screenFit.setTargetHeight(h),
        onSpeedScale: (s) => (this.sim.tuning.speedScale = speedScaleFor(s, this.arena, viewJson.soloSpeedScale)),
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
    // A touch screen held upright (M3 step 4c): ask to turn it, and hold the game until then.
    const upright = isPortraitTouch(window.innerWidth, window.innerHeight, this.touch !== null);
    this.turnDevice.update(upright, this.cameras.main.width, this.cameras.main.height);
    if (upright) return;
    // M3 step 7c: ESC closes the chart, else pauses (and resumes).
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.onPauseKey();
    if (this.paused) {
      // Paused: no orders and no simulation; the picture stays as it is.
    } else if (this.arena) this.readArenaInput(seconds);
    else {
      this.readInput(seconds);
      this.steerTarget();
    }

    // 1. Let the simulation catch up with real time (the arena can run faster).
    const simStart = performance.now();
    const alpha = this.sim.update(this.paused || this.ended ? 0 : seconds * (this.arena ? this.timeScale : 1));
    this.perf.note(delta, performance.now() - simStart);
    if (this.arena) {
      this.pickFocus();
      if (this.sim.world.arena?.peace && !this.peaceShown) {
        this.peaceShown = true;
        this.showArenaResults();
      }
    }

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
    // M4b step 3: the screen shows only what the viewer's ship knows. The arena observer sees everything, or
    // (step 4, B / EYES) only what the watched bot sees, with the same rules as a battle.
    const seeAll = observerSeesAll(this.arena, v.botEyes);
    const known = knownShips(this.sim.world, this.sim.world.ships[this.focusIndex]?.id ?? PLAYER_ID, seeAll);
    this.sim.world.ships.forEach((ship, i) => {
      const pose = poses[i];
      const image = this.shipImages[i];
      if (!pose || !image) return;
      const owner = i === this.focusIndex ? 'player' : 'enemy';
      showShip(image, ship.shipClass, owner, v.shipArt, v.detailAtZoom, pose.x, pose.y, pose.headingRad, s);
      // A sunk ship fades into the sea, stays a faint wreck for a while, then the picture goes (view/wreck.ts);
      // a placed one is solid again.
      this.wreckAge[i] = ship.sunk ? (this.wreckAge[i] ?? 0) + seconds : 0;
      const age = this.wreckAge[i] ?? 0;
      image.setAlpha(ship.sunk ? wreckAlpha(age, viewJson.wreck) : 1).setVisible(!(ship.sunk && wreckGone(age, viewJson.wreck)) && (known[i]?.shown ?? true));
      // A hit ship flashes white for a moment (fill tint), then shows its colours again.
      const flash = (this.hitFlash[i] ?? 0) - seconds;
      this.hitFlash[i] = flash;
      if (flash > 0) image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else image.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });

    // Hull bars over the ships; in a duel your own ship has its panel, in the arena every ship gets one.
    const ships = this.sim.world.ships;
    // A battle against bots: "WANTED: ..." in red over an offender of a port's peace, you included (M3 step 6c).
    // (The arena draws its own names, with the same WANTED rule, in ArenaHud.)
    const wanted = (i: number): ShipLabel => {
      const sh = ships[i];
      return !this.arena && sh && known[i]?.shown && (known[i]?.level ?? 0) >= 3 && isWanted(sh) ? shipLabel(sh, battleName(sh, PLAYER_ID), '#ffffff') : null;
    };
    // The arena (D47): sails and crew bars and a flag over every ship. A battle (M3 step 7d, D41,
    // since M4b step 5a by the sight lists): the flag from level 3 (400 m), the rough hull bar to hullGlimpseM
    // (450 m), sails and crew at level 4 (200 m); fog shrinks them; farther than that you cannot tell.
    const nationOf = (i: number): Nation => (ships[i]!.nation as Nation | undefined) ?? nationFor(this.arenaSeed, ships[i]!.id);
    // M4b step 5a: the flag from the flag level, the bars by the same rule as the bots' lists (knownShips: rough hull
    // at 200-450 m, everything at the deck level), all of it shrunk by fog.
    const flag = (i: number): Nation | null => (!ships[i] || !known[i]?.shown ? null : seeAll || (known[i]?.level ?? 0) >= 3 ? nationOf(i) : null);
    const detail = (i: number): 0 | 1 | 2 => (known[i]?.shown ? known[i]!.detail : 0);
    this.shipBars.update(ships, poses, s, v.shipBars, (i) => !this.arena && i === this.focusIndex, wanted, flag, detail, (i) => known[i]?.dot ?? false);
    this.islands.update(s);
    const watched = this.sim.world.ships[this.focusIndex];
    this.portMarks.update(s, this.time.now / 1000, watched?.offender && !watched.sunk ? watched.offender.port : -1);
    // M4b step 5a: fog is in the rules now (world.fog); the panel's "fog" switch adds or takes away the banks.
    if (!v.fog && this.sim.world.fog) delete this.sim.world.fog;
    if (v.fog && !this.sim.world.fog) this.sim.world.fog = makeFog(this.arenaSeed + this.sim.world.tick);
    this.fog.update(this.sim.world.fog, this.sim.world.wind, s, v.fog);
    const events = this.sim.takeEvents();
    if (this.arena) this.recordArena(events, seconds);
    else if (this.started) this.recordBattle(events);
    for (const e of events) {
      if (this.arena) break; // the battle counters are for your own ship only
      if (e.type === 'gunFired' && e.shipId === PLAYER_ID) this.ballsFired++;
      if (e.type === 'hit' && e.byShipId === PLAYER_ID && e.zone === 'hull') this.hullHits++;
      if (e.type === 'gunFired' && e.shipId !== PLAYER_ID) this.enemyBalls++;
      if (e.type === 'hit' && e.byShipId !== PLAYER_ID && e.shipId === PLAYER_ID && e.zone === 'hull') this.enemyHullHits++;
      if (e.type === 'sunk' && e.shipId === PLAYER_ID) this.sunkBy = e.byShipId;
      if (e.type === 'hit' && e.byShipId === PLAYER_ID && e.zone === 'hull') this.myDuelHullHits++;
    }
    // M4b step 5a: no smoke, flash, sound or balls of a ship you cannot see or hear (a shot reveals the shooter
    // within revealM, so this hides only far-off gunfire).
    const seenEvents = events.filter((e) => e.type !== 'gunFired' || shotSeen(known, this.sim.world, e.shipId, seeAll));
    this.playJuice(seenEvents, halfW);
    this.cannonballs.play(seenEvents, s, this.sim.world.wind, (id) => this.ship(id)?.headingRad);
    this.cannonballs.update(this.sim.world.balls.filter((b) => shotSeen(known, this.sim.world, b.shipId, seeAll)), alpha * STEP_SECONDS, s, seconds);

    const me = poses[this.focusIndex];
    const myShip = this.sim.world.ships[this.focusIndex];
    if (!me || !myShip) return;
    // Every ship that floats leaves a wake.
    const wakeShips = this.sim.world.ships.flatMap((ship, i) => {
      const pose = poses[i];
      const cls = SHIP_CLASSES[ship.shipClass];
      if (!pose || !cls || ship.sunk || !(known[i]?.shown ?? true)) return []; // (what is not seen leaves no wake on the screen)
      return [{ id: ship.id, x: pose.x, y: pose.y, headingRad: pose.headingRad, speed: ship.speed, length: cls.length, beam: cls.beam }];
    });
    this.wake.update(seconds, wakeShips, s);
    this.rings.visible = v.rangeRings;
    this.rings.labelsVisible = this.touch === null;
    this.touch?.setReload(myShip.reloadPort, myShip.reloadStarboard, myShip.reloadBow ?? 0);
    this.touch?.setAmmo(ammoLabel(myShip, true));
    this.rings.update(me.x, me.y, me.headingRad, s);
    const myParams = SHIP_CLASSES[myShip.shipClass];
    if (myParams) this.markers2.update(myShip, myParams, s, this.sim.world.wind.strength, seconds);

    // 4. The camera (M3 step 8, replaces the camera circle of D43): your ship (or the watched bot) stays in the
    // middle of the screen; under way the view looks ahead along its heading, at most one hull length at full
    // speed (view/combatCamera.ts leadOffset). The lead is smoothed, the ship itself is never left behind.
    // The spyglass (or the panel's "look ahead" off) puts the ship exactly in the middle.
    const spyglassOn = this.spyglassLeft > 0;
    const myClass = SHIP_CLASSES[myShip.shipClass];
    const goalLead =
      v.combatCamera && !spyglassOn && myClass
        ? leadOffset(me.headingRad, myShip.speed, myClass.maxSpeed, myClass.length * viewJson.cameraLeadHulls, halfW, halfH, viewJson.cameraCircleMaxShare)
        : { x: 0, y: 0 };
    this.cameraLead = smoothToward(this.cameraLead, goalLead, seconds, viewJson.combatCameraSmoothing * 3);
    if (this.freeView) {
      // The arena's free view: W A S D / arrows move it too.
      this.cameraCentre = this.freeView;
    } else {
      this.cameraCentre = { x: me.x + this.cameraLead.x, y: me.y + this.cameraLead.y };
    }
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
    // A wreck that has melted away is off the chart too.
    const gone = this.sim.world.ships.filter((sh, i) => sh.sunk && wreckGone(this.wreckAge[i] ?? 0, viewJson.wreck)).map((sh) => sh.id);
    const knownById = new Map(this.sim.world.ships.map((sh, i) => [sh.id, !!(known[i]?.shown || known[i]?.dot)]));
    updateSightings(
      this.chartState,
      this.sim.world.ships.filter((sh, i) => i !== this.focusIndex && !gone.includes(sh.id)),
      seaView,
      // M4b step 3: in a battle a ship is "in sight" when the viewer's ship has it in view (also off the screen), not when it is on the screen.
      seeAll ? undefined : (sh) => knownById.get(sh.id) ?? false,
    );
    forget(this.chartState, gone);
    this.chart.update(this.chartState, myShip, this.sim.world.wind);

    // 5. Edge markers for ships within sighting range that are off the screen.
    const contacts: Contact[] = [];
    // (M4b step 3: in a battle, the ships in view of your ship, at whatever distance it can see them.)
    const enemies = poses.filter((_p, i) => i !== this.focusIndex && !this.sim.world.ships[i]?.sunk && (seeAll || known[i]?.shown || known[i]?.dot));
    for (const p of enemies) {
      const distance = Math.hypot(p.x - me.x, p.y - me.y);
      if (seeAll && distance > viewJson.sightingRange) continue;
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
    const target = this.nearestEnemy(myShip, known) ?? this.leftTarget();
    const rangeM = params ? gunRange(myShip, params) : 0;
    // Ship centres on the screen: a HUD panel over one of them turns see-through.
    // A wreck never makes a panel see-through: only ships that float count.
    const shipsOnScreen = poses.flatMap((p, i) => (this.sim.world.ships[i]?.sunk || !(known[i]?.shown ?? true) ? [] : [{ x: p.x * s - cam.scrollX, y: p.y * s - cam.scrollY }]));
    const viewNow = { x: (cam.scrollX + cam.width / 2) / s, y: (cam.scrollY + cam.height / 2) / s, halfW, halfH };
    this.minimap.update(v.minimap, this.chartState, myShip, shipsOnScreen, seconds, this.panel.openWidthCss() / layout.cssZoom, viewNow);
    this.hud.setDebugBeside(this.arena && this.arenaHud.right() > 0 ? { x: this.arenaHud.right() + 10, y: this.arenaHud.top() + 3 } : null);
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
      sailShare: sailShare(myShip),
      crewShare: crewShare(myShip),
      ammoSlots: ammoSlots(myShip),
      coveredRightPx: this.panel.openWidthCss() / layout.cssZoom,
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
            sailShare: sailShare(target),
            crewShare: crewShare(target),
            // M4b step 3: the card shows only what can be seen from here (class and distance; the hull bar within 450 m; sails and crew within 200 m).
            detail: known[this.sim.world.ships.indexOf(target)]?.detail ?? 0, // M4b step 5a: the same rule as the ship bars
          }
        : null,
      debug: v.debugText,
      debugLines: v.debugText
        ? (this.arena ? ['SPACE next ship  T speed  L log', 'B bot view  + / - zoom  ESC pause', 'H hide this', ''] : []).concat(debugLines({
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
            // In the arena you do not steer: the arena keys instead of the ship keys (a shorter box, M3 step 6b).
            .filter((_line, i) => !this.arena || i === 0 || i >= 8))
            .concat(this.botLine())
            .concat(['', this.perf.line(this.game.loop.actualFps)])
        : [],
    });

    // 7. The end of the duel: a banner, then "sail again" (button or Enter).
    if (this.arena) {
      this.roster.hide();
      this.arenaHud.update(this.sim.world, poses, s, myShip.id, this.freeView === null, this.timeScale, clock(this.sim.world.tick * STEP_SECONDS), {
        known,
        botEyes: v.botEyes,
        ships: shipsOnScreen,
        ship: belowPanels(this.hud.shipRect(), this.hud.targetRect()),
        avoid: hudRects.target,
        seconds,
      });
      return;
    }
    // M4b 5d (D75): the list of the other ships (a battle only, not the arena).
    updateRosterMemory(this.rosterMemory, this.sim.world.ships, known, PLAYER_ID);
    const rows = this.started ? rosterRows(this.sim.world.ships, known, this.rosterMemory, PLAYER_ID) : [];
    const card = this.hud.targetBox();
    const shipBox = this.hud.shipRect();
    this.roster.update(rows, this.touch !== null ? { x: shipBox.x + shipBox.w + 6, y: shipBox.y + 4 } : { x: card.x, y: card.y + card.h + 6 });
    const foes = this.sim.world.ships.filter((sh) => sh.id !== PLAYER_ID);
    if (myShip.sunk) this.banner.request('lose', this.sunkBy < 0 ? 'Sunk by the shore guns' : `Sunk by the pirate ${this.ship(this.sunkBy)?.shipClass ?? 'ship'}`, this.duelStats());
    else if (v.targetBehaviour === 'bot' && foes.length > 0 && foes.every((sh) => sh.sunk || this.traderGone(sh, myShip))) {
      // M3 step 7d: a trader that got clean away (beyond TRADER_GONE_M) does not keep the battle going.
      const sunk = foes.filter((sh) => sh.sunk).length;
      const gone = foes.length - sunk;
      const line = gone > 0 ? `${sunk} sunk, ${gone} trader${gone > 1 ? 's' : ''} got away` : foes.length === 1 ? `Enemy ${foes[0]?.shipClass ?? 'ship'} sunk` : `All ${foes.length} enemies sunk`;
      this.banner.request('win', line, this.duelStats());
    }
    this.banner.update(seconds, this.touch !== null);
    if (this.banner.isShown() && Phaser.Input.Keyboard.JustDown(this.enterKey)) this.restart();
  }

  /** Which whole zoom step to show now. */
  private chooseZoom(): number {
    const v = this.panel.values;
    const me = this.sim.world.ships[this.focusIndex];
    if (!v.autoZoom || !me || this.freeView) return v.zoom;
    const seen = knownShips(this.sim.world, me.id, observerSeesAll(this.arena, v.botEyes));
    const others = this.sim.world.ships.filter((sh, i) => sh.id !== me.id && !sh.sunk && (seen[i]?.shown ?? true)); // (M4b step 3: the camera does not frame a ship you cannot see)
    const enemy = nearest(me, others);
    if (!enemy || Math.hypot(enemy.x - me.x, enemy.y - me.y) > viewJson.combatCameraRange) return v.zoom;
    const cam = this.cameras.main;
    return autoZoom(this.zoomGoal, viewJson.zoomSteps, me, enemy, {
      widthPx: cam.width,
      heightPx: cam.height,
      pixelsPerMetre: v.pixelsPerMetre,
      marginPx: viewJson.autoZoomMarginPx,
      spareToZoomInPx: viewJson.autoZoomSpareInPx,
      closeFightRange: v.closeFightRange,
      closeFightRangeSpare: viewJson.closeFightRangeSpare,
    });
  }

  /** Phone: the tuning gear sits see-through near the right edge, half over the lower edge of the minimap. */
  private placeGear(layout: PixelLayout): void {
    if (!this.touch || !this.panel) return;
    const map = hudLayout(layout.width, layout.height, true).minimap;
    this.panel.placeGear((map.y + map.h) * layout.cssZoom - GEAR_CSS_H / 2, 4);
  }

  /** The screen got a new logical size: resize the camera, water and buttons. */
  private onLayout(layout: PixelLayout): void {
    this.cameras.main.setSize(layout.width, layout.height);
    this.water.setSize(layout.width, layout.height);
    this.touch?.layout(layout.width, layout.height);
    this.hud.layout(layout.width, layout.height);
    this.arenaHud.layout(layout.width, layout.height);
    this.banner.layout(layout.width, layout.height);
    this.arenaResults.layout(layout.width, layout.height);
    this.pauseMenu.layout(layout.width, layout.height);
    const buttons = hudLayout(layout.width, layout.height, this.touch !== null).sound;
    this.chart.layout(layout.width, layout.height, buttons.y + buttons.h + 6);
    // Phone: the tuning gear, see-through, half over the lower edge of the minimap, near the right edge.
    this.placeGear(layout);
    this.minimap.layout(layout.width, layout.height);
  }

  /** Keys -> commands. Rudder and elevation are held; sails change one step per key press. */
  private readInput(seconds: number): void {
    // A sunk ship takes no orders until "Sail again" (M3 step 4b); the view keys below still work.
    if (!this.ship(PLAYER_ID)?.sunk) this.readShipInput(seconds);
    else {
      // Read (and forget) the presses, so a key pressed while sunk does not act after "Sail again".
      const KD = Phaser.Input.Keyboard;
      [this.keys.Q, this.keys.E, this.keys.Z, this.keys.SPACE, this.keys.W, this.keys.S, this.cursors.up, this.cursors.down, ...this.ammoKeys].forEach((k) => k && KD.JustDown(k));
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) this.panel.toggleSound();
    if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.chart.setOpen(!this.chart.isOpen());

    // H shows or hides the debug text (keys and all the numbers).
    if (Phaser.Input.Keyboard.JustDown(this.keys.H)) this.panel.toggleDebugText();
    // L saves the battle log (M3 step 7d), as in the arena.
    if (Phaser.Input.Keyboard.JustDown(this.keys.L)) this.downloadLog();

    // Zoom is only about the picture, so it does not go through the simulation.
    // M3 step 7c: Shift + / Shift - (Z now fires the bow chaser); + / - alone raise and lower the guns.
    if (this.keys.SHIFT.isDown) this.readZoomKeys();
    if (Phaser.Input.Keyboard.JustDown(this.keys.V)) this.toggleSpyglass();
  }

  /** Rudder, sails, guns, elevation and ammunition: only for a ship afloat. */
  private readShipInput(seconds: number): void {
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
    // Ammunition (M3 step 4): 1 round shot, 2 chain shot, 3 grape shot.
    AMMO.order.forEach((type, i) => {
      const key = this.ammoKeys[i];
      if (key && Phaser.Input.Keyboard.JustDown(key)) this.sim.queueCommand({ type: 'setAmmo', shipId: PLAYER_ID, ammo: type });
    });
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.firePlayer('port');
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.firePlayer('starboard');
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.firePlayer('bow');
    const shift = this.keys.SHIFT.isDown; // Shift + / Shift - zoom (M3 step 7c)
    const up = this.keys.R.isDown || (!shift && this.raiseKeys.some((k) => k.isDown)) || this.hud.raise || (this.touch?.raise ?? false);
    const down = this.keys.F.isDown || (!shift && this.lowerKeys.some((k) => k.isDown)) || this.hud.lower || (this.touch?.lower ?? false);
    const raise = (up ? 1 : 0) - (down ? 1 : 0);
    if (raise !== 0) {
      const next = Math.max(0, Math.min(GUNS.maxElevationDeg, this.elevationDeg + raise * ELEVATION_DEG_PER_SECOND * seconds));
      if (next !== this.elevationDeg) {
        this.elevationDeg = next;
        this.sim.queueCommand({ type: 'setElevation', shipId: PLAYER_ID, valueDeg: next });
      }
    }
  }

  /** + / - pressed now: one zoom step in or out (M3 step 7c: with Shift in a battle, alone in the arena). */
  private readZoomKeys(): void {
    const KD = Phaser.Input.Keyboard;
    let raise = false;
    let lower = false;
    for (const k of this.raiseKeys) if (KD.JustDown(k)) raise = true;
    for (const k of this.lowerKeys) if (KD.JustDown(k)) lower = true;
    if (raise) this.stepManualZoom(1);
    if (lower) this.stepManualZoom(-1);
  }

  /** One step in or out through view.json manualZoomSteps (keys Shift + / Shift -, the mouse wheel). */
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
    const me = this.ship(PLAYER_ID);
    if (!me || me.sunk) return;
    const sails = me.sailLevel;
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
  /** Touch: the ammunition button loads the next kind (round, chain, grape). */
  private cycleAmmo(): void {
    const me = this.ship(PLAYER_ID);
    if (me && !me.sunk) this.sim.queueCommand({ type: 'setAmmo', shipId: PLAYER_ID, ammo: nextAmmo(ammoOf(me)) });
  }

  private firePlayer(side: Side): void {
    const me = this.ship(PLAYER_ID);
    const params = me ? SHIP_CLASSES[me.shipClass] : undefined;
    // M3 step 7f: no training: the bow chaser fires dead ahead, you aim by turning the ship.
    const trainDeg = 0;
    this.sim.queueCommand({ type: 'fire', shipId: PLAYER_ID, side });
    if (!me || !params || me.sunk || reloadLeft(me, side) > 0 || gunsOn(params, side) <= 0) return;
    const p = turnAbout(me, predictLanding(me, params, side, STEP_SECONDS), trainDeg);
    this.markers2.addGhost(p.x, p.y, predictLanding(me, params, side, STEP_SECONDS).seconds + 0.8);
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
        case 'landHit':
          this.sounds.play('hit_wood', e.x, e.y, ear, halfWidthM, 0.3, 250);
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
    // M3 step 7c: the bot's name (the arena pilot, or the ship's nation in a battle) and its ship class.
    const pilots = this.sim.world.arena?.pilots ?? [];
    return this.sim.world.bots.map((bot) => {
      const ship = this.ship(bot.shipId);
      const pilot = pilots.find((p) => p.shipId === bot.shipId);
      const name = pilot ? `#${pilot.number} ${pilot.name}` : `${ship?.nation ?? 'bot'} ${bot.shipId}`;
      const head = `${name}, ${ship?.shipClass ?? '?'}`;
      if (ship?.sunk) return `${head}: sunk`;
      const skills = skillsText(ship, bot); // M3 step 7c
      return `${head}${skills ? ` (${skills})` : ''}: ${bot.mode}${bot.side ? `, ${bot.side}` : ''}${bot.tack !== 0 ? `, tack ${bot.tack > 0 ? '+' : '-'}` : ''}`;
    });
  }

  /** The nearest enemy still afloat. */
  private nearestEnemy(me: ShipState, known: readonly { shown: boolean }[]): ShipState | undefined {
    let best: ShipState | undefined;
    this.sim.world.ships.forEach((sh, i) => {
      if (sh.id === me.id || sh.sunk || !(known[i]?.shown ?? true)) return; // (M4b step 3: only a ship you can see is the target)
      if (!best || Math.hypot(sh.x - me.x, sh.y - me.y) < Math.hypot(best.x - me.x, best.y - me.y)) best = sh;
    });
    return best;
  }

  /** The old target after the last enemy in view is gone: a wreck stays on the card ("SUNK"); a ship you cannot see does not. */
  private leftTarget(): ShipState | undefined {
    const t = this.ship(TARGET_ID);
    return t?.sunk ? t : undefined;
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
   *   - In "bot" mode each bot appears at a random place in open water, spawnMinM-spawnMaxM from you (data/world.json).
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
    this.rosterMemory = newRosterMemory();
    this.storeBattleLog(); // the battle that just ended stays downloadable (L) until the next one ends
    this.sim = new Simulation(createWorld(seed, botMode ? enemiesFor(seed, v.enemyCount) : 1));
    if (v.fog) this.sim.world.fog = makeFog(seed); // M4b step 5a
    // M3 step 7d: the classes of the bots (the panel's "bot classes": a mix, or one class for all).
    const classes = battleClasses(seed, this.sim.world.ships.length - 1, botMode ? v.botClasses : v.targetClass);
    this.sim.tuning.speedScale = speedScaleFor(v.speedScale, false, viewJson.soloSpeedScale);
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
        for (const [k, bot] of world.ships.slice(1).entries()) {
          const shipClass = classes[k] ?? 'sloop';
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
    this.ended = false;
    this.setPaused(false);
    this.hitFlash = [];
    this.chartState.sightings = []; // a new duel: the islands you know stay on the chart, the old ship marks go
    this.startBattleLog(seed);
  }

  /** ESC or the touch "II" button (M3 step 7c): close the chart or the results first, else pause / resume. */
  private onPauseKey(): void {
    if (this.chart.isOpen()) this.chart.setOpen(false);
    else if (this.arenaResults.isShown()) this.arenaResults.hide();
    else if (this.paused) this.setPaused(false);
    else if (!this.banner.isShown() && !this.ended) this.setPaused(true);
  }

  private setPaused(on: boolean): void {
    this.paused = on;
    if (on) this.pauseMenu.show(this.pauseLines(), this.touch !== null);
    else this.pauseMenu.hide();
  }

  /** The statistics in the pause window: the battle's ships, or the arena table. */
  private pauseLines(): string[] {
    const world = this.sim.world;
    const time = clock(world.tick * STEP_SECONDS);
    if (this.arena && world.arena) {
      const rows = arenaResults(world.arena.pilots, (id) => this.ship(id)?.shipClass ?? 'sloop');
      const sunk = new Set(world.ships.filter((sh) => sh.sunk).map((sh) => sh.id));
      return arenaLines(time, rows, sunk);
    }
    const { me, foes } = this.battleRows();
    if (!me) return [`time ${time}`];
    return battleLines(time, me, foes, `hits: you ${this.myDuelHullHits}  enemy ${this.enemyHullHits}`);
  }

  private battleRows(): { me: BattleShipRow | null; foes: BattleShipRow[] } {
    const mine = this.ship(PLAYER_ID);
    const row = (sh: ShipState): BattleShipRow => ({
      name: battleName(sh, PLAYER_ID),
      shipClass: sh.shipClass,
      hullShare: sh.hull / (SHIP_CLASSES[sh.shipClass]?.hullPoints ?? 1),
      sailShare: sailShare(sh),
      crewShare: crewShare(sh),
      sunk: sh.sunk,
      gone: mine !== undefined && sh.id !== PLAYER_ID && !sh.sunk && this.traderGone(sh, mine),
    });
    return { me: mine ? row(mine) : null, foes: this.sim.world.ships.filter((sh) => sh.id !== PLAYER_ID).map(row) };
  }

  /** END GAME (M3 step 7c): the arena's results, or the battle's end banner with the winner. */
  private endGame(): void {
    this.setPaused(false);
    if (this.arena) {
      this.showArenaResults();
      return;
    }
    const { me, foes } = this.battleRows();
    if (!me) return;
    const verdict = battleVerdict(me, foes);
    const words = endWords(verdict.winner, verdict.dealt, verdict.taken);
    this.ended = true;
    this.battleLog.add(this.sim.world.tick * STEP_SECONDS, `END GAME pressed: ${words.title} ${words.line}`);
    this.banner.request(verdict.winner === 'you' ? 'win' : verdict.winner === 'enemy' ? 'lose' : 'draw', words.line, this.duelStats(), words.title, true);
  }

  /** M3 step 7d: a trader that ran farther than TRADER_GONE_M from you is out of the battle. */
  private traderGone(ship: ShipState, me: ShipState): boolean {
    return SHIP_CLASSES[ship.shipClass]?.trader === true && Math.hypot(ship.x - me.x, ship.y - me.y) > TRADER_GONE_M;
  }

  /** M3 step 7d: a new battle log (you against bots), like the arena's. */
  private startBattleLog(seed: number): void {
    this.battleLog = new ArenaLog();
    this.battleStartedAt = new Date().toLocaleString();
    this.battleModes.clear();
    const world = this.sim.world;
    for (const line of headerLines(world, seed)) this.battleLog.add(0, line);
    this.battleLog.add(0, `battle with ${world.ships.length - 1} bots (seed ${seed}); you sail under the black flag:`);
    for (const ship of world.ships) {
      this.battleLog.add(0, `   ${who(world, ship.id)}${ship.cargo !== undefined ? ` (hold ${Math.round(ship.cargo * 100)}% full)` : ''}, at ${placeText(ship.x, ship.y)}`);
    }
  }

  /** Keep the last battle's log in the browser (it can come back empty: private windows, cleared data). */
  private storeBattleLog(): void {
    if (!this.started || this.battleLog.size === 0) return;
    try {
      localStorage.setItem(BATTLE_LOG_KEY, this.battleLog.text(this.sim.world, this.battleStartedAt));
    } catch {
      // no storage here: the download still works while the battle lasts
    }
  }

  /** M3 step 7d: this frame's battle events into the battle log, and a line when a bot changes its mind. */
  private recordBattle(events: readonly SimEvent[]): void {
    const world = this.sim.world;
    this.battleLog.record(world, events);
    for (const bot of world.bots) {
      if (this.battleModes.get(bot.shipId) === bot.mode) continue;
      this.battleModes.set(bot.shipId, bot.mode);
      this.battleLog.modeChanged(world, bot.shipId, bot.mode);
    }
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
        this.sim.queueCommand({ type: 'setBot', shipId: sh.id, enemyId: v.targetBehaviour === 'bot' ? PLAYER_ID : null, skilled: true });
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
    this.arenaResults.hide();
    this.focusIndex = 0;
    this.freeView = null;
    this.timeScale = 1;
    this.panel.setArenaSpeed(1);
    this.touch?.setShipButtonsVisible(true);
    this.arenaHud.setShown(false);
    this.started = false; // start at the sea's start place, not where some bot was
    this.restart();
  }

  /** LEAVE (and peace, once): the results with the best three; EXIT leaves, BACK keeps watching (M3 step 4c). */
  private showArenaResults(): void {
    const world = this.sim.world;
    if (!world.arena) {
      this.leaveArena();
      return;
    }
    const rows = arenaResults(world.arena.pilots, (id) => this.ship(id)?.shipClass ?? 'sloop');
    const line = `${clock(world.tick * STEP_SECONDS)} game time   ${world.arena.totalWins} wins${world.arena.peace ? '   PEACE' : ''}`;
    this.arenaResults.show(rows, line, this.panel.values.shipArt);
  }

  private startArena(): void {
    const v = this.panel.values;
    const seed = (Date.now() & 0x7fffffff) || 1;
    this.arenaSeed = seed;
    this.sim = new Simulation(createArenaWorld(seed, v.arenaBots));
    if (v.fog) this.sim.world.fog = makeFog(seed); // M4b step 5a
    this.sim.tuning.speedScale = speedScaleFor(v.speedScale, true, viewJson.soloSpeedScale);
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
    this.peaceShown = false;
    this.ended = false;
    if (this.paused) this.setPaused(false);
    this.arenaResults.hide();
    this.arenaLog = new ArenaLog();
    this.arenaStartedAt = new Date().toLocaleString();
    const pilots = this.sim.world.arena?.pilots ?? [];
    for (const line of headerLines(this.sim.world, seed)) this.arenaLog.add(0, line);
    this.arenaLog.add(0, `arena started with ${pilots.length} bots (seed ${seed}):`);
    for (const p of pilots) {
      const ship = this.ship(p.shipId);
      const skills = skillsText(ship, this.sim.world.bots.find((b) => b.shipId === p.shipId));
      this.arenaLog.add(0, `   #${p.number} ${p.name}, ${ship?.shipClass ?? '?'}${ship?.cargo !== undefined ? ` (hold ${Math.round(ship.cargo * 100)}% full)` : ''}, at ${placeText(ship?.x ?? 0, ship?.y ?? 0)}${skills ? `; ${skills}` : ''}`);
    }
  }

  /** The arena's keys: Space = follow the next ship, W A S D / arrows = move the view, T = time speed, L = log, B = bot's eyes (M4b step 4). */
  private readArenaInput(seconds: number): void {
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.SPACE)) this.nextFocus();
    if (Phaser.Input.Keyboard.JustDown(k.T)) this.nextSpeed();
    if (Phaser.Input.Keyboard.JustDown(k.L)) this.downloadLog();
    if (Phaser.Input.Keyboard.JustDown(k.B)) this.toggleBotEyes();
    if (Phaser.Input.Keyboard.JustDown(k.M)) this.panel.toggleSound();
    if (Phaser.Input.Keyboard.JustDown(k.C)) this.chart.setOpen(!this.chart.isOpen());
    if (Phaser.Input.Keyboard.JustDown(k.H)) this.panel.toggleDebugText();
    this.readZoomKeys(); // + / - (with or without Shift): the arena has no guns to raise
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

  /** M4b step 4: B / the EYES button: the arena screen shows everything, or only what the watched bot sees. */
  private toggleBotEyes(): void {
    this.panel.values.botEyes = !this.panel.values.botEyes;
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
      // The ship you picked sank (M3 step 4c): back to following the best bot, as agreed,
      // instead of the next number; NEXT picks a ship by hand again.
      this.autoFocus = true;
      this.freeView = null;
      this.pickFocus();
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
    // M3 step 7d: in a battle against bots, the battle's own log.
    const battle = !world.arena;
    const text = !battle ? this.arenaLog.text(world, this.arenaStartedAt) : this.battleLog.size > 0 ? this.battleLog.text(world, this.battleStartedAt) : (safeRead(BATTLE_LOG_KEY) ?? 'No battle log yet.\n');
    const d = new Date();
    const two = (n: number): string => String(n).padStart(2, '0');
    const name = `naval-${battle ? 'battle' : 'arena'}-log-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.txt`;
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

/**
 * M4b step 4: on a touch screen the arena buttons go under my ship panel, and under the target card when it is
 * shown (with five buttons the row reached under the card). A rect whose bottom is the lower of the two.
 */
function belowPanels(ship: { x: number; y: number; w: number; h: number }, target: { x: number; y: number; w: number; h: number } | null): { x: number; y: number; w: number; h: number } {
  if (!target) return ship;
  const bottom = Math.max(ship.y + ship.h, target.y + target.h);
  return { ...ship, h: bottom - ship.y };
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
