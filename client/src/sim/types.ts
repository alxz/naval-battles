// Plain data types for the simulation. Everything here is JSON-serializable.
// Units: game metres, seconds. x east, y south.
// Angles carry their unit in the name (plan D34): ...Rad = sim radians, 0 = east, clockwise.
// Game metres: ship sizes and speeds are about 2x real, so the fight fits on the screen (plan D26).

/** Fixed numbers for one class of ship. Loaded from `data/ships.json`. */
export interface ShipParams {
  name: string;
  rig: string; // key into polars.json: "foreAndAft", "mixed" or "square"
  length: number; // game metres, bow to stern
  beam: number; // game metres, side to side
  maxSpeed: number; // m/s at the best wind angle, full sails, full wind
  speedTimeConstant: number; // seconds: after this time the speed has made 63% of a change
  turnRate: number; // rad/s with the rudder fully over and good steerage
  minSteerShare: number; // 0..1: share of turnRate left when the ship barely moves
  gunsPerSide: number;
  reloadSeconds: number; // base reload time of one broadside
  hullPoints: number; // at 0 the ship sinks
  hullHeight: number; // metres from the water to the deck edge (hull hit zone)
  mastHeight: number; // metres from the water to the mast top (rigging hit zone above the hull)
  mass: number; // tons; in a collision the lighter ship suffers more
  crew: number; // sailors with a full crew (plan 4.10)
  sailPoints: number; // how much shot the rigging takes before the sails are gone (M3 step 4)
}

/** Gun and ball numbers for every ship. Loaded from `data/guns.json` (plan 4.4). */
export interface GunParams {
  muzzleSpeed: number; // m/s
  gravity: number; // m/s2
  gunHeight: number; // metres above the water
  maxElevationDeg: number;
  rippleSeconds: number; // the guns of one side fire one after another within this time
  inheritVelocity: number; // share of the ship's velocity the ball keeps (0..1)
  gunSpreadShare: number; // the guns sit along this share of the hull length
  maxBallSeconds: number; // safety limit: a ball older than this is removed
  damage: number; // hull points one round shot takes off (plan 4.4: hullPoints / hitsToSink)
  gunSigmaDeg: number; // base spread of one gun, degrees (plan 4.4: sigma_gun); tuned with tools/hit_table.py
  salvoSigmaDeg: number; // base error of a whole broadside, degrees (plan 4.4: sigma_salvo, the ship's roll)
  sailDamage: number; // sail points one ball takes off at sails share 1.0 (chain shot); see data/ammo.json
  crewKill: number; // sailors one ball kills at crew share 1.0 (round shot) when it hits the hull
  crewPerGun: number; // a gun needs this many sailors; with fewer, fewer guns fire (plan 4.4)
  maxReloadFactor: number; // a short crew reloads slower: reload x min(this, full crew / crew)
}

/** The three kinds of ammunition (plan 4.5). A plain string, no enum. */
export type AmmoType = 'round' | 'chain' | 'grape';

/** One kind of ammunition (data/ammo.json). Shares multiply the base numbers in guns.json. */
export interface AmmoParams {
  name: string;
  short: string; // for the HUD
  rangeShare: number; // share of the round shot's range (the muzzle speed is cut by its square root)
  spread: number; // multiplies the gun error (sigma_gun)
  pellets: number; // balls per gun (grape: a bag of small balls)
  hull: number; // share of guns.damage per ball (hull zone)
  sails: number; // share of guns.sailDamage per ball (rigging zone; a hull hit does nothing to the sails)
  crew: number; // share of guns.crewKill per ball (hull zone)
}

/** Port = left side looking forward, starboard = right side. */
export type Side = 'port' | 'starboard';

/** A cannonball in flight. z is the height above the water. */
export interface Ball {
  id: number;
  shipId: number; // who fired it
  x: number;
  y: number;
  z: number;
  vx: number; // m/s
  vy: number;
  vz: number; // up is positive
  ageSeconds: number;
  /** Hull points this ball takes off, if not the usual `GunParams.damage` (a shore gun's heavier ball). */
  damage?: number;
  /** What kind of ball it is; absent = round shot (shore guns fire round shot). */
  ammo?: AmmoType;
}

/** A gun that will fire a little later (ripple fire). */
export interface PendingShot {
  shipId: number;
  side: Side;
  gun: number; // 0 .. gunsPerSide-1, from stern to bow
  tick: number; // fires at the start of this step
  salvoErrorDeg: number; // the roll error of this broadside: the same for every gun in it
  ammo: AmmoType; // what the broadside was loaded with when it was ordered
}

/** Things that happened during one step, for the screen (sounds, splashes, flashes). */
export type SimEvent =
  | { type: 'gunFired'; shipId: number; side: Side; x: number; y: number; ammo?: AmmoType; balls?: number } // balls: grape fires 8 (absent = 1)
  | { type: 'splash'; x: number; y: number }
  | { type: 'hit'; shipId: number; byShipId: number; zone: 'hull' | 'rigging'; x: number; y: number; z: number; ammo: AmmoType; hullLost: number; sailsLost: number; crewLost: number }
  | { type: 'sunk'; shipId: number; byShipId: number; x: number; y: number; speedBefore?: number; sailLevelBefore?: number } // how it sailed the moment before it sank (for the log)
  // Two ships ran into each other at (x, y); how many hull points each lost.
  | { type: 'collision'; shipA: number; shipB: number; damageA: number; damageB: number; x: number; y: number }
  // Port law (sim/law.ts, sim/shore.ts). `port` = index into the list of ports.
  | { type: 'offender'; shipId: number; port: number; reason: 'fired' | 'hit' }
  | { type: 'pardoned'; shipId: number; port: number }
  | { type: 'shoreFired'; port: number; x: number; y: number }
  // The auto-bot arena (sim/arena.ts):
  | { type: 'targetChosen'; shipId: number; targetId: number; distance: number }
  | { type: 'respawn'; shipId: number; x: number; y: number }
  | { type: 'peace'; totalWins: number };

/** One point of a polar table: at this wind angle the ship makes this share of maxSpeed. */
export interface PolarPoint {
  twaDeg: number;
  share: number;
}

/** How a rig sails at each wind angle. Loaded from `data/polars.json`. */
export interface Polar {
  name: string;
  noGoDeg: number; // closer to the wind than this, the sails give no drive
  points: PolarPoint[]; // sorted by twaDeg
}

/** The changing state of one ship. */
export interface ShipState {
  id: number;
  shipClass: string; // key into the ships data, e.g. "sloop"
  x: number; // metres
  y: number; // metres
  headingRad: number;
  speed: number; // m/s
  rudder: number; // -1 (turn left) .. +1 (turn right)
  sailLevel: number; // 0 .. 1
  aground: boolean; // true after the last step hit land
  elevationDeg: number; // gun elevation, 0 .. maxElevationDeg
  reloadPort: number; // seconds until the port battery is ready (0 = ready)
  reloadStarboard: number;
  hull: number; // hull points left
  sunk: boolean; // a sunk ship stays in the list (for the picture) but takes no part any more
  battleSkill: number; // the captain's Battle skill 0..10 (plan 4.4 and 4.7); 4 for everyone until captains come (M6)
  team: number; // ships of different teams are enemies (0 = you, 1 = the bots, for now)
  repairing: boolean; // the crew is mending the hull this step (sim/repair.ts); set by the simulation
  /**
   * Port law (D40): set when this ship broke the peace of a port. `port` = index into the list of ports.
   * `forgiveLeft` = seconds it must still stay away (it only runs down beyond the port's law range).
   * Absent = a law-abiding ship.
   */
  offender?: { port: number; forgiveLeft: number };
  // M3 step 4. Absent = as good as new (a full rigging, a full crew, round shot, the starting stock).
  // Read them through sim/condition.ts and sim/ammo.ts, which fill in those defaults.
  sails?: number; // sail points left (0 .. the class's sailPoints)
  crew?: number; // sailors left (0 .. the class's crew)
  ammo?: AmmoType; // what the next broadside is loaded with
  ammoLeft?: { chain: number; grape: number }; // broadsides of each left; round shot is not counted yet (bought in port in M5)
}

/** The wind as a ship feels it right now. */
export interface WindNow {
  fromRad: number; // where the wind comes FROM, sim radians
  strength: number; // 0 (calm) .. 1 (strong)
}

/** One wind for the whole sea (plan 4.2). */
export interface Wind extends WindNow {
  baseFromRad: number; // the drift wanders around this direction
  shiftInSeconds?: number; // the base direction swings to a new one in this many seconds (set at the first drift)
}

/**
 * A piece of land: a polygon of corners in game metres. Three sources (sim/data.ts):
 *   data/islands.json           islands made by hand
 *   data/islandsGenerated.json  islands made by tools/make_islands.py, each with a picture
 *   the reef at the edge of the chart, built from data/world.json
 */
export interface Island {
  name: string;
  points: { x: number; y: number }[];
  /** 'reef' = the edge of the chart; 'big' | 'medium' | 'small' from the generator; 'structure' = a pier or a moored boat; none = hand-made. */
  kind?: string;
  /** A ready picture at 1 pixel per metre: file in assets/islands/, and where its top left corner goes. */
  picture?: { file: string; x: number; y: number };
  /**
   * A neutral port on this island: the anchorage, a point in open water off the pier, and the
   * places of its shore guns (both written by make_islands.py).
   */
  port?: { x: number; y: number; guns?: { x: number; y: number }[] };
  /** A river mouth a ship can sail into: the middle of its mouth and its head (written by make_islands.py). */
  inlet?: {
    x: number;
    y: number;
    headX: number;
    headY: number;
    /** The middle line from the mouth to the head, then the middle of the harbour. */
    path?: { x: number; y: number }[];
    harbour?: { x: number; y: number; r: number };
  };
  /** Solid things on the water that belong to this island: quay, piers, moored boats (written by make_islands.py). */
  solids?: { name: string; points: { x: number; y: number }[] }[];
}

/** The sea: a rectangle closed by a reef (data/world.json). Beyond it lies the open ocean, not in this game. */
export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  reefWidth: number; // metres; the reef lies inside the rectangle, along its four sides
}

export interface World {
  tick: number; // how many simulation steps have run
  rngState: number; // the seeded random generator (sim/random.ts)
  wind: Wind;
  ships: ShipState[];
  balls: Ball[];
  pendingShots: PendingShot[];
  nextBallId: number;
  events: SimEvent[]; // cleared at the start of every step
  bots: BotState[]; // ships steered by the computer (sim/bot.ts)
  /** The shore batteries' timers, one entry per port (sim/shore.ts). Made at the first step if absent. */
  shore?: ShoreBattery[];
  /** The auto-bot arena: every ship is a bot, each fights for itself (sim/arena.ts). Absent in a normal game. */
  arena?: ArenaState;
}

/** The changing state of one port's shore battery (plain data, like everything in the world). */
export interface ShoreBattery {
  port: number; // index into the list of ports
  reloads: number[]; // seconds until each gun is loaded again
  gapLeft: number; // seconds until the battery may fire its next gun (the guns fire one after another)
  aimErrorDeg: number; // the gunners' misjudgement of the elevation for the next shot
}

/** The guns of a port (data/shore.json). They obey the same ballistics and random errors as ship guns. */
export interface ShoreParams {
  muzzleSpeed: number; // m/s: heavier guns than a ship's
  gunHeight: number; // metres above the water: they stand on the shore
  minElevationDeg: number; // they can point a little down at a ship close by
  maxElevationDeg: number;
  reloadSeconds: number; // per gun
  damage: number; // hull points per hit
  gunSigmaDeg: number; // base spread of one gun (firm ground: steadier than a ship's deck)
  aimErrorSigmaDeg: number; // how well the gunners judge the elevation
  battleSkill: number; // the gunners' skill 0..10, used in the same sigma formula as ships
  thinkEveryTicks: number; // the battery looks for a target every N steps
}

/** One bot of the arena and its score. */
export interface Pilot {
  shipId: number;
  number: number; // shown as "#3"
  name: string;
  wins: number; // ships it sank
  losses: number; // times it was sunk
  balls: number; // balls it fired
  hullHits: number; // balls of its own that hit an enemy hull
  sinceSeconds: number; // how long its present ship has been afloat
}

export interface ArenaState {
  pilots: Pilot[];
  totalWins: number;
  peace: boolean; // after winsToPeace wins nobody attacks any more
  respawns: { shipId: number; seconds: number }[]; // sunk ships come back after this many seconds
  retargetSeconds: number; // until the next choice of targets
}

/** What a bot is doing now (plan 4.9: a state machine). */
export type BotMode = 'chase' | 'engage' | 'breakOff' | 'flee' | 'repair' | 'port' | 'outlaw' | 'idle';

/** What makes one bot different from another, drawn once when it is created (seeded random). */
export interface BotPersonality {
  preferredRange: number; // metres it likes for a broadside fight
  patienceSeconds: number; // how long it chases without gaining before it gives up
  aimErrorSigmaDeg: number; // how well it judges the elevation (smaller = better gunner)
}

/**
 * A bot's memory. It lives in the world state (plain data), so saves and tests
 * repeat exactly. The bot changes its ship only through commands, like the player.
 */
export interface BotState {
  shipId: number;
  enemyId: number;
  mode: BotMode;
  tack: -1 | 0 | 1; // beating against the wind: +1 = heading clockwise of the wind, -1 = anticlockwise, 0 = not beating
  tackSeconds: number; // how long on this tack (to avoid flipping: tackCooldownSeconds)
  side: Side | null; // the broadside it is turning toward the enemy
  aimErrorDeg: number; // its misjudgement of the elevation for the next broadside (new after every shot)
  personality: BotPersonality;
  chaseSeconds: number; // time in the current patience window of a chase
  chaseStartDistance: number; // distance at the start of that window
  breakOffLeft: number; // seconds left of sailing away after giving up
}

/** Bot behaviour numbers (data/bots.json). */
export interface BotParams {
  grapeRangeM: number; // closer than this the bot loads grape shot (if it has any)
  grapeLeaveM: number; // ... and goes back to round shot beyond this (a gap: no flip-flop)
  chainSpeedGap: number; // m/s: an enemy this much faster than the bot gets chain shot (stop the runner)
  chainMinEnemySails: number; // ... unless its sails are already below this share
  chainRangeShare: number; // ... and only within this share of the chain shot's reach
  thinkEveryTicks: number; // the bot thinks every N steps (3 = 10 times a second)
  engageRange: number; // metres: closer than this it fights
  chaseAgainRange: number; // metres: farther than this it chases again (gap = no flip-flop)
  preferredRange: number; // metres: the distance it likes for a broadside fight (middle of the personality range)
  preferredRangeSpread: number; // metres +- : each bot gets its own preferred range
  rangeBand: number; // metres +- around preferredRange where it sails straight across
  rangeBendDeg: number; // how much it bends its course to close or open the range
  fightSpeed: number; // m/s it aims for while fighting (it sets the sails by the wind for this)
  minSails: number; // never less sail than this (keep steering way)
  tackMarginDeg: number; // a course closer than no-go + this counts as "into the wind"
  closeHauledMarginDeg: number; // when beating, sail this far outside the no-go zone
  tackCooldownSeconds: number; // at least this long on one tack
  rudderGain: number; // rudder per radian of heading error
  aimErrorMinDeg: number; // judgement error of the elevation, sigma: the best bot...
  aimErrorMaxDeg: number; // ...and the worst (each bot gets its own value between)
  elevationDegPerSecond: number; // how fast it can raise or lower the guns (the same as the player's keys)
  aimToleranceDeg: number; // fire when the guns are within this of the wanted elevation
  fireOffsetM: number; // fire when the aim point is at most this many metres off the line of fire (the guns fire straight abeam)
  fireRangeShare: number; // fire up to this share of the longest range
  landLookaheadSeconds: number; // look this far ahead for land
  landLookaheadMinM: number; // and at least this many metres
  patienceMinSeconds: number; // a chase that gains less than giveUpGainM in this long (each bot its own value)...
  patienceMaxSeconds: number; // ...between min and max...
  giveUpGainM: number; // ...is given up
  breakOffSeconds: number; // then it sails away this long before it may chase again
  fleeHullShare: number; // with less hull than this share it runs away, then repairs at sea
  shipAvoidM: number; // it turns away from another ship this close ahead (plus half of both lengths)
  shipAvoidTurnDeg: number; // by this much
  portSeekRange: number; // a badly hurt bot runs for a port if one is within this many metres
}

/** Live tuning numbers (lil-gui sliders). Not game rules: they help us find the right feel. */
export interface Tuning {
  speedScale: number; // multiplies every ship's speed; 1 = the numbers in ships.json
  windDrift: boolean; // let the wind wander slowly (plan 4.2)
}

export const DEFAULT_TUNING: Tuning = { speedScale: 1, windDrift: true };

/** Everything the player or a bot may do goes through a command. */
export type Command =
  | { type: 'setRudder'; shipId: number; value: number }
  | { type: 'setSails'; shipId: number; value: number }
  // Test setup only (scale test, later scenario tests): put a ship somewhere, stopped.
  | { type: 'placeShip'; shipId: number; x: number; y: number; headingRad: number; shipClass?: string }
  // Test setup now (lil-gui); later sea events can change the wind the same way.
  | { type: 'setWind'; fromRad: number; strength: number }
  | { type: 'setElevation'; shipId: number; valueDeg: number }
  | { type: 'fire'; shipId: number; side: Side }
  // Load the next broadsides with this kind of ammunition (keys 1 / 2 / 3).
  | { type: 'setAmmo'; shipId: number; ammo: AmmoType }
  // Test setup (lil-gui): let the computer steer this ship against `enemyId`, or stop (null).
  | { type: 'setBot'; shipId: number; enemyId: number | null };

/** Collisions and repair (data/damage.json). */
export interface DamageParams {
  collision: {
    minClosingSpeed: number; // m/s: slower contacts only push the ships apart, without damage
    hullPerMps: number; // hull points per m/s of closing speed, for two ships of equal mass
    bowFactor: number; // a ship that hits with its bow takes only this share (the bow is strong)
    bowArcDeg: number; // "with its bow" = the other ship lies within this angle of dead ahead
    speedKept: number; // share of its speed a ship keeps after a damaging collision
    gapM: number; // metres of water left between the hulls after they are pushed apart
  };
  repair: {
    seaMaxShare: number; // repair at sea mends the hull up to this share of the full hull
    maxSails: number; // only with the sails at or below this (almost stopped)
    safeRange: number; // only with no enemy afloat within this many metres
    sharePerSecond: number; // share of the full hull mended per second
    sailsMaxShare: number; // the crew mends the sails at sea up to this share
    sailsPerSecond: number; // share of the full sails mended per second at sea
  };
  /** A badly damaged ship sails slower (M3 step 1b). */
  slowdown: {
    startShare: number; // below this share of the hull the ship slows down
    minFactor: number; // at hull 0 the target speed is this share of what it would be
    freeSpeed: number; // m/s: speeds up to this are never cut (a wreck can still crawl into port)
  };
  /** A short-handed ship sails and turns worse (M3 step 4b): nobody to trim the sails and haul the braces. */
  crew: {
    speedMinFactor: number; // with no crew left the target speed is this share (a straight line from 1 at a full crew)
    turnMinFactor: number; // with no crew left the turn rate is this share
  };
  /** A neutral port ("Open Sea" package C). */
  port: {
    safeRange: number; // metres round the anchorage: no ship here can fire or be damaged
    dockRange: number; // within this of the anchorage a ship can repair
    maxDockSpeed: number; // ... if it moves no faster than this, m/s
    maxShare: number; // the port mends the hull up to this share of the full hull
    sharePerSecond: number; // share of the full hull mended per second in port
    sailsPerSecond: number; // share of the full sails mended per second in port (up to all of them)
    crewPerSecond: number; // sailors who join per second in port (until the tavern comes in M5)
    /** Port law (D40): firing in safe water is allowed but punished. */
    law: {
      shooterHullShare: number; // a broadside fired unlawfully in safe water costs the shooter this share of its full hull
      damageFactor: number; // a ball that hits a law-abiding ship in safe water does only this share of its damage
      leaveFactor: number; // the shore guns fire at an offender within safeRange x this of the anchorage
      forgiveSeconds: number; // an offender must stay beyond that range this long to be pardoned
    };
  };
}
