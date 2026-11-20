// The auto-bot arena (M3 step 2): a test mode with no player. Every ship is a bot and fights
// for itself; it picks its own target, sunk ships come back after a while, every win is counted.
// After winsToPeace wins it turns to peace: nobody attacks, hurt bots sail to a port.
// Pure rules, no Phaser: the screen (SeaScene, view/arenaLog.ts) only shows and logs it.

import { crewShare, refitShip, rollCargo, sailShare } from './condition';
import arenaJson from '../data/arena.json';
import { newBot } from './bot';
import { BOTS, ISLANDS, SHIP_CLASSES } from './data';
import { protectedByPort } from './law';
import { nextRandom } from './random';
import { gridSpot, openWaterSpot } from './spawn';
import { START_BATTLE_SKILL } from './world';
import { WIND } from './data';
import { bearingDegToHeadingRad } from './angles';
import type { Island, Pilot, ShipState, World } from './types';

export type ArenaParams = typeof arenaJson;
export const ARENA: ArenaParams = arenaJson;

/** M3 step 7a: the arena score: a win counts 1, getting away alive (hurt) counts half (your rule). */
export function pilotScore(p: Pick<Pilot, 'wins' | 'escapes'>): number {
  return p.wins + 0.5 * (p.escapes ?? 0);
}

/** A trader comes to sea with a random load in her hold (M3 step 7a); a warship with none. */
function loadCargo(world: World, ship: ShipState): void {
  const params = SHIP_CLASSES[ship.shipClass];
  if (!params) return;
  const load = rollCargo(params, params.cargoMax === undefined ? 0 : nextRandom(world));
  if (load === undefined) delete ship.cargo;
  else ship.cargo = load;
}

/** Hurt enough that getting away counts (M3 step 7a): hull, sails or crew below escapeHurtShare. */
export function isHurt(ship: ShipState, p: ArenaParams = ARENA): boolean {
  const full = SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 1;
  return ship.hull / full < p.escapeHurtShare || sailShare(ship) < p.escapeHurtShare || crewShare(ship) < p.escapeHurtShare;
}

/**
 * M3 step 7a: "got away alive". A ship hit by an enemy is under threat from it. She has escaped
 * (half a win) when, hurt, she reaches a port's safe water, or nobody has hit her for
 * escapeQuietSeconds and that enemy is more than escapeRangeM away. A threat ends without
 * credit when she sinks, the enemy sinks, or escapeForgetSeconds pass quietly while she is whole.
 * One half win per pair and life: a wreck dodging in and out of safe water is not counted again.
 */
export function stepEscapes(world: World, dt: number, p: ArenaParams = ARENA): void {
  const arena = world.arena;
  if (!arena) return;
  const threats = (arena.threats ??= []);
  const done = (arena.escapedFrom ??= []);
  for (const e of world.events) {
    if (e.type === 'sunk') arena.escapedFrom = done.filter((d) => d.shipId !== e.shipId); // a new life, a new count
    if (e.type === 'hit' && e.byShipId !== e.shipId && e.byShipId >= 0 && !(arena.escapedFrom ?? done).some((d) => d.shipId === e.shipId && d.byShipId === e.byShipId)) {
      const old = threats.find((t) => t.shipId === e.shipId);
      if (old) {
        old.byShipId = e.byShipId;
        old.quietSeconds = 0;
      } else threats.push({ shipId: e.shipId, byShipId: e.byShipId, quietSeconds: 0 });
    }
  }
  const keep: typeof threats = [];
  for (const t of threats) {
    const ship = world.ships.find((s) => s.id === t.shipId);
    const enemy = world.ships.find((s) => s.id === t.byShipId);
    if (!ship || ship.sunk || !enemy || enemy.sunk) continue;
    t.quietSeconds += dt;
    const hurt = isHurt(ship, p);
    let how: 'port' | 'away' | null = null;
    if (hurt && protectedByPort(ship)) how = 'port';
    else if (hurt && t.quietSeconds >= p.escapeQuietSeconds && Math.hypot(enemy.x - ship.x, enemy.y - ship.y) > p.escapeRangeM) how = 'away';
    if (how) {
      const pilot = arena.pilots.find((x) => x.shipId === ship.id);
      if (pilot) pilot.escapes = (pilot.escapes ?? 0) + 1;
      arena.escapedFrom!.push({ shipId: ship.id, byShipId: enemy.id });
      world.events.push({ type: 'escaped', shipId: ship.id, byShipId: enemy.id, how });
      continue;
    }
    if (t.quietSeconds < p.escapeForgetSeconds) keep.push(t);
  }
  arena.threats = keep;
}

/** A random open-water spot anywhere in the sea, away from the other ships. */
function anywhere(world: World, islands: readonly Island[], shipClass: string, others: readonly ShipState[]): { x: number; y: number } | null {
  const params = SHIP_CLASSES[shipClass];
  if (!params) return null;
  for (let i = 0; i < ARENA.spawnTries; i++) {
    const near = { x: -2600 + 5200 * nextRandom(world), y: -1600 + 3200 * nextRandom(world) };
    const spot = openWaterSpot(world, islands, near, 0, 200, params, others);
    if (spot && others.every((o) => o.sunk || Math.hypot(o.x - spot.x, o.y - spot.y) > 400)) return spot;
  }
  // Random tries failed (a crowded sea, or an island map with little open water): look over the
  // whole sea in a grid. Never a fixed place: a fixed place can be on an island.
  return gridSpot(world, islands, params, others.filter((o) => !o.sunk), 400);
}

/** A new arena: `count` bots of mixed classes at random places, each on its own side. */
export function createArenaWorld(seed: number, count: number = ARENA.bots, islands: readonly Island[] = ISLANDS): World {
  const wind = bearingDegToHeadingRad(WIND.startFromBearingDeg);
  const world: World = {
    tick: 0,
    rngState: seed,
    wind: { fromRad: wind, strength: WIND.startStrength, baseFromRad: wind },
    ships: [],
    balls: [],
    pendingShots: [],
    nextBallId: 1,
    events: [],
    bots: [],
    arena: { pilots: [], totalWins: 0, peace: false, respawns: [], retargetSeconds: 0 },
  };
  for (let i = 0; i < count; i++) {
    const id = i + 1;
    const shipClass = ARENA.classes[i % ARENA.classes.length] ?? 'sloop';
    const spot = anywhere(world, islands, shipClass, world.ships);
    if (!spot) continue; // no room at all: this bot is left out (the log header lists who came)
    world.ships.push({
      id,
      shipClass,
      x: spot.x,
      y: spot.y,
      headingRad: 2 * Math.PI * nextRandom(world),
      speed: 0,
      rudder: 0,
      sailLevel: 0,
      aground: false,
      elevationDeg: 5,
      reloadPort: 0,
      reloadStarboard: 0,
      hull: SHIP_CLASSES[shipClass]?.hullPoints ?? 1,
      sunk: false,
      battleSkill: START_BATTLE_SKILL,
      team: id, // everybody for himself
      repairing: false,
    });
    loadCargo(world, world.ships[world.ships.length - 1]!);
    world.arena!.pilots.push({ shipId: id, number: id, name: ARENA.names[i % ARENA.names.length] ?? `Bot ${id}`, wins: 0, losses: 0, balls: 0, hullHits: 0, sinceSeconds: 0 });
    world.bots.push(newBot(id, -1, world)); // no target yet: the first choice comes at once
  }
  return world;
}

/**
 * How good a target `other` is for `ship` (lower = better), in metres:
 * its distance, minus a bonus if it is badly hurt (easy to finish off), plus a penalty for
 * every other bot already after it (do not all pile on one ship).
 */
export function targetScore(ship: ShipState, other: ShipState, chasers: number, p: ArenaParams = ARENA): number {
  const full = SHIP_CLASSES[other.shipClass]?.hullPoints ?? 1;
  const hurt = 1 - other.hull / full;
  return Math.hypot(other.x - ship.x, other.y - ship.y) - p.woundedBonusM * hurt + p.crowdPenaltyM * chasers;
}

/** Every bot looks round and keeps its target, or takes a clearly better one. */
export function chooseTargets(world: World, p: ArenaParams = ARENA): void {
  for (const bot of world.bots) {
    const ship = world.ships.find((s) => s.id === bot.shipId);
    if (!ship || ship.sunk) continue;
    // M3 step 5: a bot in a finishing attack keeps its enemy; and an enemy that has just slipped into
    // safe water close by is kept until the bot has weighed a finishing attack (bot.ts finishPlan).
    if ((bot.finishLeft ?? 0) > 0) continue;
    const old = world.ships.find((o) => o.id === bot.enemyId);
    if (
      old && !old.sunk && protectedByPort(old) && bot.finishMemory?.enemyId !== old.id && !old.offender &&
      (bot.mode === 'chase' || bot.mode === 'engage' || bot.mode === 'idle') &&
      Math.hypot(old.x - ship.x, old.y - ship.y) <= BOTS.engageRange
    ) continue;
    const candidates = world.ships.filter((o) => o.id !== ship.id && !o.sunk && !protectedByPort(o));
    const chasers = (o: ShipState): number => world.bots.filter((b) => b !== bot && b.enemyId === o.id).length;
    let best: ShipState | undefined;
    let bestScore = Infinity;
    for (const o of candidates) {
      const score = targetScore(ship, o, chasers(o), p);
      if (score < bestScore) {
        bestScore = score;
        best = o;
      }
    }
    const current = candidates.find((o) => o.id === bot.enemyId);
    const keep = current && targetScore(ship, current, chasers(current), p) <= bestScore + p.switchMarginM;
    if (keep || !best || best.id === bot.enemyId) continue;
    bot.enemyId = best.id;
    // A bot that is running, mending or in port only notes its new enemy: it finishes what it
    // is doing first. (Before, a new target sent a half-mended bot straight back into the fight.)
    if (bot.mode === 'flee' || bot.mode === 'repair' || bot.mode === 'port' || bot.mode === 'outlaw') continue;
    bot.mode = 'chase';
    bot.chaseSeconds = 0;
    bot.chaseStartDistance = Math.hypot(best.x - ship.x, best.y - ship.y);
    world.events.push({ type: 'targetChosen', shipId: ship.id, targetId: best.id, distance: bot.chaseStartDistance });
  }
}

function pilotOf(world: World, shipId: number): Pilot | undefined {
  return world.arena?.pilots.find((p) => p.shipId === shipId);
}

/**
 * One arena step, after stepWorld (it reads that step's events):
 * counts balls fired, hits and wins; sinks bring a respawn after respawnSeconds; at winsToPeace
 * the arena turns to peace; every retargetSeconds the bots choose their targets.
 */
export function stepArena(world: World, dt: number, islands: readonly Island[] = ISLANDS, p: ArenaParams = ARENA): void {
  const arena = world.arena;
  if (!arena) return;
  for (const e of [...world.events]) {
    if (e.type === 'gunFired') {
      const pilot = pilotOf(world, e.shipId); // one event per gun (ripple fire)
      if (pilot) pilot.balls += e.balls ?? 1; // grape: every small ball counts, so hits/ball stays honest
    } else if (e.type === 'hit' && e.zone === 'hull') {
      const pilot = pilotOf(world, e.byShipId);
      if (pilot && e.byShipId !== e.shipId) pilot.hullHits++;
    } else if (e.type === 'sunk') {
      const loser = pilotOf(world, e.shipId);
      if (loser) loser.losses++;
      const winner = pilotOf(world, e.byShipId);
      if (winner && e.byShipId !== e.shipId && !arena.peace) {
        winner.wins++;
        arena.totalWins++;
        if (arena.totalWins >= p.winsToPeace) {
          arena.peace = true;
          world.events.push({ type: 'peace', totalWins: arena.totalWins });
        }
      }
      arena.respawns.push({ shipId: e.shipId, seconds: p.respawnSeconds });
      arena.retargetSeconds = 0; // whoever was after it looks for another target now
    }
  }
  for (const pilot of arena.pilots) pilot.sinceSeconds += dt;
  if (!arena.peace) stepEscapes(world, dt, p);

  // Sunk ships come back: a fresh ship of the same class at a random place.
  for (const r of arena.respawns) r.seconds -= dt;
  for (const r of arena.respawns.filter((x) => x.seconds <= 0)) {
    const ship = world.ships.find((s) => s.id === r.shipId);
    if (!ship) continue;
    const spot = anywhere(world, islands, ship.shipClass, world.ships);
    if (!spot) {
      r.seconds = 1; // no room now: try again in a second
      continue;
    }
    Object.assign(ship, {
      x: spot.x,
      y: spot.y,
      headingRad: 2 * Math.PI * nextRandom(world),
      speed: 0,
      rudder: 0,
      sailLevel: 0,
      aground: false,
      reloadPort: 0,
      reloadStarboard: 0,
      hull: SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 1,
      sunk: false,
      repairing: false,
      offender: undefined,
    });
    refitShip(ship); // full sails and crew, the starting ammunition
    loadCargo(world, ship);
    const i = world.bots.findIndex((b) => b.shipId === ship.id);
    const fresh = newBot(ship.id, -1, world);
    if (i >= 0) world.bots[i] = fresh;
    else world.bots.push(fresh);
    const pilot = pilotOf(world, ship.id);
    if (pilot) pilot.sinceSeconds = 0;
    world.events.push({ type: 'respawn', shipId: ship.id, x: spot.x, y: spot.y });
  }
  arena.respawns = arena.respawns.filter((x) => x.seconds > 0);

  // Targets: in peace nobody has one; in war look round every retargetSeconds.
  if (arena.peace) {
    for (const bot of world.bots) bot.enemyId = -1;
    return;
  }
  arena.retargetSeconds -= dt;
  if (arena.retargetSeconds <= 0) {
    chooseTargets(world, p);
    arena.retargetSeconds = p.retargetSeconds;
  }
}
