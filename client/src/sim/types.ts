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
}

/** A gun that will fire a little later (ripple fire). */
export interface PendingShot {
  shipId: number;
  side: Side;
  gun: number; // 0 .. gunsPerSide-1, from stern to bow
  tick: number; // fires at the start of this step
  salvoErrorDeg: number; // the roll error of this broadside: the same for every gun in it
}

/** Things that happened during one step, for the screen (sounds, splashes, flashes). */
export type SimEvent =
  | { type: 'gunFired'; shipId: number; side: Side; x: number; y: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'hit'; shipId: number; byShipId: number; zone: 'hull' | 'rigging'; x: number; y: number; z: number }
  | { type: 'sunk'; shipId: number; byShipId: number; x: number; y: number };

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
}

/** The wind as a ship feels it right now. */
export interface WindNow {
  fromRad: number; // where the wind comes FROM, sim radians
  strength: number; // 0 (calm) .. 1 (strong)
}

/** One wind for the whole sea (plan 4.2). */
export interface Wind extends WindNow {
  baseFromRad: number; // the drift wanders around this direction
}

/** An island: a polygon of corners in game metres. Loaded from `data/islands.json`. */
export interface Island {
  name: string;
  points: { x: number; y: number }[];
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
}

/** What a bot is doing now (plan 4.9: a state machine). */
export type BotMode = 'chase' | 'engage' | 'breakOff' | 'idle';

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
  // Test setup (lil-gui): let the computer steer this ship against `enemyId`, or stop (null).
  | { type: 'setBot'; shipId: number; enemyId: number | null };
