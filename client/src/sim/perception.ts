// M4b (D41), step 1: what a ship can see. Every ship keeps a list of the ships it has seen; the list is
// updated 3 times a second. Here are only the rules and the lists: the bots and the screen start to use them
// in the next steps. No random numbers: the same world gives the same lists.
import sightJson from '../data/sight.json';
import { ISLANDS, SHIP_CLASSES } from './data';
import { terrainFor, ballBlocked } from './terrain';
import type { Contact, Island, ShipParams, ShipSight, ShipState, SightLevel, World } from './types';

export interface SightParams {
  updateEveryTicks: number;
  levels: { contactM: number; silhouetteM: number; flagM: number; detailM: number };
  referenceMastM: number;
  mastExponent: number;
  mastScaleMin: number;
  mastScaleMax: number;
  eyeShareOfMast: number;
  forgetSeconds: number;
}

export const SIGHT: SightParams = sightJson;

const STEP_SECONDS = 1 / 30; // (the world step; step.ts imports this module, so it is not imported back)

/** A tall ship is seen from further away (and sees further): range x (mast / reference mast)^exponent, kept within limits. */
export function mastScale(mastHeightM: number, p: SightParams = SIGHT): number {
  const raw = Math.pow(mastHeightM / p.referenceMastM, p.mastExponent);
  return Math.min(p.mastScaleMax, Math.max(p.mastScaleMin, raw));
}

/**
 * The best level of sight at this distance (0 = not seen). `visibility` is 1 by day in clear air; fog, night and
 * lanterns will change it in later steps of M4b (it shrinks every range).
 */
export function levelAt(distanceM: number, target: ShipParams, visibility = 1, p: SightParams = SIGHT): 0 | SightLevel {
  const k = mastScale(target.mastHeight, p) * visibility;
  if (distanceM <= p.levels.detailM * k) return 4;
  if (distanceM <= p.levels.flagM * k) return 3;
  if (distanceM <= p.levels.silhouetteM * k) return 2;
  if (distanceM <= p.levels.contactM * k) return 1;
  return 0;
}

/** The longest range at which anything can be seen (a quick cut-off before the land check). */
export function maxSightM(visibility = 1, p: SightParams = SIGHT): number {
  return p.levels.contactM * p.mastScaleMax * visibility;
}

/** Does the land block the line from the watcher's lookout to the target's masthead? (An island hides a ship.) */
export function lineOfSightClear(watcher: ShipState, wParams: ShipParams, target: ShipState, tParams: ShipParams, islands: readonly Island[] = ISLANDS, p: SightParams = SIGHT): boolean {
  const eye = wParams.mastHeight * p.eyeShareOfMast;
  const top = tParams.mastHeight;
  return !ballBlocked(terrainFor(islands), { x: watcher.x, y: watcher.y, z: eye }, { x: target.x, y: target.y, z: top });
}

export function sightOf(world: World, shipId: number): ShipSight | undefined {
  return world.sight?.find((s) => s.shipId === shipId);
}

/** What the watcher knows of the other ship (undefined = never seen, or forgotten). */
export function contactOf(world: World, watcherId: number, otherId: number): Contact | undefined {
  return sightOf(world, watcherId)?.contacts.find((c) => c.id === otherId);
}

/** The ships the watcher sees right now. */
export function visibleContacts(world: World, watcherId: number): Contact[] {
  return sightOf(world, watcherId)?.contacts.filter((c) => c.visible) ?? [];
}

/**
 * One update of everybody's lists. Runs on every `updateEveryTicks`-th tick. For each watcher (a ship that floats):
 * the ships in range with a clear line get a new or refreshed contact; the ones that were seen last time and are not
 * now become "last known place"; a contact not refreshed for `forgetSeconds` is dropped. Events: sighted (new, or a
 * better level), lostSight, forgotten.
 */
export function stepPerception(world: World, islands: readonly Island[] = ISLANDS, visibility = 1, p: SightParams = SIGHT): void {
  if (world.tick % p.updateEveryTicks !== 0) return;
  if (!world.sight) world.sight = [];
  const reach = maxSightM(visibility, p);
  const forgetTicks = Math.round(p.forgetSeconds / STEP_SECONDS);
  const alive = new Set(world.ships.filter((s) => !s.sunk).map((s) => s.id));
  world.sight = world.sight.filter((s) => alive.has(s.shipId)); // a sunk watcher sees nothing

  for (const watcher of world.ships) {
    if (watcher.sunk) continue;
    const wParams = SHIP_CLASSES[watcher.shipClass];
    if (!wParams) continue;
    let sight = world.sight.find((s) => s.shipId === watcher.id);
    if (!sight) {
      sight = { shipId: watcher.id, contacts: [] };
      world.sight.push(sight);
    }
    const seenNow = new Set<number>();
    for (const target of world.ships) {
      if (target.id === watcher.id || target.sunk) continue;
      const tParams = SHIP_CLASSES[target.shipClass];
      if (!tParams) continue;
      const distance = Math.hypot(target.x - watcher.x, target.y - watcher.y);
      if (distance > reach) continue;
      // The watcher's own height counts too: from a high deck a ship shows further, so use the larger of the two scales.
      const level = levelAt(distance, tParams, visibility * Math.max(1, mastScale(wParams.mastHeight, p)), p);
      if (level === 0 || !lineOfSightClear(watcher, wParams, target, tParams, islands, p)) continue;
      seenNow.add(target.id);
      let c = sight.contacts.find((q) => q.id === target.id);
      const first = !c;
      const better = !!c && level > c.level;
      if (!c) {
        c = { id: target.id, level, visible: true, x: target.x, y: target.y, seenTick: world.tick, firstTick: world.tick };
        sight.contacts.push(c);
      }
      const wasVisible = c.visible && !first;
      c.visible = true;
      c.seenTick = world.tick;
      c.x = target.x;
      c.y = target.y;
      if (level > c.level) c.level = level;
      if (level >= 2) {
        c.headingRad = target.headingRad;
        c.speed = target.speed;
        c.shipClass = target.shipClass;
      }
      if (level >= 3 && target.nation) c.nation = target.nation;
      if (level >= 4) c.hullShare = Math.max(0, Math.min(1, target.hull / tParams.hullPoints));
      if (first || better || !wasVisible) world.events.push({ type: 'sighted', shipId: watcher.id, otherId: target.id, level: c.level, distance: Math.round(distance), first });
    }
    // Not seen now: remember the last place, then forget.
    for (const c of [...sight.contacts]) {
      if (seenNow.has(c.id)) continue;
      const gone = !alive.has(c.id);
      if (c.visible) {
        c.visible = false;
        if (!gone) world.events.push({ type: 'lostSight', shipId: watcher.id, otherId: c.id, x: Math.round(c.x), y: Math.round(c.y) });
      }
      if (gone || world.tick - c.seenTick >= forgetTicks) {
        sight.contacts.splice(sight.contacts.indexOf(c), 1);
        world.events.push({ type: 'forgotten', shipId: watcher.id, otherId: c.id, x: Math.round(c.x), y: Math.round(c.y) });
      }
    }
  }
}
