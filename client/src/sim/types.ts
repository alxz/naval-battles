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
  sailCrew: number; // M3 step 7a: the men needed to sail her; with them aboard she keeps (almost) her full speed
  sailPoints: number; // how much shot the rigging takes before the sails are gone (M3 step 4)
  polar?: string; // M3 step 7a: key into polars.json when the class sails differently from its rig (the fluyt's tall masts); absent = rig
  cargoMin?: number; // M3 step 7a, traders: the hold is this full (0..1) at the least when she comes to sea ...
  cargoMax?: number; // ... and at the most
  ladenSlowdown?: number; // a full hold takes this share off her speed (0.15 = 15%)
  sternGuns?: number; // M3 step 7b: stern chasers firing astern (absent = none)
  bowGuns?: number; // M3 step 7c: bow chasers firing ahead, round shot only (absent = none)
  trader?: boolean; // M3 step 7b: a merchant: sails a trade run, runs from enemies, gets more for reaching port alive
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
/** A battery: the two broadsides, and (M3 step 7b) the stern chasers that fire astern. */
export type Side = 'port' | 'starboard' | 'stern' | 'bow';

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
  trainDeg?: number; // M3 step 7b/7c: the chasers trained this far off the centre line (+ = clockwise)
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
  | { type: 'pirateTurn'; shipId: number; reason: 'idle' | 'law' | 'rams'; renegade: boolean; was: string; falseFlag?: string } // M4b 5b-2: a bot turns pirate (hidden under a false flag, or a renegade with the black one)
  | { type: 'pardoned'; shipId: number; port: number }
  | { type: 'shoreFired'; port: number; x: number; y: number }
  // The auto-bot arena (sim/arena.ts):
  | { type: 'targetChosen'; shipId: number; targetId: number; distance: number }
  | { type: 'skills'; shipId: number } // M3 step 7c: a battle's bot got its skills (for the log)
  | { type: 'respawn'; shipId: number; x: number; y: number }
  | { type: 'escaped'; shipId: number; byShipId: number; how: 'port' | 'away'; points?: number } // M3 step 7a (arena): hurt, and got away alive; 7b: the points it earned
  | { type: 'botLeaves'; shipId: number; enemyId: number; reason: 'fear' | 'odds' | 'trader'; fear: number; odds: number } // M3 step 7b: a bot leaves a fight early
  | { type: 'jettison'; shipId: number; cargo: number } // M3 step 7b: cargo over the side
  | { type: 'landHit'; x: number; y: number; z: number } // M3 step 7b: a ball struck the land (a hill, a cliff)
  | { type: 'peace'; totalWins: number }
  // Bots (M3 step 4c / 5): for the arena log.
  | { type: 'botUnstick'; shipId: number; x: number; y: number; headingRad: number }
  | { type: 'finishDecision'; shipId: number; enemyId: number; go: boolean; canFinish: boolean; expected: number; enemyHull: number }
  | { type: 'berthWait'; shipId: number; port: string; occupied: number; berths: number }
  | { type: 'portBlocked'; shipId: number; port: string; seconds: number }
  | { type: 'routePlanned'; shipId: number; stops: { x: number; y: number }[]; kind: 'ports' | 'islands' } // M4b step 5b-1: a bot got its default route
  | { type: 'routePoint'; shipId: number; left: number } // D73: a route point reached; `left` points still ahead (0: the autopilot is off) // D74: a bot gives up a port it cannot get into
  | { type: 'ramDecision'; shipId: number; enemyId: number; go: boolean; distance: number; desperate?: boolean } // desperate (M3 step 7b): a runner that cannot get away turns to ram
  | { type: 'rammerLearned'; shipId: number; enemyId: number }
  // M4b perception (sim/perception.ts): `shipId` is the watcher, `otherId` the ship it saw / lost / forgot.
  | { type: 'sighted'; shipId: number; otherId: number; level: SightLevel; distance: number; first: boolean; again?: boolean; levelNow?: SightLevel; heard?: boolean }
  // M4b step 4: `distance` from the watcher to the last known place; `why` = 'land' (in range, an island in the
  // way) or 'range' (too far, or gone from the watcher's reach).
  | { type: 'lostSight'; shipId: number; otherId: number; x: number; y: number; distance?: number; why?: 'land' | 'range' }
  | { type: 'forgotten'; shipId: number; otherId: number; x: number; y: number };

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
  reloadStern?: number; // M3 step 7b: seconds until the stern chasers are ready (absent = ready)
  seamanship?: number; // M3 step 7c: the crew's seamanship, speed x this (0.85..1.2; absent = 1)
  reloadBow?: number; // M3 step 7c: seconds until the bow chasers are ready (absent = ready)
  nation?: string; // M3 step 7b: the flag it sails under (view/flags.ts nations); 'pirates' frightens traders more
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
  falseFlag?: string; // M4b step 5b-2 (D82): a pirate shows this flag from afar and hoists the black one close in (until it is a renegade)
  // M3 step 4. Absent = as good as new (a full rigging, a full crew, round shot, the starting stock).
  // Read them through sim/condition.ts and sim/ammo.ts, which fill in those defaults.
  sails?: number; // sail points left (0 .. the class's sailPoints)
  crew?: number; // sailors left (0 .. the class's crew)
  cargo?: number; // M3 step 7a: how full the hold is, 0..1 (traders only; absent = empty)
  ammo?: AmmoType; // what the next broadside is loaded with
  ammoLeft?: { chain: number; grape: number }; // broadsides of each left; round shot is not counted yet (bought in port in M5)
}

/**
 * M4b (D41): what a ship knows about another ship it has seen. Level 1 = something is there (a place only),
 * 2 = a silhouette (the class, course and speed), 3 = the flag, 4 = close enough to see hull, sails and crew.
 * Bots decide only from these lists (step 2 of M4b); they do not read the world.
 */
export type SightLevel = 1 | 2 | 3 | 4;

export interface Contact {
  id: number; // the other ship
  level: SightLevel; // the best level reached so far (what it has learned stays known)
  levelNow: SightLevel; // the level at the last sighting (what can be seen of it at this moment)
  visible: boolean; // seen at the last update (false = last known place only)
  x: number; // where it was when last seen
  y: number;
  headingRad?: number; // from level 2
  speed?: number;
  shipClass?: string;
  nation?: string; // from level 3
  hullShare?: number; // level 4: hull left, 0..1
  seenTick: number; // the world tick of the last sighting
  firstTick: number; // the tick of the first sighting
}

/** One ship's list of contacts (plain data in the world: `world.sight`). */
export interface ShipSight {
  shipId: number;
  contacts: Contact[];
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
  spawnMinM?: number; // M4b 5d: the bots of a battle start between these distances from you (data/world.json)
  spawnMaxM?: number;
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
  /** D73: a ship's own route (autopilot): the helmsman steers it through these points, rudder only (sim/autopilot.ts). */
  routes?: AutoRoute[];
  /** The shore batteries' timers, one entry per port (sim/shore.ts). Made at the first step if absent. */
  shore?: ShoreBattery[];
  /** The auto-bot arena: every ship is a bot, each fights for itself (sim/arena.ts). Absent in a normal game. */
  arena?: ArenaState;
  /** M3 step 6 (D44): pairs of ships that just collided: no new damage between them before `untilTick`. Absent = none. */
  contacts?: { a: number; b: number; untilTick: number; avoidUntilTick?: number }[];
  /** M4b (D41): what every ship has seen of the others (sim/perception.ts). Made at the first update if absent. */
  sight?: ShipSight[];
  /** M4b step 5a: fog banks for the rules (sim/fog.ts). Absent = clear air everywhere. */
  fog?: FogState;
  /** M4b step 5a: ships that fired lately: heard and seen by their smoke within revealM until `untilTick`. */
  gunfire?: { shipId: number; untilTick: number }[];
}

/** One fog bank: a band of puffs lying along the wind (sim/fog.ts). Puff places are relative to the bank's middle. */
export interface FogBank {
  x: number; // metres, the middle of the bank
  y: number;
  speed: number; // the bank drifts at this share of the drift speed
  reachM: number; // no puff reaches farther than this from the middle (a quick cut-off)
  puffs: { along: number; across: number; size: number }[]; // along = metres down the wind, across = to the side, size = diameter
}

export interface FogState {
  banks: FogBank[];
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
  escapes?: number; // M3 step 7a: times it was shot at, hurt, and got away alive (half a win each)
  escapePoints?: number; // M3 step 7b: what those escapes are worth (traders: 1 into port, 0.25 at sea)
}

export interface ArenaState {
  pilots: Pilot[];
  totalWins: number;
  peace: boolean; // after winsToPeace wins nobody attacks any more
  respawns: { shipId: number; seconds: number }[]; // sunk ships come back after this many seconds
  retargetSeconds: number; // until the next choice of targets
  /** M3 step 7a: ships under attack: who hit them and how long ago (for "got away alive"). */
  threats?: { shipId: number; byShipId: number; quietSeconds: number }[];
  /** ... and who already got away from whom in this life (one half win per pair and life, not one at every dash into safe water). */
  escapedFrom?: { shipId: number; byShipId: number }[];
}

/** What a bot is doing now (plan 4.9: a state machine). */
export type BotMode = 'chase' | 'engage' | 'breakOff' | 'flee' | 'repair' | 'port' | 'outlaw' | 'idle' | 'finish' | 'ram' | 'trade';

/** What makes one bot different from another, drawn once when it is created (seeded random). */
/** M3 step 7c: the ranges of the bot skills (data/skills.json, sim/skills.ts). */
export interface SkillParams {
  seamanshipMin: number;
  seamanshipMax: number;
  turnPerSeamanship: number;
  gunneryMin: number;
  gunneryMax: number;
  neutralGunnery: number;
  reloadPerGunnery: number;
  lonerShare: number;
  lonerCrowd: number;
  packCrowd: number;
  fleeEdgeWeight: number;
}

export interface BotPersonality {
  preferredRange: number; // metres it likes for a broadside fight
  patienceSeconds: number; // how long it chases without gaining before it gives up
  aimErrorSigmaDeg: number; // how well it judges the elevation (smaller = better gunner)
  courage?: number; // M3 step 7b: 0..1; it leaves a fight when its fear grows above this (absent = 0.7)
  loner?: boolean; // M3 step 7c: true = avoids enemies others hunt, false = joins them (a pack bot), absent = neither
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
  // --- M3 step 4c / 5 (optional: absent = nothing going on) ---
  progress?: { x: number; y: number; seconds: number; travelledM?: number }; // the last "am I moving?" check: where it began, how long ago, the way made since
  unstickLeft?: number; // seconds left of working free on a chosen heading (it was stuck)
  unstickHeadingRad?: number;
  finishLeft?: number; // seconds left of a finishing attack in a port's safe water (mode 'finish')
  finishMemory?: { enemyId: number; seconds: number }; // it already decided about this enemy in safe water; ask again after this
  waitingBerth?: boolean; // sailing to a port whose berths are full: waiting off the anchorage
  ramLeft?: number; // M3 step 6: seconds left of a deliberate ram (mode 'ram')
  ramMemory?: number; // seconds before it may weigh another ram
  // --- M3 step 6c ---
  route?: { goalX: number; goalY: number; points: { x: number; y: number }[]; ageSeconds: number }; // its way round the land (sim/path.ts)
  quietSeconds?: number; // seconds in a fight without firing a broadside (then it closes in)
  rammer?: boolean; // it has rammed an enemy on purpose and hit: now it likes the tactic (chain, grape, ram)
  // --- M3 step 7b: crew spirit and running ---
  fear?: number; // grows with hits, men lost and near misses (more under a black flag), fades slowly
  weighLeft?: number; // seconds until it weighs its chances again (3-6 s, random)
  weighDistance?: number; // the enemy's distance at the last weighing (is it gaining on us?)
  tradeTo?: { x: number; y: number }; // a trader's next stop on its trade run
  plan?: { x: number; y: number }[]; // M4b step 5b-1: its default route (stops chosen at birth, sailed round in turn)
  planIndex?: number; // the next stop of the plan
  // --- M4b step 5d (D74): it remembers a port it cannot get into ---
  wasAground?: boolean; // was aground at the last decision (to count a new grounding once)
  portTrouble?: { port: string; count: number; seconds: number }; // failures (groundings, working free) near that port in the current window
  blockedPorts?: { port: string; seconds: number }[]; // ports it gives up on, and for how long still
  // --- M4b step 5b-2 (D82): renegades ---
  sinceTick?: number; // the tick of its last sinking, or of its birth / rebirth (for "sank nobody for 10 minutes")
  rams?: number; // collisions in which it was the rammer
  renegade?: boolean; // hunts anyone, across the map; hides no more (black flag, wider patrol)
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
  rudderDeadDeg: number; // M4b 5c: a heading error this small gets no rudder (no hunting about the course)
  portFailCount: number; // M4b 5d: this many failures near one port within portFailWindowSeconds ...
  portFailWindowSeconds: number;
  portFailRadiusM: number; // ... closer to it than this (groundings, working free) ...
  portBlockSeconds: number; // ... and the bot counts the port closed for this long
  rudderSlewPerThink: number; // M4b 5c: the rudder moves at most this much per decision (a helmsman is not instant)
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
  // M3 step 4c: chasing a runner, and getting unstuck
  runnerOpeningMps: number; // the enemy pulls away at least this fast (m/s): it is running
  chaseSpeedMargin: number; // then the bot sets its sails for the runner's speed plus this (m/s)
  weakHullShare: number; // an enemy with less hull than this is pressed hard (straight at it beyond the preferred range)
  stuckCheckSeconds: number; // every this long it checks that it moved...
  stuckMoveM: number; // ...at least this far while it wanted to move; if not, it works free:
  unstickSeconds: number; // on the best open, fast heading for this long
  // M3 step 5: a finishing attack in a port's safe water
  finishHitChance: number[][]; // [metres, share of balls that hit the hull] (from tools/hit_table.py)
  finishMargin: number; // it can finish if expected damage x this >= the enemy's hull left
  finishChance: number; // ...and then goes in with this chance (a personal roll)
  finishRecklessChance: number; // when it cannot, it still goes in with this chance (bots are not always wise)
  finishSeconds: number; // the attack lasts at most this long, then it leaves (it is an offender by then)
  finishMemorySeconds: number; // a "no" stands this long before it may think again about the same enemy
  berthWaitM: number; // a full port: it waits this far off the anchorage
  // M3 step 6 (D45): seamanship part 2
  leadMaxSeconds: number; // a chaser steers for where the enemy will be, at most this far ahead (cuts it off)
  wearBelowMps: number; // a mixed rig wears (turns through downwind) instead of tacking when slower than this; a square rig always wears
  abeamBerthM: number; // water kept between its side and a ship alongside (other than a ram target)
  abeamTurnDeg: number; // how far it bears away from a ship too close alongside
  contactTurnDeg: number; // after a collision: turn this far away from the other ship and ease sail, for the pause
  ramRangeM: number; // a ram is weighed only within this distance...
  ramMassShare: number; // ...against a ship at most 1 / this heavier, or a crippled one...
  ramChance: number; // ...and then tried with this chance (a personal roll; it is not always wise)
  ramSeconds: number; // a ram lasts at most this long
  ramMemorySeconds: number; // before it weighs another ram
  // M3 step 6c
  wearBelowMpsSquare: number; // a square rig wears when slower than this, and tacks (bow through the wind) when faster
  shoreTackSeconds: number; // beating along a shore: it goes about early (after this long on a tack) when land is ahead
  routeSkipM: number; // the straight-line check ignores this much at both ends (a ship close to a shore, a goal in a harbour)
  routeReplanSeconds: number; // it plans its way round the land again after this long...
  routeGoalMoveM: number; // ...or when the goal has moved this far
  routeReachM: number; // a turning point of the way counts as reached this close
  quietCloseSeconds: number; // this long in a fight without a broadside: it closes in on the enemy
  shotTurnDeg: number; // a loaded side whose aim point is within this angle of the beam: it turns to put it on the beam
  rammerRamChance: number; // a rammer's chance to ram when the chance comes (others: ramChance)
  rammerMemorySeconds: number; // ... and how soon it weighs the next one
  rammerRangeM: number; // a rammer fights closer (its preferred range at most this)
  rammerGrapeM: number; // a rammer loads grape closer than this
  harbourSpeedMps: number; // M3 step 6d: in a harbour a bot sets its sails for at most this speed
  // --- M3 step 7b: crew spirit and running ---
  courageMin: number; // a warship's courage is drawn between these ...
  courageMax: number;
  traderCourageMin: number; // ... a trader's between these (much lower)
  traderCourageMax: number;
  fearPerHullShare: number; // fear from a hit: x the share of the full hull it took
  fearPerCrewShare: number; // fear from men lost: x the share of the full crew
  fearNearMiss: number; // fear from a ball splashing within nearMissM (a warning shot does the same)
  nearMissM: number;
  fearNearMissWarship: number; // ... a warship's crew is used to it: much less
  traderSafeM: number; // a running trader keeps running until the enemy is this far
  blackFlagFear: number; // fear from a pirate (black flag) is multiplied by this
  fearDecayPerSecond: number; // fear fades this much a second
  weighMinSeconds: number; // it weighs its chances every weighMin..weighMax seconds (random)
  weighMaxSeconds: number;
  leaveOdds: number; // our strength / theirs below this: it may leave the fight ...
  leaveChance: number; // ... with this chance at each weighing
  desperateRangeM: number; // running, caught (the enemy is faster) and this close: ...
  desperateChance: number; // ... it may turn and ram in despair (chance per weighing) ...
  desperateHullShare: number; // ... when its hull or crew is below this share
  jettisonChance: number; // a running trader the enemy gains on throws its cargo over the side (chance per weighing)
  jettisonMinCargo: number;
  traderThreatM: number; // an enemy this close makes a trader decide: run (most) or fight
  traderFightCourage: number; // a trader fights only with at least this courage and the odds in its favour
  traderArriveM: number; // a stop of the trade run is reached this close
  searchArriveM: number; // M4b (D69): this close to an enemy's last known place with nobody in view, the search is over
  traderCruiseSails: number; // sails set on the trade run
  routeStops: number; // M4b step 5b-1: stops in a bot's default route
  renegadeRouteStops: number; // M4b 5b-2: stops in a renegade's route (a wider patrol)
  traderIslandOffsetM: number; // a stop off a big island lies this far off its shore
  harbourLengthShare: number; // a ship may use a harbour up an inlet if its length is at most this share of the harbour's radius
  rammerChainShare: number; // and chain shot (to tear the sails) within this share of the chain shot's reach
  traderMouthOffM: number; // a trade stop at a port up an inlet lies this far off the inlet's mouth (M3 step 8)
}

/** Live tuning numbers (lil-gui sliders). Not game rules: they help us find the right feel. */
export interface Tuning {
  speedScale: number; // multiplies every ship's speed; 1 = the numbers in ships.json
  windDrift: boolean; // let the wind wander slowly (plan 4.2)
  huntPlayer?: boolean; // TEST only (M4b 5b-2): warships and pirates are told where you are every 20 s (a rumour reaches them); it breaks "bots do not cheat", so it is off by default and the logs say TEST
}

export const DEFAULT_TUNING: Tuning = { speedScale: 1, windDrift: true };

/** Everything the player or a bot may do goes through a command. */
export type Command =
  | { type: 'setRudder'; shipId: number; value: number; auto?: boolean } // auto: from the autopilot; a rudder input without it switches the autopilot off (D73)
  | { type: 'setSails'; shipId: number; value: number; auto?: boolean } // auto: from the autopilot; a sail input without it keeps the sails in your hand while the route lasts (M4b 5b-2)
  // Test setup only (scale test, later scenario tests): put a ship somewhere, stopped.
  | { type: 'placeShip'; shipId: number; x: number; y: number; headingRad: number; shipClass?: string }
  // Test setup now (lil-gui); later sea events can change the wind the same way.
  | { type: 'setWind'; fromRad: number; strength: number }
  | { type: 'setElevation'; shipId: number; valueDeg: number }
  | { type: 'fire'; shipId: number; side: Side; trainDeg?: number } // trainDeg: chasers only (stern 7b, bow 7c)
  | { type: 'jettison'; shipId: number } // M3 step 7b: throw the cargo over the side (faster)
  // Load the next broadsides with this kind of ammunition (keys 1 / 2 / 3).
  | { type: 'setAmmo'; shipId: number; ammo: AmmoType }
  // Test setup (lil-gui): let the computer steer this ship against `enemyId`, or stop (null).
  | { type: 'setBot'; shipId: number; enemyId: number | null; skilled?: boolean } // skilled: draw bot skills (M3 step 7c)
  // D73: the ship's route (up to maxPoints, the next point first), or none.
  | { type: 'setRoute'; shipId: number; points: { x: number; y: number }[] }
  | { type: 'clearRoute'; shipId: number }

/** D73: the player's route. The autopilot steers the ship to each point in turn (rudder only; the sails stay the player's). */
export interface AutoRoute {
  shipId: number;
  points: { x: number; y: number }[]; // the points still ahead, the next one first
  tack: -1 | 0 | 1; // beating to the next point (headwind): +1 / -1 the tack, 0 straight at it
  tackSeconds: number; // how long on this tack (the bots' hysteresis)
  handSails?: boolean; // you touched the sails: the helmsman leaves them alone for the rest of this route
}

/** D73: the autopilot's numbers (data/autopilot.json). */
export interface AutopilotParams {
  maxPoints: number; // a route holds at most this many points (a fifth wipes the oldest)
  arriveM: number; // a point is reached this close
  sails: number; // the sail level the helmsman sets when the route starts (until you touch the sails)
  thinkEveryTicks: number; // the helmsman decides every this many steps
}

/** Collisions and repair (data/damage.json). */
export interface DamageParams {
  collision: {
    minClosingSpeed: number; // m/s: slower contacts only push the ships apart, without damage
    // M3 step 6 (D44): damage = hullPerMps2 x (closing - minClosingSpeed)^2 x mass share x place x own-speed factor
    hullPerMps2: number; // hull points per (m/s)^2 above the minimum, for two ships of equal mass
    bowFactor: number; // a ship that hits with its bow takes only this share (the bow is strong)
    bowArcDeg: number; // "with its bow" = the other ship lies within this angle of dead ahead
    sideArcDeg: number; // struck "amidships" = within this angle of the beam (full damage)
    endFactor: number; // struck near the bow or the stern (not amidships, not with its own bow)
    alongsideDeg: number; // hulls within this angle of each other (either way) = side against side...
    alongsideFactor: number; // ...and both take only this share
    pairPauseSeconds: number; // after a damaging contact the same two ships take no new damage for this long
    avoidSeconds: number; // ...and the bots of the pair steer clear of each other this long
    maxHullShare: number; // one collision takes at most this share of a ship's full hull (a head-on crash is bad, not fatal)
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
    // M3 step 7a: a ship needs only its sailing crew (ShipParams.sailCrew) to keep its speed.
    speedMinFactor: number; // with no crew left the target speed is this share (a straight line up to the sailing crew)
    speedLossFull: number; // with exactly the sailing crew left the speed is 1 - this x the share of men lost (a small loss)
    turnMinFactor: number; // with no crew left the turn rate is this share
    accelSlowdown: number; // speeding up and slowing down take 1 + this x the share of men lost times longer
    crowdPerMetre: number; // a ball kills guns.crewKill men on a deck this crowded (men per metre of length); fewer on an emptier deck
    grapeCoverHeightM: number; // grape kills fewer men behind sides higher than this (x this / hullHeight)
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
    berths: number; // ships that can lie at the anchorage at once (M3 step 5)...
    berthsInlet: number; // ...fewer in a small harbour up an inlet
    towMps: number; // M3 step 6c: in a harbour, boats tow a ship with any sail set at least this fast (even into the wind)
    towPathM: number; // ...up an inlet: within this many metres of its middle line
    /** Port law (D40): firing in safe water is allowed but punished. */
    law: {
      shooterHullShare: number; // a broadside fired unlawfully in safe water costs the shooter this share of its full hull
      damageFactor: number; // a ball that hits a law-abiding ship in safe water does only this share of its damage
      leaveFactor: number; // the shore guns fire at an offender within safeRange x this of the anchorage
      forgiveSeconds: number; // an offender must stay beyond that range this long to be pardoned
    };
  };
}

/** Renegades and false flags (data/renegade.json, D82). */
export interface RenegadeParams {
  checkEverySeconds: number; // how often the rules look at every bot
  idleSeconds: number; // a bot that sank nobody this long (and is alive) may change its flag
  idleChance: number; // ... with this chance at each check
  hoistM: number; // a false flag comes down this close (the black flag goes up)
  falseFlagShare: number; // share of the pirates that start under a false flag
  ramsMin: number; // the bot with the most rams is a renegade, if it has at least this many
}
