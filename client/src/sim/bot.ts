// The first bot (M2 step 4, plan 4.9): a pirate sloop that chases you, turns its side and fires.
//
// A bot is a small state machine:
//   chase   (far away)   sail toward the enemy, beating against the wind if needed
//   engage  (in range)   turn a broadside to the enemy, keep about 140 m, set the sails for a steady speed,
//                        aim (with a small misjudgement) and fire when the enemy is on the line of fire
//   idle    (no enemy)   lie still
// It sees only what a captain could see (positions, headings, speeds) and changes its ship
// only through commands, like the player. Its shots get the same random errors as the player's.
// Its memory (BotState) lives in the world state, so a save or a test repeats exactly.

import { degToRad, normalizeAngle, twaDeg } from './angles';
import { BOTS, GUNS, POLARS, SHIP_CLASSES } from './data';
import { predictLanding, reloadLeft, sideAngleRad } from './guns';
import { touchesLand } from './land';
import { clamp } from './math';
import { nextGaussian } from './random';
import { STEP_SECONDS, targetSpeed } from './step';
import { nextRandom } from './random';
import type { BotParams, BotState, Command, Island, ShipParams, ShipState, Side, WindNow, World } from './types';

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
 */
export function updateMode(bot: BotState, distance: number, seconds: number, p: BotParams): void {
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
 * far and away from it when too close (so the bot keeps about `preferredRange`).
 * Port faces left of the bow: to have the enemy to port, head 90 degrees clockwise of the bearing.
 */
export function broadsideHeading(bearingRad: number, distance: number, side: Side, p: BotParams): number {
  const bend = distance > p.preferredRange + p.rangeBand ? 1 : distance < p.preferredRange - p.rangeBand ? -1 : 0;
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

  // --- No enemy (gone or sunk): lie still. ---
  if (!enemy || enemy.sunk) {
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
  updateMode(bot, distance, thinkSeconds, p);
  const mine: BotParams = { ...p, preferredRange: bot.personality.preferredRange };

  // --- Course and sails. ---
  let goal: number;
  let sails: number;
  if (bot.mode === 'chase') {
    bot.side = null;
    goal = bearing;
    sails = 1;
  } else if (bot.mode === 'breakOff') {
    bot.side = null;
    goal = normalizeAngle(bearing + Math.PI); // away from the enemy
    sails = sailsForSpeed(ship, params, world.wind, p.fightSpeed, p.minSails);
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
  }
  let steer = steerWithTacks(goal, params, world.wind, bot, p);
  const away = avoidLand(ship, params, islands, steer, p);
  if (away !== null) steer = away;
  const rudder = clamp(p.rudderGain * normalizeAngle(steer - ship.headingRad), -1, 1);
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: id, value: rudder });
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: id, value: sails });

  // --- Guns: aim with the side that faces the enemy, fire when it is in the arc. ---
  const side: Side = Math.abs(normalizeAngle(bearing - sideAngleRad(ship.headingRad, 'port'))) < Math.PI / 2 ? 'port' : 'starboard';
  const flight = predictLanding(ship, params, side, STEP_SECONDS).seconds;
  const target = aimPoint(ship, enemy, flight);
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

/** All bots think; returns every command in the order of the bots list. */
export function thinkBots(world: World, islands: readonly Island[], p: BotParams = BOTS): Command[] {
  return world.bots.flatMap((bot) => thinkBot(world, bot, islands, p));
}
