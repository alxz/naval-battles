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
import { crewShare, gunsManned, sailShare } from './condition';
import { courageOf, odds, tradeStopSets } from './morale';
import { nextRouteStop } from './routes';
import type { StopSets } from './routes';
import { believedShip, contactOf, forgetContact } from './perception';
import { ballBlocked, terrainFor } from './terrain';
import { isOffenderOf, offenderNear, protectedByPort, safePortIndex } from './law';
import { berthWaitSpot, berthsTaken, inHarbour, inletWayOut, nearestPort, portWaypoint, portsCached, portsOf } from './port';
import type { Port } from './port';
import { degToRad, normalizeAngle, twaDeg } from './angles';
import { BOTS, DAMAGE, GUNS, polarOf, SHIP_CLASSES, SKILLS, WORLD } from './data';
import { batteryAmmo, gunsOn, isChaser, predictLanding, reloadLeft, sideAngleRad } from './guns';
import { touchesLand } from './land';
import { clamp } from './math';
import { nextGaussian } from './random';
import { STEP_SECONDS, targetSpeed } from './step';
import { nextRandom } from './random';
import { findRoute, landClearM, lineIsOpen, waterGridFor } from './path';
import type { Point } from './path';
import type { AmmoType, BotParams, BotState, Command, DamageParams, GunParams, Island, ShipParams, ShipState, Side, WindNow, World } from './types';

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
export function steerWithTacks(goalRad: number, params: ShipParams, wind: WindNow, bot: Pick<BotState, 'tack' | 'tackSeconds'>, p: BotParams): number {
  const noGo = polarOf(params)?.noGoDeg ?? 0;
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
  return closeHauled(params, wind, bot.tack, p);
}

/** The close-hauled heading on this tack (+1: clockwise of the wind, -1: anticlockwise). */
export function closeHauled(params: ShipParams, wind: WindNow, tack: 1 | -1, p: BotParams): number {
  const noGo = polarOf(params)?.noGoDeg ?? 0;
  return normalizeAngle(wind.fromRad + tack * degToRad(noGo + p.closeHauledMarginDeg));
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
  // M3 step 6e (speed): read from a table of landing distances (REACH_STEPS + 1 elevations, made once
  // per ship size and kind of shot) instead of flying 21 test balls every time a bot aims.
  const table = reachTable(ship, params, side, maxDeg, ammoGuns(batteryAmmo(ship, side)));
  const n = table.length - 1;
  if (distance > table[n]!) return null;
  if (distance <= table[0]!) return 0;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid]! < distance) lo = mid;
    else hi = mid;
  }
  const t = (distance - table[lo]!) / (table[hi]! - table[lo]! || 1);
  return ((lo + t) / n) * maxDeg;
}

/** Elevation steps in a reach table (0 to maxDeg). */
const REACH_STEPS = 400;
const reachTables = new Map<string, Float64Array>();

/**
 * How far a ball lands from a ship lying still (from its middle), for elevations 0 .. maxDeg in
 * REACH_STEPS steps. The same for any place, heading and side, so it is made once per ship beam,
 * muzzle speed and top elevation.
 */
export function reachTable(ship: ShipState, params: ShipParams, side: Side, maxDeg: number, g: GunParams): Float64Array {
  const key = `${isChaser(side) ? `chaser ${params.length}` : params.beam}|${g.muzzleSpeed}|${g.gravity}|${maxDeg}`;
  let table = reachTables.get(key);
  if (!table) {
    table = new Float64Array(REACH_STEPS + 1);
    const still = { ...ship, x: 0, y: 0, headingRad: 0, speed: 0 };
    for (let i = 0; i <= REACH_STEPS; i++) {
      const p = predictLanding({ ...still, elevationDeg: (i / REACH_STEPS) * maxDeg }, params, side, STEP_SECONDS, g);
      table[i] = Math.hypot(p.x, p.y);
    }
    reachTables.set(key, table);
  }
  return table;
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
  // M3 step 6d: hard by a shore the "fat" test finds land on every heading (a sloop turned round onto
  // the bank again and again). Then a slim test (the hull itself, 30 m ahead): the wanted heading first.
  const slim = (h: number): boolean => landAhead(ship, params, islands, h, Math.min(look, 30), 0);
  for (const turn of [0, 45, -45, 90, -90, 135, -135, 180]) {
    const h = normalizeAngle(headingRad + degToRad(turn));
    if (!slim(h)) return h;
  }
  return headingRad; // boxed in: keep the wanted heading (working free takes over if it does not get anywhere)
}

/**
 * Is there land within `lookM` metres on this heading? Tests a "fat" copy of the ship
 * (LAND_CLEARANCE_M wider and longer) at a quarter, half and all of the way.
 */
export function landAhead(ship: ShipState, params: ShipParams, islands: readonly Island[], headingRad: number, lookM: number, clearanceM = LAND_CLEARANCE_M): boolean {
  // M3 step 6e (speed): nothing within reach of the swept, widened hull: no land ahead.
  if (islands.length > 0 && landClearM(waterGridFor(islands), ship.x, ship.y) > lookM + Math.hypot(params.length / 2 + clearanceM, params.beam / 2 + clearanceM) + 1) return false;
  const fat: ShipParams = { ...params, length: params.length + 2 * clearanceM, beam: params.beam + 2 * clearanceM };
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
    // Open water for 80 m is best; in a small harbour, 30 m will do (M3 step 6c).
    const open = !landAhead(ship, params, islands, h, 80) ? 100 : !landAhead(ship, params, islands, h, 30) ? 50 : 0;
    const turnAway = Math.abs(normalizeAngle(h - ship.headingRad)) / Math.PI; // 0..1
    const score = open + speed + turnAway;
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
 * M3 step 6d (your test: a wreck ran at the edge of the sea, twitching by 5-10 degrees): a course
 * with land within FLEE_LAND_LOOK_M ahead is not taken; then up to 90 degrees off "away" is tried,
 * and with no open course at all, the most open one along the shore.
 */
export function fleeHeading(
  ship: ShipState,
  params: ShipParams,
  wind: WindNow,
  bearingToEnemy: number,
  islands: readonly Island[] = [],
  pursuer?: { ship: ShipState; params: ShipParams },
): number {
  const away = normalizeAngle(bearingToEnemy + Math.PI);
  const look = Math.max(FLEE_LAND_LOOK_M, ship.speed * 12);
  const open = (h: number): boolean => islands.length === 0 || !landAhead(ship, params, islands, h, look);
  // M3 step 7a (your 6e log: a merchantman ran into the north-west corner and lay on the reef for
  // 15 minutes): a runner does not run into a corner. Each heading is judged by how much sea is
  // left ahead of it (seaRoom); a heading that ends near the edge loses to one that keeps sea room.
  const room = (h: number): number => seaRoom(ship.x + Math.cos(h) * FLEE_ROOM_LOOK_M, ship.y + Math.sin(h) * FLEE_ROOM_LOOK_M);
  let best = away;
  let bestScore = -Infinity;
  // Up to 135 degrees off: in a corner the only way out is along an edge, half across the enemy's bow.
  for (const offDeg of [0, 20, -20, 40, -40, 60, -60, 90, -90, 135, -135]) {
    const heading = normalizeAngle(away + degToRad(offDeg));
    if (!open(heading)) continue;
    const speed = targetSpeed({ ...ship, headingRad: heading, sailLevel: 1 }, params, wind);
    // Fast and straight away is best; a wide turn costs a little; little sea room ahead costs a lot.
    const cramped = Math.max(0, FLEE_ROOM_M - room(heading)) / FLEE_ROOM_M; // 0 = plenty of room, 1 = at the edge
    // M3 step 7c: a runner looks for the course where it is faster than its pursuer (a schooner
    // close-hauled against a square rig, a square rig before the wind against a schooner). The
    // pursuer's speed is what anyone sees: its rig, hull and sails, sailing on the same course.
    // Counted only for courses that open the distance (cos > 0: across its bow it would be cut off).
    const edge = pursuer ? (speed - targetSpeed({ ...pursuer.ship, headingRad: heading, sailLevel: 1 }, pursuer.params, wind)) * Math.max(0, Math.cos(degToRad(offDeg))) : 0;
    const score = speed + SKILLS.fleeEdgeWeight * edge - FLEE_TURN_COST * Math.abs(offDeg) - FLEE_CORNER_COST * cramped;
    if (score > bestScore + 0.2) {
      best = heading;
      bestScore = score;
    }
  }
  if (bestScore > -Infinity) return best;
  return unstickHeading(ship, params, islands, wind);
}

/** The enemy as a pursuer for fleeHeading (M3 step 7c); none if its class is unknown. */
function pursuerOf(enemy: ShipState): { ship: ShipState; params: ShipParams } | undefined {
  const params = SHIP_CLASSES[enemy.shipClass];
  return params ? { ship: enemy, params } : undefined;
}

/** M3 step 7a: how far a point is from the reef that rings the sea (0 at the reef or beyond). */
export function seaRoom(x: number, y: number): number {
  const r = WORLD.reefWidth;
  return Math.max(0, Math.min(x - (WORLD.minX + r), WORLD.maxX - r - x, y - (WORLD.minY + r), WORLD.maxY - r - y));
}

/** A runner judges a heading by the sea room this far along it ... */
const FLEE_ROOM_LOOK_M = 500;
/** ... wants at least this much room there ... */
const FLEE_ROOM_M = 400;
/** ... and gives up this many m/s of speed to keep it (a cornered heading is almost never taken). */
const FLEE_CORNER_COST = 20;
/** A heading off "straight away" costs this many m/s per degree (so equal speeds prefer straight away). */
const FLEE_TURN_COST = 0.02;

/** A running ship looks this far ahead for land (more when fast). */
const FLEE_LAND_LOOK_M = 150;

/**
 * Is another ship close ahead? Then a heading that turns away from it (to the side it is not on).
 * Bots do not ram: a collision costs them hull too.
 */
export function avoidShips(ship: ShipState, params: ShipParams, ships: readonly ShipState[], headingRad: number, p: BotParams, ignoreId = -1): number | null {
  for (const other of ships) {
    if (other.id === ship.id || other.sunk || other.id === ignoreId) continue;
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
  // M3 step 6 (D45): a ship close alongside (your test: two chasers side by side, scraping):
  // bear away from it a little, so the hulls do not close.
  for (const other of ships) {
    if (other.id === ship.id || other.sunk || other.id === ignoreId) continue;
    const otherBeam = SHIP_CLASSES[other.shipClass]?.beam ?? 0;
    const dx = other.x - ship.x;
    const dy = other.y - ship.y;
    const off = normalizeAngle(Math.atan2(dy, dx) - headingRad);
    if (Math.abs(off) < Math.PI / 4 || Math.abs(off) > (3 * Math.PI) / 4) continue; // not alongside
    const sideGap = Math.abs(Math.sin(off)) * Math.hypot(dx, dy) - (params.beam + otherBeam) / 2;
    if (sideGap > p.abeamBerthM) continue;
    return normalizeAngle(headingRad + (off >= 0 ? -1 : 1) * degToRad(p.abeamTurnDeg));
  }
  return null;
}

/**
 * Where to steer to meet a moving ship (M3 step 6, D45): its place after the time we need to get
 * there (distance / our speed, at most leadMaxSeconds), so a chaser cuts the corner instead of
 * running parallel or behind.
 */
export function interceptBearing(ship: ShipState, enemy: ShipState, p: BotParams = BOTS): number {
  const dx = enemy.x - ship.x;
  const dy = enemy.y - ship.y;
  const distance = Math.hypot(dx, dy);
  const t = Math.min(p.leadMaxSeconds, distance / Math.max(3, ship.speed));
  return Math.atan2(dy + Math.sin(enemy.headingRad) * enemy.speed * t, dx + Math.cos(enemy.headingRad) * enemy.speed * t);
}

/**
 * The rudder toward a heading (M3 step 6, D45). A square-rigged ship (and a mixed one that is
 * slow) does not tack: when the short turn would take its bow through the wind, it turns the
 * long way round, through downwind ("wearing ship"), which never stops it in irons.
 */
export function rudderFor(ship: ShipState, params: ShipParams, headingRad: number, wind: WindNow, p: BotParams = BOTS, leeShore = false): number {
  let diff = normalizeAngle(headingRad - ship.headingRad);
  // M3 step 6c: a square rig with good way on goes about too (it keeps enough speed through the turn).
  // M3 step 6d: never wear with land close downwind (a lee shore): the long turn would put the bow on it.
  const wears = !leeShore && ((params.rig === 'square' && ship.speed < p.wearBelowMpsSquare) || (params.rig === 'mixed' && ship.speed < p.wearBelowMps));
  if (wears && Math.abs(diff) > degToRad(20)) {
    const w = normalizeAngle(wind.fromRad - ship.headingRad); // where the wind comes from, off the bow
    if (Math.sign(w) === Math.sign(diff) && Math.abs(w) < Math.abs(diff)) diff -= Math.sign(diff) * 2 * Math.PI;
  }
  return shapeRudder(p.rudderGain * diff, ship.rudder, p);
}

/**
 * M4b step 5c (your test 23 Nov: bots hunt about their course). The wanted rudder (`raw`, -1..1) is shaped like a
 * helmsman's work: nothing for an error below rudderDeadDeg (the rest is eased in from the dead band's edge), and the
 * rudder moves at most rudderSlewPerThink per decision, so a noisy aim point does not shake the helm.
 */
export function shapeRudder(raw: number, current: number, p: BotParams = BOTS): number {
  const dead = p.rudderGain * degToRad(p.rudderDeadDeg);
  const eased = Math.sign(raw) * Math.max(0, Math.abs(raw) - dead);
  const wanted = clamp(eased, -1, 1);
  return clamp(wanted, current - p.rudderSlewPerThink, current + p.rudderSlewPerThink) + 0; // (+ 0 turns -0 into 0)
}

/**
 * The heading toward a goal point over open water (M3 step 6c, sim/path.ts). When the straight line
 * is open: straight at it. When land is in the way: along a planned way round it, planned again every
 * few seconds or when the goal has moved. Keeps the way in `bot.route` (absent = straight line).
 */
export function headingVia(bot: BotState, ship: ShipState, islands: readonly Island[], goal: Point, p: BotParams = BOTS): number {
  const direct = Math.atan2(goal.y - ship.y, goal.x - ship.x);
  if (islands.length === 0) return direct;
  const g = waterGridFor(islands);
  if (lineIsOpen(g, ship, goal, p.routeSkipM)) {
    delete bot.route;
    return direct;
  }
  let route = bot.route;
  if (!route || route.points.length === 0 || route.ageSeconds > p.routeReplanSeconds + (ship.id % 4) * 0.25 /* spread the bots' planning over different ticks (M3 step 6e) */ || Math.hypot(route.goalX - goal.x, route.goalY - goal.y) > p.routeGoalMoveM) {
    const points = findRoute(g, ship, goal);
    if (!points) {
      delete bot.route;
      return direct;
    }
    route = { goalX: goal.x, goalY: goal.y, points, ageSeconds: 0 };
    bot.route = route;
  }
  const pts = route.points;
  while (pts.length > 1 && (Math.hypot(pts[0]!.x - ship.x, pts[0]!.y - ship.y) < p.routeReachM || lineIsOpen(g, ship, pts[1]!, p.routeSkipM))) pts.shift();
  return Math.atan2(pts[0]!.y - ship.y, pts[0]!.x - ship.x);
}

/** Is the straight line to this point blocked by land (with room to the shore)? */
export function landBetween(ship: ShipState, islands: readonly Island[], goal: Point, p: BotParams = BOTS): boolean {
  return islands.length > 0 && !lineIsOpen(waterGridFor(islands), ship, goal, p.routeSkipM);
}

/**
 * The ports this ship can use (M3 step 6c): a small round harbour up an inlet takes only ships not
 * much longer than its radius (harbourLengthShare); a big frigate or merchantman cannot turn in it.
 */
export function portsFor(ports: readonly Port[], params: ShipParams, p: BotParams = BOTS): Port[] {
  return ports.filter((port) => port.harbourR === undefined || params.length <= port.harbourR * p.harbourLengthShare);
}

/** The ports this bot may still use: those its ship can use (portsFor) minus the ones it has given up on (D74). */
export function portsForBot(bot: BotState, ports: readonly Port[], params: ShipParams, p: BotParams = BOTS): Port[] {
  const usable = portsFor(ports, params, p);
  const blocked = bot.blockedPorts;
  return blocked && blocked.length > 0 ? usable.filter((port) => !blocked.some((b) => b.port === port.name)) : usable;
}

/**
 * D74: one failure (a new grounding, or working free) of a bot that is sailing to a port. Near a port
 * (portFailRadiusM) failures add up in a window; at portFailCount the port is closed for this bot for
 * portBlockSeconds and it looks for another.
 */
export function notePortTrouble(bot: BotState, ship: ShipState, params: ShipParams, islands: readonly Island[], p: BotParams = BOTS): string | undefined {
  if (bot.mode !== 'port') return undefined;
  const near = nearestPort(ship.x, ship.y, portsForBot(bot, portsOf(islands), params, p));
  if (!near || near.distance > p.portFailRadiusM) return undefined;
  const t = bot.portTrouble && bot.portTrouble.port === near.port.name ? bot.portTrouble : { port: near.port.name, count: 0, seconds: 0 };
  t.count += 1;
  bot.portTrouble = t;
  if (t.count < p.portFailCount) return undefined;
  delete bot.portTrouble;
  bot.blockedPorts = [...(bot.blockedPorts ?? []).filter((b) => b.port !== near.port.name), { port: near.port.name, seconds: p.portBlockSeconds }];
  delete bot.route;
  bot.waitingBerth = false;
  return near.port.name;
}

/** Time passes for the trouble window and the closed ports. */
function ageBlockedPorts(bot: BotState, thinkSeconds: number, p: BotParams): void {
  if (bot.portTrouble) {
    bot.portTrouble.seconds += thinkSeconds;
    if (bot.portTrouble.seconds > p.portFailWindowSeconds) delete bot.portTrouble;
  }
  if (bot.blockedPorts) {
    for (const b of bot.blockedPorts) b.seconds -= thinkSeconds;
    bot.blockedPorts = bot.blockedPorts.filter((b) => b.seconds > 0);
    if (bot.blockedPorts.length === 0) delete bot.blockedPorts;
  }
}

/**
 * The sails for a ship in a harbour (M3 step 6d): at most what gives harbourSpeedMps there (the
 * harbour boats still tow it at towMps, so it never stops). Outside a harbour: `sails` unchanged.
 */
export function harbourSails(ship: ShipState, params: ShipParams, wind: WindNow, islands: readonly Island[], sails: number, p: BotParams = BOTS): number {
  if (sails <= 0 || islands.length === 0 || !inHarbour(ship.x, ship.y, portsCached(islands))) return sails;
  return Math.min(sails, Math.max(0.1, sailsForSpeed(ship, params, wind, p.harbourSpeedMps, 0.1)));
}

/**
 * A ship outside every harbour whose course would take it into one within HARBOUR_LOOK_M: the first
 * heading of +-45, +-90, +-135 degrees that does not (null: no change; a ship already inside may go on).
 */
export function avoidHarbour(ship: ShipState, islands: readonly Island[], headingRad: number): number | null {
  if (islands.length === 0) return null;
  const ports = portsCached(islands);
  if (ports.length === 0 || inHarbour(ship.x, ship.y, ports)) return null;
  const enters = (h: number): boolean =>
    [0.5, 1].some((k) => inHarbour(ship.x + Math.cos(h) * HARBOUR_LOOK_M * k, ship.y + Math.sin(h) * HARBOUR_LOOK_M * k, ports));
  if (!enters(headingRad)) return null;
  for (const turn of [45, -45, 90, -90, 135, -135]) {
    const h = normalizeAngle(headingRad + degToRad(turn));
    if (!enters(h)) return h;
  }
  return null;
}

/** How far ahead a bot looks for a harbour it should not enter, metres. */
const HARBOUR_LOOK_M = 100;

/** Is the enemy up an inlet or in the harbour of a port this ship is too big to use? */
export function enemyInSmallHarbour(enemy: ShipState, params: ShipParams, ports: readonly Port[], p: BotParams = BOTS): boolean {
  const usable = portsFor(ports, params, p);
  const small = ports.filter((port) => !usable.includes(port));
  return small.length > 0 && inHarbour(enemy.x, enemy.y, small);
}

/** Is there land close downwind of this ship (a lee shore, where it must not wear)? */
export function onLeeShore(ship: ShipState, params: ShipParams, islands: readonly Island[], wind: WindNow): boolean {
  return islands.length > 0 && landAhead(ship, params, islands, wind.fromRad + Math.PI, Math.max(60, params.length * 1.5));
}

/** The other ship of a recent collision (within avoidSeconds, sim/collide.ts), if any. */
function contactWith(world: World, shipId: number): number | null {
  for (const c of world.contacts ?? []) {
    if (Math.max(c.untilTick, c.avoidUntilTick ?? 0) <= world.tick) continue; // they steer clear a while longer than the damage pause
    if (c.a === shipId) return c.b;
    if (c.b === shipId) return c.a;
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
  if (bot.route) bot.route.ageSeconds += thinkSeconds;
  const commands: Command[] = [];
  const id = ship.id;
  // M4b step 2: the enemy is what this ship believes about it (its contact), not the real ship of the world.
  const enemy = believedShip(world, id, bot.enemyId, ship.shipClass);
  const seen = !world.sight || !!contactOf(world, id, bot.enemyId)?.visible; // in view right now (else: the last known place)

  // D74: a new grounding on the way to a port counts against that port.
  ageBlockedPorts(bot, thinkSeconds, p);
  if (ship.aground && !bot.wasAground) {
    const blocked = notePortTrouble(bot, ship, params, islands, p);
    if (blocked) world.events.push({ type: 'portBlocked', shipId: ship.id, port: blocked, seconds: p.portBlockSeconds });
  }
  bot.wasAground = ship.aground;

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
    const port = nearestPort(ship.x, ship.y, portsForBot(bot, portsOf(islands), params, p));
    if (port && ship.hull < full * DAMAGE.port.maxShare - 1e-6 && (world.arena || port.distance <= p.portSeekRange)) return sailToPort(world, bot, ship, params, islands, port, p);
    // M4b step 2: nobody in view and none remembered: a sound ship goes on its way (a search), a hurt one lies still and mends.
    const sound = ship.hull >= full * DAMAGE.repair.seaMaxShare - 1e-6;
    if (world.sight && !world.arena?.peace && sound && !ship.offender) return cruise(world, bot, ship, params, islands, p);
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
  const nearest = nearestPort(ship.x, ship.y, ports); // any port (to keep clear of it while waiting)
  const port = nearestPort(ship.x, ship.y, portsForBot(bot, ports, params, p)); // a port this ship can use for repairs
  // --- M3 step 7b: crew spirit. Fear fades (faster out of the fight); now and then (every 3-6 s,
  // at random moments) the bot weighs its chances. ---
  const courage = courageOf(bot, params, world, p);
  if (bot.fear !== undefined) {
    const calm = distance > DAMAGE.repair.safeRange ? 4 : 1;
    bot.fear = Math.max(0, bot.fear - p.fearDecayPerSecond * calm * thinkSeconds);
    if (bot.fear === 0) delete bot.fear;
  }
  bot.weighLeft = (bot.weighLeft ?? 0) - thinkSeconds;
  let weighNow = false;
  if (bot.weighLeft <= 0) {
    bot.weighLeft = p.weighMinSeconds + (p.weighMaxSeconds - p.weighMinSeconds) * nextRandom(world);
    weighNow = true;
  }
  // A deliberate ram (D45) runs until it hits, times out or the enemy gets away.
  if (bot.ramMemory !== undefined) {
    bot.ramMemory -= thinkSeconds;
    if (bot.ramMemory <= 0) delete bot.ramMemory;
  }
  if (bot.mode === 'ram') {
    bot.ramLeft = (bot.ramLeft ?? 0) - thinkSeconds;
    const struck = contactWith(world, id) === enemy.id;
    if (struck && !bot.rammer) {
      // M3 step 6c (your idea): a ram that struck home makes this bot a rammer for the rest of its life.
      bot.rammer = true;
      world.events.push({ type: 'rammerLearned', shipId: id, enemyId: enemy.id });
    }
    if (bot.ramLeft <= 0 || distance > 2 * p.ramRangeM || struck || protectedByPort(enemy, ports)) {
      delete bot.ramLeft;
      bot.ramMemory = bot.rammer ? p.rammerMemorySeconds : p.ramMemorySeconds;
      bot.mode = 'engage';
    }
  }
  let ramming = bot.mode === 'ram';
  if (finishing) {
    bot.mode = 'finish';
  } else if (ramming) {
    // keep ramming
  } else if (bot.mode === 'port') {
    // In port (or on the way): stay until the port has done all it can, then hunt again.
    if (!port || hullShare >= DAMAGE.port.maxShare - 1e-6) startChase(bot, distance);
  } else if (params.trader) {
    // M3 step 7b: a trader sails its trade run; an enemy close by makes it decide: run (most do) or fight.
    // Running, it keeps running until the enemy is traderSafeM away; then it mends (at sea or in a
    // port, if hurt) or goes back to its run.
    traderMode(world, bot, ship, enemy, distance, hullShare, courage, ports, p);
    if ((bot.mode === 'flee' || bot.mode === 'repair') && port && port.distance <= p.portSeekRange && hullShare < DAMAGE.port.maxShare - 1e-6) bot.mode = 'port';
  } else {
    if (bot.mode === 'finish' || bot.mode === 'trade') startChase(bot, distance); // (a cruising ship that finds an enemy gives chase)
    updateMode(bot, distance, thinkSeconds, p, hullShare);
    // Badly hurt and a port is within reach: run for the port instead of the open sea.
    if ((bot.mode === 'flee' || bot.mode === 'repair') && port && port.distance <= p.portSeekRange) bot.mode = 'port';
  }
  if (bot.mode !== 'port') bot.waitingBerth = false;
  // A rammer (M3 step 6c) fights closer: chain shot to slow the enemy, grape to clear its deck, then the ram.
  const mine: BotParams = { ...p, preferredRange: bot.rammer ? Math.min(bot.personality.preferredRange, p.rammerRangeM) : bot.personality.preferredRange };
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
  // M3 step 6d: a big ship does not follow its enemy into a harbour too small for it (it would
  // stick there, as the merchantman did at Isla Verde): it waits off the harbour like for a protected ship.
  const tooSmall = enemyInSmallHarbour(enemy, params, ports, p);
  const waiting = (enemySafe || tooSmall) && !goIn && (bot.mode === 'chase' || bot.mode === 'engage' || bot.mode === 'breakOff' || bot.mode === 'ram');
  if (waiting) {
    bot.mode = 'idle';
    delete bot.ramLeft;
  }
  // M3 step 6 (D45): ram on purpose when it pays: close, at least nearly as heavy (or the enemy is
  // crippled), faster than the enemy (or it is nearly stopped), our own hull sound; then a roll.
  if (!ramming && !waiting && !goIn && bot.ramMemory === undefined && (bot.mode === 'engage' || bot.mode === 'chase') && distance <= p.ramRangeM) {
    const ep = SHIP_CLASSES[enemy.shipClass];
    const crippled = !!ep && (enemy.hull < ep.hullPoints * p.weakHullShare || sailShare(enemy) < 0.4);
    const heavy = !!ep && params.mass >= ep.mass * p.ramMassShare;
    const faster = ship.speed >= enemy.speed + 1 || enemy.speed < 3;
    // Its side must face us (we would strike it amidships, not glance off its bow or stern).
    const aspect = Math.abs(normalizeAngle(Math.atan2(ship.y - enemy.y, ship.x - enemy.x) - enemy.headingRad));
    const sideOn = aspect > Math.PI / 4 && aspect < (3 * Math.PI) / 4;
    if ((heavy || crippled) && faster && sideOn && hullShare > 0.5) {
      const go = nextRandom(world) < (bot.rammer ? p.rammerRamChance : p.ramChance);
      world.events.push({ type: 'ramDecision', shipId: id, enemyId: enemy.id, go, distance });
      if (go) {
        bot.mode = 'ram';
        bot.ramLeft = p.ramSeconds;
      } else bot.ramMemory = bot.rammer ? p.rammerMemorySeconds : p.ramMemorySeconds;
    }
  }

  // --- M3 step 7b: weigh the chances (every 3-6 s). ---
  if (weighNow && !finishing && !waiting && !goIn) {
    const o = odds(ship, enemy);
    const fear = bot.fear ?? 0;
    const running = bot.mode === 'flee' || bot.mode === 'repair' || bot.mode === 'breakOff' || (bot.mode === 'port' && distance < p.engageRange);
    if ((bot.mode === 'engage' || bot.mode === 'chase') && distance < 1.5 * p.chaseAgainRange) {
      // Fear above courage: it leaves. Hurt and outmatched: it may leave too (a roll).
      const hurt = hullShare < 0.85 || crewShare(ship) < 0.85;
      const reason = fear > courage ? 'fear' : hurt && o < p.leaveOdds && nextRandom(world) < p.leaveChance ? 'odds' : null;
      if (reason) {
        bot.mode = 'flee';
        bot.side = null;
        world.events.push({ type: 'botLeaves', shipId: id, enemyId: enemy.id, reason, fear, odds: o });
      }
    } else if (
      running && !enemySafe && distance < p.desperateRangeM && enemy.speed > ship.speed + 0.5 && huntedBy(ship, enemy, distance, bot.weighDistance) &&
      (hullShare < p.desperateHullShare || crewShare(ship) < p.desperateHullShare) && nextRandom(world) < p.desperateChance
    ) {
      // Caught: the enemy is faster and close, the ship is badly hurt. Running is hopeless: turn and ram.
      bot.mode = 'ram';
      bot.ramLeft = p.ramSeconds;
      ramming = true;
      world.events.push({ type: 'ramDecision', shipId: id, enemyId: enemy.id, go: true, distance, desperate: true });
    }
    // A running trader the enemy gains on throws its cargo over the side (faster without it).
    if (params.trader && running && (ship.cargo ?? 0) > p.jettisonMinCargo && bot.weighDistance !== undefined && distance < bot.weighDistance - 5 && nextRandom(world) < p.jettisonChance) {
      commands.push({ type: 'jettison', shipId: id });
    }
    bot.weighDistance = distance;
  }

  // M4b step 2: an enemy out of view is sought at the last place it was seen: no broadside, no ram, no finishing blow.
  if (!seen && (bot.mode === 'engage' || bot.mode === 'ram' || bot.mode === 'finish')) {
    bot.mode = 'chase';
    delete bot.ramLeft;
    delete bot.finishLeft;
    ramming = false;
  }
  // Review 22 Nov (D69): at the last known place and nobody there: the search is over, the bot sails on
  // (before, it circled the empty spot until the contact was forgotten, up to 60 s).
  if (!seen && world.sight && distance <= p.searchArriveM) {
    forgetContact(world, id, bot.enemyId);
    return cruise(world, bot, ship, params, islands, p);
  }

  // --- Course and sails. ---
  let goal: number;
  let sails: number;
  let nearPort = false; // close to the anchorage: the bot may come close to the shore there
  if (bot.mode !== 'engage') delete bot.quietSeconds;
  // M3 step 6c: land between the bot and the enemy: it sails round it (sim/path.ts), not into it.
  const blocked = landBetween(ship, islands, enemy, p);
  let routed = false; // following a planned way this time (then avoidLand looks only a short way ahead)
  const via = (to: Point): number => {
    const h = headingVia(bot, ship, islands, to, p);
    if (bot.route) routed = true;
    return h;
  };
  if (bot.mode === 'port' && port) {
    bot.side = null;
    const course = portCourse(world, bot, ship, params, islands, port, p);
    goal = course.goal;
    sails = course.sails;
    nearPort = course.nearPort;
    routed = bot.route !== undefined;
  } else if (bot.mode === 'trade') {
    // M3 step 7b: a trader's run from stop to stop (ports and big islands), at a cruising sail.
    bot.side = null;
    if (!bot.tradeTo || Math.hypot(bot.tradeTo.x - ship.x, bot.tradeTo.y - ship.y) < p.traderArriveM) {
      pickRouteStop(world, bot, ship, params, islands, p);
    }
    goal = bot.tradeTo ? via(bot.tradeTo) : ship.headingRad;
    sails = p.traderCruiseSails;
  } else if (bot.mode === 'idle') {
    // The enemy is in safe water: keep clear of the port and wait almost stopped.
    // (Out of a harbour up an inlet: out through the inlet, not straight at the shore.)
    bot.side = null;
    const tooClose = nearest !== null && nearest.distance < DAMAGE.port.safeRange + 250;
    goal = tooClose && nearest ? via(portExit(nearest.port, ship, 250)) : bearing;
    sails = tooClose ? 0.5 : 0;
  } else if (bot.mode === 'ram') {
    bot.side = null;
    goal = blocked ? via(enemy) : interceptBearing(ship, enemy, p); // bow first into where it will be
    sails = 1;
  } else if (bot.mode === 'chase') {
    bot.side = null;
    goal = blocked ? via(enemy) : interceptBearing(ship, enemy, p); // cut it off (D45), not a tail chase
    sails = 1;
  } else if (bot.mode === 'breakOff') {
    bot.side = null;
    goal = fleeHeading(ship, params, world.wind, bearing, islands, pursuerOf(enemy)); // away from the enemy (not onto a shore, M3 step 6d)
    sails = sailsForSpeed(ship, params, world.wind, p.fightSpeed, p.minSails);
  } else if (bot.mode === 'flee') {
    bot.side = null;
    goal = fleeHeading(ship, params, world.wind, bearing, islands, pursuerOf(enemy));
    sails = 1;
  } else if (bot.mode === 'repair') {
    bot.side = null;
    goal = fleeHeading(ship, params, world.wind, bearing, islands); // keep drifting away (not onto a shore), almost stopped, while the crew works
    sails = DAMAGE.repair.maxSails;
  } else {
    bot.quietSeconds = (bot.quietSeconds ?? 0) + thinkSeconds;
    // M3 step 6c (your test: bots did not lead their shots): the side is turned toward the aim
    // point, where the enemy will be when the balls come down, not toward where it is now.
    const lead = aimPoint(ship, enemy, predictLanding(ship, params, bot.side ?? 'port', STEP_SECONDS).seconds);
    const aimBearing = Math.atan2(lead.y - ship.y, lead.x - ship.x);
    // Keep the chosen side. Change to the other side when it is loaded, this one is not,
    // and the turn to it is less than 90 degrees (a full turn round would waste the reload time).
    const turn = (s: Side): number => Math.abs(normalizeAngle(broadsideHeading(aimBearing, distance, s, mine) - ship.headingRad));
    const other: Side = bot.side === 'port' ? 'starboard' : 'port';
    if (bot.side === null) {
      const loaded = SIDES.filter((s) => reloadLeft(ship, s) <= 0);
      const choices = loaded.length > 0 ? loaded : SIDES;
      bot.side = choices.reduce((a, b) => (turn(a) <= turn(b) ? a : b));
    } else if (reloadLeft(ship, bot.side) > 0 && reloadLeft(ship, other) <= 0 && turn(other) < Math.PI / 2) {
      bot.side = other;
    }
    goal = broadsideHeading(aimBearing, distance, bot.side, mine);
    // A loaded side whose aim point is nearly on the beam: turn to put it exactly there and fire
    // (no bend for the range this time; the shot comes first).
    const offBeam = normalizeAngle(aimBearing - sideAngleRad(ship.headingRad, bot.side));
    if (reloadLeft(ship, bot.side) <= 0 && Math.abs(offBeam) < degToRad(p.shotTurnDeg)) goal = broadsideHeading(aimBearing, mine.preferredRange, bot.side, mine);
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
      goal = interceptBearing(ship, enemy, p);
      sails = 1;
    }
    // M3 step 6c (your test: long parallel runs without a fight): a long time without a broadside
    // and still beyond its range: close in.
    if ((bot.quietSeconds ?? 0) > p.quietCloseSeconds && distance > mine.preferredRange) {
      goal = interceptBearing(ship, enemy, p);
      sails = 1;
    }
    if (blocked) {
      goal = via(enemy);
      sails = 1;
    }
  }
  // M3 step 7b (headless arena: a sloop that had escaped into the Isla Verde harbour ground along the
  // inlet's bank for minutes on its way out): inside a harbour up an inlet, whatever it is after, a
  // bot first sails out through the inlet's mouth.
  if (bot.mode !== 'port' && bot.mode !== 'idle' && !finishing && !ramming && nearest?.port.path && inHarbour(ship.x, ship.y, [nearest.port])) {
    goal = via(portExit(nearest.port, ship, 150));
  }
  if (!routed) delete bot.route; // a way planned earlier (for another goal) is not kept in the world state
  // M3 step 8: where the harbour boats tow (a harbour, the inlet) a ship needs no tacks: it heads straight for its
  // goal and the boats pull it (tacking in the narrow inlet put it on the banks again and again).
  const towed = inHarbour(ship.x, ship.y, portsCached(islands));
  let steer = towed ? goal : steerWithTacks(goal, params, world.wind, bot, p);
  // Beating along a shore (M3 step 6c): go about early when land is ahead on this tack.
  if (!towed && bot.tack !== 0 && bot.tackSeconds >= p.shoreTackSeconds && landAhead(ship, params, islands, steer, Math.max(p.landLookaheadMinM, ship.speed * p.landLookaheadSeconds))) {
    bot.tack = bot.tack === 1 ? -1 : 1;
    bot.tackSeconds = 0;
    steer = closeHauled(params, world.wind, bot.tack, p);
  }
  const clear = avoidShips(ship, params, world.ships, steer, p, ramming ? enemy.id : -1);
  if (clear !== null) steer = clear;
  // Just collided (D45): turn away from that ship and ease sail for a few seconds (avoidSeconds),
  // unless it was the ship we meant to ram.
  const touched = contactWith(world, id);
  if (touched !== null && !(ramming && touched === enemy.id)) {
    const other = world.ships.find((s) => s.id === touched);
    if (other) {
      const off = normalizeAngle(Math.atan2(other.y - ship.y, other.x - ship.x) - ship.headingRad);
      steer = normalizeAngle(ship.headingRad + (off >= 0 ? -1 : 1) * degToRad(p.contactTurnDeg));
      sails = Math.min(sails, p.minSails);
    }
  }
  // On a planned way round the land the way itself keeps clear of the shore: look only a short way ahead.
  const away = nearPort ? null : avoidLand(ship, params, islands, steer, routed ? ROUTE_LOOK : p);
  if (away !== null) steer = away;
  // M3 step 6d: a harbour is no place to fight or to run to: unless it is going to port (or finishing
  // an enemy there), a bot outside a harbour does not sail into one (the merchantman broke off into the inlet).
  if (bot.mode !== 'port' && !finishing && !ramming) {
    const keepOut = avoidHarbour(ship, islands, steer);
    if (keepOut !== null) steer = keepOut;
  }
  const rudder = rudderFor(ship, params, steer, world.wind, p, onLeeShore(ship, params, islands, world.wind));
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: id, value: rudder });
  // In a harbour (M3 step 6d, your test: bots circling in the Isla Verde harbour): no faster than harbourSpeedMps.
  if (!ramming && !finishing) sails = harbourSails(ship, params, world.wind, islands, sails, p);
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: id, value: sails });

  // --- Guns: aim with the side that faces the enemy, fire when it is in the arc. ---
  // Bots keep the port law: no fire at a protected ship, and no fire from inside safe water
  // unless an offender is there to be shot at.
  // Ammunition (M3 step 4): grape at close range, chain at a faster enemy whose sails still draw,
  // round shot for everything else. Takes effect from the next think (the aim uses the loaded kind).
  // A trader on its run (M3 step 7b) does not start a fight: its guns are for defence.
  if (bot.mode === 'trade' || !seen) return commands; // (no shot at a ship that cannot be seen)
  const ammo = chooseAmmo(ship, params, enemy, distance, p, bot.rammer === true);
  if (ammo !== ammoOf(ship)) commands.push({ type: 'setAmmo', shipId: id, ammo });
  if (enemySafe && !goIn) return commands;
  const myPort = safePortIndex(ship.x, ship.y, ports);
  if (!goIn && myPort >= 0 && !offenderNear(world, myPort, ship.id, ports)) return commands;
  // The battery that faces the enemy best: a broadside, the stern chasers of a trader (M3 step 7b)
  // or the bow chasers in a chase (step 7c). A loaded battery comes before one that is still loading.
  const batteries = (['port', 'starboard', 'stern', 'bow'] as Side[]).filter((s) => gunsOn(params, s) > 0);
  const facing = (s: Side): number => Math.cos(normalizeAngle(bearing - sideAngleRad(ship.headingRad, s))) + (reloadLeft(ship, s) <= 0 ? 1 : 0);
  const side: Side = batteries.reduce((a, b) => (facing(b) > facing(a) ? b : a));
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
    // M3 step 7f: the chasers are not trained any more; like a broadside they fire only when the aim point lies on their line.
    const inArc = Math.abs(Math.sin(offBeam)) * aimDistance <= p.fireOffsetM && Math.cos(offBeam) > 0;
    const onElevation = Math.abs(next - goalDeg) <= p.aimToleranceDeg;
    // M3 step 7b: no shot into a hill or a cliff (the balls would stick in the land).
    const clear = ready && inArc && onElevation ? shotClear(ship, target, next, islands) : true;
    if (ready && inArc && onElevation && clear) {
      commands.push({ type: 'fire', shipId: id, side });
      bot.quietSeconds = 0;
      bot.aimErrorDeg = nextGaussian(world) * bot.personality.aimErrorSigmaDeg; // a new misjudgement for the next broadside
    }
  }
  return commands;
}

/**
 * M4b step 2: nobody in view and none remembered. The ship sails on along a trade run (the next stop: a port or a big
 * island), like a trader, so that ships meet and find each other, instead of lying still. (First version: no better
 * search; patrol routes and renegades come later in M4b.)
 */
function cruise(world: World, bot: BotState, ship: ShipState, params: ShipParams, islands: readonly Island[], p: BotParams): Command[] {
  bot.mode = 'trade';
  bot.side = null;
  delete bot.quietSeconds;
  if (!bot.tradeTo || Math.hypot(bot.tradeTo.x - ship.x, bot.tradeTo.y - ship.y) < p.traderArriveM) pickRouteStop(world, bot, ship, params, islands, p);
  let routed = false;
  let goal = ship.headingRad;
  if (bot.tradeTo) {
    goal = headingVia(bot, ship, islands, bot.tradeTo, p);
    if (bot.route) routed = true;
  }
  const nearest = nearestPort(ship.x, ship.y, portsOf(islands));
  if (nearest?.port.path && inHarbour(ship.x, ship.y, [nearest.port])) {
    goal = headingVia(bot, ship, islands, portExit(nearest.port, ship, 150), p);
    if (bot.route) routed = true;
  }
  if (!routed) delete bot.route;
  const towed = inHarbour(ship.x, ship.y, portsCached(islands));
  let steer = towed ? goal : steerWithTacks(goal, params, world.wind, bot, p);
  if (!towed && bot.tack !== 0 && bot.tackSeconds >= p.shoreTackSeconds && landAhead(ship, params, islands, steer, Math.max(p.landLookaheadMinM, ship.speed * p.landLookaheadSeconds))) {
    bot.tack = bot.tack === 1 ? -1 : 1;
    bot.tackSeconds = 0;
    steer = closeHauled(params, world.wind, bot.tack, p);
  }
  let sails = p.traderCruiseSails;
  const clear = avoidShips(ship, params, world.ships, steer, p);
  if (clear !== null) steer = clear;
  const touched = contactWith(world, ship.id);
  if (touched !== null) {
    const other = world.ships.find((s) => s.id === touched);
    if (other) {
      const off = normalizeAngle(Math.atan2(other.y - ship.y, other.x - ship.x) - ship.headingRad);
      steer = normalizeAngle(ship.headingRad + (off >= 0 ? -1 : 1) * degToRad(p.contactTurnDeg));
      sails = Math.min(sails, p.minSails);
    }
  }
  const away = avoidLand(ship, params, islands, steer, routed ? ROUTE_LOOK : p);
  if (away !== null) steer = away;
  const keepOut = avoidHarbour(ship, islands, steer);
  if (keepOut !== null) steer = keepOut;
  const commands: Command[] = [];
  const rudder = rudderFor(ship, params, steer, world.wind, p, onLeeShore(ship, params, islands, world.wind));
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: ship.id, value: rudder });
  sails = harbourSails(ship, params, world.wind, islands, sails, p);
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: ship.id, value: sails });
  return commands;
}

/**
 * M3 step 7b: is this enemy hunting us? It is getting closer (since the last weighing) and its bow
 * points at us (within 45 degrees). What any captain could see from his deck.
 */
function huntedBy(ship: ShipState, enemy: ShipState, distance: number, lastDistance: number | undefined): boolean {
  if (lastDistance === undefined || distance > lastDistance - 3) return false;
  const toUs = Math.atan2(ship.y - enemy.y, ship.x - enemy.x);
  return Math.abs(normalizeAngle(toUs - enemy.headingRad)) < Math.PI / 4;
}

/**
 * M3 step 7b: a trader's mode. With no enemy near (traderThreatM) it sails its trade run. An
 * enemy near (another trader only if it has already frightened us): with courage enough and the
 * odds in its favour it fights (a brave caravel), otherwise it runs. Badly hurt: it runs anyway.
 */
function traderMode(world: World, bot: BotState, ship: ShipState, enemy: ShipState, distance: number, hullShare: number, courage: number, ports: readonly Port[], p: BotParams): void {
  if (bot.mode === 'flee' || bot.mode === 'repair') {
    if (distance < p.traderSafeM) bot.mode = 'flee';
    else if (hullShare < DAMAGE.repair.seaMaxShare - 1e-6) bot.mode = 'repair';
    else bot.mode = 'trade';
    return;
  }
  const ep = SHIP_CLASSES[enemy.shipClass];
  const threat = distance < p.traderThreatM && !protectedByPort(enemy, ports) && !(ep?.trader && (bot.fear ?? 0) < 0.05);
  if (!threat) {
    bot.mode = 'trade';
    return;
  }
  if (hullShare < p.fleeHullShare) {
    bot.mode = 'flee';
    bot.side = null;
    return;
  }
  if (bot.mode === 'engage' || bot.mode === 'ram') return; // it has decided to fight
  const o = odds(ship, enemy);
  if (courage >= p.traderFightCourage && o >= 1) {
    bot.mode = 'engage';
    return;
  }
  bot.mode = 'flee';
  bot.side = null;
  world.events.push({ type: 'botLeaves', shipId: ship.id, enemyId: enemy.id, reason: 'trader', fear: bot.fear ?? 0, odds: o });
}

const tradeStopCache = new WeakMap<readonly Island[], Map<string, StopSets>>();

/** The stops of a trade run for this class on these islands (made once): off the ports, and off the big islands. */
function tradeStopsFor(shipClass: string, params: ShipParams, islands: readonly Island[], p: BotParams): StopSets {
  let byClass = tradeStopCache.get(islands);
  if (!byClass) {
    byClass = new Map();
    tradeStopCache.set(islands, byClass);
  }
  let stops = byClass.get(shipClass);
  if (!stops) {
    stops = tradeStopSets(params, islands, portsFor(portsCached(islands), params, p), p);
    byClass.set(shipClass, stops);
  }
  return stops;
}

/** M4b step 5b-1: the next stop of the bot's default route becomes its goal (`tradeTo`); a new route is logged by an event. */
function pickRouteStop(world: World, bot: BotState, ship: ShipState, params: ShipParams, islands: readonly Island[], p: BotParams): void {
  const next = nextRouteStop(world, bot, ship, tradeStopsFor(ship.shipClass, params, islands, p), !!SHIP_CLASSES[ship.shipClass]?.trader, bot.renegade ? p.renegadeRouteStops : p.routeStops, p.traderArriveM);
  if (!next) {
    delete bot.tradeTo;
    return;
  }
  bot.tradeTo = next.stop;
  if (next.planned) world.events.push({ type: 'routePlanned', shipId: ship.id, stops: next.planned.stops, kind: next.planned.kind });
}

/**
 * M3 step 7b: does a shot at this elevation clear the land on its way to `to`? The ball's path is
 * taken as an arc from the gun (3 m) over the top (a quarter of the distance x tan(elevation))
 * down to the water: a hill or a cliff higher than that on the way stops the shot.
 */
export function shotClear(ship: ShipState, to: Point, elevationDeg: number, islands: readonly Island[]): boolean {
  const t = terrainFor(islands);
  const dist = Math.hypot(to.x - ship.x, to.y - ship.y);
  const apex = (dist * Math.tan(degToRad(elevationDeg))) / 4;
  const steps = Math.max(1, Math.ceil(dist / (t.cellM / 2)));
  for (let k = 1; k < steps; k++) {
    const f = k / steps;
    const z = GUNS.gunHeight * (1 - f) + 4 * apex * f * (1 - f);
    const x = ship.x + (to.x - ship.x) * f;
    const y = ship.y + (to.y - ship.y) * f;
    if (ballBlocked(t, { x, y, z }, { x, y, z })) return false;
  }
  return true;
}

/**
 * The bot's choice of ammunition, with a gap so that it does not switch back and forth:
 *   grape  closer than grapeRangeM (kept until grapeLeaveM): clear the enemy's deck
 *   chain  the enemy is chainSpeedGap faster and its sails still draw, and it is within the chain shot's reach
 *   round  otherwise (and whenever the wanted kind has run out)
 */
export function chooseAmmo(ship: ShipState, params: ShipParams, enemy: ShipState, distance: number, p: BotParams = BOTS, rammer = false): AmmoType {
  const now = ammoOf(ship);
  const grapeLimit = rammer ? p.rammerGrapeM : now === 'grape' ? p.grapeLeaveM : p.grapeRangeM;
  if (distance < grapeLimit && ammoLeftOf(ship, 'grape') > 0) return 'grape';
  const chainTable = reachTable(ship, params, 'port', GUNS.maxElevationDeg, ammoGuns('chain'));
  const reach = chainTable[chainTable.length - 1]!;
  // A rammer tears the sails first (a slow enemy is easy to ram), whatever its speed.
  if (rammer && sailShare(enemy) > p.chainMinEnemySails && distance < reach * p.rammerChainShare && ammoLeftOf(ship, 'chain') > 0) return 'chain';
  const runner = enemy.speed > ship.speed + p.chainSpeedGap && sailShare(enemy) > p.chainMinEnemySails;
  if (runner && distance < reach * p.chainRangeShare && ammoLeftOf(ship, 'chain') > 0) return 'chain';
  return 'round';
}

/** A short look ahead for land while following a planned way (the way already keeps clear of the shore). */
const ROUTE_LOOK: BotParams = { ...BOTS, landLookaheadMinM: 25, landLookaheadSeconds: 3 };

/** Bots hold their fire when the aim point is this close to a port's safe water (balls scatter). */
const PORT_EDGE_MARGIN_M = 30;

/** An offender bot sails straight away from the port whose peace it broke, under full sail, until it is pardoned. */
function leavePort(world: World, bot: BotState, ship: ShipState, params: ShipParams, islands: readonly Island[], port: Port, p: BotParams): Command[] {
  bot.mode = 'outlaw';
  bot.side = null;
  // Away from the port; out of a harbour up an inlet: out through the inlet's mouth (sim/path.ts).
  const outGoal = headingVia(bot, ship, islands, portExit(port, ship, 400), p);
  let steer = inHarbour(ship.x, ship.y, [port]) ? outGoal : steerWithTacks(outGoal, params, world.wind, bot, p);
  const clear = avoidShips(ship, params, world.ships, steer, p);
  if (clear !== null) steer = clear;
  const away = avoidLand(ship, params, islands, steer, bot.route ? ROUTE_LOOK : p);
  if (away !== null) steer = away;
  const commands: Command[] = [];
  const rudder = rudderFor(ship, params, steer, world.wind, p, onLeeShore(ship, params, islands, world.wind));
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: ship.id, value: rudder });
  const sails = harbourSails(ship, params, world.wind, islands, 1, p);
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: ship.id, value: sails });
  return commands;
}

/**
 * A point to sail to when leaving a port (M3 step 6c): `distanceM` beyond the edge of its safe water
 * on the ship's side; for a harbour up an inlet, `distanceM` off the inlet's mouth (and on the inlet,
 * the next point of its middle line toward the mouth, M3 step 8).
 */
export function portExit(port: Port, ship: ShipState, distanceM: number): Point {
  // M3 step 8: on the inlet itself, the next point of its middle line toward the mouth (the bends).
  const along = inletWayOut(ship.x, ship.y, port);
  if (along) return along;
  const mouth = port.path?.[0];
  const second = port.path?.[1];
  if (mouth && second) {
    const l = Math.hypot(mouth.x - second.x, mouth.y - second.y) || 1;
    return { x: mouth.x + ((mouth.x - second.x) / l) * distanceM, y: mouth.y + ((mouth.y - second.y) / l) * distanceM };
  }
  const len = Math.hypot(ship.x - port.x, ship.y - port.y) || 1;
  const out = DAMAGE.port.safeRange + distanceM;
  return { x: port.x + ((ship.x - port.x) / len) * out, y: port.y + ((ship.y - port.y) / len) * out };
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
  const away = course.nearPort ? null : avoidLand(ship, params, islands, steer, bot.route ? ROUTE_LOOK : p);
  if (away !== null) steer = away;
  const sails = course.sails;
  const commands: Command[] = [];
  const rudder = rudderFor(ship, params, steer, world.wind, p, onLeeShore(ship, params, islands, world.wind));
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
    return { goal: headingVia(bot, ship, islands, spot, p), sails: away < 40 ? 0 : away < 150 ? p.minSails : 1, nearPort: false };
  }
  bot.waitingBerth = false;
  const way = portWaypoint(ship.x, ship.y, port.port);
  // "Up the inlet" only when the next point of its middle line is in plain sight (M3 step 6d: a ship
  // beside the inlet, behind its bank, steered straight at it across the land and stuck there).
  const upInlet = way.inside && !landBetween(ship, islands, way, p);
  if (upInlet) delete bot.route;
  return {
    // M3 step 6c: on the way to the inlet's mouth (or a port behind an island), round the land.
    goal: upInlet ? Math.atan2(way.y - ship.y, way.x - ship.x) : headingVia(bot, ship, islands, way, p),
    // Close to the anchorage, or on the way up an inlet: the way itself keeps clear of the land.
    nearPort: port.distance < 2 * dock || upInlet,
    sails: port.distance < dock * 0.5 ? 0 : port.distance < 3 * dock ? p.minSails : 1,
  };
}

/** Does the bot mean to get somewhere now? (Lying at anchor, waiting for a berth or mending does not count.) */
function wantsToMove(bot: BotState, ship: ShipState, islands: readonly Island[]): boolean {
  if (bot.mode === 'idle' || bot.mode === 'repair') return false;
  if (bot.mode === 'port') {
    if (bot.waitingBerth) return false;
    const params = SHIP_CLASSES[ship.shipClass];
    const port = nearestPort(ship.x, ship.y, params ? portsForBot(bot, portsOf(islands), params, BOTS) : portsOf(islands));
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
  const blocked = notePortTrouble(bot, ship, params, islands, p);
  if (blocked) world.events.push({ type: 'portBlocked', shipId: ship.id, port: blocked, seconds: p.portBlockSeconds });
  bot.unstickLeft = p.unstickSeconds;
  bot.unstickHeadingRad = heading;
  bot.tack = 0;
  world.events.push({ type: 'botUnstick', shipId: ship.id, x: ship.x, y: ship.y, headingRad: heading });
  return steerTo(ship, heading, 1, p);
}

/** Rudder toward a heading and the sails at a level (only the commands that change something). */
function steerTo(ship: ShipState, headingRad: number, sails: number, p: BotParams): Command[] {
  const commands: Command[] = [];
  const rudder = shapeRudder(p.rudderGain * normalizeAngle(headingRad - ship.headingRad), ship.rudder, p);
  if (Math.abs(rudder - ship.rudder) > 0.02) commands.push({ type: 'setRudder', shipId: ship.id, value: rudder });
  if (Math.abs(sails - ship.sailLevel) > 0.01) commands.push({ type: 'setSails', shipId: ship.id, value: sails });
  return commands;
}

/** All bots think; returns every command in the order of the bots list. */
export function thinkBots(world: World, islands: readonly Island[], p: BotParams = BOTS): Command[] {
  return world.bots.flatMap((bot) => thinkBot(world, bot, islands, p));
}
