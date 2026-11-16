import { describe, expect, it } from 'vitest';
import { thinkBots, newBot } from './bot';
import { applyCommand } from './commands';
import { DAMAGE, ISLANDS, SHIP_CLASSES } from './data';
import { damageHull } from './damage';
import { PORTS, inSafeWater, isDocked, nearestPort, portsOf, stepPortRepair } from './port';
import type { Port } from './port';
import { stepWorld } from './step';
import { createWorld } from './world';

const port: Port = { name: 'Test port', x: 1000, y: 1000 };
const ports = [port];

describe('ports', () => {
  it('the sea has one port, in open water', () => {
    expect(PORTS).toHaveLength(1);
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

  it('a ship in safe water takes no damage; outside it does', () => {
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

  it('a ship in the safe water of the real port cannot fire', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    ship.x = PORTS[0]!.x;
    ship.y = PORTS[0]!.y;
    applyCommand(world, { type: 'fire', shipId: ship.id, side: 'port' });
    expect(ship.reloadPort).toBe(0);
    ship.x = 160;
    ship.y = 90;
    applyCommand(world, { type: 'fire', shipId: ship.id, side: 'port' });
    expect(ship.reloadPort).toBeGreaterThan(0);
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

  it('a bot does not fire at an enemy in safe water', () => {
    const world = createWorld(3);
    const [me, botShip] = world.ships;
    const p = PORTS[0]!;
    Object.assign(me!, { x: p.x, y: p.y + 20, sailLevel: 0, speed: 0 });
    Object.assign(botShip!, { x: p.x, y: p.y + 20 + 140, headingRad: 0 });
    world.bots = [newBot(botShip!.id, me!.id, world)];
    let fired = false;
    for (let i = 0; i < 30 * 60; i++) {
      for (const c of thinkBots(world, ISLANDS)) {
        if (c.type === 'fire') fired = true;
        applyCommand(world, c);
      }
      stepWorld(world);
    }
    expect(fired).toBe(false);
    expect(world.bots[0]!.mode).toBe('idle');
  });
});
