// The first bot (M2 step 4, plan 4.9): a pirate sloop that chases you, turns its side and fires.
//
// A bot is a small state machine:
//   chase   (far away)   sail toward the enemy, beating against the wind if needed
//   engage  (in range)   turn a broadside to the enemy, keep about 140 m, set the sails for a steady speed,
//                        aim (with a small misjudgement) and fire when the enemy is on the line of fire
//   flee    (hull low)   run on the fastest course away; then repair at sea and come back
//   idle    (no enemy)   lie still
// It sees only what a captain could see (positions, headings, speeds) and changes its ship
// only through commands, like the player. Its shots get the same random errors as the player's.
// Its memory (BotState) lives in the world state, so a save or a test repeats exactly.

import { isOffenderOf, offenderNear, protectedByPort, safePortIndex } from './law';
import { nearestPort, portWaypoint, portsOf } from './port';
import type { Port } from './port';
import { degToRad, normalizeAngle, twaDeg } from './angles';
import { BOTS, DAMAGE, GUNS, POLARS, SHIP_CLASSES } from './data';
import { predictLanding, reloadLeft, sideAngleRad } from './guns';
import { touchesLand } from './land';
import { clamp } from './math';
import { nextGaussian } from './random';
import { STEP_SECONDS, targetSpeed } from './step';
import { nextRandom } from './random';
import type { BotParams, BotState, Command, DamageParams, Island, ShipParams, ShipState, Side, WindNow, World } from './types';

const SIDES: Side[] = ['port', 'starboard'];

/**
 * A new bot for this ship, with its own personality drawn from the seeded random generator
 * (so every bot is a little different, and the same seed still gives the same game).
 */
export function newBot(shipId: number, enemyId: number, rng: { rngState: number }, p: BotParams = BOTS): BotState {
  const between = (lo: number, hi: number): number => lo + (hi - lo) * nextRandom(rng);
  return {
    shipId,
    enemyId,
    mode: 'chase',
    tack: 0,
    tackSeconds: 0,
    side: null,
    aimErrorDeg: 0,
    personality: {
      preferredRange: between(p.preferredRange - p.preferredRangeSpread, p.preferredRange + p.preferredRangeSpread),
      patienceSeconds: between(p.patienceMinSeconds, p.patienceMaxSeconds),
      aimErrorSigmaDeg: between(p.aimErrorMinDeg, p.aimErrorMaxDeg),
    },
    chaseSeconds: 0,
    chaseStartDistance: Infinity,
    breakOffLeft: 0,
  };
}

/** Start (or restart) a chase: a new patience window. */
function startChase(bot: BotState, distance: number): void {
  bot.mode = 'chase';
  bot.chaseSeconds = 0;
  bot.chaseStartDistance = distance;
}

/**
 * The mode for this moment (a state machine with gaps, so it does not flip):
 *   engage    when the enemy is within engageRange (from any mode)
 *   chase     when it gets farther than chaseAgainRange; after a break-off; after idle
 *   breakOff  when a chase gained less than giveUpGainM in the bot's patience time:
 *             it sails away for breakOffSeconds (so a faster or equal ship can escape)
 *   flee      when its hull is below fleeHullShare: it runs until the enemy is out of repair range
 *   repair    then it almost stops and mends the hull (sim/repair.ts); if the enemy comes near
 *             again it flees again; mended to the sea limit, it comes back to fight
 * `hullShare`: hull / full hull. `repairDone`: the hull has reached the limit for repair at sea.
 */
export function updateMode(bot: BotState, distance: number, seconds: number, p: BotParams, hullShare = 1, d: DamageParams = DAMAGE): void {
  const safe = d.repair.safeRange + 100; // a little more than the rule asks, so it does not hover at the limit
  if (bot.mode === 'flee') {
    if (distance > safe) bot.mode = 'repair';
    return;
  }
  if (bot.mode === 'repair') {
    if (distance <= d.repair.safeRange) bot.mode = 'flee';
    else if (hullShare >= d.repair.seaMaxShare - 1e-6) startChase(bot, distance);
    return;
  }
  if (hullShare < p.fleeHullShare) {
    bot.mode = 'flee';
    bot.side = null;
    return;
  }
  if (distance < p.engageRange) {
    bot.mode = 'engage';
    return;
  }
  switch (bot.mode) {
    case 'idle':
      startChase(bot, distance);
      break;
    case 'engage':
      if (distance > p.chaseAgainRange) startChase(bot, distance);
      break;
    case 'breakOff':
      bot.breakOffLeft -= seconds;
      if (bot.breakOffLeft <= 0) startChase(bot, distance);
      break;
    case 'chase':
      bot.chaseSeconds += seconds;
      if (bot.chaseSeconds >= bot.personality.patienceSeconds) {
        if (bot.chaseStartDistance - distance < p.giveUpGainM) {
          bot.mode = 'breakOff';
          bot.breakOffLeft = p.breakOffSeconds;
        } else {
          startChase(bot, distance); // it is gaining: a new window
        }
      }
      break;
  }
}

/**
 * The sail setting that gives about `wantedSpeed` here and now (the polar and the wind decide
 * how much each bit of sail is worth). Downwind a bot needs less sail than on a reach.
 * In irons there is no drive at all, so it keeps full sail to be ready.
 */
export function sailsForSpeed(ship: ShipState, params: ShipParams, wind: WindNow, wantedSpeed: number, minSails: number): number {
  const full = targetSpeed({ ...ship, sailLevel: 1 }, params, wind);
  if (full < 0.1) return 1;
  return clamp(wantedSpeed / full, minSails, 1);
}

/**
 * The heading to steer for a goal heading, beating against the wind when the goal lies in
 * (or close to) the no-go zone: close-hauled on one tack. It stays on a tack at least
 * `tackCooldownSeconds` (hysteresis), then goes about if the goal is now on the other side.
 * Updates `bot.tack`; returns the heading.
 */
export function steerWithTacks(goalRad: number, params: ShipParams, wind: WindNow, bot: BotState, p: BotParams): number {
  const noGo = POLARS[params.rig]?.noGoDeg ?? 0;
  if (twaDeg(goalRad, wind.fromRad) >= noGo + p.tackMarginDeg) {
    bot.tack = 0;
    return goalRad;
  }
  const rel = normalizeAngle(goalRad - wind.fromRad); // > 0: the goal lies clockwise of the wind
  const better: 1 | -1 = rel >= 0 ? 1 : -1;
  if (bot.tack === 0) {
    bot.tack = better;
    bot.tackSeconds = 0;
  } else if (bot.tack !== better && bot.tackSeconds >= p.tackCooldownSeconds) {
    bot.tack = better; // go about
    bot.tackSeconds = 0;
  }
  return normalizeAngle(wind.fromRad + bot.tack * degToRad(noGo + p.closeHauledMarginDeg));
}

/**
 * The heading that turns `side` toward a point at this bearing, bent toward it when we are too
 * far and away from it when too close (so the bot keeps about `preferredRange`); the bend grows
 * smoothly with the distance from the preferred range.
 * Port faces left of the bow: to have the enemy to port, head 90 degrees clockwise of the bearing.
 */
export function broadsideHeading(bearingRad: number, distance: number, side: Side, p: BotParams): number {
  // A smooth pull toward the preferred range: no bend at it, the full bend `rangeBand` metres
  // or more away from it. (A dead band let the bot sit at its outer edge, at 180 m, for ever.)
  const bend = clamp((distance - p.preferredRange) / p.rangeBand, -1, 1);
  const b = degToRad(p.rangeBendDeg) * bend; // > 0: turn the bow toward the enemy
  return side === 'port' ? normalizeAngle(bearingRad + Math.PI / 2 - b) : normalizeAngle(bearingRad - Math.PI / 2 + b);
}

/**
 * The elevation that throws the middle ball `distance` metres from the ship's centre, by halving
 * the interval (the landing distance grows with the elevation up to the maximum).
 * Measured as if the ship lay still: our own motion is already in `aimPoint` (relative motion).
 * Returns null when the distance is out of reach.
 */
export function aimElevation(ship: ShipState, params: ShipParams, side: Side, distance: number, maxDeg: number): number | null {
  const still = { ...ship, speed: 0 };
  const reach = (deg: number): number => {
    const p = predictLanding({ ...still, elevationDeg: deg }, params, side, STEP_SECONDS);
    return Math.hypot(p.x - ship.x, p.y - ship.y);
  };
  if (distance > reach(maxDeg)) return null;
  let lo = 0;
  let hi = maxDeg;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (reach(mid) < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Where to aim: the enemy's position after the flight time, as seen from our moving deck
 * (the ball keeps our speed, so it is the enemy's motion relative to ours that counts).
 */
export function aimPoint(ship: ShipState, enemy: ShipState, flightSeconds: number): { x: number; y: number } {
  const rvx = enemy.speed * Math.cos(enemy.headingRad) - ship.speed * Math.cos(ship.headingRad);
  const rvy = enemy.speed * Math.sin(enemy.headingRad) - ship.speed * Math.sin(ship.headingRad);
  return { x: enemy.x + rvx * flightSeconds, y: enemy.y + rvy * flightSeconds };
}

/** Room the bot keeps between its hull and the shore, metres. */
const LAND_CLEARANCE_M = 15;
/** Metres of water a bot keeps between its hull and an enemy's when it would sail into it. */
const ENEMY_BERTH_M = 40;

/**
 * Is there land ahead? If so, a heading to turn to (the first free one of +-45, +-90, +-135 degrees).
 * It tests a "fat" copy of the ship (LAND_CLEARANCE_M wider and longer) at three points ahead,
 * so it also sees a corner of the shore that would scrape its side, not only land straight ahead.
 */
export function avoidLand(ship: ShipState, params: ShipParams, islands: readonly Island[], headingRad: number, p: BotParams): number | null {
  if (islands.length === 0) return null;
  const look = Math.max(p.landLookaheadMinM, ship.speed * p.landLookaheadSeconds);
  const fat: ShipParams = { ...params, length: params.length + 2 * LAND_CLEARANCE_M, beam: params.beam + 2 * LAND_CLEARANCE_M };
  const blocked = (h: number): boolean =>
    [0.25, 0.5, 1].some((share) =>
      touchesLand({ ...ship, headingRad: h, x: ship.x + Math.cos(h) * look * share, y: ship.y + Math.sin(h) * look * share }, fat, islands),
    );
  if (!blocked(headingRad)) return null;
  for (const turn of [45, -45, 90, -90, 135, -135]) {
    const h = normalizeAngle(headingRad + degToRad(turn));
    if (!blocked(h)) return h;
  }
  return normalizeAngle(headingRad + Math.PI); // boxed in: turn round
}

/**
 * The fastest way to run: straight away from the enemy, or up to 40 degrees to either side
 * of that if the wind makes such a course faster (a ship running dead before the wind or
 * into it is slower than one on a reach).
 */
export function fleeHeading(ship: ShipState, params: ShipParams, wind: WindNow, bearingToEnemy: number): number {
  const away = normalizeAngle(bearingToEnemy + Math.PI);
  let best = away;
  let bestSpeed = -1;
  for (const offDeg of [0, 20, -20, 40, -40]) {
    const heading = normalizeAngle(away + degToRad(offDeg));
    const speed = targetSpeed({ ...ship, headingRad: heading, sailLevel: 1 }, params, wind);
    if (speed > bestSpeed + 0.2) {
      best = heading;
      bestSpeed = speed;
    }
  }
  return best;
}

/**
 * Is another ship close ahead? Then a heading that turns away from it (to the side it is not on).
 * Bots do not ram: a collision costs them hull too.
 */
export function avoidShips(ship: ShipState, params: ShipParams, ships: readonly ShipState[], headingRad: number, p: BotParams): number | null {
  for (const other of ships) {
    if (other.id === ship.id || other.sunk) continue;
    const otherLength = SHIP_CLASSES[other.shipClass]?.length ?? 0;
    const dx = other.x - ship.x;
    const dy = other.y - ship.y;
    // Friends get a wide berth; an enemy only a short one (the bot fights at 120-160 m and must not shy away from it).
    const berth = other.team === ship.team ? p.shipAvoidM : ENEMY_BERTH_M;
    if (Math.hypot(dx, dy) > berth + (params.length + otherLength) / 2) continue;
    const off = normalizeAngle(Math.atan2(dy, dx) - headingRad); // > 0: it lies to starboard of our course
    if (Math.abs(off) > Math.PI / 3) continue; // not ahead
    return normalizeAngle(headingRad + (off >= 0 ? -1 : 1) * degToRad(p.shipAvoidTurnDeg));
  }
  return null;
}

/**
 * One bot thinks and returns its commands. Called every step; it really thinks only every
 * `thinkEveryTicks` steps (reaction time), the rest of the time it returns nothing.
 */
export function thinkBot(world: World, bot: BotState, islands: readonly Island[], p: BotParams = BOTS): Command[] {
  if ((world.tick + bot.shipId) % p.thinkEveryTicks !== 0) return [];
  const ship = world.ships.find((s) => s.id === bot.shipId);
  const params = ship ? SHIP_CLASSES[ship.shipClass] : undefined;
  if (!ship || !params || ship.sunk) return [];
  const thinkSeconds = p.thinkEveryTicks * STEP_SECONDS;
  bot.tackSeconds += thinkSeconds;
  const commands: Command[] = [];
  const id = ship.id;
  const enemy = world.ships.find((s) => s.id === bot.enemyId);

  // --- Port law: a bot that broke a port's peace (a stray ball is enough) runs out of the reach
  // of its shore guns and stays away until it is pardoned. Its own guns stay silent meanwhile. ---
  if (ship.offender) {
    const lawPort = portsOf(islands)[ship.offender.port];
    if (lawPort) return leavePort(world, bot, ship, params, islands, lawPort, p);
  } else if (bot.mode === 'outlaw') {
    bot.mode = 'idle'; // pardoned: back to the usual life
  }

  // --- No enemy (gone or sunk; or peace in the arena): a hurt ship sails to a port, else it lies still. ---
  if (!enemy || enemy.sunk) {
    const full = params.hullPoints;
    const port = nearestPort(ship.x, ship.y, portsOf(islands));
    if (port && ship.hull < full * DAMAGE.port.maxShare - 1e-6 && world.arena) return sailToPort(world, bot, ship, params, islands, port, p);
    bot.mode = 'idle';
    if (ship.sailLevel !== 0) commands.push({ type: 'setSails', shipId: id, value: 0 });
    if (ship.rudder !== 0) commands.push({ type: 'setRudder', shipId: id, value: 0 });
    return commands;
  }

  // --- Mode, with a gap between the two ranges so it does not flip. ---
  const dx = enemy.x - ship.x;
  const dy = enemy.y - ship.y;
  const distance = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  const hullShare = ship.hull / params.hullPoints;
  const ports = portsOf(islands);
  const port = nearestPort(ship.x, ship.y, ports);
  if (bot.mode === 'port') {
    // In port (or on the way): stay until the port has done all it can, then hunt again.
    if (!port || hullShare >= DAMAGE.port.maxShare - 1e-6) startChase(bot, distance);
  } else {
    updateMode(bot, distance, thinkSeconds, p, hullShare);
    // Badly hurt and a port is within reach: run for the port instead of the open sea.
    if (bot.mode === 'flee' && port && port.distance <= p.portSeekRange) bot.mode = 'port';
  }
  const mine: BotParams = { ...p, preferredRange: bot.personality.preferredRange };
  // Port law: an enemy the port protects is left alone; the bot waits outside.
  // (An offender has lost that protection: the bot goes for him even in safe water.)
  const enemySafe = protectedByPort(enemy, ports);
  const waiting = enemySafe && (bot.mode === 'chase' || bot.mode === 'engage' || bot.mode === 'breakOff');
  if (waiting) bot.mode = 'idle';

  // --- Course and sails. ---
  let goal: number;
  let sails: number;
  let nearPort = false; // close to the anchorage: the bot may come close to the shore there
  if (bot.mode === 'port' && port) {
    // Sail to the anchorage, slow down near it, stop on it.
    bot.side = null;
    const way = portWaypoint(ship.x, ship.y, port.port);
    goal = Math.atan2(way.y - ship.y, way.x - ship.x);
    // Close to the anchorage, or on the way up an inlet: the way itself keeps clear of the land.
    nearPort = port.distance < 2 * DAMAGE.port.dockRange || way.inside;
    sails = port.distance < DAMAGE.port.dockRange * 0.5 ? 0 : port.distance < 3 * DAMAGE.port.dockRange ? p.minSails : 1;
  } else if (bot.mode === 'idle') {
    // The enemy is in safe water: keep clear of the port and wait almost stopped.
    bot.side = null;
    const tooClose = port !== null && port.distance < DAMAGE.port.safeRange + 250;
    goal = tooClose && port ? Math.atan2(ship.y - port.port.y, ship.x - port.port.x) : bearing;
    sails = tooClose ? 0.5 : 0;
  } else if (bot.mode === 'chase') {
    bot.side = null;
    goal = bearing;
    sails = 1;
  } else if (bot.mode === 'breakOff') {
    bot.side = null;
    goal = normalizeAngle(bearing + Math.PI); // away from the enemy
    sails = sailsForSpeed(ship, params, world.wind, p.fightSpeed, p.minSails);
  } else if (bot.mode === 'flee') {
    bot.side = null;
    goal = fleeHeading(ship, params, world.wind, bearing);
    sails = 1;
  } else if (bot.mode === 'repair') {
    bot.side = null;
    goal = normalizeAngle(bearing + Math.PI); // keep drifting away, almost stopped, while the crew works
    sails = DAMAGE.repair.maxSails;
  } else {
    // Keep the chosen side. Change to the other side when it is loaded, this one is not,
    // and the turn to it is less than 90 degrees (a full turn round would waste the reload time).
    const turn = (s: Side): number => Math.abs(normalizeAngle(broadsideHeading(bearing, distance, s, mine) - ship.headingRad));
    const other: Side = bot.side === 'port' ? 'starboard' : 'port';
    if (bot.side === null) {
      const loaded = SIDES.filter((s) => reloadLeft(ship, s) <= 0);
      const choices = loaded.length > 0 ? loaded : SIDES;
      bot.side = choices.reduce((a, b) => (turn(a) <= turn(b) ? a : b));
    } else if (reloadLeft(ship, bot.side) > 0 && reloadLeft(ship, other) <= 0 && turn(other) < Math.PI / 2) {
      bot.side = other;
    }
    goal = broadsideHeading(bearing, distance, bot.side, mine);
    sails = sailsForSpeed(ship, params, world.wind, p.fightSpeed, p.minSails);
    // Much too far for a good broadside (for example it fell to leeward): close in straight
    // at the enemy under full sail, beating against the wind if needed, instead of sailing
    // beam-on and firing at long range (your test, 15 Nov). It still fires when lined up.
    if (distance > mine.preferredRange + 2 * p.rangeBand) {
      goal = bearing;
      sails = 1;
    }
  }
  let steer = steerWithTacks(goal, params, world.wind, bot, p);
  const clear = avoidShips(ship, params, world.ships, steer, p);
  if (clear !== null) steer = clear;
  const away = nearPort ? null : avoidLand(ship, params, islands, steer, p);
  if (away !== null) steer = away;
  const rudder = clamp(p.rudderGain * normalizeAngle(steer - ship.headingRad), -1, 1);
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: id, value: rudder });
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: id, value: sails });

  // --- Guns: aim with the side that faces the enemy, fire when it is in the arc. ---
  // Bots keep the port law: no fire at a protected ship, and no fire from inside safe water
  // unless an offender is there to be shot at.
  if (enemySafe) return commands;
  const myPort = safePortIndex(ship.x, ship.y, ports);
  if (myPort >= 0 && !offenderNear(world, myPort, ship.id, ports)) return commands;
  const side: Side = Math.abs(normalizeAngle(bearing - sideAngleRad(ship.headingRad, 'port'))) < Math.PI / 2 ? 'port' : 'starboard';
  const flight = predictLanding(ship, params, side, STEP_SECONDS).seconds;
  const target = aimPoint(ship, enemy, flight);
  // The enemy will be in safe water when the balls come down (it is just slipping into port):
  // hold the fire, or the port would call this bot an offender.
  const landsIn = safePortIndex(target.x, target.y, ports, DAMAGE, PORT_EDGE_MARGIN_M);
  if (landsIn >= 0 && !isOffenderOf(enemy, landsIn)) return commands;
  const aimDistance = Math.hypot(target.x - ship.x, target.y - ship.y);
  const maxDeg = GUNS.maxElevationDeg;
  const longest = predictLanding({ ...ship, speed: 0, elevationDeg: maxDeg }, params, side, STEP_SECONDS);
  const inRange = aimDistance <= Math.hypot(longest.x - ship.x, longest.y - ship.y) * p.fireRangeShare;
  const wanted = inRange ? aimElevation(ship, params, side, aimDistance, maxDeg) : null;
  if (wanted !== null) {
    const goalDeg = clamp(wanted + bot.aimErrorDeg, 0, maxDeg);
    const stepDeg = p.elevationDegPerSecond * thinkSeconds;
    const next = ship.elevationDeg + clamp(goalDeg - ship.elevationDeg, -stepDeg, stepDeg);
    if (Math.abs(next - ship.elevationDeg) > 1e-6) commands.push({ type: 'setElevation', shipId: id, valueDeg: next });
    // The guns fire straight abeam, so fire only when the aim point lies close to that line.
    const offBeam = normalizeAngle(Math.atan2(target.y - ship.y, target.x - ship.x) - sideAngleRad(ship.headingRad, side));
    const ready = reloadLeft(ship, side) <= 0;
    const inArc = Math.abs(Math.sin(offBeam)) * aimDistance <= p.fireOffsetM && Math.cos(offBeam) > 0;
    const onElevation = Math.abs(next - goalDeg) <= p.aimToleranceDeg;
    if (ready && inArc && onElevation) {
      commands.push({ type: 'fire', shipId: id, side });
      bot.aimErrorDeg = nextGaussian(world) * bot.personality.aimErrorSigmaDeg; // a new misjudgement for the next broadside
    }
  }
  return commands;
}

/** Bots hold their fire when the aim point is this close to a port's safe water (balls scatter). */
const PORT_EDGE_MARGIN_M = 30;

/** An offender bot sails straight away from the port whose peace it broke, under full sail, until it is pardoned. */
function leavePort(world: World, bot: BotState, ship: ShipState, params: ShipParams, islands: readonly Island[], port: Port, p: BotParams): Command[] {
  bot.mode = 'outlaw';
  bot.side = null;
  let steer = steerWithTacks(Math.atan2(ship.y - port.y, ship.x - port.x), params, world.wind, bot, p);
  const clear = avoidShips(ship, params, world.ships, steer, p);
  if (clear !== null) steer = clear;
  const away = avoidLand(ship, params, islands, steer, p);
  if (away !== null) steer = away;
  const commands: Command[] = [];
  const rudder = clamp(p.rudderGain * normalizeAngle(steer - ship.headingRad), -1, 1);
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: ship.id, value: rudder });
  if (ship.sailLevel < 0.99) commands.push({ type: 'setSails', shipId: ship.id, value: 1 });
  return commands;
}

/** A bot with nothing to fight (peace in the arena) sails a hurt ship to the nearest port and stops there. */
function sailToPort(
  world: World,
  bot: BotState,
  ship: ShipState,
  params: ShipParams,
  islands: readonly Island[],
  port: { port: Port; distance: number },
  p: BotParams,
): Command[] {
  bot.mode = 'port';
  bot.side = null;
  const way = portWaypoint(ship.x, ship.y, port.port);
  let steer = steerWithTacks(Math.atan2(way.y - ship.y, way.x - ship.x), params, world.wind, bot, p);
  const clear = avoidShips(ship, params, world.ships, steer, p);
  if (clear !== null) steer = clear;
  const near = port.distance < 2 * DAMAGE.port.dockRange || way.inside;
  const away = near ? null : avoidLand(ship, params, islands, steer, p);
  if (away !== null) steer = away;
  const sails = port.distance < DAMAGE.port.dockRange * 0.5 ? 0 : port.distance < 3 * DAMAGE.port.dockRange ? p.minSails : 1;
  const commands: Command[] = [];
  const rudder = clamp(p.rudderGain * normalizeAngle(steer - ship.headingRad), -1, 1);
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: ship.id, value: rudder });
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: ship.id, value: sails });
  return commands;
}

/** All bots think; returns every command in the order of the bots list. */
export function thinkBots(world: World, islands: readonly Island[], p: BotParams = BOTS): Command[] {
  return world.bots.flatMap((bot) => thinkBot(world, bot, islands, p));
}
