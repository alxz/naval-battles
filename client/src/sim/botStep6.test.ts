// M3 step 6 (D45): bot seamanship part 2: cut a runner off, wear instead of tacking,
// keep clear alongside, turn away after a collision, ram on purpose (with a roll).
import { describe, expect, it } from 'vitest';
import { avoidShips, interceptBearing, newBot, rudderFor, shapeRudder, thinkBots } from './bot';
import { BOTS, SHIP_CLASSES } from './data';
import type { ShipState, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const frigate = SHIP_CLASSES['frigate']!;
const brig = SHIP_CLASSES['brigantine']!;

function at(id: number, x: number, y: number, headingRad = 0, speed = 0, shipClass = 'sloop'): ShipState {
  return {
    id, shipClass, x, y, headingRad, speed, rudder: 0, sailLevel: 0.5,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: SHIP_CLASSES[shipClass]!.hullPoints, sunk: false, battleSkill: 4, team: id, repairing: false,
  };
}

function world(ships: ShipState[]): World {
  const north = -Math.PI / 2;
  return { tick: 1, rngState: 3, wind: { fromRad: north, strength: 0.7, baseFromRad: north }, ships, balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [] };
}

describe('interceptBearing', () => {
  it('a ship lying still: straight at it; a ship crossing: ahead of it, never more than leadMaxSeconds ahead', () => {
    const me = at(1, 0, 0, 0, 10);
    expect(interceptBearing(me, at(2, 300, 0))).toBeCloseTo(0, 6);
    // It sails south at 8 m/s, 300 m east of us: aim south of east.
    const b = interceptBearing(me, at(2, 300, 0, Math.PI / 2, 8));
    expect(b).toBeGreaterThan(0.3);
    expect(b).toBeLessThan(Math.PI / 2);
    const far = interceptBearing(at(1, 0, 0, 0, 0), at(2, 3000, 0, Math.PI / 2, 8)); // slow chaser: capped lead
    expect(Math.tan(far) * 3000).toBeCloseTo(8 * BOTS.leadMaxSeconds, 0);
  });
});

describe('rudderFor: wearing instead of tacking', () => {
  const wind = { fromRad: -Math.PI / 2, strength: 0.7 }; // from the north
  it('a slow square rig on starboard tack (heading north-east) told to go north-west turns the long way, through downwind', () => {
    const ship = at(1, 0, 0, -Math.PI / 4 + 0.3, 4, 'frigate');
    const goal = (-3 * Math.PI) / 4 - 0.3;
    expect(rudderFor(ship, frigate, goal, wind)).toBeGreaterThan(0); // clockwise: away from the wind
    // M3 step 6c: with good way on (wearBelowMpsSquare or faster) a square rig goes about through the wind.
    expect(rudderFor({ ...ship, speed: BOTS.wearBelowMpsSquare + 1 }, frigate, goal, wind)).toBeLessThan(0);
    // A sloop just tacks (anticlockwise, through the wind).
    expect(rudderFor({ ...ship, shipClass: 'sloop' }, sloop, goal, wind)).toBeLessThan(0);
    // A brigantine tacks when it has way on, wears when slow.
    expect(rudderFor({ ...ship, speed: 8 }, brig, goal, wind)).toBeLessThan(0);
    expect(rudderFor({ ...ship, speed: 2 }, brig, goal, wind)).toBeGreaterThan(0);
  });

  it('a turn that does not cross the wind is the short one for every rig', () => {
    const ship = at(1, 0, 0, 0, 6, 'frigate');
    expect(rudderFor(ship, frigate, Math.PI / 2, wind)).toBeGreaterThan(0);
  });
});

describe('avoidShips alongside', () => {
  it('a ship close alongside: bear away from it; at a safe distance or the ram target: no change', () => {
    const me = at(1, 0, 0, 0, 6);
    const near = at(2, 10, 20, 0, 6); // to starboard, sides about 8 m apart
    const h = avoidShips(me, sloop, [me, near], 0, BOTS);
    expect(h).not.toBeNull();
    expect(h!).toBeLessThan(0); // turned to port, away from it
    expect(avoidShips(me, sloop, [me, at(2, 10, 60, 0, 6)], 0, BOTS)).toBeNull();
    expect(avoidShips(me, sloop, [me, near], 0, BOTS, 2)).toBeNull();
  });
});

describe('after a collision and ramming (thinkBot)', () => {
  it('just collided with a ship it did not mean to ram: turns away and eases sail', () => {
    const me = at(1, 0, -900, 0, 0); // the bot's enemy, far away
    const bot = at(2, 0, 0, 0, 6);
    const other = at(3, 0, 18, 0, 6); // the ship it touched, to starboard
    const w = world([me, bot, other]);
    w.bots = [newBot(2, 1, { rngState: 9 })];
    w.contacts = [{ a: 2, b: 3, untilTick: 60 }];
    const c = thinkBots(w, []);
    const rudder = c.find((x) => x.type === 'setRudder');
    const sails = c.find((x) => x.type === 'setSails');
    expect(rudder && rudder.type === 'setRudder' && rudder.value).toBeLessThan(0); // to port, away
    expect(sails && sails.type === 'setSails' && sails.value).toBeLessThanOrEqual(BOTS.minSails);
  });

  it('a heavy, faster bot close to a slow enemy weighs a ram; with the roll it goes for it bow first', () => {
    const enemy = at(1, 120, 0, Math.PI / 2, 2); // a sloop crawling south, 120 m east
    const bot = at(2, 0, 0, 0, 8, 'frigate');
    const w = world([enemy, bot]);
    w.bots = [newBot(2, 1, { rngState: 9 })];
    w.bots[0]!.mode = 'engage';
    thinkBots(w, [], { ...BOTS, ramChance: 1 });
    expect(w.events.find((e) => e.type === 'ramDecision')).toMatchObject({ go: true, enemyId: 1 });
    expect(w.bots[0]!.mode).toBe('ram');
    // Without the roll: no ram, and it does not ask again for a while.
    const w2 = world([at(1, 120, 0, Math.PI / 2, 2), at(2, 0, 0, 0, 8, 'frigate')]);
    w2.bots = [newBot(2, 1, { rngState: 9 })];
    w2.bots[0]!.mode = 'engage';
    thinkBots(w2, [], { ...BOTS, ramChance: 0 });
    expect(w2.bots[0]!.mode).not.toBe('ram');
    expect(w2.bots[0]!.ramMemory).toBeCloseTo(BOTS.ramMemorySeconds);
  });

  it('a light, slow bot does not even weigh a ram against a sound frigate', () => {
    const w = world([at(1, 120, 0, 0, 8, 'frigate'), at(2, 0, 0, 0, 6)]);
    w.bots = [newBot(2, 1, { rngState: 9 })];
    w.bots[0]!.mode = 'engage';
    thinkBots(w, [], { ...BOTS, ramChance: 1 });
    expect(w.events.some((e) => e.type === 'ramDecision')).toBe(false);
  });
});

describe('shapeRudder (5c): a dead band and a slow helm', () => {
  const dead = BOTS.rudderGain * (BOTS.rudderDeadDeg * Math.PI) / 180;
  it('a small error gets no rudder; beyond the band it grows from zero', () => {
    expect(shapeRudder(dead * 0.9, 0)).toBe(0);
    expect(shapeRudder(-dead * 0.9, 0)).toBe(0);
    expect(shapeRudder(dead + 0.1, 0)).toBeCloseTo(0.1, 9);
    expect(shapeRudder(-dead - 0.1, 0)).toBeCloseTo(-0.1, 9);
  });
  it('the rudder moves at most rudderSlewPerThink per decision, either way', () => {
    expect(shapeRudder(1 + dead, 0)).toBeCloseTo(BOTS.rudderSlewPerThink, 9);
    expect(shapeRudder(-1 - dead, 0.1)).toBeCloseTo(0.1 - BOTS.rudderSlewPerThink, 9);
    expect(shapeRudder(0, 0.9)).toBeCloseTo(0.9 - BOTS.rudderSlewPerThink, 9);
  });
  it('a steady error reaches full rudder after 1 / slew decisions', () => {
    let r = 0;
    for (let i = 0; i < Math.ceil(1 / BOTS.rudderSlewPerThink); i++) r = shapeRudder(1 + dead, r);
    expect(r).toBe(1);
  });
});
