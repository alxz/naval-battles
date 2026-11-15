// Accuracy: skill plus luck (plan 4.4).
// Every broadside gets two kinds of random error:
//   - the salvo error: the ship's roll at the moment of firing; one number for the whole broadside,
//     in elevation only, so the whole salvo lands long or short together;
//   - the gun error: the gun crew and the gun itself; a new number for every ball,
//     in elevation and in direction.
// Both are "sigma" values in degrees: about 68% of the errors are smaller than sigma.

import { GUNS } from './data';
import type { GunParams, ShipState } from './types';

/** What the error depends on. Some parts do not exist in the game yet and stay at their neutral value. */
export interface AccuracyInputs {
  battleSkill: number; // captain's Battle skill, 0..10
  windStrength: number; // 0..1
  crewShortage: number; // 0 = full crew .. 1 = no crew (crew comes in M3; 0 for now)
  gunWear: number; // 0 = new guns .. 1 = worn out (M3; 0 for now)
  ammoSpread: number; // round shot 1.0 (other ammunition in M3)
}

/** sigma_gun = gunSigmaDeg x ammoSpread x (1.4 - 0.06 x Battle) x (1 + crewShortage) x (1 + 0.5 x gunWear) */
export function gunSigmaDeg(a: AccuracyInputs, g: GunParams = GUNS): number {
  return g.gunSigmaDeg * a.ammoSpread * (1.4 - 0.06 * a.battleSkill) * (1 + a.crewShortage) * (1 + 0.5 * a.gunWear);
}

/** sigma_salvo = salvoSigmaDeg x (1 + wind) x (1.2 - 0.04 x Battle) */
export function salvoSigmaDeg(a: AccuracyInputs, g: GunParams = GUNS): number {
  return g.salvoSigmaDeg * (1 + a.windStrength) * (1.2 - 0.04 * a.battleSkill);
}

/** The inputs for this ship now. Crew, wear and ammunition join in M3. */
export function accuracyInputs(ship: ShipState, windStrength: number): AccuracyInputs {
  return { battleSkill: ship.battleSkill, windStrength, crewShortage: 0, gunWear: 0, ammoSpread: 1 };
}
