// Three kinds of ammunition (plan 4.5, M3 step 4):
//   round shot: the full range, holes in the hull, a few men
//   chain shot: 60% of the range, a wider spread, tears the sails (stops a ship that runs)
//   grape shot: 30% of the range, 8 small balls per gun, kills men on deck, no harm to the hull
// The numbers live in data/ammo.json. Round shot is not counted yet (it is bought in port in M5);
// chain and grape are counted in broadsides and refilled in port.

import { AMMO, GUNS } from './data';
import type { AmmoParams, AmmoType, GunParams, ShipState } from './types';

export function ammoOf(ship: ShipState): AmmoType {
  return ship.ammo ?? 'round';
}

export function ammoParams(type: AmmoType): AmmoParams {
  return AMMO.types[type];
}

/**
 * The gun numbers for this ammunition: a lighter or looser charge flies slower.
 * Range grows with the square of the muzzle speed, so speed x sqrt(rangeShare) gives rangeShare of the range.
 */
export function ammoGuns(type: AmmoType, g: GunParams = GUNS): GunParams {
  const share = ammoParams(type).rangeShare;
  return share === 1 ? g : { ...g, muzzleSpeed: g.muzzleSpeed * Math.sqrt(share) };
}

/** Broadsides of this kind left; Infinity for round shot (not counted yet). */
export function ammoLeftOf(ship: ShipState, type: AmmoType): number {
  if (type === 'round') return Infinity;
  return ship.ammoLeft?.[type] ?? AMMO.startBroadsides[type];
}

/** Use one broadside of this kind. */
export function spendAmmo(ship: ShipState, type: AmmoType): void {
  if (type === 'round') return;
  const left = { chain: ammoLeftOf(ship, 'chain'), grape: ammoLeftOf(ship, 'grape') };
  left[type] = Math.max(0, left[type] - 1);
  ship.ammoLeft = left;
}

/** The kind the next broadside really gets: the chosen one if any is left, else round shot. */
export function loadableAmmo(ship: ShipState): AmmoType {
  const want = ammoOf(ship);
  return ammoLeftOf(ship, want) > 0 ? want : 'round';
}

/** A port refills the chain and grape shot (free until there is gold, M5). */
export function refillAmmo(ship: ShipState): boolean {
  if (ammoLeftOf(ship, 'chain') >= AMMO.startBroadsides.chain && ammoLeftOf(ship, 'grape') >= AMMO.startBroadsides.grape) return false;
  delete ship.ammoLeft;
  return true;
}
