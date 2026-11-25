/**
 * M4b step 5b-1: default routes (the developer's idea of 19 Nov, D54).
 *
 * Every bot gets a route once, when it first has nothing else to do: a few stops chosen at random (from the world's
 * seed) and sailed round in turn, so ships keep meeting on the same lanes instead of wandering at random.
 *   - a trader's route goes from port to port ("ports"); with fewer than two ports, from stop to stop;
 *   - a warship's or pirate's route goes from island to island ("islands": where traders pass, a patrol or an ambush);
 *     with fewer than two such stops it uses all stops.
 * The stops are picked at random, not by distance, so a route is not always the shortest. Pure rules, no Phaser.
 */
import { nextRandom } from './random';
import type { BotState, ShipState } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface StopSets {
  ports: readonly Point[];
  islands: readonly Point[];
}

/** Which kind of stops this ship sails between. */
export function routeKind(trader: boolean, sets: StopSets): 'ports' | 'islands' {
  const wanted = trader ? sets.ports : sets.islands;
  return wanted.length >= 2 ? (trader ? 'ports' : 'islands') : trader ? 'islands' : 'ports';
}

/**
 * `count` different stops of the right kind, in random order (fewer when the pool is smaller). The first stop is not
 * close to the ship (more than `arriveM` away), when the pool allows it.
 */
export function planRoute(rng: { rngState: number }, ship: Point, sets: StopSets, trader: boolean, count: number, arriveM: number): { kind: 'ports' | 'islands'; stops: Point[] } {
  let kind = routeKind(trader, sets);
  let pool = (kind === 'ports' ? sets.ports : sets.islands).map((s) => ({ ...s }));
  if (pool.length < 2) {
    pool = [...sets.ports, ...sets.islands].map((s) => ({ ...s }));
    kind = trader ? 'ports' : 'islands';
  }
  const stops: Point[] = [];
  while (stops.length < count && pool.length > 0) {
    const at = Math.min(pool.length - 1, Math.floor(nextRandom(rng) * pool.length));
    stops.push(pool.splice(at, 1)[0]!);
  }
  const far = stops.findIndex((s) => Math.hypot(s.x - ship.x, s.y - ship.y) > 3 * arriveM);
  if (far > 0) stops.unshift(...stops.splice(far, 1));
  return { kind, stops };
}

/**
 * The next stop of the bot's route; the route is made on the first call. A stop the ship is already at is skipped.
 * Returns `planned` when the route was just made (the caller logs it).
 */
export function nextRouteStop(
  rng: { rngState: number },
  bot: Pick<BotState, 'plan' | 'planIndex'>,
  ship: ShipState,
  sets: StopSets,
  trader: boolean,
  count: number,
  arriveM: number,
): { stop: Point; planned?: { kind: 'ports' | 'islands'; stops: Point[] } } | undefined {
  let planned: { kind: 'ports' | 'islands'; stops: Point[] } | undefined;
  if (!bot.plan || bot.plan.length === 0) {
    planned = planRoute(rng, ship, sets, trader, count, arriveM);
    bot.plan = planned.stops;
    bot.planIndex = 0;
  }
  const plan = bot.plan;
  if (plan.length === 0) return undefined;
  let index = (bot.planIndex ?? 0) % plan.length;
  if (plan.length > 1 && Math.hypot(plan[index]!.x - ship.x, plan[index]!.y - ship.y) <= 3 * arriveM) index = (index + 1) % plan.length;
  bot.planIndex = (index + 1) % plan.length;
  const stop = { ...plan[index]! };
  return planned ? { stop, planned } : { stop };
}
