import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { chooseTargets, createArenaWorld } from './arena';
import { newBot, thinkBots } from './bot';
import { DAMAGE, GUNS, ISLANDS, SHIP_CLASSES } from './data';
import { damageHull } from './damage';
import { ballDamage, isOffenderOf, lawRange, makeOffender, offenderNear, onBroadsideFired, protectedByPort, safePortIndex, stepLaw } from './law';
import { canRepair } from './repair';
import { PORTS, isDocked, stepPortRepair } from './port';
import type { Port } from './port';
import { STEP_SECONDS, stepWorld } from './step';
import { createWorld } from './world';

const port: Port = { name: 'Test port', x: 1000, y: 1000, berths: 3 };
const far: Port = { name: 'Far port', x: 5000, y: 1000, berths: 3 };
const ports = [port, far];
const law = DAMAGE.port.law;
const SAFE = DAMAGE.port.safeRange;

function twoShips() {
  const world = createWorld(1);
  const [a, b] = world.ships;
  return { world, a: a!, b: b! };
}

describe('port law: the rules', () => {
  it('the law reaches leaveFactor x safeRange (450 m)', () => {
    expect(lawRange()).toBeCloseTo(SAFE * law.leaveFactor, 9);
    expect(lawRange()).toBe(450);
  });

  it('safePortIndex: the port whose safe water holds the point, -1 outside; a margin widens it', () => {
    expect(safePortIndex(1000, 1000 + SAFE - 1, ports)).toBe(0);
    expect(safePortIndex(5000 + SAFE - 1, 1000, ports)).toBe(1);
    expect(safePortIndex(1000, 1000 + SAFE + 1, ports)).toBe(-1);
    expect(safePortIndex(1000, 1000 + SAFE + 20, ports, DAMAGE, 30)).toBe(0);
    expect(safePortIndex(0, 0, [])).toBe(-1);
  });

  it('a port protects a law-abiding ship in its safe water, not an offender of that port', () => {
    const { world, a } = twoShips();
    Object.assign(a, { x: 1000, y: 1100 });
    expect(protectedByPort(a, ports)).toBe(true);
    makeOffender(world, a, 0, 'fired');
    expect(isOffenderOf(a, 0)).toBe(true);
    expect(protectedByPort(a, ports)).toBe(false);
    Object.assign(a, { x: 5000, y: 1100 }); // an offender of port 0 is still safe in port 1
    expect(protectedByPort(a, ports)).toBe(true);
    Object.assign(a, { x: 3000, y: 1000 });
    expect(protectedByPort(a, ports)).toBe(false);
  });

  it('fire rule: a broadside in safe water costs shooterHullShare of the full hull and makes an offender', () => {
    const { world, a } = twoShips();
    const full = SHIP_CLASSES[a.shipClass]!.hullPoints;
    Object.assign(a, { x: 1000, y: 1100 });
    expect(onBroadsideFired(world, a, ports)).toBeCloseTo(full * law.shooterHullShare, 9);
    expect(a.hull).toBeCloseTo(full * (1 - law.shooterHullShare), 9);
    expect(a.offender).toEqual({ port: 0, forgiveLeft: law.forgiveSeconds });
    expect(world.events.filter((e) => e.type === 'offender')).toHaveLength(1);
    // A second broadside costs again, but he is not announced twice.
    onBroadsideFired(world, a, ports);
    expect(a.hull).toBeCloseTo(full * (1 - 2 * law.shooterHullShare), 9);
    expect(world.events.filter((e) => e.type === 'offender')).toHaveLength(1);
  });

  it('fire rule: the price never sinks the shooter; in open water a broadside is free', () => {
    const { world, a } = twoShips();
    Object.assign(a, { x: 1000, y: 1100, hull: 3 });
    onBroadsideFired(world, a, ports);
    expect(a.hull).toBe(1);
    expect(a.sunk).toBe(false);
    const { world: w2, a: free } = twoShips();
    Object.assign(free, { x: 3000, y: 1000 });
    expect(onBroadsideFired(w2, free, ports)).toBe(0);
    expect(free.offender).toBeUndefined();
  });

  it('fire rule: with an offender within the law range, firing in safe water is lawful', () => {
    const { world, a, b } = twoShips();
    Object.assign(a, { x: 1000, y: 1100 });
    Object.assign(b, { x: 1000, y: 1000 + lawRange() - 10 });
    makeOffender(world, b, 0, 'fired');
    expect(offenderNear(world, 0, a.id, ports)).toBe(true);
    expect(onBroadsideFired(world, a, ports)).toBe(0);
    expect(a.offender).toBeUndefined();
    b.y = 1000 + lawRange() + 10; // the offender has left: no excuse any more
    expect(offenderNear(world, 0, a.id, ports)).toBe(false);
    expect(onBroadsideFired(world, a, ports)).toBeGreaterThan(0);
  });

  it('hit rule: a ball on a law-abiding ship in safe water does damageFactor of its damage and marks the shooter', () => {
    const { world, a, b } = twoShips();
    Object.assign(a, { x: 1000, y: 1100 }); // the target, in safe water
    Object.assign(b, { x: 1000, y: 1500 }); // the shooter, outside
    expect(ballDamage(world, a, b, 27, ports)).toBeCloseTo(27 * law.damageFactor, 9);
    expect(isOffenderOf(b, 0)).toBe(true);
  });

  it('hit rule: full damage and no blame on an offender in safe water, and on any ship outside', () => {
    const { world, a, b } = twoShips();
    Object.assign(a, { x: 1000, y: 1100 });
    Object.assign(b, { x: 1000, y: 1500 });
    makeOffender(world, a, 0, 'fired');
    expect(ballDamage(world, a, b, 27, ports)).toBe(27);
    expect(b.offender).toBeUndefined();
    Object.assign(a, { x: 3000, y: 1000, offender: undefined });
    expect(ballDamage(world, a, b, 27, ports)).toBe(27);
    expect(b.offender).toBeUndefined();
  });

  it('ramming: no damage to a law-abiding ship in safe water, full damage to an offender there', () => {
    const { world, a } = twoShips();
    Object.assign(a, { x: 1000, y: 1100 });
    const before = a.hull;
    damageHull(world, a, 30, 2, ports);
    expect(a.hull).toBe(before);
    makeOffender(world, a, 0, 'fired');
    damageHull(world, a, 30, 2, ports);
    expect(a.hull).toBe(before - 30);
  });

  it('pardon: forgiveSeconds beyond the law range; coming back inside starts the clock again', () => {
    const { world, a } = twoShips();
    Object.assign(a, { x: 1000, y: 1000 + lawRange() + 5 });
    makeOffender(world, a, 0, 'fired');
    stepLaw(world, 20, ports);
    expect(a.offender?.forgiveLeft).toBeCloseTo(law.forgiveSeconds - 20, 9);
    a.y = 1000 + lawRange() - 5; // back inside
    stepLaw(world, 1, ports);
    expect(a.offender?.forgiveLeft).toBe(law.forgiveSeconds);
    a.y = 1000 + lawRange() + 5;
    world.events = [];
    stepLaw(world, law.forgiveSeconds - 1, ports);
    expect(a.offender).toBeDefined();
    stepLaw(world, 1.01, ports);
    expect(a.offender).toBeUndefined();
    expect(world.events).toEqual([{ type: 'pardoned', shipId: a.id, port: 0 }]);
  });

  it('a sunk offender is an offender no more', () => {
    const { world, a } = twoShips();
    Object.assign(a, { x: 1000, y: 1100 });
    makeOffender(world, a, 0, 'fired');
    a.sunk = true;
    stepLaw(world, STEP_SECONDS, ports);
    expect(a.offender).toBeUndefined();
  });

  it('an offender does not repair at sea either, until it is pardoned', () => {
    const { world, a, b } = twoShips();
    Object.assign(a, { x: 3000, y: 3000, sailLevel: 0, hull: 100 });
    Object.assign(b, { x: -2000, y: -1000 });
    expect(canRepair(a, world, DAMAGE.repair.seaMaxShare)).toBe(true);
    makeOffender(world, a, 0, 'fired');
    expect(canRepair(a, world, DAMAGE.repair.seaMaxShare)).toBe(false);
  });

  it('the port does not repair an offender', () => {
    const { world, a } = twoShips();
    Object.assign(a, { x: port.x, y: port.y, speed: 0, hull: 100 });
    expect(isDocked(a, ports)).toBe(true);
    makeOffender(world, a, 0, 'fired');
    expect(isDocked(a, ports)).toBe(false);
    stepPortRepair(world, 1, ports);
    expect(a.hull).toBe(100);
  });
});

describe('port law in the real sea', () => {
  const p = PORTS[0]!;

  it('a real ball that hits a ship lying in port takes half and makes the shooter an offender', () => {
    const world = createWorld(4);
    const [me, victim] = world.ships;
    const saved = { gun: GUNS.gunSigmaDeg, salvo: GUNS.salvoSigmaDeg };
    GUNS.gunSigmaDeg = 0;
    GUNS.salvoSigmaDeg = 0;
    try {
      // The victim 20 m inside the safe water; I lie 100 m west of it, outside, heading north: starboard faces it.
      Object.assign(victim!, { x: p.x - SAFE + 20, y: p.y, headingRad: -Math.PI / 2 });
      Object.assign(me!, { x: p.x - SAFE - 80, y: p.y, headingRad: -Math.PI / 2, elevationDeg: 3 });
      const before = victim!.hull;
      applyCommand(world, { type: 'fire', shipId: me!.id, side: 'starboard' });
      expect(me!.offender).toBeUndefined(); // fired from outside: no blame yet
      for (let i = 0; i < 30 * 4; i++) stepWorld(world);
      const lost = before - victim!.hull;
      expect(lost).toBeGreaterThan(0);
      expect(lost % (GUNS.damage * law.damageFactor)).toBeCloseTo(0, 6);
      expect(isOffenderOf(me!, 0)).toBe(true);
    } finally {
      GUNS.gunSigmaDeg = saved.gun;
      GUNS.salvoSigmaDeg = saved.salvo;
    }
  });

  it('a bot keeps the law: it does not fire from safe water at an enemy outside it', () => {
    const world = createWorld(3);
    const [me, botShip] = world.ships;
    Object.assign(botShip!, { x: p.x, y: p.y + SAFE - 30, headingRad: 0 });
    Object.assign(me!, { x: p.x, y: p.y + SAFE + 110, sailLevel: 0, speed: 0 });
    world.bots = [newBot(botShip!.id, me!.id, world)];
    for (let i = 0; i < 30 * 20; i++) {
      for (const c of thinkBots(world, ISLANDS)) {
        if (c.type === 'fire') expect(safePortIndex(botShip!.x, botShip!.y)).toBe(-1);
        applyCommand(world, c);
      }
      stepWorld(world);
    }
    expect(botShip!.offender).toBeUndefined();
  });

  it('a bot attacks an offender even in safe water, and that is lawful', () => {
    const world = createWorld(3);
    const [me, botShip] = world.ships;
    Object.assign(me!, { x: p.x, y: p.y + 60, sailLevel: 0, speed: 0 });
    Object.assign(botShip!, { x: p.x, y: p.y + 60 + 150, headingRad: 0 });
    me!.offender = { port: 0, forgiveLeft: 45 };
    world.bots = [newBot(botShip!.id, me!.id, world)];
    let fired = 0;
    for (let i = 0; i < 30 * 60; i++) {
      for (const c of thinkBots(world, ISLANDS)) {
        if (c.type === 'fire') fired++;
        applyCommand(world, c);
      }
      stepWorld(world);
    }
    expect(fired).toBeGreaterThan(0);
    expect(botShip!.offender).toBeUndefined();
  });

  it('an offender bot runs out of the law range and is pardoned', () => {
    const world = createWorld(3);
    const [me, botShip] = world.ships;
    Object.assign(me!, { x: p.x + 2000, y: p.y + 1000 });
    Object.assign(botShip!, { x: p.x, y: p.y + 200, headingRad: Math.PI / 2 });
    world.bots = [newBot(botShip!.id, me!.id, world)];
    makeOffender(world, botShip!, 0, 'hit');
    let sawOutlaw = false;
    let pardoned = false;
    for (let i = 0; i < 30 * 240 && !pardoned; i++) {
      for (const c of thinkBots(world, ISLANDS)) applyCommand(world, c);
      stepWorld(world);
      sawOutlaw ||= world.bots[0]!.mode === 'outlaw';
      pardoned = world.events.some((e) => e.type === 'pardoned');
      if (botShip!.sunk) break;
    }
    expect(sawOutlaw).toBe(true);
    expect(botShip!.sunk).toBe(false);
    expect(pardoned).toBe(true);
    expect(Math.hypot(botShip!.x - p.x, botShip!.y - p.y)).toBeGreaterThan(lawRange());
  });

  it('arena: a protected ship is no target, an offender in safe water is; a bot in port keeps mending when it gets a new enemy', () => {
    const w = createArenaWorld(7);
    const [a, b] = w.ships;
    for (const s of w.ships.slice(2)) s.sunk = true;
    Object.assign(a!, { x: p.x + 800, y: p.y + 600 });
    Object.assign(b!, { x: p.x, y: p.y + 50 });
    chooseTargets(w);
    expect(w.bots[0]!.enemyId).toBe(-1);
    b!.offender = { port: 0, forgiveLeft: 45 };
    chooseTargets(w);
    expect(w.bots[0]!.enemyId).toBe(b!.id);
    // b's bot is in port mode: a new enemy does not pull it out.
    w.bots[1]!.mode = 'port';
    w.events = [];
    chooseTargets(w);
    expect(w.bots[1]!.enemyId).toBe(a!.id);
    expect(w.bots[1]!.mode).toBe('port');
    expect(w.events.some((e) => e.type === 'targetChosen' && e.shipId === b!.id)).toBe(false);
  });
});
