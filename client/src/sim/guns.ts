import { accuracyInputs, gunSigmaDeg, salvoSigmaDeg } from './accuracy';
import { degToRad } from './angles';
import { GUNS, SHIP_CLASSES } from './data';
import { damageHull } from './damage';
import { ballDamage, isOffenderOf } from './law';
import { nextGaussian } from './random';
import { ballHit } from './hits';
import type { HitZone } from './hits';
import type { Ball, GunParams, ShipParams, ShipState, Side, World } from './types';

/** The direction a battery fires: 90 degrees left (port) or right (starboard) of the bow. */
export function sideAngleRad(headingRad: number, side: Side): number {
  return headingRad + (side === 'starboard' ? Math.PI / 2 : -Math.PI / 2);
}

/** Where gun number `gun` sits on the deck, in world metres (guns spread from stern to bow). */
export function gunPosition(ship: ShipState, params: ShipParams, side: Side, gun: number, g: GunParams = GUNS): { x: number; y: number } {
  const n = params.gunsPerSide;
  const along = n > 1 ? (gun / (n - 1) - 0.5) * g.gunSpreadShare * params.length : 0;
  const out = sideAngleRad(ship.headingRad, side);
  const fx = Math.cos(ship.headingRad);
  const fy = Math.sin(ship.headingRad);
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
 */
export function launchBall(ship: ShipState, side: Side, from: { x: number; y: number }, g: GunParams = GUNS, error: ShotError = NO_ERROR): Ball {
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
 */
export function predictLanding(ship: ShipState, params: ShipParams, side: Side, dt: number, g: GunParams = GUNS): { x: number; y: number; seconds: number } {
  // The middle of the battery: on the ship's side, level with the middle of the hull.
  const out = sideAngleRad(ship.headingRad, side);
  const from = { x: ship.x + Math.cos(out) * (params.beam / 2), y: ship.y + Math.sin(out) * (params.beam / 2) };
  const ball = launchBall(ship, side, from, g);
  while (ball.z > 0 && ball.ageSeconds < g.maxBallSeconds) stepBall(ball, dt, g);
  return { x: ball.x, y: ball.y, seconds: ball.ageSeconds };
}

/** Seconds until this battery can fire again. */
export function reloadLeft(ship: ShipState, side: Side): number {
  return side === 'port' ? ship.reloadPort : ship.reloadStarboard;
}

/**
 * The `fire` command: if the battery is loaded, plan the shots of all its guns
 * (ripple fire: one after another over `rippleSeconds`) and start reloading.
 * Returns true if the broadside was really ordered.
 */
export function orderBroadside(world: World, ship: ShipState, side: Side, stepSeconds: number, g: GunParams = GUNS): boolean {
  const params = SHIP_CLASSES[ship.shipClass];
  if (!params || ship.sunk || reloadLeft(ship, side) > 0) return false;
  const n = params.gunsPerSide;
  // The roll of the ship: one random error for the whole broadside (plan 4.4).
  const salvoErrorDeg = nextGaussian(world) * salvoSigmaDeg(accuracyInputs(ship, world.wind.strength), g);
  for (let gun = 0; gun < n; gun++) {
    const delay = n > 1 ? (gun / (n - 1)) * g.rippleSeconds : 0;
    world.pendingShots.push({ shipId: ship.id, side, gun, tick: world.tick + Math.round(delay / stepSeconds), salvoErrorDeg });
  }
  if (side === 'port') ship.reloadPort = params.reloadSeconds;
  else ship.reloadStarboard = params.reloadSeconds;
  return true;
}

/** Fire the guns whose time has come, move every ball, and make splashes. */
export function stepGunsAndBalls(world: World, dt: number, g: GunParams = GUNS): void {
  for (const ship of world.ships) {
    ship.reloadPort = Math.max(0, ship.reloadPort - dt);
    ship.reloadStarboard = Math.max(0, ship.reloadStarboard - dt);
  }

  const due = world.pendingShots.filter((s) => s.tick <= world.tick);
  world.pendingShots = world.pendingShots.filter((s) => s.tick > world.tick);
  for (const shot of due) {
    const ship = world.ships.find((s) => s.id === shot.shipId);
    const params = ship ? SHIP_CLASSES[ship.shipClass] : undefined;
    if (!ship || !params || ship.sunk) continue;
    const from = gunPosition(ship, params, shot.side, shot.gun, g);
    // Each gun adds its own error, up/down and left/right, on top of the salvo's roll error.
    const sigma = gunSigmaDeg(accuracyInputs(ship, world.wind.strength), g);
    const error: ShotError = {
      elevationDeg: shot.salvoErrorDeg + nextGaussian(world) * sigma,
      directionDeg: nextGaussian(world) * sigma,
    };
    const ball = launchBall(ship, shot.side, from, g, error);
    ball.id = world.nextBallId++;
    world.balls.push(ball);
    world.events.push({ type: 'gunFired', shipId: ship.id, side: shot.side, x: from.x, y: from.y });
  }

  const hitBalls = new Set<number>();
  for (const ball of world.balls) {
    const from = { x: ball.x, y: ball.y, z: ball.z };
    stepBall(ball, dt, g);
    const hit = firstHit(world, ball, from);
    if (hit) {
      hitBalls.add(ball.id);
      applyHit(world, hit.ship, ball, hit.zone, hit.point, g);
    } else if (ball.z <= 0) {
      world.events.push({ type: 'splash', x: ball.x, y: ball.y });
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

/** Hull hits take hull points; at 0 the ship sinks. Rigging hits only make an event for now (sails come in M3). */
function applyHit(world: World, ship: ShipState, ball: Ball, zone: HitZone, point: { x: number; y: number; z: number }, g: GunParams): void {
  world.events.push({ type: 'hit', shipId: ship.id, byShipId: ball.shipId, zone, ...point });
  if (zone !== 'hull') return;
  // The port law may halve the damage and mark the shooter (sim/law.ts).
  const shooter = world.ships.find((s) => s.id === ball.shipId);
  damageHull(world, ship, ballDamage(world, ship, shooter, ball.damage ?? g.damage), ball.shipId, undefined, true);
}

/**
 * How far the balls of this battery may stray from the cross, in metres (for the landing ellipse).
 *   along:  along the line of fire (long or short), from the elevation errors (salvo and gun together)
 *   across: sideways (ahead or behind the target), from the direction error
 * Each is one sigma: about two thirds of the balls land within it.
 * The elevation error is turned into metres by flying the middle ball at elevation +- sigma.
 */
export function landingSpread(ship: ShipState, params: ShipParams, side: Side, windStrength: number, dt: number, g: GunParams = GUNS): { alongM: number; acrossM: number } {
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
