// M4b step 3: what the viewer's screen shows of the other ships. The screen draws a ship only as far as the
// viewer's ship knows it (its contact list, sim/perception.ts): a ship out of sight is not drawn at all (an
// island hides it, or it is too far), one at the edge of sight is only a dark dot, and from the silhouette level
// on it is drawn. The arena observer sees everything, or (step 4) only what the watched bot sees. Step 5a: the bars
// and the gun smoke follow the same lists (rough hull at 200-450 m, a shot reveals the shooter), fog shrinks it all.
import { ISLANDS, SHIP_CLASSES } from '../sim/data';
import { fogBetween, fogVisibility } from '../sim/fog';
import { lineOfSightClear, maxSightM, SIGHT } from '../sim/perception';
import type { Island, SightLevel, World } from '../sim/types';

/** M4b step 4: does the screen show every ship? In a battle never (your ship's eyes); in the arena unless "bot's eyes" is on. */
export function observerSeesAll(arena: boolean, botEyes: boolean): boolean {
  return arena && !botEyes;
}

export interface Known {
  /** Draw the ship itself. */
  shown: boolean;
  /** Draw only a dot (something is there, level 1). */
  dot: boolean;
  /** The sight level now (0 = not in view; 4 for the viewer itself and for "see all"). Flag and WANTED from 3. */
  level: 0 | SightLevel;
  /**
   * M4b step 5a, the bars: 0 = nothing, 1 = one rough hull bar (in quarters, roughHull; within hullGlimpseM, less in
   * fog), 2 = hull, sails and crew (level 4). The same rule the bots' lists follow (sim/perception.ts).
   */
  detail: 0 | 1 | 2;
}

const ALL: Known = { shown: true, dot: false, level: 4, detail: 2 };
const NONE: Known = { shown: false, dot: false, level: 0, detail: 0 };

/**
 * `known[i]` belongs to `world.ships[i]`. The viewer's own ship is always shown; a wreck is shown while it is within
 * the longest sight and no land is in the way (its picture melts away on its own, view/wreck.ts); any other ship by
 * its contact: seen now at level 2 or better = shown, at level 1 = a dot, otherwise nothing.
 */
export function knownShips(world: World, viewerId: number, seeAll: boolean, islands: readonly Island[] = ISLANDS): Known[] {
  const viewer = world.ships.find((s) => s.id === viewerId);
  const vParams = viewer ? SHIP_CLASSES[viewer.shipClass] : undefined;
  const contacts = world.sight?.find((s) => s.shipId === viewerId)?.contacts;
  return world.ships.map((ship) => {
    if (seeAll || ship.id === viewerId || !world.sight) return ALL;
    if (ship.sunk) {
      const params = SHIP_CLASSES[ship.shipClass];
      const near = !!viewer && Math.hypot(ship.x - viewer.x, ship.y - viewer.y) <= maxSightM();
      const clear = near && !!vParams && !!params && lineOfSightClear(viewer!, vParams, ship, params, islands);
      return clear ? { shown: true, dot: false, level: 0, detail: 0 } : NONE;
    }
    const contact = contacts?.find((c) => c.id === ship.id);
    if (!contact?.visible) return NONE;
    if (contact.levelNow < 2) return { shown: false, dot: true, level: contact.levelNow, detail: 0 };
    const distance = viewer ? Math.hypot(ship.x - viewer.x, ship.y - viewer.y) : Infinity;
    const vis = viewer ? fogVisibility(fogBetween(world.fog, world.wind, viewer.x, viewer.y, ship.x, ship.y)) : 1;
    const detail = contact.levelNow >= 4 ? 2 : distance <= SIGHT.hullGlimpseM * vis ? 1 : 0;
    return { shown: true, dot: false, level: contact.levelNow, detail };
  });
}

/**
 * M4b step 5a: may the screen show this ship's gun smoke, flash and balls? Always for "see all", shore guns and a
 * ship the viewer knows (a shot gives the shooter away within revealM, sim/perception.ts noteGunfire); never for
 * one it cannot see or hear.
 */
export function shotSeen(known: readonly Known[], world: World, shooterId: number, seeAll: boolean): boolean {
  if (seeAll || shooterId < 0) return true;
  const i = world.ships.findIndex((s) => s.id === shooterId);
  const k = known[i];
  return !!k && (k.shown || k.dot);
}
