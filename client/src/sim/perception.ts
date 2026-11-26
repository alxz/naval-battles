// M4b (D41), step 1: what a ship can see. Every ship keeps a list of the ships it has seen; the list is
// updated 3 times a second. Here are only the rules and the lists: the bots and the screen start to use them
// in the next steps. No random numbers: the same world gives the same lists.
import { shownNation } from './nation';
import { RENEGADE } from './renegade';
import sightJson from '../data/sight.json';
import { ISLANDS, SHIP_CLASSES } from './data';
import { terrainFor, ballBlocked } from './terrain';
import { fogBetween, fogVisibility } from './fog';
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
  keepFactor: number; // M4b step 5a: a ship in view is lost only beyond this share of its range (no blinking)
  revealM: number; // M4b step 5a: a ship that fires is heard and its smoke seen this far, through fog and over land
  revealSeconds: number; // ... for this long after its last shot
  hullGlimpseM: number; // M4b step 5a: within this range the hull is seen roughly (the screen's one overall bar)
  hullGlimpseSteps: number; // ... in this many steps (4 = quarters)
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
  return levelForMasts(distanceM, mastScale(target.mastHeight, p), visibility, p);
}

/**
 * Review 22 Nov (D69): the masts help only over the horizon (levels 1 and 2: something there, the silhouette).
 * The flag and the deck are seen with the eyes at fixed ranges (400 / 200 m, times the visibility), the same
 * numbers the screen uses (D68), whatever the masts. `mastK` is the masts' factor (mastScale, at most mastScaleMax).
 */
export function levelForMasts(distanceM: number, mastK: number, visibility = 1, p: SightParams = SIGHT): 0 | SightLevel {
  if (distanceM <= p.levels.detailM * visibility) return 4;
  if (distanceM <= p.levels.flagM * visibility) return 3;
  const k = Math.min(p.mastScaleMax, mastK) * visibility;
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
    const hiddenByLand = new Set<number>(); // M4b step 4: in range, but an island is in the way (for the log)
    for (const target of world.ships) {
      if (target.id === watcher.id || target.sunk) continue;
      const tParams = SHIP_CLASSES[target.shipClass];
      if (!tParams) continue;
      const distance = Math.hypot(target.x - watcher.x, target.y - watcher.y);
      if (distance > reach) continue;
      // M4b step 5a: fog on the line between the two (or around either) shrinks every range.
      const vis = visibility * fogVisibility(fogBetween(world.fog, world.wind, watcher.x, watcher.y, target.x, target.y));
      // The watcher's own height counts too (a lookout high up sees over a longer horizon), within mastScaleMax (D69).
      const mastK = mastScale(tParams.mastHeight, p) * Math.max(1, mastScale(wParams.mastHeight, p));
      let level: 0 | SightLevel = levelForMasts(distance, mastK, vis, p);
      // M4b step 5a: a ship in view is kept a little longer (keepFactor) before it is lost, so a ship at the edge of
      // sight or of a fog bank does not blink in and out of view three times a second.
      if (level === 0 && sight.contacts.some((q) => q.id === target.id && q.visible) && levelForMasts(distance, mastK, vis * p.keepFactor, p) > 0) level = 1;
      if (level > 0 && !lineOfSightClear(watcher, wParams, target, tParams, islands, p)) {
        hiddenByLand.add(target.id);
        level = 0;
      }
      // M4b step 5a: a ship that fired lately is heard, and its smoke seen, through fog and over land: level 1.
      const heard = level === 0 && distance <= p.revealM && firedLately(world, target.id);
      if (heard) level = 1;
      if (level === 0) continue;
      seenNow.add(target.id);
      let c = sight.contacts.find((q) => q.id === target.id);
      const first = !c;
      const better = !!c && level > c.level;
      if (!c) {
        c = { id: target.id, level, levelNow: level, visible: true, x: target.x, y: target.y, seenTick: world.tick, firstTick: world.tick };
        sight.contacts.push(c);
      }
      const wasVisible = c.visible && !first;
      c.visible = true;
      c.seenTick = world.tick;
      c.x = target.x;
      c.y = target.y;
      if (level > c.level) c.level = level;
      c.levelNow = level;
      if (level >= 2) {
        c.headingRad = target.headingRad;
        c.speed = target.speed;
        c.shipClass = target.shipClass;
      }
      if (level >= 3 && target.nation) {
        // M4b 5b-2 (D82): a pirate under a false flag shows it from afar; once seen black, it is known as a pirate.
        const shown = shownNation(target, distance, RENEGADE.hoistM);
        if (c.nation !== 'pirates' || shown === 'pirates') c.nation = shown;
      }
      const share = Math.max(0, Math.min(1, target.hull / tParams.hullPoints));
      if (level >= 4) c.hullShare = share;
      else if (level >= 2 && distance <= p.hullGlimpseM * vis) c.hullShare = roughHull(share, p); // M4b step 5a: the overall look of the ship
      if (first || better || !wasVisible) world.events.push({ type: 'sighted', shipId: watcher.id, otherId: target.id, level: c.level, distance: Math.round(distance), first, again: !first && !wasVisible, levelNow: level, ...(heard ? { heard: true } : {}) });
    }
    // Not seen now: remember the last place, then forget.
    for (const c of [...sight.contacts]) {
      if (seenNow.has(c.id)) continue;
      const gone = !alive.has(c.id);
      const sawIt = c.visible; // in view at the last update: the watcher saw it go down
      if (c.visible) {
        c.visible = false;
        if (!gone) {
          const distance = Math.round(Math.hypot(c.x - watcher.x, c.y - watcher.y));
          world.events.push({ type: 'lostSight', shipId: watcher.id, otherId: c.id, x: Math.round(c.x), y: Math.round(c.y), distance, why: hiddenByLand.has(c.id) ? 'land' : 'range' });
        }
      }
      if ((gone && sawIt) || world.tick - c.seenTick >= forgetTicks) {
        sight.contacts.splice(sight.contacts.indexOf(c), 1);
        world.events.push({ type: 'forgotten', shipId: watcher.id, otherId: c.id, x: Math.round(c.x), y: Math.round(c.y) });
      }
    }
  }
}

/** M4b step 5a: the hull as it looks from 200-450 m: rounded up to quarters (a ship afloat never looks like 0). */
export function roughHull(share: number, p: SightParams = SIGHT): number {
  const n = Math.max(1, p.hullGlimpseSteps);
  return Math.min(1, Math.max(0, Math.ceil(share * n - 1e-9)) / n);
}

/** Has this ship fired within revealSeconds? (world.gunfire, kept by noteGunfire) */
export function firedLately(world: World, shipId: number): boolean {
  return !!world.gunfire?.some((g) => g.shipId === shipId && g.untilTick > world.tick);
}

/**
 * M4b step 5a: a shot gives the shooter away. Called every step after the guns: each ship that fired is marked for
 * revealSeconds, and every ship within revealM that did not have it in view gets it at once as "something there"
 * (level 1, its place), so a bot can turn toward the gunfire and the screen may show the smoke. The 3-a-second
 * update (stepPerception) keeps it in view while the mark lasts.
 */
export function noteGunfire(world: World, p: SightParams = SIGHT): void {
  const shooters = new Set<number>();
  for (const e of world.events) if (e.type === 'gunFired') shooters.add(e.shipId);
  if (world.gunfire) world.gunfire = world.gunfire.filter((g) => g.untilTick > world.tick);
  if (shooters.size === 0) return;
  const until = world.tick + Math.round(p.revealSeconds / STEP_SECONDS);
  world.gunfire ??= [];
  for (const id of shooters) {
    const mark = world.gunfire.find((g) => g.shipId === id);
    if (mark) mark.untilTick = until;
    else world.gunfire.push({ shipId: id, untilTick: until });
    const shooter = world.ships.find((s) => s.id === id);
    if (!shooter || shooter.sunk || !world.sight) continue;
    for (const watcher of world.ships) {
      if (watcher.id === id || watcher.sunk) continue;
      const distance = Math.hypot(shooter.x - watcher.x, shooter.y - watcher.y);
      if (distance > p.revealM) continue;
      let sight = world.sight.find((s) => s.shipId === watcher.id);
      if (!sight) {
        sight = { shipId: watcher.id, contacts: [] };
        world.sight.push(sight);
      }
      let c = sight.contacts.find((q) => q.id === id);
      if (c?.visible) continue;
      const first = !c;
      if (!c) {
        c = { id, level: 1, levelNow: 1, visible: true, x: shooter.x, y: shooter.y, seenTick: world.tick, firstTick: world.tick };
        sight.contacts.push(c);
      }
      c.visible = true;
      c.levelNow = 1;
      c.seenTick = world.tick;
      c.x = shooter.x;
      c.y = shooter.y;
      world.events.push({ type: 'sighted', shipId: watcher.id, otherId: id, level: c.level, distance: Math.round(distance), first, again: !first, levelNow: 1, heard: true });
    }
  }
}

/** Review 22 Nov (D69): drop a contact (a bot searched its last known place and found nothing there). */
export function forgetContact(world: World, watcherId: number, otherId: number): void {
  const sight = sightOf(world, watcherId);
  const c = sight?.contacts.find((q) => q.id === otherId);
  if (!sight || !c || c.visible) return;
  sight.contacts.splice(sight.contacts.indexOf(c), 1);
  world.events.push({ type: 'forgotten', shipId: watcherId, otherId, x: Math.round(c.x), y: Math.round(c.y) });
}

/**
 * M4b step 2: the other ship as the watcher believes it to be: a ShipState built from its contact, for the bot's
 * decisions. A ship in view is taken live (the latest place, course and speed, as far as the level allows: the
 * course and speed from the silhouette level, the hull and crew only from close by); a ship out of view stays
 * at the last known place and is taken as not moving. What the watcher cannot know is filled in as "as good as
 * new". `undefined` = no contact (never seen, or forgotten). With no lists in the world at all (perception has
 * not run yet, or a unit test of the old rules) the real ship is returned.
 */
export function believedShip(world: World, watcherId: number, otherId: number, fallbackClass: string): ShipState | undefined {
  const real = world.ships.find((s) => s.id === otherId);
  if (!world.sight) return real;
  const c = contactOf(world, watcherId, otherId);
  if (!c) return undefined;
  const live = c.visible && real && !real.sunk ? real : undefined;
  const shipClass = c.shipClass ?? fallbackClass;
  const params = SHIP_CLASSES[shipClass];
  const full = params?.hullPoints ?? 1;
  const know2 = !!live && c.levelNow >= 2;
  const know4 = !!live && c.levelNow >= 4;
  const ship: ShipState = {
    id: otherId,
    shipClass,
    x: live ? live.x : c.x,
    y: live ? live.y : c.y,
    headingRad: know2 ? live.headingRad : c.headingRad ?? 0,
    speed: know2 ? live.speed : c.visible ? c.speed ?? 0 : 0,
    rudder: 0,
    sailLevel: 1,
    aground: false,
    elevationDeg: 0,
    reloadPort: 0,
    reloadStarboard: 0,
    hull: know4 ? live.hull : (c.hullShare ?? 1) * full,
    sunk: false,
    battleSkill: 4,
    team: real?.team ?? 1,
    repairing: false,
  };
  if (c.nation) ship.nation = c.nation;
  if (live && c.levelNow >= 3 && live.offender) ship.offender = live.offender; // the flag level: a WANTED ship is known
  if (know4 && live.crew !== undefined) ship.crew = live.crew;
  if (know4 && live.sails !== undefined) ship.sails = live.sails;
  return ship;
}

/**
 * TEST switch "bots hunt me" (M4b step 5b-2): a rumour of the player's place reaches every warship and pirate that does
 * not see him now: a contact at level 1, out of view, so the usual search mode takes it to the place (and, once it is
 * close, its own eyes take over). Runs every `everySeconds`. It tells bots what they could not know, so it is a test aid
 * only: the arena log marks it. Returns how many bots were told.
 */
export function rumourOfPlayer(world: World, playerId: number, everySeconds = 20): number {
  if (world.tick % Math.round(everySeconds / STEP_SECONDS) !== 0) return 0;
  const player = world.ships.find((s) => s.id === playerId);
  if (!player || player.sunk || !world.sight) return 0;
  let told = 0;
  for (const bot of world.ships) {
    if (bot.id === playerId || bot.sunk) continue;
    if (SHIP_CLASSES[bot.shipClass]?.trader) continue;
    const sight = sightOf(world, bot.id);
    if (!sight) continue;
    const c = sight.contacts.find((q) => q.id === playerId);
    if (c?.visible) continue; // it sees him itself
    if (c) {
      c.x = player.x;
      c.y = player.y;
      c.seenTick = world.tick;
    } else {
      sight.contacts.push({ id: playerId, level: 1, levelNow: 1, visible: false, x: player.x, y: player.y, seenTick: world.tick, firstTick: world.tick });
    }
    told++;
  }
  return told;
}
