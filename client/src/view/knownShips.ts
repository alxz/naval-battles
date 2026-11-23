// M4b step 3: what the viewer's screen shows of the other ships. The screen draws a ship only as far as the
// viewer's ship knows it (its contact list, sim/perception.ts): a ship out of sight is not drawn at all (an
// island hides it, or it is too far), one at the edge of sight is only a dark dot, and from the silhouette level
// on it is drawn. The arena observer sees everything (until the "what the watched bot sees" switch of step 4).
import { maxSightM } from '../sim/perception';
import type { World } from '../sim/types';

export interface Known {
  /** Draw the ship itself. */
  shown: boolean;
  /** Draw only a dot (something is there, level 1). */
  dot: boolean;
}

/**
 * `known[i]` belongs to `world.ships[i]`. The viewer's own ship is always shown; a wreck is shown while it is within
 * the longest sight (its picture melts away on its own, view/wreck.ts); any other ship by its contact: seen now at
 * level 2 or better = shown, at level 1 = a dot, otherwise nothing.
 */
export function knownShips(world: World, viewerId: number, seeAll: boolean): Known[] {
  const viewer = world.ships.find((s) => s.id === viewerId);
  return world.ships.map((ship) => {
    if (seeAll || ship.id === viewerId || !world.sight) return { shown: true, dot: false };
    if (ship.sunk) return { shown: !!viewer && Math.hypot(ship.x - viewer.x, ship.y - viewer.y) <= maxSightM(), dot: false };
    const contact = world.sight.find((s) => s.shipId === viewerId)?.contacts.find((c) => c.id === ship.id);
    if (!contact?.visible) return { shown: false, dot: false };
    return contact.levelNow >= 2 ? { shown: true, dot: false } : { shown: false, dot: true };
  });
}
