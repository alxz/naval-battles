/**
 * M3 step 7b: crew spirit and the trader's life (your ideas of 19 Nov).
 *
 *  - Courage: every bot gets its own, once (traders much less than warships).
 *  - Fear: grows with every hit (the share of the hull it took), with men lost, and with balls
 *    splashing close by (a warning shot does the same); a pirate's black flag makes it grow 1.5x;
 *    it fades slowly. When fear rises above courage the bot leaves the fight.
 *  - Odds: our strength against theirs (guns x hull left x crew); a hurt bot with poor odds may
 *    leave too, by a roll, when it weighs its chances (every 3-6 s, at random moments).
 *  - Traders sail a trade run between ports and the big islands, run from enemies, throw their
 *    cargo over the side to run faster, and fire their stern chasers at the pursuer.
 *
 * Pure rules: plain data in the bot's memory, numbers in data/bots.json, seeded random numbers.
 */
import { BOTS, SHIP_CLASSES, WORLD } from './data';
import { crewShare } from './condition';
import { isPirate } from './nation';
import { nextRandom } from './random';
import { nearestOpenWater } from './spawn';
import type { BotParams, BotState, Island, ShipParams, ShipState, World } from './types';
import type { Port } from './port';

/** A bot's courage, 0..1: drawn the first time it is asked for (traders between the trader limits). */
export function courageOf(bot: BotState, params: ShipParams | undefined, rng: { rngState: number }, p: BotParams = BOTS): number {
  if (bot.personality.courage === undefined) {
    const lo = params?.trader ? p.traderCourageMin : p.courageMin;
    const hi = params?.trader ? p.traderCourageMax : p.courageMax;
    bot.personality.courage = lo + (hi - lo) * nextRandom(rng);
  }
  return bot.personality.courage;
}

/** Add fear to the bot of this ship (none for the player's ship); a pirate frightens more. */
export function frighten(world: World, shipId: number, amount: number, byShipId: number, p: BotParams = BOTS): void {
  if (amount <= 0) return;
  const bot = world.bots.find((b) => b.shipId === shipId);
  if (!bot) return;
  const by = world.ships.find((s) => s.id === byShipId);
  bot.fear = (bot.fear ?? 0) + amount * (by && isPirate(by) ? p.blackFlagFear : 1);
}

/** Fear from one hit: the share of the full hull and of the full crew it cost. */
export function hitFear(params: ShipParams, hullLost: number, crewLost: number, p: BotParams = BOTS): number {
  return (p.fearPerHullShare * hullLost) / Math.max(1, params.hullPoints) + (p.fearPerCrewShare * crewLost) / Math.max(1, params.crew);
}

/** Fear from a ball splashing near these ships (within nearMissM): a warning shot, or a near miss. */
export function nearMiss(world: World, x: number, y: number, byShipId: number, p: BotParams = BOTS): void {
  for (const ship of world.ships) {
    if (ship.sunk || ship.id === byShipId) continue;
    if (Math.hypot(ship.x - x, ship.y - y) <= p.nearMissM) frighten(world, ship.id, SHIP_CLASSES[ship.shipClass]?.trader ? p.fearNearMiss : p.fearNearMissWarship, byShipId, p);
  }
}

/**
 * How strong a ship is in a fight, roughly: its broadside (with a short crew fewer guns are worked)
 * times the hull it has left. The time to sink the enemy goes as its hull / our guns, so the
 * ratio of these two numbers is a fair first guess at who wins.
 */
export function strength(ship: ShipState, params: ShipParams): number {
  const guns = params.gunsPerSide + 0.5 * ((params.sternGuns ?? 0) + (params.bowGuns ?? 0));
  return guns * (0.4 + 0.6 * crewShare(ship)) * Math.max(0, ship.hull);
}

/** Our strength against theirs (1 = even, below 1 = they are stronger). */
export function odds(ship: ShipState, enemy: ShipState): number {
  const a = SHIP_CLASSES[ship.shipClass];
  const b = SHIP_CLASSES[enemy.shipClass];
  if (!a || !b) return 1;
  return strength(ship, a) / Math.max(1, strength(enemy, b));
}

/**
 * The stops of a trade run: the anchorages of the ports this ship may use and a place off each big
 * or medium island (on the side toward the middle of the sea, in open water). The trader goes from
 * stop to stop at random, so its run is not always the shortest one.
 */
export function tradeStops(params: ShipParams, islands: readonly Island[], ports: readonly Port[], p: BotParams = BOTS): { x: number; y: number }[] {
  const sets = tradeStopSets(params, islands, ports, p);
  return [...sets.ports, ...sets.islands];
}

/** The same stops in two lists: off the ports, and off the big and medium islands (M4b step 5b-1: routes by kind of ship). */
export function tradeStopSets(params: ShipParams, islands: readonly Island[], ports: readonly Port[], p: BotParams = BOTS): { ports: { x: number; y: number }[]; islands: { x: number; y: number }[] } {
  // A port up an inlet: the stop is off the inlet's mouth (M3 step 8: traders on a run ground at the mouth
  // when they head for the harbour inside, which they do not enter unless they go there for repairs).
  const stops: { x: number; y: number }[] = [];
  const byIsland: { x: number; y: number }[] = [];
  for (const port of ports) {
    const a = port.path?.[0];
    const b = port.path?.[1];
    if (!a || !b) {
      stops.push({ x: port.x, y: port.y });
      continue;
    }
    const l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const off = { x: a.x + ((a.x - b.x) / l) * p.traderMouthOffM, y: a.y + ((a.y - b.y) / l) * p.traderMouthOffM };
    const spot = nearestOpenWater(off.x, off.y, params, islands, WORLD, 400);
    if (spot) stops.push(spot);
  }
  const midX = (WORLD.minX + WORLD.maxX) / 2;
  const midY = (WORLD.minY + WORLD.maxY) / 2;
  for (const island of islands) {
    if (island.kind !== 'big' && island.kind !== 'medium') continue;
    let cx = 0;
    let cy = 0;
    for (const q of island.points) {
      cx += q.x;
      cy += q.y;
    }
    cx /= island.points.length;
    cy /= island.points.length;
    let r = 0;
    for (const q of island.points) r = Math.max(r, Math.hypot(q.x - cx, q.y - cy));
    const d = Math.hypot(midX - cx, midY - cy) || 1;
    const x = cx + ((midX - cx) / d) * (r + p.traderIslandOffsetM);
    const y = cy + ((midY - cy) / d) * (r + p.traderIslandOffsetM);
    const spot = nearestOpenWater(x, y, params, islands, WORLD, 400);
    if (spot) byIsland.push(spot);
  }
  return { ports: stops, islands: byIsland };
}

/** The next stop of a trade run: a random one, not where the ship is now. */
export function nextTradeStop(rng: { rngState: number }, ship: ShipState, stops: readonly { x: number; y: number }[], p: BotParams = BOTS): { x: number; y: number } | undefined {
  const far = stops.filter((s) => Math.hypot(s.x - ship.x, s.y - ship.y) > 3 * p.traderArriveM);
  const from = far.length > 0 ? far : stops;
  if (from.length === 0) return undefined;
  return { ...from[Math.min(from.length - 1, Math.floor(nextRandom(rng) * from.length))]! };
}
