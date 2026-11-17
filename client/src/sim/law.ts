// Port law (decision D40). A port is neutral ground, and it defends its peace:
//  - a ship MAY fire in a port's safe water, but an unlawful broadside costs the shooter a little
//    of its own hull and makes it an OFFENDER of that port;
//  - a ball that hits a law-abiding ship lying in safe water does only part of its damage, and
//    whoever fired it becomes an offender too, wherever he fired from;
//  - an offender has lost the port's protection: he takes full damage there, the port does not
//    repair him, anybody may fire at him, and the shore guns (sim/shore.ts) fire at him while he
//    is within the law range (leaveFactor x safeRange);
//  - he is pardoned after forgiveSeconds spent beyond that range (the clock starts again every
//    time he comes back inside).
// "Lawful" fire in safe water = an offender of this port is afloat within its law range
// (you are helping the port).

import { DAMAGE, SHIP_CLASSES } from './data';
import { PORTS } from './port';
import type { Port } from './port';
import type { DamageParams, ShipState, World } from './types';

/** How far from the anchorage the port's law reaches, metres (the shore guns fire up to here). */
export function lawRange(d: DamageParams = DAMAGE): number {
  return d.port.safeRange * d.port.law.leaveFactor;
}

/** The index of the port whose safe water holds this point (the nearest one), or -1. */
export function safePortIndex(x: number, y: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE, marginM = 0): number {
  let best = -1;
  let bestD = Infinity;
  ports.forEach((port, i) => {
    const distance = Math.hypot(port.x - x, port.y - y);
    if (distance <= d.port.safeRange + marginM && distance < bestD) {
      best = i;
      bestD = distance;
    }
  });
  return best;
}

/** Has this ship broken the peace of port number `port` (and not been pardoned yet)? */
export function isOffenderOf(ship: ShipState, port: number): boolean {
  return ship.offender !== undefined && ship.offender.port === port;
}

/** Does a port protect this ship now? (It lies in the port's safe water and has kept its peace.) */
export function protectedByPort(ship: ShipState, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): boolean {
  const i = safePortIndex(ship.x, ship.y, ports, d);
  return i >= 0 && !isOffenderOf(ship, i);
}

/** Is an offender of this port (not `except`) afloat within its law range? Then firing there is lawful. */
export function offenderNear(world: World, port: number, exceptId: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): boolean {
  const p = ports[port];
  if (!p) return false;
  return world.ships.some((s) => s.id !== exceptId && !s.sunk && isOffenderOf(s, port) && Math.hypot(s.x - p.x, s.y - p.y) <= lawRange(d));
}

/** Mark a ship as an offender of a port (or start its waiting time again). */
export function makeOffender(world: World, ship: ShipState, port: number, reason: 'fired' | 'hit', d: DamageParams = DAMAGE): void {
  if (ship.sunk) return;
  const already = isOffenderOf(ship, port);
  ship.offender = { port, forgiveLeft: d.port.law.forgiveSeconds };
  if (!already) world.events.push({ type: 'offender', shipId: ship.id, port, reason });
}

/**
 * The fire rule. Call it when a ship has really fired a broadside.
 * In safe water, with no offender to shoot at: the shooter pays shooterHullShare of its full
 * hull (the price never sinks it: at least 1 hull point stays) and becomes an offender.
 * Returns the hull points it paid (0 = a lawful broadside).
 */
export function onBroadsideFired(world: World, ship: ShipState, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): number {
  const port = safePortIndex(ship.x, ship.y, ports, d);
  if (port < 0 || offenderNear(world, port, ship.id, ports, d)) return 0;
  const full = SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 0;
  const price = Math.max(0, Math.min(full * d.port.law.shooterHullShare, ship.hull - 1));
  ship.hull -= price;
  makeOffender(world, ship, port, 'fired', d);
  return price;
}

/**
 * The hit rule. A ball of `shooter` (undefined = a shore gun or a ship that is gone) has hit
 * `target`: how many hull points does it really take off? A law-abiding target in safe water
 * takes only damageFactor of it, and the shooter becomes an offender of that port.
 */
export function ballDamage(world: World, target: ShipState, shooter: ShipState | undefined, amount: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): number {
  const port = safePortIndex(target.x, target.y, ports, d);
  if (port < 0 || isOffenderOf(target, port)) return amount;
  if (shooter) makeOffender(world, shooter, port, 'hit', d);
  return amount * d.port.law.damageFactor;
}

/** One step of the law: pardon the offenders that have stayed away long enough. */
export function stepLaw(world: World, dt: number, ports: readonly Port[] = PORTS, d: DamageParams = DAMAGE): void {
  for (const ship of world.ships) {
    const o = ship.offender;
    if (!o) continue;
    const port = ports[o.port];
    if (ship.sunk || !port) {
      ship.offender = undefined; // the sea has settled the account
      continue;
    }
    if (Math.hypot(ship.x - port.x, ship.y - port.y) <= lawRange(d)) {
      o.forgiveLeft = d.port.law.forgiveSeconds; // still (or again) inside: the clock starts anew
      continue;
    }
    o.forgiveLeft -= dt;
    if (o.forgiveLeft <= 0) {
      ship.offender = undefined;
      world.events.push({ type: 'pardoned', shipId: ship.id, port: o.port });
    }
  }
}
