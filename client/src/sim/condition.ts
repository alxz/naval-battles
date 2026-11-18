// The state of a ship besides its hull (M3 step 4, plan 4.6): sails and crew.
// The fields on ShipState may be absent (a new ship, an old save): absent means "as good as new".
// Every rule reads them through these functions, so the default lives in one place.

import { GUNS, SHIP_CLASSES } from './data';
import type { GunParams, ShipParams, ShipState } from './types';

function paramsOf(ship: ShipState): ShipParams | undefined {
  return SHIP_CLASSES[ship.shipClass];
}

/** Sail points left. */
export function sailsOf(ship: ShipState): number {
  return ship.sails ?? paramsOf(ship)?.sailPoints ?? 0;
}

/** Sail condition 0..1 (plan 4.3: it multiplies the speed). */
export function sailShare(ship: ShipState): number {
  const full = paramsOf(ship)?.sailPoints ?? 0;
  return full > 0 ? Math.min(1, sailsOf(ship) / full) : 1;
}

/** Sailors left. */
export function crewOf(ship: ShipState): number {
  return ship.crew ?? paramsOf(ship)?.crew ?? 0;
}

/** Crew 0..1 of a full crew. */
export function crewShare(ship: ShipState): number {
  const full = paramsOf(ship)?.crew ?? 0;
  return full > 0 ? Math.min(1, crewOf(ship) / full) : 1;
}

/** Plan 4.4: crewShortage 0 (full crew) .. 1 (nobody left). It widens the gun error. */
export function crewShortage(ship: ShipState): number {
  return 1 - crewShare(ship);
}

/**
 * Plan 4.3: target speed x (0.2 + 0.8 x sail condition). With every sail shot away a ship
 * still drifts at a fifth of its speed (the crew sets whatever canvas is left).
 */
export function sailSpeedFactor(ship: ShipState): number {
  return 0.2 + 0.8 * sailShare(ship);
}

/**
 * Plan 4.4: reload = base x min(maxReloadFactor, full crew / crew). A ship that lost a third
 * of its men loads 1.5 times slower; with no one left the guns stay silent anyway.
 */
export function reloadFactor(ship: ShipState, g: GunParams = GUNS): number {
  const share = crewShare(ship);
  return share > 0 ? Math.min(g.maxReloadFactor, 1 / share) : g.maxReloadFactor;
}

/** Plan 4.4: every gun needs crewPerGun sailors; with fewer, fewer guns of a battery fire. */
export function gunsManned(ship: ShipState, params: ShipParams, g: GunParams = GUNS): number {
  return Math.min(params.gunsPerSide, Math.floor(crewOf(ship) / g.crewPerGun));
}

/** Take sail points off (a ball in the rigging). Never below 0. */
export function damageSails(ship: ShipState, amount: number): number {
  const before = sailsOf(ship);
  ship.sails = Math.max(0, before - Math.max(0, amount));
  return before - ship.sails;
}

/** Kill sailors (a ball through the hull). Whole men; never below 0. Returns how many fell. */
export function killCrew(ship: ShipState, men: number): number {
  const before = crewOf(ship);
  ship.crew = Math.max(0, before - Math.max(0, Math.round(men)));
  return before - ship.crew;
}

/** Back to new: full sails and crew, the starting ammunition (a placed ship, a respawn). */
export function refitShip(ship: ShipState): void {
  delete ship.sails;
  delete ship.crew;
  delete ship.ammo;
  delete ship.ammoLeft;
}
