// How a flying ball looks (M3 step 4b): the kind of shot shows by its colour,
// so you can see what the enemy is loading. Pure: no Phaser.

import type { AmmoType } from '../sim/types';

/** Texture keys made in scenes/Cannonballs.ts. */
export const BALL_TEXTURES: Readonly<Record<AmmoType, string>> = {
  round: 'ball', // black iron ball
  chain: 'ball-chain', // two brown half-balls on a chain, tumbling
  grape: 'ball-grape', // small red-and-black shot
};

/** The texture of a ball; an old ball without the field is round shot. */
export function ballTexture(ammo: AmmoType | undefined): string {
  return BALL_TEXTURES[ammo ?? 'round'];
}

/** Chain shot tumbles in flight: turns per second (0 = the picture does not spin). */
export function ballSpinTurnsPerSecond(ammo: AmmoType | undefined): number {
  return ammo === 'chain' ? 3 : 0;
}
