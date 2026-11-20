import { accuracyInputs, gunSigmaDeg, salvoSigmaDeg } from './accuracy';
import { ammoGuns, ammoParams, loadableAmmo, spendAmmo } from './ammo';
import { crewExposure, crewOf, damageSails, gunsManned, killCrew, reloadFactor } from './condition';
import { degToRad } from './angles';
import { GUNS, ISLANDS, SHIP_CLASSES } from './data';
import { ballBlocked, terrainFor } from './terrain';
import { frighten, hitFear, nearMiss } from './morale';
import { damageHull } from './damage';
import { ballDamage, isOffenderOf } from './law';
import { nextGaussian, nextRandom } from './random';
import { ballHit } from './hits';
import { gunneryReload } from './skills';
import type { HitZone } from './hits';
import type { AmmoType, Ball, GunParams, Island, PendingShot, ShipParams, ShipState, Side, World } from './types';

/** How far the chasers (stern, M3 step 7b; bow, step 7c) can be trained off the centre line, degrees. */
export const STERN_TRAIN_DEG = 30;
export const CHASER_TRAIN_DEG = STERN_TRAIN_DEG;

/** The bow and stern chasers: guns on the centre line that can be trained a little (not a broadside). */
export function isChaser(side: Side): boolean {
  return side === 'stern' || side === 'bow';
}

/** The direction a battery fires: 90 degrees left (port) or right (starboard) of the bow; the stern chasers (M3 step 7b) straight astern. */
export function sideAngleRad(headingRad: number, side: Side): number {
  if (side === 'stern') return headingRad + Math.PI;
  if (side === 'bow') return headingRad;
  return headingRad + (side === 'starboard' ? Math.PI / 2 : -Math.PI / 2);
}

/** How many guns a battery has: gunsPerSide for a broadside, sternGuns (M3 step 7b) for the stern, bowGuns (step 7c) for the bow. */
export function gunsOn(params: ShipParams, side: Side): number {
  if (side === 'stern') return params.sternGuns ?? 0;
  if (side === 'bow') return params.bowGuns ?? 0;
  return params.gunsPerSide;
}

/** The ammunition a battery really fires: the bow chasers always fire round shot (M3 step 7c). */
export function batteryAmmo(ship: ShipState, side: Side): AmmoType {
  return side === 'bow' ? 'round' : loadableAmmo(ship);
}

/** Where gun number `gun` sits on the deck, in world metres (guns spread from stern to bow; stern chasers side by side at the stern). */
export function gunPosition(ship: ShipState, params: ShipParams, side: Side, gun: number, g: GunParams = GUNS): { x: number; y: number } {
  const fx = Math.cos(ship.headingRad);
  const fy = Math.sin(ship.headingRad);
  if (isChaser(side)) {
    const n = gunsOn(params, side);
    const across = n > 1 ? (gun / (n - 1) - 0.5) * params.beam * 0.5 : 0;
    const along = side === 'bow' ? params.length / 2 : -params.length / 2;
    return { x: ship.x + fx * along - fy * across, y: ship.y + fy * along + fx * across };
  }
  const n = params.gunsPerSide;
  const along = n > 1 ? (gun / (n - 1) - 0.5) * g.gunSpreadShare * params.length : 0;
  const out = sideAngleRad(ship.headingRad, side);
  return {
    x: ship.x + fx * along + Math.cos(out) * (params.beam / 2),
    y: ship.y + fy * along + Math.sin(out) * (params.beam / 2),
  };
}

/** Random errors of one ball, in degrees: up/down and left/right of where the gun was pointed. */
export interface ShotError {
  elevationDeg: number;
  directionDeg: number;
}

export const NO_ERROR: ShotError = { elevationDeg: 0, directionDeg: 0 };

/**
 * A new ball leaving the gun (plan 4.4):
 *   velocity = inheritVelocity x ship velocity + muzzle speed at a right angle to the hull, raised by the elevation.
 * `error` turns the gun a little (accuracy, step 3); without it the ball flies exactly as aimed.
 * By default the gun numbers of the ammunition the ship has loaded (chain and grape fly slower).
 */
export function launchBall(ship: ShipState, side: Side, from: { x: number; y: number }, g: GunParams = ammoGuns(batteryAmmo(ship, side)), error: ShotError = NO_ERROR): Ball {
  const out = sideAngleRad(ship.headingRad, side) + degToRad(error.directionDeg);
  const elev = degToRad(ship.elevationDeg + error.elevationDeg);
  const horizontal = g.muzzleSpeed * Math.cos(elev);
  return {
    id: 0,
    shipId: ship.id,
    x: from.x,
    y: from.y,
    z: g.gunHeight,
    vx: Math.cos(out) * horizontal + g.inheritVelocity * Math.cos(ship.headingRad) * ship.speed,
    vy: Math.sin(out) * horizontal + g.inheritVelocity * Math.sin(ship.headingRad) * ship.speed,
    vz: g.muzzleSpeed * Math.sin(elev),
    ageSeconds: 0,
  };
}

/** One step of flight: gravity slows the climb, then the ball moves. */
export function stepBall(ball: Ball, dt: number, g: GunParams = GUNS): void {
  ball.vz -= g.gravity * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
  ball.ageSeconds += dt;
}

/**
 * Where a ball from the middle of this battery would hit the water.
 * It runs the same steps as a real ball, so the marker and the real shot always agree.
 * By default for the ammunition the ship has loaded.
 */
export function predictLanding(ship: ShipState, params: ShipParams, side: Side, dt: number, g: GunParams = ammoGuns(batteryAmmo(ship, side))): { x: number; y: number; seconds: number } {
  // The middle of the battery: on the ship's side, level with the middle of the hull (the stern chasers: at the stern).
  const out = sideAngleRad(ship.headingRad, side);
  const reach = isChaser(side) ? params.length / 2 : params.beam / 2;
  const from = { x: ship.x + Math.cos(out) * reach, y: ship.y + Math.sin(out) * reach };
  const ball = launchBall(ship, side, from, g);
  while (ball.z > 0 && ball.ageSeconds < g.maxBallSeconds) stepBall(ball, dt, g);
  return { x: ball.x, y: ball.y, seconds: ball.ageSeconds };
}

/** Seconds until this battery can fire again. */
export function reloadLeft(ship: ShipState, side: Side): number {
  if (side === 'stern') return ship.reloadStern ?? 0;
  if (side === 'bow') return ship.reloadBow ?? 0;
  return side === 'port' ? ship.reloadPort : ship.reloadStarboard;
}

/**
 * The `fire` command: if the battery is loaded, plan the shots of all its guns
 * (ripple fire: one after another over `rippleSeconds`) and start reloading.
 * Returns true if the broadside was really ordered.
 */
export function orderBroadside(world: World, ship: ShipState, side: Side, stepSeconds: number, g: GunParams = GUNS, trainDeg = 0): boolean {
  const params = SHIP_CLASSES[ship.shipClass];
  if (!params || ship.sunk || reloadLeft(ship, side) > 0) return false;
  // Plan 4.4: every gun needs its gun crew; with a short crew fewer guns fire (spread along the side).
  const n = gunsOn(params, side);
  const manned = isChaser(side) ? Math.min(n, Math.floor(crewOf(ship) / g.crewPerGun)) : gunsManned(ship, params, g);
  if (manned <= 0) return false;
  const ammo = batteryAmmo(ship, side); // the chosen kind, or round shot when none of it is left; the bow: round shot
  spendAmmo(ship, ammo);
  // The roll of the ship: one random error for the whole broadside (plan 4.4).
  const salvoErrorDeg = nextGaussian(world) * salvoSigmaDeg(accuracyInputs(ship, world.wind.strength), g);
  for (let i = 0; i < manned; i++) {
    const gun = manned > 1 ? Math.round((i * (n - 1)) / (manned - 1)) : Math.floor((n - 1) / 2);
    const delay = n > 1 ? (gun / (n - 1)) * g.rippleSeconds : 0;
    const shot: PendingShot = { shipId: ship.id, side, gun, tick: world.tick + Math.round(delay / stepSeconds), salvoErrorDeg, ammo };
    // M3 step 7b: the stern chasers can be trained a little to either side (a broadside cannot: the ship turns).
    if (isChaser(side) && trainDeg !== 0) shot.trainDeg = Math.max(-CHASER_TRAIN_DEG, Math.min(CHASER_TRAIN_DEG, trainDeg));
    world.pendingShots.push(shot);
  }
  // A short crew loads slower (plan 4.4).
  const reload = params.reloadSeconds * reloadFactor(ship, g) * gunneryReload(ship); // M3 step 7c: skilled gunners load faster
  if (side === 'port') ship.reloadPort = reload;
  else if (side === 'starboard') ship.reloadStarboard = reload;
  else if (side === 'stern') ship.reloadStern = reload;
  else ship.reloadBow = reload;
  return true;
}

/** The reload time this ship would get now (the HUD draws the pie against it). */
export function reloadSecondsOf(ship: ShipState, g: GunParams = GUNS): number {
  return (SHIP_CLASSES[ship.shipClass]?.reloadSeconds ?? 0) * reloadFactor(ship, g) * gunneryReload(ship);
}

/** Fire the guns whose time has come, move every ball, and make splashes. */
export function stepGunsAndBalls(world: World, dt: number, g: GunParams = GUNS, islands: readonly Island[] = ISLANDS): void {
  for (const ship of world.ships) {
    ship.reloadPort = Math.max(0, ship.reloadPort - dt);
    ship.reloadStarboard = Math.max(0, ship.reloadStarboard - dt);
    if (ship.reloadStern !== undefined) {
      ship.reloadStern = Math.max(0, ship.reloadStern - dt);
      if (ship.reloadStern === 0) delete ship.reloadStern; // absent = ready (keeps old saves and tests the same)
    }
    if (ship.reloadBow !== undefined) {
      ship.reloadBow = Math.max(0, ship.reloadBow - dt);
      if (ship.reloadBow === 0) delete ship.reloadBow;
    }
  }

  const due = world.pendingShots.filter((s) => s.tick <= world.tick);
  world.pendingShots = world.pendingShots.filter((s) => s.tick > world.tick);
  for (const shot of due) {
    const ship = world.ships.find((s) => s.id === shot.shipId);
    const params = ship ? SHIP_CLASSES[ship.shipClass] : undefined;
    if (!ship || !params || ship.sunk) continue;
    const from = gunPosition(ship, params, shot.side, shot.gun, g);
    const ammo: AmmoType = shot.ammo ?? 'round';
    const kind = ammoParams(ammo);
    const ammoG = ammoGuns(ammo, g);
    // Each gun adds its own error, up/down and left/right, on top of the salvo's roll error.
    // Grape: every small ball of the bag gets its own error, so they fly out as a cone.
    const sigma = gunSigmaDeg({ ...accuracyInputs(ship, world.wind.strength), ammoSpread: kind.spread }, g);
    for (let k = 0; k < kind.pellets; k++) {
      const error: ShotError = {
        elevationDeg: shot.salvoErrorDeg + nextGaussian(world) * sigma,
        directionDeg: nextGaussian(world) * sigma + (shot.trainDeg ?? 0),
      };
      const ball = launchBall(ship, shot.side, from, ammoG, error);
      ball.id = world.nextBallId++;
      if (ammo !== 'round') ball.ammo = ammo;
      world.balls.push(ball);
    }
    world.events.push({ type: 'gunFired', shipId: ship.id, side: shot.side, x: from.x, y: from.y, ammo, balls: kind.pellets });
  }

  const hitBalls = new Set<number>();
  const terrain = terrainFor(islands);
  for (const ball of world.balls) {
    const from = { x: ball.x, y: ball.y, z: ball.z };
    stepBall(ball, dt, g);
    const hit = firstHit(world, ball, from);
    // M3 step 7b: a hill or a cliff on the way stops the ball before it reaches a ship behind it.
    const blocked = ballBlocked(terrain, from, { x: ball.x, y: ball.y, z: ball.z });
    const shipFirst = hit && (!blocked || Math.hypot(hit.point.x - from.x, hit.point.y - from.y) <= Math.hypot(blocked.x - from.x, blocked.y - from.y));
    if (hit && shipFirst) {
      hitBalls.add(ball.id);
      applyHit(world, hit.ship, ball, hit.zone, hit.point, g);
    } else if (blocked) {
      hitBalls.add(ball.id);
      world.events.push({ type: 'landHit', x: blocked.x, y: blocked.y, z: blocked.z });
    } else if (ball.z <= 0) {
      world.events.push({ type: 'splash', x: ball.x, y: ball.y });
      nearMiss(world, ball.x, ball.y, ball.shipId); // M3 step 7b: a ball close by frightens a crew (a warning shot)
    }
  }
  world.balls = world.balls.filter((b) => !hitBalls.has(b.id) && b.z > 0 && b.ageSeconds < g.maxBallSeconds);
}

/**
 * The first ship this ball hits during the step it just made (from -> its new position).
 * Testing the whole segment means a fast ball never jumps through a ship.
 * A ball never hits the ship that fired it, and sunk ships are ignored.
 */
function firstHit(world: World, ball: Ball, from: { x: number; y: number; z: number }): { ship: ShipState; zone: HitZone; point: { x: number; y: number; z: number } } | null {
  const to = { x: ball.x, y: ball.y, z: ball.z };
  let best: { ship: ShipState; zone: HitZone; t: number } | null = null;
  for (const ship of world.ships) {
    if (ship.id === ball.shipId || ship.sunk) continue;
    // A shore gun's ball (owner id below 0) is meant for the offenders of its port only.
    if (ball.shipId < 0 && !isOffenderOf(ship, -ball.shipId - 1)) continue;
    const params = SHIP_CLASSES[ship.shipClass];
    if (!params) continue;
    const hit = ballHit(ship, params, from, to);
    if (hit && (!best || hit.t < best.t)) best = { ship, zone: hit.zone, t: hit.t };
  }
  if (!best) return null;
  const t = best.t;
  const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
  return { ship: best.ship, zone: best.zone, point };
}

/**
 * What a ball does (plan 4.4 and 4.5, M3 step 4), by the zone it hit and its kind:
 *   hull zone:    hull points (guns.damage x hull share) and sailors (guns.crewKill x crew share)
 *   rigging zone: sail points (guns.sailDamage x sails share)
 * At 0 hull the ship sinks. The port law may halve all of it and mark the shooter (sim/law.ts).
 */
function applyHit(world: World, ship: ShipState, ball: Ball, zone: HitZone, point: { x: number; y: number; z: number }, g: GunParams): void {
  const ammo: AmmoType = ball.ammo ?? 'round';
  const kind = ammoParams(ammo);
  const shooter = world.ships.find((s) => s.id === ball.shipId);
  const factor = ballDamage(world, ship, shooter, 1); // 1, or the port law's share
  let hullLost = 0;
  let sailsLost = 0;
  let crewLost = 0;
  if (zone === 'hull') {
    const amount = (ball.damage ?? g.damage) * kind.hull * factor;
    hullLost = Math.min(ship.hull, amount);
    // M3 step 7a: fewer men fall on an emptier deck and behind high sides (grape). A share of a man
    // is a chance: 0.3 of a man kills one in three hits (seeded, like every random thing in the world).
    const params = SHIP_CLASSES[ship.shipClass];
    const men = g.crewKill * kind.crew * factor * (params ? crewExposure(ship, params, ammo) : 1);
    const whole = Math.floor(men);
    crewLost = killCrew(ship, whole + (nextRandom(world) < men - whole ? 1 : 0));
  } else {
    sailsLost = damageSails(ship, g.sailDamage * kind.sails * factor);
  }
  world.events.push({ type: 'hit', shipId: ship.id, byShipId: ball.shipId, zone, ...point, ammo, hullLost, sailsLost, crewLost });
  // M3 step 7b: every hit frightens the crew a little (the share of hull and men it cost).
  const hitParams = SHIP_CLASSES[ship.shipClass];
  if (hitParams) frighten(world, ship.id, hitFear(hitParams, hullLost, crewLost), ball.shipId);
  if (hullLost > 0) damageHull(world, ship, hullLost, ball.shipId, undefined, true);
}

/**
 * How far the balls of this battery may stray from the cross, in metres (for the landing ellipse).
 *   along:  along the line of fire (long or short), from the elevation errors (salvo and gun together)
 *   across: sideways (ahead or behind the target), from the direction error
 * Each is one sigma: about two thirds of the balls land within it.
 * The elevation error is turned into metres by flying the middle ball at elevation +- sigma.
 */
export function landingSpread(ship: ShipState, params: ShipParams, side: Side, windStrength: number, dt: number, g: GunParams = ammoGuns(batteryAmmo(ship, side))): { alongM: number; acrossM: number } {
  const inputs = accuracyInputs(ship, windStrength);
  const gunSigma = gunSigmaDeg(inputs, g);
  const salvoSigma = salvoSigmaDeg(inputs, g);
  // Two independent errors add like the sides of a right triangle.
  const elevSigma = Math.hypot(gunSigma, salvoSigma);
  const at = (deltaDeg: number): { x: number; y: number } => predictLanding({ ...ship, elevationDeg: ship.elevationDeg + deltaDeg }, params, side, dt, g);
  const far = at(elevSigma);
  const near = at(-elevSigma);
  const mid = at(0);
  const out = sideAngleRad(ship.headingRad, side);
  const fromX = ship.x + Math.cos(out) * (params.beam / 2);
  const fromY = ship.y + Math.sin(out) * (params.beam / 2);
  return {
    alongM: Math.hypot(far.x - near.x, far.y - near.y) / 2,
    acrossM: Math.hypot(mid.x - fromX, mid.y - fromY) * Math.tan(degToRad(gunSigma)),
  };
}
