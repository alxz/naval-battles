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
}

/** Things that happened during one step, for the screen (sounds, splashes, flashes). */
export type SimEvent =
  | { type: 'gunFired'; shipId: number; side: Side; x: number; y: number }
  | { type: 'splash'; x: number; y: number };

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
  | { type: 'fire'; shipId: number; side: Side };
