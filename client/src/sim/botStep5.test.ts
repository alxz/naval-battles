// M3 step 4c and step 5: bots work free when stuck, chase a runner at its own pace,
// finish a nearly sunk enemy in a port's safe water (with a roll), and wait for a free berth.
import { describe, expect, it } from 'vitest';
import { finishPlan, newBot, thinkBots, unstickHeading } from './bot';
import { applyCommand } from './commands';
import { BOTS, DAMAGE, GUNS, ISLANDS, SHIP_CLASSES } from './data';
import { PORTS, berthWaitSpot, berthsTaken } from './port';
import { isOpenWater, nearestOpenWater } from './spawn';
import { STEP_SECONDS, stepWorld, targetSpeed } from './step';
import type { BotParams, Command, Island, ShipState, SimEvent, World } from './types';
import { createWorld } from './world';

const sloop = SHIP_CLASSES['sloop']!;
const steady = { speedScale: 1, windDrift: false };

function sloopAt(id: number, x: number, y: number, headingRad = 0, speed = 0): ShipState {
  return {
    id, shipClass: 'sloop', x, y, headingRad, speed, rudder: 0, sailLevel: 0,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: sloop.hullPoints, sunk: false, battleSkill: 4, team: id, repairing: false,
  };
}

/** Run like Simulation does, keeping the bots' own events too. Returns events and the commands of ship `watch`. */
function run(world: World, seconds: number, islands: readonly Island[], p: BotParams, watch = 2): { events: SimEvent[]; commands: Command[] } {
  const events: SimEvent[] = [];
  const commands: Command[] = [];
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) {
    world.events = [];
    for (const c of thinkBots(world, islands, p)) {
      if ('shipId' in c && c.shipId === watch) commands.push(c);
      applyCommand(world, c);
    }
    const botEvents = world.events;
    stepWorld(world, STEP_SECONDS, steady, islands);
    events.push(...botEvents, ...world.events);
  }
  return { events, commands };
}

/** Open water near (x, y) for a sloop, or fail the test. */
function water(x: number, y: number): { x: number; y: number } {
  const spot = isOpenWater(x, y, sloop, ISLANDS) ? { x, y } : nearestOpenWater(x, y, sloop, ISLANDS);
  if (!spot) throw new Error('no open water');
  return spot;
}

describe('finishPlan (M3 step 5)', () => {
  it('guns x damage x hit share x the port law factor x the sides that are ready', () => {
    const ship = sloopAt(2, 0, 0);
    const enemy = sloopAt(1, 100, 0);
    const hit = 0.45; // bots.json finishHitChance at 100 m
    const both = sloop.gunsPerSide * GUNS.damage * hit * DAMAGE.port.law.damageFactor * 2;
    enemy.hull = 40;
    expect(finishPlan(ship, sloop, enemy, 100)).toEqual({ expected: expect.closeTo(both, 6) as unknown as number, canFinish: true });
    enemy.hull = both + 1;
    expect(finishPlan(ship, sloop, enemy, 100).canFinish).toBe(false);
    ship.reloadStarboard = 12; // one side still reloading: one broadside
    expect(finishPlan(ship, sloop, enemy, 100).expected).toBeCloseTo(both / 2, 6);
    expect(finishPlan(ship, sloop, enemy, 75).expected).toBeGreaterThan(finishPlan(ship, sloop, enemy, 100).expected); // interpolated
  });
});

describe('finishing attack in safe water (M3 step 5)', () => {
  /** You at the first port's anchorage with little hull left; the bot 140 m off, inside the safe water. */
  function setUp(hull: number): World {
    const world = createWorld(5);
    const p = PORTS[0]!;
    const [me, bot] = world.ships;
    Object.assign(me!, { x: p.x, y: p.y + 20, sailLevel: 0, speed: 0, hull });
    Object.assign(bot!, { x: p.x, y: p.y + 160, headingRad: 0 });
    world.bots = [newBot(bot!.id, me!.id, world)];
    return world;
  }

  it('can sink it and the roll says yes: it goes in, fires, becomes an offender and leaves afterwards', () => {
    const world = setUp(30);
    const { events, commands } = run(world, 60, ISLANDS, { ...BOTS, finishChance: 1 });
    const decision = events.find((e) => e.type === 'finishDecision');
    expect(decision).toMatchObject({ go: true, canFinish: true });
    expect(commands.some((c) => c.type === 'fire')).toBe(true);
    expect(events.some((e) => e.type === 'offender' && e.shipId === 2)).toBe(true);
    const me = world.ships[0]!;
    // Either it sank you, or the attack ran out: then it runs from the shore guns.
    expect(me.sunk || world.bots[0]!.mode === 'outlaw').toBe(true);
  });

  it('the roll says no: it waits outside and does not fire; the same answer stands for a while', () => {
    const world = setUp(30);
    const { events, commands } = run(world, 25, ISLANDS, { ...BOTS, finishChance: 0, finishRecklessChance: 0 });
    expect(events.filter((e) => e.type === 'finishDecision')).toHaveLength(1);
    expect(commands.some((c) => c.type === 'fire')).toBe(false);
    expect(world.bots[0]!.mode).toBe('idle');
  });

  it('cannot sink it: only the reckless roll can send it in', () => {
    const world = setUp(sloop.hullPoints);
    const { events } = run(world, 3, ISLANDS, { ...BOTS, finishChance: 1, finishRecklessChance: 0 });
    expect(events.find((e) => e.type === 'finishDecision')).toMatchObject({ go: false, canFinish: false });
  });
});

describe('berths (M3 step 5)', () => {
  it('a small harbour up an inlet has fewer berths; taken = other ships afloat at the anchorage', () => {
    const open = PORTS.find((p) => !p.path)!;
    const inlet = PORTS.find((p) => p.path)!;
    expect(open.berths).toBe(DAMAGE.port.berths);
    expect(inlet.berths).toBe(DAMAGE.port.berthsInlet);
    expect(inlet.berths).toBeLessThan(open.berths);
    const ships = [sloopAt(1, open.x, open.y), sloopAt(2, open.x + 30, open.y), sloopAt(3, open.x + 300, open.y), { ...sloopAt(4, open.x, open.y), sunk: true }];
    expect(berthsTaken(ships, open, 1)).toBe(1);
    const spot = berthWaitSpot(open, sloopAt(9, open.x, open.y + 600), sloop, ISLANDS, BOTS.berthWaitM);
    expect(Math.hypot(spot.x - open.x, spot.y - open.y)).toBeGreaterThan(DAMAGE.port.dockRange);
    expect(isOpenWater(spot.x, spot.y, sloop, ISLANDS, undefined, 10, 20)).toBe(true);
  });

  it('a full port: a hurt bot waits off it, and goes in when a berth is free', () => {
    const world = createWorld(6);
    const p = PORTS.find((q) => !q.path)!;
    const start = water(p.x, p.y + 550);
    const [me, bot] = world.ships;
    Object.assign(bot!, { x: start.x, y: start.y, hull: sloop.hullPoints * 0.2 });
    Object.assign(me!, { x: start.x, y: start.y + 2100 }); // the enemy far away
    // Three ships already lie at the anchorage.
    for (let k = 0; k < 3; k++) world.ships.push({ ...sloopAt(10 + k, p.x + (k - 1) * 25, p.y), team: 5 });
    world.bots = [newBot(bot!.id, me!.id, world)];
    const first = run(world, 70, ISLANDS, BOTS);
    expect(first.events.some((e) => e.type === 'berthWait' && e.shipId === 2)).toBe(true);
    expect(Math.hypot(bot!.x - p.x, bot!.y - p.y)).toBeGreaterThan(DAMAGE.port.dockRange);
    expect(world.bots[0]!.waitingBerth).toBe(true);
    // Two of them leave (sunk, for the test): a berth is free.
    world.ships[2]!.sunk = true;
    world.ships[3]!.sunk = true;
    run(world, 90, ISLANDS, BOTS);
    expect(Math.hypot(bot!.x - p.x, bot!.y - p.y)).toBeLessThan(DAMAGE.port.dockRange);
  });
});

describe('working free (M3 step 4c)', () => {
  function duel(): World {
    const north = -Math.PI / 2;
    return {
      tick: 1, rngState: 7, wind: { fromRad: north, strength: 0.7, baseFromRad: north },
      ships: [sloopAt(1, 0, -900, 0), sloopAt(2, 0, 0, north)],
      balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [newBot(2, 1, { rngState: 99 })],
    };
  }

  it('a bot that wanted to move but got nowhere for 15 s turns to an open, fast heading under full sail', () => {
    const world = duel();
    const bot = world.bots[0]!;
    bot.progress = { x: 0, y: 0, seconds: BOTS.stuckCheckSeconds - 0.01 };
    const commands = thinkBots(world, []);
    const event = world.events.find((e) => e.type === 'botUnstick');
    expect(event).toBeDefined();
    expect(bot.unstickLeft).toBeCloseTo(BOTS.unstickSeconds);
    expect(commands).toContainEqual({ type: 'setSails', shipId: 2, value: 1 });
    // The heading it picked is a fast one (no ship sails fast in irons).
    const h = bot.unstickHeadingRad!;
    expect(targetSpeed({ ...world.ships[1]!, headingRad: h, sailLevel: 1 }, sloop, world.wind)).toBeGreaterThan(sloop.maxSpeed * 0.5);
  });

  it('a bot that moved, or lies still on purpose, does not', () => {
    const world = duel();
    const bot = world.bots[0]!;
    bot.progress = { x: -100, y: 0, seconds: BOTS.stuckCheckSeconds };
    thinkBots(world, []);
    expect(world.events.some((e) => e.type === 'botUnstick')).toBe(false);
    world.tick += 3;
    bot.mode = 'idle';
    world.ships[0]!.sunk = true; // nothing to fight: it lies still
    bot.progress = { x: 0, y: 0, seconds: BOTS.stuckCheckSeconds };
    thinkBots(world, []);
    expect(world.events.some((e) => e.type === 'botUnstick')).toBe(false);
  });

  it('unstickHeading avoids land ahead', () => {
    const ship = sloopAt(2, 0, 0, 0);
    const wind = { fromRad: -Math.PI / 2, strength: 0.7 };
    // A wall of land to the east and the south.
    const wall: Island = { name: 'wall', points: [{ x: 40, y: -400 }, { x: 400, y: -400 }, { x: 400, y: 400 }, { x: -400, y: 400 }, { x: -400, y: 40 }, { x: 40, y: 40 }] } as Island;
    const h = unstickHeading(ship, sloop, [wall], wind);
    // West or north-west: away from the wall (x < 0 ahead) and not into the wind from the north.
    expect(Math.cos(h)).toBeLessThan(0);
  });
});

describe('chasing a runner (M3 step 4c)', () => {
  it('an enemy pulling away sets the pace: more sail than the usual fighting speed needs', () => {
    const sailsFor = (enemySpeed: number): number => {
      const north = -Math.PI / 2;
      const world: World = {
        tick: 1, rngState: 7, wind: { fromRad: north, strength: 0.7, baseFromRad: north },
        ships: [sloopAt(1, 0, -170, north, enemySpeed), sloopAt(2, 0, 0, 0)],
        balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [newBot(2, 1, { rngState: 99 })],
      };
      world.bots[0]!.personality.preferredRange = 150;
      const c = thinkBots(world, []).find((x) => x.type === 'setSails');
      return c && c.type === 'setSails' ? c.value : world.ships[1]!.sailLevel;
    };
    const steadyEnemy = sailsFor(0);
    const runner = sailsFor(9);
    expect(runner).toBeGreaterThan(steadyEnemy + 0.1);
  });
});
