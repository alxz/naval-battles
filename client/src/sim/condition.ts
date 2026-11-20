// The state of a ship besides its hull (M3 step 4, plan 4.6): sails and crew.
// The fields on ShipState may be absent (a new ship, an old save): absent means "as good as new".
// Every rule reads them through these functions, so the default lives in one place.

import { DAMAGE, GUNS, SHIP_CLASSES } from './data';
import type { DamageParams, GunParams, ShipParams, ShipState } from './types';

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
 * A short-handed ship sails slower, but only a little while she has her sailing crew
 * (M3 step 7a, your idea: a small crew can keep the sails set; it is turning, tacking and
 * trimming that need many hands):
 *   with sailCrew or more aboard:  1 - crew.speedLossFull x (share of the crew lost)   (0.95..1)
 *   below sailCrew:                a straight line down to crew.speedMinFactor with nobody left
 * Before 7a the speed fell straight from 1 to 0.7 with the whole crew, so a sloop that lost
 * its fighting men to grape also lost its speed.
 */
export function crewSpeedFactor(ship: ShipState, d: DamageParams = DAMAGE): number {
  const params = paramsOf(ship);
  const full = params?.crew ?? 0;
  if (full <= 0) return 1;
  const hands = crewOf(ship);
  const sail = Math.min(params?.sailCrew ?? full, full);
  const loss = d.crew.speedLossFull;
  if (hands >= sail) return 1 - loss * (1 - Math.min(1, hands / full));
  const atSailCrew = 1 - loss * (1 - sail / full);
  return d.crew.speedMinFactor + (atSailCrew - d.crew.speedMinFactor) * (sail > 0 ? hands / sail : 0);
}

/** M3 step 4b: a short-handed ship turns slower: from 1 (full crew) to crew.turnMinFactor (nobody left). */
export function crewTurnFactor(ship: ShipState, d: DamageParams = DAMAGE): number {
  return d.crew.turnMinFactor + (1 - d.crew.turnMinFactor) * crewShare(ship);
}

/**
 * M3 step 7a: ... and gathers way and loses it slower: her speed time constant is multiplied by
 * 1 + crew.accelSlowdown x (share of the crew lost). (Full crew 1, half 1.5, nobody 2.)
 */
export function crewAccelFactor(ship: ShipState, d: DamageParams = DAMAGE): number {
  return 1 + d.crew.accelSlowdown * (1 - crewShare(ship));
}

/**
 * M3 step 7a: how many men one ball kills, for each man guns.crewKill says: the deck's crowding
 * (men aboard per metre of hull, against crew.crowdPerMetre) times, for grape, the cover of the
 * sides (crew.grapeCoverHeightM / hullHeight, at most 1). A sloop full of men: about 1.
 * A fluyt with 18 men: about 0.17; the high-sided caravel takes grape at 0.4 of a sloop's losses.
 */
export function crewExposure(ship: ShipState, params: ShipParams, ammo: string, d: DamageParams = DAMAGE): number {
  const crowd = Math.min(2, crewOf(ship) / Math.max(1, params.length * d.crew.crowdPerMetre));
  const cover = ammo === 'grape' ? Math.min(1, d.crew.grapeCoverHeightM / Math.max(0.1, params.hullHeight)) : 1;
  return crowd * cover;
}

/** M3 step 7a: a full hold slows a trader: 1 - ladenSlowdown x cargo (1 for an empty hold or a warship). */
export function cargoSpeedFactor(ship: ShipState): number {
  return 1 - (paramsOf(ship)?.ladenSlowdown ?? 0) * Math.min(1, Math.max(0, ship.cargo ?? 0));
}

/** M3 step 7a: how full a trader's hold is when she comes to sea, for a random number r in 0..1; undefined for a warship. */
export function rollCargo(params: ShipParams, r: number): number | undefined {
  if (params.cargoMax === undefined) return undefined;
  const lo = params.cargoMin ?? 0;
  return lo + (params.cargoMax - lo) * Math.min(1, Math.max(0, r));
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
  delete ship.cargo; // a new ship comes with a new load (the arena rolls it again)
  delete ship.reloadStern;
  delete ship.reloadBow;
}
