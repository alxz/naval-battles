// M4b step 5b-2 (D82): renegades and false flags.
// A renegade hunts anyone, across the whole map. A bot becomes one when (1) it is an offender of a port's law, or (2) it is
// the bot with the most rams. A bot that sank nobody for 10 minutes may, by chance, turn pirate - but quietly, under a false
// flag, that comes down only at about 300 m. A renegade hides no more: the black flag stays up and it patrols wider.
// Your answers of 24 Nov (world-ideas §15). Pure rules; the numbers are in data/renegade.json.

import renegadeJson from '../data/renegade.json';
import { SHIP_CLASSES } from './data';
import { nextRandom } from './random';
import { falseFlagFor, isPirate, nationFor } from './nation';
import type { BotState, RenegadeParams, ShipState, SimEvent, World } from './types';

export const RENEGADE: RenegadeParams = renegadeJson;

const STEP_SECONDS = 1 / 30;

/**
 * The bots that rammed in a collision: a ship whose bot was ramming on purpose (mode 'ram') when the hulls met, and only
 * when the collision did damage. Accidental bumps are no rams.
 */
export function rammersIn(e: Extract<SimEvent, { type: 'collision' }>, bots: readonly Pick<BotState, 'shipId' | 'mode'>[]): number[] {
  if (e.damageA <= 0 && e.damageB <= 0) return [];
  return [e.shipA, e.shipB].filter((id) => bots.some((b) => b.shipId === id && b.mode === 'ram'));
}

/** True when the bot sank nobody (and was not reborn) for `idleSeconds`. */
export function idleFor(bot: Pick<BotState, 'sinceTick'>, tick: number, idleSeconds: number): boolean {
  return (tick - (bot.sinceTick ?? tick)) * STEP_SECONDS >= idleSeconds;
}

/** The bot with the most rams, if it has at least `ramsMin` and nobody else has as many; else undefined. */
export function mostRams(bots: readonly Pick<BotState, 'shipId' | 'rams'>[], ramsMin: number): number | undefined {
  let best: number | undefined;
  let count = 0;
  let tie = false;
  for (const b of bots) {
    const r = b.rams ?? 0;
    if (r > count) {
      best = b.shipId;
      count = r;
      tie = false;
    } else if (r === count && r > 0) tie = true;
  }
  return count >= ramsMin && !tie ? best : undefined;
}

/** Which of the pirates start under a false flag: a deterministic share by seed and ship (integer hash, the same on every engine). */
export function startsHidden(seed: number, shipId: number, share: number): boolean {
  return hashUnit(seed, shipId, 0x51ed27) < share;
}

/** A number in [0, 1) from seed and ship: integer arithmetic only, so Chrome and Safari agree bit for bit (no Math.sin). */
export function hashUnit(seed: number, shipId: number, salt: number): number {
  let h = (Math.floor(seed) ^ Math.imul(shipId + 1, 0x9e3779b1) ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/**
 * A new life in the arena (a respawn): a new crew under the ship's birth flag (`nationFor`), hidden again by the same
 * lot when that flag is the black one. A renegade's black flag does not outlive its crew.
 */
export function rebirthFlag(ship: ShipState, seed: number, p: RenegadeParams = RENEGADE): void {
  ship.nation = nationFor(seed, ship.id);
  delete ship.falseFlag;
  if (isPirate(ship) && !SHIP_CLASSES[ship.shipClass]?.trader && startsHidden(seed, ship.id, p.falseFlagShare)) ship.falseFlag = falseFlagFor(seed, ship.id);
}

/** At the start of a battle or arena: some pirates hide under a false flag. */
export function hideSomePirates(world: World, seed: number, p: RenegadeParams = RENEGADE): void {
  for (const ship of world.ships) {
    if (ship.id === 1 && !world.arena) continue; // you are the pirate of the battle, with no disguise
    if (isPirate(ship) && !SHIP_CLASSES[ship.shipClass]?.trader && startsHidden(seed, ship.id, p.falseFlagShare)) ship.falseFlag = falseFlagFor(seed, ship.id);
  }
}

/** Call every world step. Counts sinkings and deliberate rams, and every `checkEverySeconds` turns bots into pirates / renegades. */
export function stepRenegades(world: World, p: RenegadeParams = RENEGADE): void {
  for (const e of world.events) {
    if (e.type === 'sunk') {
      const b = world.bots.find((x) => x.shipId === e.byShipId);
      if (b) b.sinceTick = world.tick;
    } else if (e.type === 'collision') {
      for (const id of rammersIn(e, world.bots)) {
        const b = world.bots.find((x) => x.shipId === id)!;
        b.rams = (b.rams ?? 0) + 1;
      }
    }
  }
  // A respawned bot is a fresh BotState (no sinceTick): its idle time starts here. (The arena's respawn event comes after
  // the world step, so it is not read above.)
  for (const b of world.bots) if (b.sinceTick === undefined) b.sinceTick = world.tick;
  if (world.tick % Math.max(1, Math.round(p.checkEverySeconds / STEP_SECONDS)) !== 0 || world.tick === 0) return;

  const ramKing = mostRams(world.bots, p.ramsMin);
  for (const bot of world.bots) {
    const ship = world.ships.find((s) => s.id === bot.shipId);
    if (!ship || ship.sunk || bot.renegade || SHIP_CLASSES[ship.shipClass]?.trader) continue;
    const reason = ship.offender ? 'law' : bot.shipId === ramKing ? 'rams' : undefined;
    if (reason) {
      const was = ship.falseFlag ?? ship.nation ?? '?';
      bot.renegade = true;
      ship.nation = 'pirates';
      delete ship.falseFlag;
      world.events.push({ type: 'pirateTurn', shipId: ship.id, reason, renegade: true, was });
    } else if (!isPirate(ship) && idleFor(bot, world.tick, p.idleSeconds) && nextRandom(world) < p.idleChance) {
      const was = ship.nation ?? '?';
      ship.nation = 'pirates';
      ship.falseFlag = was;
      world.events.push({ type: 'pirateTurn', shipId: ship.id, reason: 'idle', renegade: false, was, falseFlag: ship.falseFlag });
    }
  }
}
