// The text for the loaded ammunition (pure: no Phaser). Computer: "CHAIN 5  (1 2 3)"; touch button: "CHN 5".

import { ammoLeftOf, ammoOf, ammoParams, loadableAmmo } from '../sim/ammo';
import { AMMO } from '../sim/data';
import type { AmmoType, ShipState } from '../sim/types';

const TINY: Record<AmmoType, string> = { round: 'RND', chain: 'CHN', grape: 'GRP' };

/** `touch`: the short form for the button. Round shot shows no count (it is not counted yet). */
export function ammoLabel(ship: ShipState, touch: boolean): string {
  const want = ammoOf(ship);
  const loaded = loadableAmmo(ship);
  const name = touch ? TINY[loaded] : ammoParams(loaded).short;
  const left = loaded === 'round' ? '' : ` ${ammoLeftOf(ship, loaded)}`;
  // The chosen kind ran out: say so, the guns load round shot instead.
  const out = want !== loaded ? (touch ? '!' : ` (no ${ammoParams(want).short.toLowerCase()})`) : '';
  return `${name}${left}${out}`;
}

/** The kind after this one, for the touch button (round -> chain -> grape -> round). */
export function nextAmmo(type: AmmoType): AmmoType {
  const order = AMMO.order;
  return order[(order.indexOf(type) + 1) % order.length] ?? 'round';
}
