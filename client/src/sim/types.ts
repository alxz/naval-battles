// Plain data types for the simulation. Everything here is JSON-serializable.
// Units: game metres, seconds, radians. x east, y south. Heading 0 = east, clockwise.
// Game metres: ship sizes and speeds are about 2x real, so the fight fits on the screen (plan D26).

/** Fixed numbers for one class of ship. Loaded from `data/ships.json`. */
export interface ShipParams {
  name: string;
  length: number; // game metres, bow to stern
  beam: number; // game metres, side to side
  maxSpeed: number; // m/s at full sails
  acceleration: number; // m/s per second (speeding up and slowing down)
  turnRate: number; // rad/s with the rudder fully over and good steerage
  steerSpeed: number; // m/s at which the rudder works at full strength
}

/** The changing state of one ship. */
export interface ShipState {
  id: number;
  shipClass: string; // key into the ships data, e.g. "sloop"
  x: number; // metres
  y: number; // metres
  heading: number; // radians
  speed: number; // m/s
  rudder: number; // -1 (turn left) .. +1 (turn right)
  sailLevel: number; // 0 .. 1
}

export interface World {
  tick: number; // how many simulation steps have run
  ships: ShipState[];
}

/** Live tuning numbers (lil-gui sliders). Not game rules: they help us find the right feel. */
export interface Tuning {
  speedScale: number; // multiplies every ship's speed and acceleration; 1 = the numbers in ships.json
}

export const DEFAULT_TUNING: Tuning = { speedScale: 1 };

/** Everything the player or a bot may do goes through a command. */
export type Command =
  | { type: 'setRudder'; shipId: number; value: number }
  | { type: 'setSails'; shipId: number; value: number }
  // Test setup only (scale test, later scenario tests): put a ship somewhere, stopped.
  | { type: 'placeShip'; shipId: number; x: number; y: number; heading: number; shipClass?: string };
