// M3 step 6c: bots find their way round the land, small harbours take small ships, harbour boats
// tow, a rammer learns its trade (chain, grape, ram), and a port's way out.
import { describe, expect, it } from 'vitest';
import { chooseAmmo, headingVia, newBot, portExit, portsFor, thinkBots } from './bot';
import { BOTS, DAMAGE, SHIP_CLASSES } from './data';
import { inHarbour } from './port';
import type { Port } from './port';
import { stepShip } from './step';
import type { Island, ShipState, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const frigate = SHIP_CLASSES['frigate']!;

function at(id: number, x: number, y: number, headingRad = 0, speed = 0, shipClass = 'sloop'): ShipState {
  return {
    id, shipClass, x, y, headingRad, speed, rudder: 0, sailLevel: 0.5,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: SHIP_CLASSES[shipClass]!.hullPoints, sunk: false, battleSkill: 4, team: id, repairing: false,
  };
}

function world(ships: ShipState[]): World {
  const north = -Math.PI / 2;
  return { tick: 0, rngState: 3, wind: { fromRad: north, strength: 0.7, baseFromRad: north }, ships, balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [] };
}

const square = (name: string, x0: number, y0: number, x1: number, y1: number): Island => ({
  name,
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
});
const wall = square('wall', -20, -500, 20, 200);

describe('headingVia', () => {
  it('open water: straight at the goal; land between: along a way round it (south of the wall)', () => {
    const bot = newBot(1, 2, { rngState: 1 });
    const islands = [wall];
    const open = headingVia(bot, at(1, -200, 400), islands, { x: 200, y: 400 });
    expect(open).toBeCloseTo(0, 6);
    expect(bot.route).toBeUndefined();
    const round = headingVia(bot, at(1, -200, 0), islands, { x: 200, y: 0 });
    expect(Math.sin(round)).toBeGreaterThan(0.3); // heads south, round the end of the wall
    expect(bot.route).toBeDefined();
  });
});

describe('ports for big and small ships', () => {
  const inlet: Port = { name: 'Inlet', x: 0, y: 0, berths: 2, harbourR: 85, path: [{ x: 300, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 0 }] };
  const open: Port = { name: 'Open', x: 2000, y: 0, berths: 3 };
  it('a sloop may use a small harbour up an inlet; a frigate only an open anchorage', () => {
    expect(portsFor([inlet, open], sloop).map((p) => p.name)).toEqual(['Inlet', 'Open']);
    expect(portsFor([inlet, open], frigate).map((p) => p.name)).toEqual(['Open']);
  });
  it('the way out: off the inlet mouth; from an open anchorage: beyond its safe water on the ship side', () => {
    const out = portExit(inlet, at(1, 0, 0), 250);
    expect(out.x).toBeCloseTo(550, 6);
    const away = portExit(open, at(1, 2000, 100), 250);
    expect(away.y).toBeCloseTo(DAMAGE.port.safeRange + 250, 6);
  });
  it('the harbour (towing) area: along the inlet and at the anchorage, not outside', () => {
    expect(inHarbour(250, 20, [inlet])).toBe(true);
    expect(inHarbour(250, 80, [inlet])).toBe(false);
    expect(inHarbour(2050, 0, [open])).toBe(true);
    expect(inHarbour(2200, 0, [open])).toBe(false);
  });
});

describe('harbour boats tow (stepShip with towMps)', () => {
  it('bow into the wind with sails set: still moves at the tow speed; with the sails down it stops', () => {
    const wind = { fromRad: -Math.PI / 2, strength: 0.7 };
    const ship = { ...at(1, 0, 0, -Math.PI / 2), sailLevel: 1 };
    for (let i = 0; i < 1800; i++) stepShip(ship, sloop, wind, 1 / 30, undefined, DAMAGE.port.towMps);
    expect(ship.speed).toBeCloseTo(DAMAGE.port.towMps, 1);
    const still = { ...at(2, 0, 0, -Math.PI / 2), sailLevel: 0 };
    for (let i = 0; i < 300; i++) stepShip(still, sloop, wind, 1 / 30, undefined, DAMAGE.port.towMps);
    expect(still.speed).toBeCloseTo(0, 6);
  });
});

describe('the rammer', () => {
  it('chooses chain shot at middle range (whatever the enemy speed) and grape closer than rammerGrapeM', () => {
    const me = at(1, 0, 0, 0, 6);
    const slow = at(2, 120, 0, 0, 2);
    expect(chooseAmmo(me, sloop, slow, 120)).toBe('round'); // a usual bot: the enemy is slower, round shot
    expect(chooseAmmo(me, sloop, slow, 120, BOTS, true)).toBe('chain');
    expect(chooseAmmo(me, sloop, slow, BOTS.rammerGrapeM - 5, BOTS, true)).toBe('grape');
  });
  it('a ram that strikes the enemy makes the bot a rammer (and says so)', () => {
    const me = at(1, 0, 0, 0, 6);
    const enemy = at(2, 40, 0, Math.PI / 2, 2);
    const w = world([me, enemy]);
    w.tick = 2; // bot 1 thinks on this tick
    const bot = newBot(1, 2, w);
    bot.mode = 'ram';
    bot.ramLeft = 10;
    w.bots = [bot];
    w.contacts = [{ a: 1, b: 2, untilTick: 100, avoidUntilTick: 200 }];
    thinkBots(w, []);
    expect(bot.rammer).toBe(true);
    expect(w.events.some((e) => e.type === 'rammerLearned' && e.shipId === 1)).toBe(true);
    expect(bot.mode).toBe('engage');
    expect(bot.ramMemory).toBe(BOTS.rammerMemorySeconds);
  });
});
