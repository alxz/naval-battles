// The shore guns of a port (port law, D40): a gun owner that is not a ship.
// Each port has a few guns on the shore (their places come from make_islands.py). They fire only
// at offenders of their own port (sim/law.ts) that are within the law range, one gun after
// another. They do not cheat: the gunners see only where the ship is and how it moves, the ball
// flies by the same steps as every ball, and it gets the same kind of random errors
// (the gun's spread, and the gunners' misjudgement of the elevation).

import { gunSigmaDeg } from './accuracy';
import { degToRad } from './angles';
import { DAMAGE, GUNS, SHORE } from './data';
import { stepBall } from './guns';
import { isOffenderOf, lawRange } from './law';
import { PORTS } from './port';
import { firedLately, levelForMasts, SIGHT } from './perception';
import { fogBetween, fogVisibility } from './fog';
import type { Port } from './port';
import { nextGaussian } from './random';
import type { Ball, DamageParams, GunParams, ShipState, ShoreBattery, ShoreParams, World } from './types';

/** Balls of a shore gun carry this "ship id": -1 for port 0, -2 for port 1, ... (never a real ship). */
export function shoreOwnerId(port: number): number {
  return -(port + 1);
}

/** The port a ball owner id stands for, or -1 if it is a ship's id. */
export function shorePortOf(ownerId: number): number {
  return ownerId < 0 ? -ownerId - 1 : -1;
}

/** A ball leaving a shore gun at `from`, flying toward `bearingRad`, the barrel raised by `elevationDeg`. */
export function launchShoreBall(port: number, from: { x: number; y: number }, bearingRad: number, elevationDeg: number, p: ShoreParams = SHORE): Ball {
  const elev = degToRad(elevationDeg);
  const horizontal = p.muzzleSpeed * Math.cos(elev);
  return {
    id: 0,
    shipId: shoreOwnerId(port),
    x: from.x,
    y: from.y,
    z: p.gunHeight,
    vx: Math.cos(bearingRad) * horizontal,
    vy: Math.sin(bearingRad) * horizontal,
    vz: p.muzzleSpeed * Math.sin(elev),
    ageSeconds: 0,
    damage: p.damage,
  };
}

/** How far a shore ball flies at this elevation before it meets the water, and how long it takes. Same steps as the game. */
export function shoreFlight(elevationDeg: number, dt: number, p: ShoreParams = SHORE, g: GunParams = GUNS): { range: number; seconds: number } {
  const ball = launchShoreBall(0, { x: 0, y: 0 }, 0, elevationDeg, p);
  while (ball.z > 0 && ball.ageSeconds < g.maxBallSeconds) stepBall(ball, dt, g);
  return { range: ball.x, seconds: ball.ageSeconds };
}

/**
 * The elevation that lands a ball `distance` metres away, or null if that is beyond the guns.
 * Found by halving: the range grows with the elevation (up to 45 degrees; these guns stop far below).
 */
export function shoreElevation(distance: number, dt: number, p: ShoreParams = SHORE, g: GunParams = GUNS): { elevationDeg: number; seconds: number } | null {
  if (distance > shoreFlight(p.maxElevationDeg, dt, p, g).range) return null;
  let lo = p.minElevationDeg;
  let hi = p.maxElevationDeg;
  if (distance <= shoreFlight(lo, dt, p, g).range) return { elevationDeg: lo, seconds: shoreFlight(lo, dt, p, g).seconds };
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (shoreFlight(mid, dt, p, g).range < distance) lo = mid;
    else hi = mid;
  }
  const elevationDeg = (lo + hi) / 2;
  return { elevationDeg, seconds: shoreFlight(elevationDeg, dt, p, g).seconds };
}

/**
 * Where to point a gun at `from` to hit a moving ship: aim at the place the ship will have
 * reached when the ball comes down (three rounds: the flight time depends on the distance,
 * and the distance on the flight time). Null if it is out of reach.
 */
export function shoreAim(from: { x: number; y: number }, target: ShipState, dt: number, p: ShoreParams = SHORE, g: GunParams = GUNS): { bearingRad: number; elevationDeg: number } | null {
  let aim = { x: target.x, y: target.y };
  let solution: { elevationDeg: number; seconds: number } | null = null;
  for (let i = 0; i < 3; i++) {
    solution = shoreElevation(Math.hypot(aim.x - from.x, aim.y - from.y), dt, p, g);
    if (!solution) return null;
    aim = {
      x: target.x + Math.cos(target.headingRad) * target.speed * solution.seconds,
      y: target.y + Math.sin(target.headingRad) * target.speed * solution.seconds,
    };
  }
  return solution ? { bearingRad: Math.atan2(aim.y - from.y, aim.x - from.x), elevationDeg: solution.elevationDeg } : null;
}

/**
 * M4b step 5c (D72): the gunners have eyes like every ship, no more. A ship is seen from the port when it is at least a
 * silhouette (level 2) at that distance, with the fog on the line shrinking the range; or when it fired lately
 * (its shot is heard, as for ships). Unseen, it is not shot at. The lookout stands at the mast height of the reference ship.
 */
export function portSees(world: World, port: Port, ship: ShipState): boolean {
  if (firedLately(world, ship.id) && Math.hypot(ship.x - port.x, ship.y - port.y) <= SIGHT.revealM) return true;
  const vis = fogVisibility(fogBetween(world.fog, world.wind, port.x, port.y, ship.x, ship.y));
  const level = levelForMasts(Math.hypot(ship.x - port.x, ship.y - port.y), 1, vis, SIGHT);
  return level >= 2;
}

/** The offender this port's guns fire at: the one nearest the anchorage, afloat, within the law range, and seen from the port. */
export function shoreTarget(world: World, port: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): ShipState | null {
  const p = ports[port];
  if (!p) return null;
  let best: ShipState | null = null;
  let bestD = lawRange(d);
  for (const ship of world.ships) {
    if (ship.sunk || !isOffenderOf(ship, port) || !portSees(world, p, ship)) continue;
    const distance = Math.hypot(ship.x - p.x, ship.y - p.y);
    if (distance <= bestD) {
      best = ship;
      bestD = distance;
    }
  }
  return best;
}

function newBattery(port: number, guns: number): ShoreBattery {
  return { port, reloads: Array.from({ length: guns }, () => 0), gapLeft: 0, aimErrorDeg: 0 };
}

/**
 * One step for every shore battery: the guns reload; if an offender is within the law range,
 * the next loaded gun that can reach him fires (one gun every reloadSeconds / guns).
 */
export function stepShore(world: World, dt: number, ports: readonly Port[] = PORTS, p: ShoreParams = SHORE, d: DamageParams = DAMAGE, g: GunParams = GUNS): void {
  if (!world.shore || world.shore.length !== ports.length) world.shore = ports.map((port, i) => newBattery(i, port.guns?.length ?? 0));
  for (const battery of world.shore) {
    const guns = ports[battery.port]?.guns ?? [];
    battery.gapLeft = Math.max(0, battery.gapLeft - dt);
    for (let i = 0; i < battery.reloads.length; i++) battery.reloads[i] = Math.max(0, (battery.reloads[i] ?? 0) - dt);
    if (guns.length === 0 || battery.gapLeft > 0 || world.tick % p.thinkEveryTicks !== 0) continue;
    const target = shoreTarget(world, battery.port, ports, d);
    if (!target) continue;
    for (let i = 0; i < guns.length; i++) {
      const from = guns[i];
      if (!from || (battery.reloads[i] ?? 0) > 0) continue;
      const aim = shoreAim(from, target, dt, p, g);
      if (!aim) continue; // this gun cannot reach him; perhaps another can
      // The same spread formula as a ship's gun (no roll: the gun stands on firm ground).
      const sigma = gunSigmaDeg({ battleSkill: p.battleSkill, windStrength: world.wind.strength, crewShortage: 0, gunWear: 0, ammoSpread: 1 }, { ...g, gunSigmaDeg: p.gunSigmaDeg });
      const elevation = aim.elevationDeg + battery.aimErrorDeg + nextGaussian(world) * sigma;
      const bearing = aim.bearingRad + degToRad(nextGaussian(world) * sigma);
      const ball = launchShoreBall(battery.port, from, bearing, elevation, p);
      ball.id = world.nextBallId++;
      world.balls.push(ball);
      world.events.push({ type: 'shoreFired', port: battery.port, x: from.x, y: from.y });
      battery.reloads[i] = p.reloadSeconds;
      battery.gapLeft = p.reloadSeconds / guns.length;
      battery.aimErrorDeg = nextGaussian(world) * p.aimErrorSigmaDeg; // a new misjudgement for the next shot
      break;
    }
  }
}
