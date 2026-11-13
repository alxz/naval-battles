// Plain data types for the simulation. Everything here is JSON-serializable.
// Units: metres, seconds, radians. x east, y south. Heading 0 = east, clockwise.

/** Fixed numbers for one class of ship. Loaded from `data/ships.json`. */
export interface ShipParams {
  name: string;
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

/** Everything the player or a bot may do goes through a command. */
export type Command =
  | { type: 'setRudder'; shipId: number; value: number }
  | { type: 'setSails'; shipId: number; value: number };
