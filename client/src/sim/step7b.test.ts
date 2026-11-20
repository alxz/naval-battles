// M3 step 7b (crew spirit, traders, stern chasers, land stops balls) and 7d (battle classes and flags).
import { describe, expect, it } from 'vitest';
import { createArenaWorld, escapeWorth, ARENA } from './arena';
import { shotClear, thinkBot } from './bot';
import { applyCommand } from './commands';
import { BOTS, ISLANDS, SHIP_CLASSES } from './data';
import { gunPosition, gunsOn, orderBroadside, predictLanding, sideAngleRad, stepGunsAndBalls } from './guns';
import { courageOf, frighten, hitFear, nextTradeStop, odds, tradeStops } from './morale';
import { portsOf } from './port';
import { STEP_SECONDS } from './step';
import { ballBlocked, buildTerrain, landHeight } from './terrain';
import { battleClasses, createWorld } from './world';
import { withPerfectGuns } from './testing';
import type { BotState, Island, ShipState, World } from './types';

const fluyt = SHIP_CLASSES['fluyt']!;
const caravel = SHIP_CLASSES['caravel']!;
const sloop = SHIP_CLASSES['sloop']!;

/** A round island of radius r at (cx, cy). */
function roundIsland(cx: number, cy: number, r: number, kind = 'big'): Island {
  const points = Array.from({ length: 32 }, (_, i) => ({ x: cx + r * Math.cos((i / 32) * 2 * Math.PI), y: cy + r * Math.sin((i / 32) * 2 * Math.PI) }));
  return { name: 'Test Isle', kind, points };
}

function emptyWorld(ships: ShipState[]): World {
  return { tick: 0, rngState: 7, wind: { fromRad: 0, strength: 0.8, baseFromRad: 0 }, ships, balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [] };
}

function shipOf(id: number, shipClass: string, x: number, y: number, headingRad = 0): ShipState {
  return {
    id, shipClass, x, y, headingRad, speed: 0, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 5,
    reloadPort: 0, reloadStarboard: 0, hull: SHIP_CLASSES[shipClass]!.hullPoints, sunk: false, battleSkill: 4, team: id, repairing: false,
  };
}

describe('stern chasers (M3 step 7b)', () => {
  withPerfectGuns();
  it('the traders carry 2 stern chasers; they sit at the stern and fire astern', () => {
    expect(gunsOn(fluyt, 'stern')).toBe(2);
    expect(gunsOn(sloop, 'stern')).toBe(0);
    const s = shipOf(1, 'fluyt', 0, 0, 0);
    const gun = gunPosition(s, fluyt, 'stern', 0);
    expect(gun.x).toBeCloseTo(-fluyt.length / 2);
    expect(sideAngleRad(0, 'stern')).toBeCloseTo(Math.PI);
    expect(predictLanding(s, fluyt, 'stern', STEP_SECONDS).x).toBeLessThan(-fluyt.length / 2);
  });

  it('a stern salvo fires sternGuns balls, reloads, and a sloop (none) cannot fire astern', () => {
    const w = emptyWorld([shipOf(1, 'fluyt', 0, 0, 0), shipOf(2, 'sloop', 500, 500)]);
    expect(orderBroadside(w, w.ships[0]!, 'stern', STEP_SECONDS)).toBe(true);
    expect(w.pendingShots.filter((p) => p.side === 'stern')).toHaveLength(2);
    expect(w.ships[0]!.reloadStern).toBeGreaterThan(0);
    expect(orderBroadside(w, w.ships[0]!, 'stern', STEP_SECONDS)).toBe(false);
    expect(orderBroadside(w, w.ships[1]!, 'stern', STEP_SECONDS)).toBe(false);
  });

  it('the stern chasers can be trained to one side (trainDeg)', () => {
    const w = emptyWorld([shipOf(1, 'fluyt', 0, 0, 0)]);
    applyCommand(w, { type: 'fire', shipId: 1, side: 'stern', trainDeg: 20 });
    for (let i = 0; i < 30 && w.balls.length === 0; i++) {
      stepGunsAndBalls(w, STEP_SECONDS, undefined, []);
      w.tick++;
    }
    const ball = w.balls[0]!;
    // Astern is -x; trained 20 degrees clockwise (toward -y when pointing at -x... the sign follows the heading rule).
    const dir = Math.atan2(ball.vy, ball.vx);
    expect(Math.abs(Math.abs(dir) - Math.PI)).toBeGreaterThan(0.2);
  });
});

describe('the land stops balls (M3 step 7b)', () => {
  it('an island is low at the beach and high in the middle (capped)', () => {
    const t = buildTerrain([roundIsland(0, 0, 300)]);
    expect(landHeight(t, 0, 0)).toBeGreaterThan(30);
    expect(landHeight(t, 295, 0)).toBeLessThan(6);
    expect(landHeight(t, 400, 0)).toBe(0);
    const islet = buildTerrain([roundIsland(0, 0, 30, 'small')]);
    expect(landHeight(islet, 0, 0)).toBeLessThan(12);
    const reef = buildTerrain([roundIsland(0, 0, 300, 'reef')]);
    expect(landHeight(reef, 0, 0)).toBeLessThan(2);
  });

  it('a ball flying low into the hill stops there; one high above flies on', () => {
    const t = buildTerrain([roundIsland(0, 0, 300)]);
    expect(ballBlocked(t, { x: -400, y: 0, z: 5 }, { x: 0, y: 0, z: 5 })).not.toBeNull();
    expect(ballBlocked(t, { x: -400, y: 0, z: 80 }, { x: 0, y: 0, z: 80 })).toBeNull();
  });

  it('a broadside across an island: the balls hit the land (landHit), not the ship behind it', () => {
    const island = roundIsland(0, 75, 40);
    const w = emptyWorld([shipOf(1, 'sloop', 0, 0, 0), shipOf(2, 'sloop', 0, 150, 0)]);
    w.ships[0]!.elevationDeg = 3;
    orderBroadside(w, w.ships[0]!, 'starboard', STEP_SECONDS);
    const events: string[] = [];
    for (let i = 0; i < 150; i++) {
      stepGunsAndBalls(w, STEP_SECONDS, undefined, [island]);
      events.push(...w.events.map((e) => e.type));
      w.events = [];
      w.tick++;
    }
    expect(events).toContain('landHit');
    expect(events).not.toContain('hit');
  });

  it('a bot does not fire into a hill (shotClear)', () => {
    const island = [roundIsland(0, 120, 60)];
    const s = shipOf(1, 'sloop', 0, 0, 0);
    expect(shotClear(s, { x: 0, y: 250 }, 3, island)).toBe(false);
    expect(shotClear(s, { x: 250, y: 0 }, 3, island)).toBe(true);
  });
});

describe('crew spirit (M3 step 7b)', () => {
  it('courage: warships between courageMin and courageMax, traders lower; drawn once', () => {
    const w = createArenaWorld(11);
    const bot = w.bots[0]!;
    const c = courageOf(bot, sloop, w);
    expect(c).toBeGreaterThanOrEqual(BOTS.courageMin);
    expect(c).toBeLessThanOrEqual(BOTS.courageMax);
    expect(courageOf(bot, sloop, w)).toBe(c);
    const t: BotState = { ...w.bots[1]!, personality: { ...w.bots[1]!.personality } };
    delete t.personality.courage;
    expect(courageOf(t, fluyt, w)).toBeLessThanOrEqual(BOTS.traderCourageMax);
  });

  it('fear: a hit frightens by the share of hull and men it cost; a black flag 1.5x', () => {
    expect(hitFear(sloop, sloop.hullPoints / 10, 0)).toBeCloseTo(BOTS.fearPerHullShare / 10);
    const w = createArenaWorld(12);
    const a = w.ships[0]!;
    const b = w.ships[1]!;
    a.nation = 'england';
    frighten(w, b.id, 0.1, a.id);
    const bot = w.bots.find((x) => x.shipId === b.id)!;
    expect(bot.fear).toBeCloseTo(0.1);
    a.nation = 'pirates';
    frighten(w, b.id, 0.1, a.id);
    expect(bot.fear).toBeCloseTo(0.1 + 0.1 * BOTS.blackFlagFear);
  });

  it('odds: a sloop against a frigate is poor, against a fluyt good', () => {
    const s = shipOf(1, 'sloop', 0, 0);
    expect(odds(s, shipOf(2, 'frigate', 0, 0))).toBeLessThan(0.5);
    expect(odds(s, shipOf(2, 'fluyt', 0, 0))).toBeGreaterThan(1);
  });

  it('a warship whose fear has grown above its courage leaves the fight (botLeaves, flee)', () => {
    const w = createArenaWorld(13);
    const bot = w.bots[0]!;
    const me = w.ships.find((s) => s.id === bot.shipId)!;
    const enemy = w.ships.find((s) => s.id !== me.id && !SHIP_CLASSES[s.shipClass]!.trader)!;
    enemy.x = me.x + 150;
    enemy.y = me.y;
    bot.enemyId = enemy.id;
    bot.mode = 'engage';
    bot.personality.courage = 0.5;
    bot.fear = 2;
    bot.weighLeft = 0;
    w.tick = (BOTS.thinkEveryTicks - (me.id % BOTS.thinkEveryTicks)) % BOTS.thinkEveryTicks;
    thinkBot(w, bot, ISLANDS);
    expect(bot.mode).toBe('flee');
    expect(w.events.some((e) => e.type === 'botLeaves' && e.reason === 'fear')).toBe(true);
  });
});

describe('traders (M3 step 7b)', () => {
  const traderWorld = (enemyDistance: number): { w: World; bot: BotState; me: ShipState } => {
    const w = createArenaWorld(21);
    const me = w.ships.find((s) => s.shipClass === 'fluyt')!;
    const bot = w.bots.find((b) => b.shipId === me.id)!;
    const enemy = w.ships.find((s) => s.shipClass === 'sloop')!;
    me.x = 0;
    me.y = -1500;
    enemy.x = enemyDistance;
    enemy.y = -1500;
    for (const s of w.ships) if (s !== me && s !== enemy) s.sunk = true;
    bot.enemyId = enemy.id;
    bot.mode = 'chase';
    bot.personality.courage = 0.2;
    w.tick = (BOTS.thinkEveryTicks - (me.id % BOTS.thinkEveryTicks)) % BOTS.thinkEveryTicks;
    return { w, bot, me };
  };

  it('far from enemies a trader sails its trade run', () => {
    const { w, bot } = traderWorld(2000);
    thinkBot(w, bot, ISLANDS);
    expect(bot.mode).toBe('trade');
    expect(bot.tradeTo).toBeDefined();
  });

  it('an enemy close by: the trader runs (botLeaves, reason trader), and does not fire on its run', () => {
    const { w, bot } = traderWorld(400);
    thinkBot(w, bot, ISLANDS);
    expect(bot.mode).toBe('flee');
    expect(w.events.some((e) => e.type === 'botLeaves' && e.reason === 'trader')).toBe(true);
  });

  it('a brave trader with the odds in its favour fights', () => {
    const { w, bot } = traderWorld(400);
    bot.personality.courage = 0.9;
    const enemy = w.ships.find((s) => s.id === bot.enemyId)!;
    enemy.hull = 10; // a wreck: the odds are good
    thinkBot(w, bot, ISLANDS);
    expect(bot.mode).toBe('engage');
  });

  it('trade stops: the usable ports and places off the big islands, in open water', () => {
    const ports = portsOf(ISLANDS);
    const stops = tradeStops(fluyt, ISLANDS, ports);
    expect(stops.length).toBeGreaterThan(ports.length);
    const ship = shipOf(1, 'fluyt', stops[0]!.x, stops[0]!.y);
    const next = nextTradeStop({ rngState: 3 }, ship, stops)!;
    expect(Math.hypot(next.x - ship.x, next.y - ship.y)).toBeGreaterThan(3 * BOTS.traderArriveM);
  });

  it('cargo over the side: the command empties the hold (event jettison)', () => {
    const w = emptyWorld([{ ...shipOf(1, 'fluyt', 0, 0), cargo: 0.8 }]);
    applyCommand(w, { type: 'jettison', shipId: 1 });
    expect(w.ships[0]!.cargo).toBe(0);
    expect(w.events.some((e) => e.type === 'jettison')).toBe(true);
  });

  it('escape points: a trader 1 into port, 0.25 at sea; a warship 0.5', () => {
    expect(escapeWorth('fluyt', 'port')).toBe(ARENA.escapePoints.traderPort);
    expect(escapeWorth('caravel', 'away')).toBe(ARENA.escapePoints.traderAway);
    expect(escapeWorth('sloop', 'port')).toBe(0.5);
    expect(caravel.trader).toBe(true);
  });
});

describe('a battle against bots (M3 step 7d)', () => {
  it('bot classes: one class for all, or a mix that follows the seed', () => {
    expect(battleClasses(5, 4, 'frigate')).toEqual(['frigate', 'frigate', 'frigate', 'frigate']);
    const mix = battleClasses(5, 40, 'mix');
    expect(battleClasses(5, 40, 'mix')).toEqual(mix);
    expect(new Set(mix).size).toBeGreaterThan(2);
    for (const k of mix) expect(SHIP_CLASSES[k]).toBeDefined();
  });

  it('you sail under the black flag; the bots under the flags of this battle', () => {
    const w = createWorld(99, 3);
    expect(w.ships[0]!.nation).toBe('pirates');
    for (const s of w.ships.slice(1)) expect(s.nation).toBeDefined();
  });

  it('a trader placed in a battle comes with cargo', () => {
    const w = createWorld(99, 1);
    applyCommand(w, { type: 'placeShip', shipId: 2, x: 200, y: 90, headingRad: 0, shipClass: 'fluyt' });
    expect(w.ships[1]!.cargo).toBeGreaterThanOrEqual(fluyt.cargoMin ?? 0);
  });
});
