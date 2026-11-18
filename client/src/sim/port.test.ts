import { describe, expect, it } from 'vitest';
import { thinkBots, newBot } from './bot';
import { applyCommand } from './commands';
import { BOTS, DAMAGE, ISLANDS, SHIP_CLASSES } from './data';
import { damageHull } from './damage';
import { PORTS, inSafeWater, isDocked, nearestPort, portWaypoint, portsOf, stepPortRepair } from './port';
import type { Port } from './port';
import { STEP_SECONDS, stepWorld } from './step';
import { createWorld } from './world';

const port: Port = { name: 'Test port', x: 1000, y: 1000, berths: 3 };
const ports = [port];

describe('ports', () => {
  it('the sea has two ports: the village and the harbour up the inlet', () => {
    expect(PORTS).toHaveLength(2);
    expect(PORTS.filter((p) => p.path)).toHaveLength(1);
    expect(portsOf(ISLANDS)[0]).toEqual(PORTS[0]);
  });

  it('nearestPort gives the port and the distance; no ports gives null', () => {
    expect(nearestPort(1000, 1300, ports)).toEqual({ port, distance: 300 });
    expect(nearestPort(0, 0, [])).toBeNull();
  });

  it('safe water reaches safeRange from the anchorage', () => {
    expect(inSafeWater(1000, 1000 + DAMAGE.port.safeRange - 1, ports)).toBe(true);
    expect(inSafeWater(1000, 1000 + DAMAGE.port.safeRange + 1, ports)).toBe(false);
    expect(inSafeWater(1000, 1000, [])).toBe(false);
  });

  it('a ship in safe water takes no ramming damage; outside it does', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    ship.x = port.x + 50;
    ship.y = port.y;
    const before = ship.hull;
    damageHull(world, ship, 30, 2, ports);
    expect(ship.hull).toBe(before);
    ship.x = port.x + DAMAGE.port.safeRange + 50;
    damageHull(world, ship, 30, 2, ports);
    expect(ship.hull).toBe(before - 30);
  });

  it('a ship in the safe water of the real port can fire, but pays for it and becomes an offender (port law)', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    ship.x = PORTS[0]!.x;
    ship.y = PORTS[0]!.y;
    const before = ship.hull;
    applyCommand(world, { type: 'fire', shipId: ship.id, side: 'port' });
    expect(ship.reloadPort).toBeGreaterThan(0);
    expect(ship.hull).toBeCloseTo(before * (1 - DAMAGE.port.law.shooterHullShare), 6);
    expect(ship.offender?.port).toBe(0);
    // In open water a broadside is free.
    const other = world.ships[1]!;
    other.x = 160;
    other.y = 90;
    const otherBefore = other.hull;
    applyCommand(world, { type: 'fire', shipId: other.id, side: 'port' });
    expect(other.reloadPort).toBeGreaterThan(0);
    expect(other.hull).toBe(otherBefore);
    expect(other.offender).toBeUndefined();
  });

  it('docked = at the anchorage and almost still', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    ship.x = port.x + DAMAGE.port.dockRange - 5;
    ship.y = port.y;
    ship.speed = 1;
    expect(isDocked(ship, ports)).toBe(true);
    ship.speed = DAMAGE.port.maxDockSpeed + 1;
    expect(isDocked(ship, ports)).toBe(false);
    ship.speed = 0;
    ship.x = port.x + DAMAGE.port.dockRange + 5;
    expect(isDocked(ship, ports)).toBe(false);
  });

  it('the port mends a docked ship up to 90%, with an enemy near and the sails set', () => {
    const world = createWorld(1);
    const [ship, enemy] = world.ships;
    const full = SHIP_CLASSES[ship!.shipClass]!.hullPoints;
    Object.assign(ship!, { x: port.x, y: port.y, speed: 0, hull: full * 0.2 });
    Object.assign(enemy!, { x: port.x + 100, y: port.y });
    stepPortRepair(world, 1, ports);
    expect(ship!.hull).toBeCloseTo(full * (0.2 + DAMAGE.port.sharePerSecond));
    expect(ship!.repairing).toBe(true);
    for (let i = 0; i < 100; i++) stepPortRepair(world, 1, ports);
    expect(ship!.hull).toBeCloseTo(full * DAMAGE.port.maxShare);
  });

  it('scenario: a badly hurt bot sails to the port, is repaired there and comes out again', () => {
    const world = createWorld(7);
    const [me, botShip] = world.ships;
    const p = PORTS[0]!;
    const full = SHIP_CLASSES[botShip!.shipClass]!.hullPoints;
    Object.assign(botShip!, { x: p.x + 100, y: p.y + 700, hull: full * 0.2, headingRad: -Math.PI / 2 });
    Object.assign(me!, { x: p.x + 1500, y: p.y + 1500, sailLevel: 0, speed: 0 });
    world.bots = [newBot(botShip!.id, me!.id, world)];
    let docked = false;
    let best = botShip!.hull;
    for (let i = 0; i < 30 * 400 && !(docked && world.bots[0]!.mode === 'chase'); i++) {
      for (const c of thinkBots(world, ISLANDS)) applyCommand(world, c);
      stepWorld(world);
      if (world.bots[0]!.mode === 'port' && isDocked(botShip!)) docked = true;
      best = Math.max(best, botShip!.hull);
    }
    expect(docked).toBe(true);
    expect(best).toBeGreaterThanOrEqual(full * DAMAGE.port.maxShare - 0.01);
    expect(world.bots[0]!.mode).toBe('chase');
  });

  it('a sensible bot does not fire at a sound enemy in safe water (no reckless finishing attack)', () => {
    const world = createWorld(3);
    const [me, botShip] = world.ships;
    const p = PORTS[0]!;
    Object.assign(me!, { x: p.x, y: p.y + 20, sailLevel: 0, speed: 0 });
    Object.assign(botShip!, { x: p.x, y: p.y + 20 + 140, headingRad: 0 });
    world.bots = [newBot(botShip!.id, me!.id, world)];
    let fired = false;
    const sensible = { ...BOTS, finishRecklessChance: 0 };
    for (let i = 0; i < 30 * 60; i++) {
      for (const c of thinkBots(world, ISLANDS, sensible)) {
        if (c.type === 'fire') fired = true;
        applyCommand(world, c);
      }
      stepWorld(world);
    }
    expect(fired).toBe(false);
    expect(world.bots[0]!.mode).toBe('idle');
  });

  it('portWaypoint: open-water port = the anchorage; inlet port = along the way in, never straight across the land', () => {
    expect(portWaypoint(0, 0, port)).toEqual({ x: port.x, y: port.y, inside: false });
    const inlet = PORTS.find((p) => p.path)!;
    const path = inlet.path!;
    const mid = path[Math.floor(path.length / 2)]!;
    const way = portWaypoint(mid.x, mid.y, inlet);
    expect(way.inside).toBe(true);
    expect(path.some((p) => p.x === way.x && p.y === way.y)).toBe(true);
  });

  it('scenario: a badly hurt bot off the inlet sails up it into the harbour and is repaired there', () => {
    const world = createWorld(11);
    const [me, botShip] = world.ships;
    const inlet = PORTS.find((p) => p.path)!;
    const path = inlet.path!;
    const a = path[0]!;
    const b = path[1]!;
    const out = Math.atan2(a.y - b.y, a.x - b.x); // from the mouth out to the sea
    // The wind blows from the sea into the inlet, and stays so.
    world.wind = { fromRad: out, strength: 0.8, baseFromRad: out };
    const full = SHIP_CLASSES[botShip!.shipClass]!.hullPoints;
    Object.assign(botShip!, { x: a.x + Math.cos(out) * 250, y: a.y + Math.sin(out) * 250, headingRad: out + Math.PI, hull: full * 0.2 });
    Object.assign(me!, { x: a.x + Math.cos(out) * 1200, y: a.y + Math.sin(out) * 1200 + 400, sailLevel: 0, speed: 0 });
    world.bots = [newBot(botShip!.id, me!.id, world)];
    let docked = false;
    for (let i = 0; i < 30 * 300 && !docked; i++) {
      for (const c of thinkBots(world, ISLANDS)) applyCommand(world, c);
      stepWorld(world, STEP_SECONDS, { speedScale: 1, windDrift: false });
      docked = isDocked(botShip!) && Math.hypot(botShip!.x - inlet.x, botShip!.y - inlet.y) < 100;
    }
    expect(docked).toBe(true);
  });
});

describe('port: sails, crew and ammunition (M3 step 4)', () => {
  it('a docked ship gets all its sails, new sailors and fresh chain and grape shot', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    const sloop = SHIP_CLASSES['sloop']!;
    Object.assign(ship, { x: port.x, y: port.y, speed: 0, sails: 0, crew: 20, ammoLeft: { chain: 0, grape: 1 } });
    stepPortRepair(world, 1, ports);
    expect(ship.repairing).toBe(true);
    expect(ship.ammoLeft).toBeUndefined(); // the starting stock again
    for (let i = 0; i < 100; i++) stepPortRepair(world, 1, ports);
    expect(ship.sails).toBeCloseTo(sloop.sailPoints);
    expect(ship.crew).toBeCloseTo(sloop.crew);
  });
});
