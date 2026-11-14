import { degToRad } from './angles';
import { GUNS, SHIP_CLASSES } from './data';
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

/**
 * A new ball leaving the gun (plan 4.4):
 *   velocity = inheritVelocity x ship velocity + muzzle speed at a right angle to the hull, raised by the elevation.
 */
export function launchBall(ship: ShipState, side: Side, from: { x: number; y: number }, g: GunParams = GUNS): Ball {
  const out = sideAngleRad(ship.headingRad, side);
  const elev = degToRad(ship.elevationDeg);
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
 */
export function orderBroadside(world: World, ship: ShipState, side: Side, stepSeconds: number, g: GunParams = GUNS): void {
  const params = SHIP_CLASSES[ship.shipClass];
  if (!params || reloadLeft(ship, side) > 0) return;
  const n = params.gunsPerSide;
  for (let gun = 0; gun < n; gun++) {
    const delay = n > 1 ? (gun / (n - 1)) * g.rippleSeconds : 0;
    world.pendingShots.push({ shipId: ship.id, side, gun, tick: world.tick + Math.round(delay / stepSeconds) });
  }
  if (side === 'port') ship.reloadPort = params.reloadSeconds;
  else ship.reloadStarboard = params.reloadSeconds;
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
    if (!ship || !params) continue;
    const from = gunPosition(ship, params, shot.side, shot.gun, g);
    const ball = launchBall(ship, shot.side, from, g);
    ball.id = world.nextBallId++;
    world.balls.push(ball);
    world.events.push({ type: 'gunFired', shipId: ship.id, side: shot.side, x: from.x, y: from.y });
  }

  for (const ball of world.balls) stepBall(ball, dt, g);
  for (const ball of world.balls) {
    if (ball.z <= 0) world.events.push({ type: 'splash', x: ball.x, y: ball.y });
  }
  world.balls = world.balls.filter((b) => b.z > 0 && b.ageSeconds < g.maxBallSeconds);
}
