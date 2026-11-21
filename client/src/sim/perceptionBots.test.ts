// M4b step 2: the bots decide only from what they have seen (their contacts).
import { describe, expect, it } from 'vitest';
import { createArenaWorld, chooseTargets } from './arena';
import { newBot, thinkBots } from './bot';
import { applyCommand } from './commands';
import { SHIP_CLASSES } from './data';
import { believedShip, contactOf } from './perception';
import { STEP_SECONDS, stepWorld } from './step';
import type { Island, ShipState, SimEvent, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const steady = { speedScale: 1, windDrift: false };

function sloopAt(id: number, x: number, y: number, headingRad = 0, speed = 0): ShipState {
  return {
    id, shipClass: 'sloop', x, y, headingRad, speed, rudder: 0, sailLevel: 0,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: sloop.hullPoints, sunk: false, battleSkill: 4, team: id === 1 ? 0 : 1, repairing: false,
  };
}

/** Ship 1 (the enemy) lying still; ship 2 is a bot after it. Open sea, wind from the north. */
function duel(botX: number, botY: number, enemyX = 0, enemyY = 0): World {
  return {
    tick: 0, rngState: 7, wind: { fromRad: -Math.PI / 2, strength: 0.7, baseFromRad: -Math.PI / 2 },
    ships: [sloopAt(1, enemyX, enemyY, Math.PI / 2), sloopAt(2, botX, botY, 0)],
    balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [newBot(2, 1, { rngState: 99 })],
  };
}

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

describe('believedShip', () => {
  it('no contact: nothing is known (and with no lists at all, the real ship, for the old rules)', () => {
    const w = duel(2500, 0);
    expect(believedShip(w, 2, 1, 'sloop')?.id).toBe(1); // perception has not run yet
    stepWorld(w, STEP_SECONDS, steady, []);
    expect(believedShip(w, 2, 1, 'sloop')).toBeUndefined(); // 2500 m: out of sight
  });
  it('the hull of a ship is known only from close by; far off it is taken as sound', () => {
    const w = duel(500, 0);
    w.ships[0]!.hull = sloop.hullPoints * 0.3;
    stepWorld(w, STEP_SECONDS, steady, []);
    expect(believedShip(w, 2, 1, 'sloop')!.hull).toBe(sloop.hullPoints); // 500 m: the silhouette only
    const near = duel(150, 0);
    near.ships[0]!.hull = sloop.hullPoints * 0.3;
    stepWorld(near, STEP_SECONDS, steady, []);
    expect(believedShip(near, 2, 1, 'sloop')!.hull).toBeCloseTo(sloop.hullPoints * 0.3, 6);
  });
  it('out of view: at the last known place, not moving', () => {
    const w = duel(500, 0);
    w.ships[0]!.speed = 3;
    stepWorld(w, STEP_SECONDS, steady, []);
    w.ships[0]!.x = -5000;
    w.tick = 10;
    stepWorld(w, STEP_SECONDS, steady, []);
    const b = believedShip(w, 2, 1, 'sloop')!;
    expect(contactOf(w, 2, 1)?.visible).toBe(false);
    expect(Math.abs(b.x)).toBeLessThan(10);
    expect(b.speed).toBe(0);
  });
});

describe('bots act on their contacts', () => {
  it('an enemy out of sight: no shot, the bot sails on (a search) instead of lying still', () => {
    const w = duel(1800, 0);
    const events = run(w, 30);
    expect(events.some((e) => e.type === 'gunFired')).toBe(false);
    expect(w.bots[0]!.mode).toBe('trade');
    expect(w.ships[1]!.sailLevel).toBeGreaterThan(0);
  });
  it('an enemy in view is hunted, and it is fought as before', () => {
    const w = duel(600, 0);
    const events = run(w, 90);
    expect(events.some((e) => e.type === 'gunFired' && e.shipId === 2)).toBe(true);
  });
  it('an enemy lost from view: the bot goes to the last place it was seen, and does not fire at the empty sea', () => {
    const w = duel(700, 0);
    run(w, 3); // it sees the enemy at 700 m
    expect(contactOf(w, 2, 1)?.visible).toBe(true);
    // The enemy is gone (far away, out of sight).
    w.ships[0]!.x = -6000;
    const before = Math.hypot(w.ships[1]!.x, w.ships[1]!.y);
    const events = run(w, 12);
    expect(contactOf(w, 2, 1)?.visible).toBe(false);
    expect(events.filter((e) => e.type === 'gunFired').length).toBe(0);
    expect(Math.hypot(w.ships[1]!.x, w.ships[1]!.y)).toBeLessThan(before); // closer to where the enemy was
  });
});

describe('choosing a target (arena)', () => {
  const hill: Island[] = [{ name: 'test hill', points: [{ x: -60, y: -120 }, { x: 60, y: -120 }, { x: 60, y: 120 }, { x: -60, y: 120 }] }];
  it('a ship hidden behind an island is not chosen, though it is nearer than the one in view', () => {
    const w = createArenaWorld(31, 3);
    const [a, b, c] = w.ships as [ShipState, ShipState, ShipState];
    for (const s of w.ships.slice(3)) { s.x = 5000; s.y = 5000; }
    Object.assign(a, { x: -300, y: 0, headingRad: 0, speed: 0 }); // the bot
    Object.assign(b, { x: 300, y: 0 }); // behind the hill: 600 m, hidden
    Object.assign(c, { x: -300, y: 700 }); // in view, 700 m, but the hill is not in the way
    stepWorld(w, STEP_SECONDS, steady, hill);
    expect(contactOf(w, a.id, b.id)).toBeUndefined();
    expect(contactOf(w, a.id, c.id)?.visible).toBe(true);
    w.bots[0]!.enemyId = -1;
    w.arena!.retargetSeconds = 0;
    chooseTargets(w);
    expect(w.bots[0]!.enemyId).toBe(c.id);
  });
});
