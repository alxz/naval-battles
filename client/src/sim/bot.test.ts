import { describe, expect, it } from 'vitest';
import { twaDeg } from './angles';
import { aimElevation, aimPoint, avoidLand, avoidShips, broadsideHeading, fleeHeading, newBot, sailsForSpeed, steerWithTacks, thinkBots, updateMode } from './bot';
import { applyCommand } from './commands';
import { BOTS, DAMAGE, SHIP_CLASSES } from './data';
import { predictLanding } from './guns';
import { STEP_SECONDS, stepWorld, targetSpeed } from './step';
import type { Island, ShipState, SimEvent, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const fromNorth = { fromRad: -Math.PI / 2, strength: 0.7 };
const steady = { speedScale: 1, windDrift: false };

function sloopAt(id: number, x: number, y: number, headingRad = 0, speed = 0): ShipState {
  return {
    id, shipClass: 'sloop', x, y, headingRad, speed, rudder: 0, sailLevel: 0,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: sloop.hullPoints, sunk: false, battleSkill: 4, team: id === 1 ? 0 : 1, repairing: false,
  };
}

/** Player (id 1) lying still at the origin; bot (id 2) somewhere else. Wind from the north. */
function duel(botX: number, botY: number, botHeading = 0): World {
  return {
    tick: 0, rngState: 7, wind: { ...fromNorth, baseFromRad: fromNorth.fromRad },
    ships: [sloopAt(1, 0, 0, Math.PI / 2), sloopAt(2, botX, botY, botHeading)],
    balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [newBot(2, 1, { rngState: 99 })],
  };
}

/** Run the world with its bots, like Simulation does. Returns every event. */
function run(world: World, seconds: number, islands: readonly Island[] = [], each?: (w: World) => void): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) {
    for (const c of thinkBots(world, islands)) applyCommand(world, c);
    stepWorld(world, STEP_SECONDS, steady, islands);
    events.push(...world.events);
    each?.(world);
  }
  return events;
}

describe('sailsForSpeed', () => {
  it('gives the sail share that makes the wanted speed', () => {
    const ship = sloopAt(2, 0, 0, 0); // heading east, wind from the north: a beam reach
    const sails = sailsForSpeed(ship, sloop, fromNorth, 4.5, 0.25);
    expect(targetSpeed({ ...ship, sailLevel: sails }, sloop, fromNorth)).toBeCloseTo(4.5, 6);
  });

  it('less sail on a fast course, full sail in irons, never below the minimum', () => {
    const reach = sailsForSpeed(sloopAt(2, 0, 0, 0), sloop, fromNorth, 4.5, 0.25);
    const closeHauled = sailsForSpeed(sloopAt(2, 0, 0, -Math.PI / 2 + 0.85), sloop, fromNorth, 4.5, 0.25);
    expect(closeHauled).toBeGreaterThan(reach);
    expect(sailsForSpeed(sloopAt(2, 0, 0, -Math.PI / 2), sloop, fromNorth, 4.5, 0.25)).toBe(1);
    expect(sailsForSpeed(sloopAt(2, 0, 0, 0), sloop, fromNorth, 0.1, 0.25)).toBe(0.25);
  });
});

describe('steerWithTacks', () => {
  it('follows a goal that is not into the wind', () => {
    const bot = newBot(2, 1, { rngState: 1 });
    expect(steerWithTacks(0, sloop, fromNorth, bot, BOTS)).toBe(0);
    expect(bot.tack).toBe(0);
  });

  it('beats close-hauled on the nearer tack, then keeps it until the cooldown has passed', () => {
    const bot = newBot(2, 1, { rngState: 1 });
    const slightlyEast = -Math.PI / 2 + 0.1; // the goal is a little clockwise of the wind
    const h = steerWithTacks(slightlyEast, sloop, fromNorth, bot, BOTS);
    expect(bot.tack).toBe(1);
    expect(twaDeg(h, fromNorth.fromRad)).toBeCloseTo(40 + BOTS.closeHauledMarginDeg, 6);
    // The goal moves a little to the other side: no flip before the cooldown...
    const slightlyWest = -Math.PI / 2 - 0.1;
    bot.tackSeconds = BOTS.tackCooldownSeconds - 1;
    steerWithTacks(slightlyWest, sloop, fromNorth, bot, BOTS);
    expect(bot.tack).toBe(1);
    // ...after it, the bot goes about.
    bot.tackSeconds = BOTS.tackCooldownSeconds;
    steerWithTacks(slightlyWest, sloop, fromNorth, bot, BOTS);
    expect(bot.tack).toBe(-1);
  });
});

describe('broadsideHeading', () => {
  const east = 0;
  it('puts the chosen side toward the enemy at the preferred range', () => {
    // Enemy to the east: port to it means heading south (90 deg clockwise), starboard means north.
    expect(broadsideHeading(east, BOTS.preferredRange, 'port', BOTS)).toBeCloseTo(Math.PI / 2, 6);
    expect(broadsideHeading(east, BOTS.preferredRange, 'starboard', BOTS)).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('bends a little when a little off the preferred range (a smooth pull, no dead band)', () => {
    const half = ((BOTS.rangeBendDeg / 2) * Math.PI) / 180;
    expect(broadsideHeading(east, BOTS.preferredRange + BOTS.rangeBand / 2, 'port', BOTS)).toBeCloseTo(Math.PI / 2 - half, 6);
  });

  it('bends the bow toward a far enemy and away from a near one', () => {
    const bend = (BOTS.rangeBendDeg * Math.PI) / 180;
    expect(broadsideHeading(east, 300, 'port', BOTS)).toBeCloseTo(Math.PI / 2 - bend, 6); // south-east-ish: closer
    expect(broadsideHeading(east, 60, 'port', BOTS)).toBeCloseTo(Math.PI / 2 + bend, 6); // south-west-ish: away
  });
});

describe('aiming', () => {
  it('aimElevation lands the middle ball at the wanted distance (within one ball step, 2.5 m)', () => {
    const ship = sloopAt(2, 0, 0, 0);
    for (const d of [80, 150, 200]) {
      const e = aimElevation(ship, sloop, 'starboard', d, 10)!;
      const p = predictLanding({ ...ship, elevationDeg: e }, sloop, 'starboard', STEP_SECONDS);
      expect(Math.abs(Math.hypot(p.x, p.y) - d)).toBeLessThan(2.5); // a ball moves 2.5 m per step, so the landing distance comes in steps
    }
    expect(aimElevation(ship, sloop, 'starboard', 400, 10)).toBeNull();
  });

  it('aimPoint leads a moving enemy by its motion relative to ours', () => {
    const me = sloopAt(2, 0, 0, 0, 3); // 3 m/s east
    const enemy = sloopAt(1, 0, 150, 0, 5); // 5 m/s east, 150 m south
    const p = aimPoint(me, enemy, 2);
    expect(p.x).toBeCloseTo(4, 6); // (5 - 3) m/s x 2 s
    expect(p.y).toBeCloseTo(150, 6);
  });
});

describe('avoidLand', () => {
  const wall: Island = { name: 'wall', points: [{ x: 50, y: -200 }, { x: 80, y: -200 }, { x: 80, y: 200 }, { x: 50, y: 200 }] };
  it('nothing to do in open water; a free heading when land is ahead', () => {
    const ship = sloopAt(2, 0, 0, 0, 5);
    expect(avoidLand(ship, sloop, [wall], Math.PI, BOTS)).toBeNull(); // heading west: open sea
    const h = avoidLand(ship, sloop, [wall], 0, BOTS); // heading east: the wall is 50 m ahead
    expect(h).not.toBeNull();
    expect(Math.abs(Math.cos(h!))).toBeLessThan(0.75); // turned at least 45 degrees off
  });
});

describe('bot scenarios (headless)', () => {
  it('from 400 m it closes in, turns its side, fires and hits a ship lying still', () => {
    const w = duel(-400, 0, 0);
    const events = run(w, 180);
    const shots = events.filter((e) => e.type === 'gunFired' && e.shipId === 2).length;
    const hits = events.filter((e) => e.type === 'hit' && e.byShipId === 2).length;
    expect(shots).toBeGreaterThanOrEqual(12); // at least 3 broadsides of 4
    expect(hits).toBeGreaterThan(0);
    expect(w.ships[0]!.hull).toBeLessThan(sloop.hullPoints);
  });

  it('beats upwind to reach an enemy straight to windward, tacking without flip-flop', () => {
    const w = duel(0, 700, -Math.PI / 2); // the bot is 700 m south (downwind), heading north into the wind
    let closest = Infinity;
    let tackChanges = 0;
    let lastTack = 0;
    run(w, 240, [], (world) => {
      const [me, bot] = world.ships;
      closest = Math.min(closest, Math.hypot(bot!.x - me!.x, bot!.y - me!.y));
      const tack = world.bots[0]!.tack;
      if (tack !== 0 && lastTack !== 0 && tack !== lastTack) tackChanges++;
      if (tack !== 0) lastTack = tack;
    });
    expect(closest).toBeLessThan(BOTS.engageRange);
    expect(tackChanges).toBeGreaterThanOrEqual(1);
    expect(tackChanges).toBeLessThanOrEqual(240 / BOTS.tackCooldownSeconds);
  });

  it('from leeward it closes in to its preferred range and stays there (no hovering at long range)', () => {
    const w = duel(0, 240, -Math.PI / 2); // 240 m straight downwind of you
    const late: number[] = [];
    run(w, 150, [], (world) => {
      world.ships[0]!.hull = sloop.hullPoints; // keep you afloat for the whole test
      if (world.tick > 100 * 30) late.push(Math.hypot(world.ships[1]!.x, world.ships[1]!.y));
    });
    const preferred = w.bots[0]!.personality.preferredRange;
    const average = late.reduce((a, b) => a + b, 0) / late.length;
    expect(Math.abs(average - preferred)).toBeLessThan(BOTS.rangeBand);
  });

  it('keeps clear of an island between it and the enemy', () => {
    const island: Island = { name: 'cay', points: [{ x: -260, y: -120 }, { x: -200, y: -120 }, { x: -200, y: 120 }, { x: -260, y: 120 }] };
    const w = duel(-500, 0, 0);
    let aground = 0;
    run(w, 150, [island], (world) => {
      if (world.ships[1]!.aground) aground++;
    });
    expect(aground).toBe(0);
  });

  it('lies still once the enemy is sunk', () => {
    const w = duel(-150, 0, 0);
    w.ships[0]!.sunk = true;
    run(w, 10);
    expect(w.bots[0]!.mode).toBe('idle');
    expect(w.ships[1]!.sailLevel).toBe(0);
  });

  it('the same seed gives the same fight', () => {
    const a = duel(-300, 50, 0);
    const b = duel(-300, 50, 0);
    run(a, 60);
    run(b, 60);
    expect(a.ships).toEqual(b.ships);
  });
});

describe('setBot command', () => {
  it('adds a bot with fresh memory and removes it', () => {
    const w = duel(-100, 0);
    w.bots = [];
    applyCommand(w, { type: 'setBot', shipId: 2, enemyId: 1 });
    expect(w.bots.length).toBe(1);
    expect(w.bots[0]!.shipId).toBe(2);
    expect(w.bots[0]!.enemyId).toBe(1);
    expect(w.bots[0]!.mode).toBe('chase');
    applyCommand(w, { type: 'setBot', shipId: 2, enemyId: null });
    expect(w.bots).toEqual([]);
  });
});

describe('personality', () => {
  it('every bot gets its own values inside the ranges of bots.json; the same seed gives the same bot', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const b = newBot(2, 1, { rngState: seed }).personality;
      expect(b.preferredRange).toBeGreaterThanOrEqual(BOTS.preferredRange - BOTS.preferredRangeSpread);
      expect(b.preferredRange).toBeLessThanOrEqual(BOTS.preferredRange + BOTS.preferredRangeSpread);
      expect(b.patienceSeconds).toBeGreaterThanOrEqual(BOTS.patienceMinSeconds);
      expect(b.patienceSeconds).toBeLessThanOrEqual(BOTS.patienceMaxSeconds);
      expect(b.aimErrorSigmaDeg).toBeGreaterThanOrEqual(BOTS.aimErrorMinDeg);
      expect(b.aimErrorSigmaDeg).toBeLessThanOrEqual(BOTS.aimErrorMaxDeg);
      seen.add(Math.round(b.preferredRange));
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(newBot(2, 1, { rngState: 3 })).toEqual(newBot(2, 1, { rngState: 3 }));
  });
});

describe('updateMode (giving up a chase)', () => {
  it('a chase that does not gain turns into a break-off, then a new chase', () => {
    const bot = newBot(2, 1, { rngState: 1 });
    updateMode(bot, 600, 0, BOTS); // a new window starts at 600 m (from chase with no start yet: keeps chasing)
    bot.chaseStartDistance = 600;
    updateMode(bot, 590, bot.personality.patienceSeconds, BOTS); // only 10 m gained in the whole window
    expect(bot.mode).toBe('breakOff');
    updateMode(bot, 700, BOTS.breakOffSeconds, BOTS);
    expect(bot.mode).toBe('chase');
    expect(bot.chaseStartDistance).toBe(700);
  });

  it('a chase that gains keeps going; any mode turns to engage within range', () => {
    const bot = newBot(2, 1, { rngState: 1 });
    bot.chaseStartDistance = 600;
    updateMode(bot, 500, bot.personality.patienceSeconds, BOTS); // 100 m gained
    expect(bot.mode).toBe('chase');
    bot.mode = 'breakOff';
    bot.breakOffLeft = 50;
    updateMode(bot, BOTS.engageRange - 1, 0.1, BOTS);
    expect(bot.mode).toBe('engage');
  });
});

describe('escaping (headless)', () => {
  it('a ship as fast as the bot, running away on the same course, can get away', () => {
    // Both sloops run west, wind from the east (dead downwind for both); the player is 400 m ahead.
    const w = duel(400, 0, Math.PI);
    w.ships[0] = { ...w.ships[0]!, x: 0, y: 0, headingRad: Math.PI, sailLevel: 1 };
    w.ships[1] = { ...w.ships[1]!, x: 400, y: 0, headingRad: Math.PI };
    w.wind = { fromRad: 0, strength: 0.7, baseFromRad: 0 };
    let brokeOff = false;
    run(w, 300, [], (world) => {
      if (world.bots[0]!.mode === 'breakOff') brokeOff = true;
    });
    const [me, bot] = w.ships;
    expect(brokeOff).toBe(true);
    expect(Math.hypot(bot!.x - me!.x, bot!.y - me!.y)).toBeGreaterThan(BOTS.chaseAgainRange);
  });
});

describe('fleeing and repair (package B)', () => {
  it('updateMode: low hull -> flee; far enough -> repair; enemy near again -> flee; mended -> chase', () => {
    const bot = newBot(2, 1, { rngState: 1 });
    updateMode(bot, 150, 0.1, BOTS, 0.9);
    expect(bot.mode).toBe('engage');
    updateMode(bot, 150, 0.1, BOTS, BOTS.fleeHullShare - 0.05);
    expect(bot.mode).toBe('flee');
    updateMode(bot, 200, 0.1, BOTS, 0.2); // still close: keeps running, does not fight
    expect(bot.mode).toBe('flee');
    updateMode(bot, DAMAGE.repair.safeRange + 150, 0.1, BOTS, 0.2);
    expect(bot.mode).toBe('repair');
    updateMode(bot, DAMAGE.repair.safeRange - 10, 0.1, BOTS, 0.4);
    expect(bot.mode).toBe('flee');
    updateMode(bot, 2000, 0.1, BOTS, 0.4);
    expect(bot.mode).toBe('repair');
    updateMode(bot, 2000, 0.1, BOTS, DAMAGE.repair.seaMaxShare);
    expect(bot.mode).toBe('chase');
  });

  it('fleeHeading: away from the enemy, bent toward a faster course when dead downwind is slow', () => {
    const ship = sloopAt(2, 0, 0);
    // Enemy to the north, wind from the north: straight away is dead downwind (slower than a broad reach).
    const h = fleeHeading(ship, sloop, fromNorth, -Math.PI / 2);
    expect(Math.sin(h)).toBeGreaterThan(0.7); // still mostly south (away)
    expect(Math.abs(Math.cos(h))).toBeGreaterThan(0.2); // but not dead downwind
    // Enemy to the west, wind from the north: away = east = a beam reach, fast; stays near it.
    const h2 = fleeHeading(ship, sloop, fromNorth, Math.PI);
    expect(Math.cos(h2)).toBeGreaterThan(0.7);
  });

  it('avoidShips: turns away from a ship close ahead, ignores one behind, far away or sunk', () => {
    const me = sloopAt(2, 0, 0, 0); // heading east
    const ahead = sloopAt(3, 60, 10); // close ahead, a little to starboard (south)
    const h = avoidShips(me, sloop, [me, ahead], 0, BOTS)!;
    expect(h).toBeLessThan(0); // turns to port (north), away from it
    expect(avoidShips(me, sloop, [me, sloopAt(3, -60, 0)], 0, BOTS)).toBeNull();
    expect(avoidShips(me, sloop, [me, sloopAt(3, 400, 0)], 0, BOTS)).toBeNull();
    expect(avoidShips(me, sloop, [me, { ...ahead, sunk: true }], 0, BOTS)).toBeNull();
  });

  it('scenario: a badly hurt bot runs, mends to 75% at sea and comes back', () => {
    const w = duel(-200, 0, 0);
    w.ships[1]!.hull = sloop.hullPoints * 0.2;
    const modes = new Set<string>();
    let lowest = Infinity;
    run(w, 420, [], (world) => {
      world.ships[0]!.hull = sloop.hullPoints; // you stay afloat
      modes.add(world.bots[0]!.mode);
      if (world.bots[0]!.mode === 'repair') lowest = Math.min(lowest, world.ships[1]!.hull);
      if (world.ships[1]!.hull < sloop.hullPoints * 0.15) world.ships[1]!.hull = sloop.hullPoints * 0.15; // your gunner is not part of this test
    });
    expect(modes.has('flee')).toBe(true);
    expect(modes.has('repair')).toBe(true);
    expect(modes.has('chase')).toBe(true); // it came back
  });

  it('scenario: three bots against you do not ram each other', () => {
    const w = duel(-400, 0, 0);
    w.ships.push({ ...sloopAt(3, -420, 60, 0), team: 1 }, { ...sloopAt(4, -380, -60, 0), team: 1 });
    w.bots.push(newBot(3, 1, { rngState: 5 }), newBot(4, 1, { rngState: 6 }));
    let collisions = 0;
    const events = run(w, 150, [], (world) => {
      world.ships[0]!.hull = sloop.hullPoints;
    });
    for (const e of events) if (e.type === 'collision' && e.damageA + e.damageB > 0) collisions++;
    expect(collisions).toBeLessThanOrEqual(1);
    expect(events.some((e) => e.type === 'hit' && e.shipId === 1)).toBe(true); // and they still fight you
  });
});
