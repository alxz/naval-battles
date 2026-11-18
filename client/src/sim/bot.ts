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

import { ammoGuns, ammoLeftOf, ammoOf, ammoParams, loadableAmmo } from './ammo';
import { gunsManned, sailShare } from './condition';
import { isOffenderOf, offenderNear, protectedByPort, safePortIndex } from './law';
import { berthWaitSpot, berthsTaken, nearestPort, portWaypoint, portsOf } from './port';
import type { Port } from './port';
import { degToRad, normalizeAngle, twaDeg } from './angles';
import { BOTS, DAMAGE, GUNS, POLARS, SHIP_CLASSES } from './data';
import { predictLanding, reloadLeft, sideAngleRad } from './guns';
import { touchesLand } from './land';
import { clamp } from './math';
import { nextGaussian } from './random';
import { STEP_SECONDS, targetSpeed } from './step';
import { nextRandom } from './random';
import type { AmmoType, BotParams, BotState, Command, DamageParams, Island, ShipParams, ShipState, Side, WindNow, World } from './types';

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
  const blocked = (h: number): boolean => landAhead(ship, params, islands, h, look);
  if (!blocked(headingRad)) return null;
  for (const turn of [45, -45, 90, -90, 135, -135]) {
    const h = normalizeAngle(headingRad + degToRad(turn));
    if (!blocked(h)) return h;
  }
  return normalizeAngle(headingRad + Math.PI); // boxed in: turn round
}

/**
 * Is there land within `lookM` metres on this heading? Tests a "fat" copy of the ship
 * (LAND_CLEARANCE_M wider and longer) at a quarter, half and all of the way.
 */
export function landAhead(ship: ShipState, params: ShipParams, islands: readonly Island[], headingRad: number, lookM: number): boolean {
  const fat: ShipParams = { ...params, length: params.length + 2 * LAND_CLEARANCE_M, beam: params.beam + 2 * LAND_CLEARANCE_M };
  return [0.25, 0.5, 1].some((share) =>
    touchesLand({ ...ship, headingRad, x: ship.x + Math.cos(headingRad) * lookM * share, y: ship.y + Math.sin(headingRad) * lookM * share }, fat, islands),
  );
}

/**
 * A stuck bot's way out (M3 step 4c): of 16 headings, the fastest one with open water for
 * 80 m ahead; between two about as fast, the one that turns most away from where it points now
 * (that way did not work). If every heading is blocked, simply the fastest.
 */
export function unstickHeading(ship: ShipState, params: ShipParams, islands: readonly Island[], wind: WindNow): number {
  let best = normalizeAngle(ship.headingRad + Math.PI);
  let bestScore = -Infinity;
  for (let k = 0; k < 16; k++) {
    const h = normalizeAngle((k / 16) * 2 * Math.PI);
    const speed = targetSpeed({ ...ship, headingRad: h, sailLevel: 1 }, params, wind);
    const open = !landAhead(ship, params, islands, h, 80);
    const turnAway = Math.abs(normalizeAngle(h - ship.headingRad)) / Math.PI; // 0..1
    const score = (open ? 100 : 0) + speed + turnAway;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

/**
 * The expected hull damage of this ship's next broadsides at this distance (M3 step 5): the guns it
 * can man x the damage of the loaded shot x the share that hits (bots.json finishHitChance) x the
 * port law's factor (a ball on a law-abiding ship in safe water does less), for each side that is
 * loaded or nearly so (both sides: two broadsides, one from each).
 */
export function finishPlan(ship: ShipState, params: ShipParams, enemy: ShipState, distance: number, p: BotParams = BOTS): { expected: number; canFinish: boolean } {
  const ammo = loadableAmmo(ship);
  const perBall = GUNS.damage * ammoParams(ammo).hull;
  const hit = interpolate(p.finishHitChance, distance);
  const sides = SIDES.filter((side) => reloadLeft(ship, side) <= 5).length;
  const expected = gunsManned(ship, params) * perBall * hit * DAMAGE.port.law.damageFactor * sides;
  return { expected, canFinish: sides > 0 && expected * p.finishMargin >= enemy.hull };
}

/** Straight lines between [x, y] points (flat beyond the ends). */
function interpolate(points: readonly number[][], x: number): number {
  if (points.length === 0) return 0;
  const first = points[0]!;
  if (x <= (first[0] ?? 0)) return first[1] ?? 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const ax = a[0] ?? 0;
    const bx = b[0] ?? 0;
    if (x <= bx) return (a[1] ?? 0) + (((b[1] ?? 0) - (a[1] ?? 0)) * (x - ax)) / (bx - ax || 1);
  }
  return points[points.length - 1]![1] ?? 0;
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

  // --- Stuck? (M3 step 4c) A bot that wanted to move but did not get anywhere works free first. ---
  const working = workFree(world, bot, ship, params, islands, thinkSeconds, p);
  if (working) return working;

  // --- A finishing attack in a port's safe water (M3 step 5) runs its course, offender or not. ---
  if (bot.finishMemory) {
    bot.finishMemory.seconds -= thinkSeconds;
    if (bot.finishMemory.seconds <= 0 || bot.finishMemory.enemyId !== bot.enemyId) delete bot.finishMemory;
  }
  if ((bot.finishLeft ?? 0) > 0) {
    bot.finishLeft = (bot.finishLeft ?? 0) - thinkSeconds;
    if (bot.finishLeft <= 0 || !enemy || enemy.sunk) {
      delete bot.finishLeft;
      bot.mode = 'chase';
      bot.finishMemory = { enemyId: bot.enemyId, seconds: p.finishMemorySeconds };
    }
  }
  const finishing = (bot.finishLeft ?? 0) > 0 && !!enemy && !enemy.sunk;

  // --- Port law: a bot that broke a port's peace (a stray ball is enough) runs out of the reach
  // of its shore guns and stays away until it is pardoned. Its own guns stay silent meanwhile. ---
  if (ship.offender && !finishing) {
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
  if (finishing) {
    bot.mode = 'finish';
  } else if (bot.mode === 'port') {
    // In port (or on the way): stay until the port has done all it can, then hunt again.
    if (!port || hullShare >= DAMAGE.port.maxShare - 1e-6) startChase(bot, distance);
  } else {
    if (bot.mode === 'finish') bot.mode = 'chase';
    updateMode(bot, distance, thinkSeconds, p, hullShare);
    // Badly hurt and a port is within reach: run for the port instead of the open sea.
    if (bot.mode === 'flee' && port && port.distance <= p.portSeekRange) bot.mode = 'port';
  }
  if (bot.mode !== 'port') bot.waitingBerth = false;
  const mine: BotParams = { ...p, preferredRange: bot.personality.preferredRange };
  // Port law: an enemy the port protects is left alone; the bot waits outside.
  // (An offender has lost that protection: the bot goes for him even in safe water.)
  const enemySafe = protectedByPort(enemy, ports);
  // M3 step 5: unless it decides to finish him there. It weighs it once (then again after a while):
  // can its next broadsides sink him (finishPlan)? Then most bots go in; a few go in even when
  // they cannot. Going in makes it an offender: the shore guns fire, and it leaves when done.
  let goIn = finishing;
  const fighting = bot.mode === 'chase' || bot.mode === 'engage';
  if (!goIn && enemySafe && fighting && !ship.offender && !bot.finishMemory && distance <= p.engageRange) {
    const plan = finishPlan(ship, params, enemy, distance, p);
    goIn = nextRandom(world) < (plan.canFinish ? p.finishChance : p.finishRecklessChance);
    world.events.push({ type: 'finishDecision', shipId: id, enemyId: enemy.id, go: goIn, canFinish: plan.canFinish, expected: plan.expected, enemyHull: enemy.hull });
    if (goIn) {
      bot.finishLeft = p.finishSeconds;
      bot.mode = 'finish';
    } else bot.finishMemory = { enemyId: enemy.id, seconds: p.finishMemorySeconds };
  }
  const waiting = enemySafe && !goIn && (bot.mode === 'chase' || bot.mode === 'engage' || bot.mode === 'breakOff');
  if (waiting) bot.mode = 'idle';

  // --- Course and sails. ---
  let goal: number;
  let sails: number;
  let nearPort = false; // close to the anchorage: the bot may come close to the shore there
  if (bot.mode === 'port' && port) {
    bot.side = null;
    const course = portCourse(world, bot, ship, params, islands, port, p);
    goal = course.goal;
    sails = course.sails;
    nearPort = course.nearPort;
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
    // M3 step 4c (your test: a fresh brigantine could not catch a wreck): an enemy that pulls
    // away, or is nearly sunk, sets the pace: sails for its speed plus a margin, not the usual
    // fighting speed; a nearly sunk one beyond the preferred range is chased straight.
    const rvx = enemy.speed * Math.cos(enemy.headingRad) - ship.speed * Math.cos(ship.headingRad);
    const rvy = enemy.speed * Math.sin(enemy.headingRad) - ship.speed * Math.sin(ship.headingRad);
    const opening = distance > 0 ? (rvx * dx + rvy * dy) / distance : 0; // > 0: the range grows
    const weak = enemy.hull < (SHIP_CLASSES[enemy.shipClass]?.hullPoints ?? Infinity) * p.weakHullShare;
    const runner = distance > mine.preferredRange && opening > p.runnerOpeningMps;
    const pace = runner || weak || bot.mode === 'finish' ? Math.max(p.fightSpeed, enemy.speed + p.chaseSpeedMargin) : p.fightSpeed;
    sails = sailsForSpeed(ship, params, world.wind, pace, p.minSails);
    // Much too far for a good broadside (for example it fell to leeward): close in straight
    // at the enemy under full sail, beating against the wind if needed, instead of sailing
    // beam-on and firing at long range (your test, 15 Nov). It still fires when lined up.
    if (distance > mine.preferredRange + 2 * p.rangeBand || ((weak || bot.mode === 'finish') && distance > mine.preferredRange + p.rangeBand)) {
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
  // Ammunition (M3 step 4): grape at close range, chain at a faster enemy whose sails still draw,
  // round shot for everything else. Takes effect from the next think (the aim uses the loaded kind).
  const ammo = chooseAmmo(ship, params, enemy, distance, p);
  if (ammo !== ammoOf(ship)) commands.push({ type: 'setAmmo', shipId: id, ammo });
  if (enemySafe && !goIn) return commands;
  const myPort = safePortIndex(ship.x, ship.y, ports);
  if (!goIn && myPort >= 0 && !offenderNear(world, myPort, ship.id, ports)) return commands;
  const side: Side = Math.abs(normalizeAngle(bearing - sideAngleRad(ship.headingRad, 'port'))) < Math.PI / 2 ? 'port' : 'starboard';
  const flight = predictLanding(ship, params, side, STEP_SECONDS).seconds;
  const target = aimPoint(ship, enemy, flight);
  // The enemy will be in safe water when the balls come down (it is just slipping into port):
  // hold the fire, or the port would call this bot an offender.
  const landsIn = safePortIndex(target.x, target.y, ports, DAMAGE, PORT_EDGE_MARGIN_M);
  if (!goIn && landsIn >= 0 && !isOffenderOf(enemy, landsIn)) return commands;
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

/**
 * The bot's choice of ammunition, with a gap so that it does not switch back and forth:
 *   grape  closer than grapeRangeM (kept until grapeLeaveM): clear the enemy's deck
 *   chain  the enemy is chainSpeedGap faster and its sails still draw, and it is within the chain shot's reach
 *   round  otherwise (and whenever the wanted kind has run out)
 */
export function chooseAmmo(ship: ShipState, params: ShipParams, enemy: ShipState, distance: number, p: BotParams = BOTS): AmmoType {
  const now = ammoOf(ship);
  const grapeLimit = now === 'grape' ? p.grapeLeaveM : p.grapeRangeM;
  if (distance < grapeLimit && ammoLeftOf(ship, 'grape') > 0) return 'grape';
  const far = predictLanding({ ...ship, speed: 0, elevationDeg: GUNS.maxElevationDeg }, params, 'port', STEP_SECONDS, ammoGuns('chain'));
  const reach = Math.hypot(far.x - ship.x, far.y - ship.y);
  const runner = enemy.speed > ship.speed + p.chainSpeedGap && sailShare(enemy) > p.chainMinEnemySails;
  if (runner && distance < reach * p.chainRangeShare && ammoLeftOf(ship, 'chain') > 0) return 'chain';
  return 'round';
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
  const course = portCourse(world, bot, ship, params, islands, port, p);
  let steer = steerWithTacks(course.goal, params, world.wind, bot, p);
  const clear = avoidShips(ship, params, world.ships, steer, p);
  if (clear !== null) steer = clear;
  const away = course.nearPort ? null : avoidLand(ship, params, islands, steer, p);
  if (away !== null) steer = away;
  const sails = course.sails;
  const commands: Command[] = [];
  const rudder = clamp(p.rudderGain * normalizeAngle(steer - ship.headingRad), -1, 1);
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: ship.id, value: rudder });
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: ship.id, value: sails });
  return commands;
}

/**
 * The course to a port (M3 step 5: berths). Sail to the anchorage, slow down near it, stop on it.
 * If its berths are all taken by other ships, wait off it (berthWaitSpot) until one is free.
 */
function portCourse(
  world: World,
  bot: BotState,
  ship: ShipState,
  params: ShipParams,
  islands: readonly Island[],
  port: { port: Port; distance: number },
  p: BotParams,
): { goal: number; sails: number; nearPort: boolean } {
  const dock = DAMAGE.port.dockRange;
  const taken = berthsTaken(world.ships, port.port, ship.id);
  if (port.distance >= dock && taken >= port.port.berths) {
    if (!bot.waitingBerth) {
      bot.waitingBerth = true;
      world.events.push({ type: 'berthWait', shipId: ship.id, port: port.port.name, occupied: taken, berths: port.port.berths });
    }
    const spot = berthWaitSpot(port.port, ship, params, islands, p.berthWaitM);
    const away = Math.hypot(spot.x - ship.x, spot.y - ship.y);
    return { goal: Math.atan2(spot.y - ship.y, spot.x - ship.x), sails: away < 40 ? 0 : away < 150 ? p.minSails : 1, nearPort: false };
  }
  bot.waitingBerth = false;
  const way = portWaypoint(ship.x, ship.y, port.port);
  return {
    goal: Math.atan2(way.y - ship.y, way.x - ship.x),
    // Close to the anchorage, or on the way up an inlet: the way itself keeps clear of the land.
    nearPort: port.distance < 2 * dock || way.inside,
    sails: port.distance < dock * 0.5 ? 0 : port.distance < 3 * dock ? p.minSails : 1,
  };
}

/** Does the bot mean to get somewhere now? (Lying at anchor, waiting for a berth or mending does not count.) */
function wantsToMove(bot: BotState, ship: ShipState, islands: readonly Island[]): boolean {
  if (bot.mode === 'idle' || bot.mode === 'repair') return false;
  if (bot.mode === 'port') {
    if (bot.waitingBerth) return false;
    const port = nearestPort(ship.x, ship.y, portsOf(islands));
    return !port || port.distance > 2 * DAMAGE.port.dockRange;
  }
  return true;
}

/**
 * Working free (M3 step 4c): every `stuckCheckSeconds` the bot checks how far it got. A bot that
 * wanted to move but made less than `stuckMoveM` (in irons, nosing into a reef, pinned against a
 * shore) turns to the best open heading (unstickHeading) under full sail for `unstickSeconds`.
 * Returns the commands while it works free, else null.
 */
function workFree(world: World, bot: BotState, ship: ShipState, params: ShipParams, islands: readonly Island[], thinkSeconds: number, p: BotParams): Command[] | null {
  if ((bot.unstickLeft ?? 0) > 0) {
    bot.unstickLeft = (bot.unstickLeft ?? 0) - thinkSeconds;
    if (bot.unstickLeft > 0) return steerTo(ship, bot.unstickHeadingRad ?? ship.headingRad, 1, p);
    delete bot.unstickLeft;
    delete bot.unstickHeadingRad;
    bot.progress = { x: ship.x, y: ship.y, seconds: 0, travelledM: 0 };
    return null;
  }
  const pr = bot.progress ?? { x: ship.x, y: ship.y, seconds: 0, travelledM: 0 };
  pr.seconds += thinkSeconds;
  // The way it made through the water (a ship circling in a fight ends where it began, but it moved).
  pr.travelledM = (pr.travelledM ?? 0) + Math.abs(ship.speed) * thinkSeconds;
  bot.progress = pr;
  if (pr.seconds < p.stuckCheckSeconds) return null;
  const moved = Math.max(Math.hypot(ship.x - pr.x, ship.y - pr.y), pr.travelledM ?? 0);
  bot.progress = { x: ship.x, y: ship.y, seconds: 0, travelledM: 0 };
  if (moved >= p.stuckMoveM || !wantsToMove(bot, ship, islands)) return null;
  const heading = unstickHeading(ship, params, islands, world.wind);
  bot.unstickLeft = p.unstickSeconds;
  bot.unstickHeadingRad = heading;
  bot.tack = 0;
  world.events.push({ type: 'botUnstick', shipId: ship.id, x: ship.x, y: ship.y, headingRad: heading });
  return steerTo(ship, heading, 1, p);
}

/** Rudder toward a heading and the sails at a level (only the commands that change something). */
function steerTo(ship: ShipState, headingRad: number, sails: number, p: BotParams): Command[] {
  const commands: Command[] = [];
  const rudder = clamp(p.rudderGain * normalizeAngle(headingRad - ship.headingRad), -1, 1);
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: ship.id, value: rudder });
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: ship.id, value: sails });
  return commands;
}

/** All bots think; returns every command in the order of the bots list. */
export function thinkBots(world: World, islands: readonly Island[], p: BotParams = BOTS): Command[] {
  return world.bots.flatMap((bot) => thinkBot(world, bot, islands, p));
}
