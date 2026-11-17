import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { DAMAGE, GUNS, SHIP_CLASSES, SHORE } from './data';
import { lawRange, makeOffender } from './law';
import { PORTS } from './port';
import type { Port } from './port';
import { launchShoreBall, shoreAim, shoreElevation, shoreFlight, shoreOwnerId, shorePortOf, shoreTarget, stepShore } from './shore';
import { STEP_SECONDS, stepWorld } from './step';
import { createWorld } from './world';

const port: Port = { name: 'Test port', x: 1000, y: 1000, guns: [{ x: 1000, y: 900 }, { x: 950, y: 900 }, { x: 1050, y: 900 }] };
const ports = [port];

describe('shore guns: ballistics', () => {
  it('owner ids: port 0 is -1, port 1 is -2; a ship id is no port', () => {
    expect(shoreOwnerId(0)).toBe(-1);
    expect(shoreOwnerId(1)).toBe(-2);
    expect(shorePortOf(-2)).toBe(1);
    expect(shorePortOf(3)).toBe(-1);
  });

  it('a ball leaves at muzzle speed from the gun height and carries the shore damage', () => {
    const ball = launchShoreBall(0, { x: 5, y: 6 }, Math.PI / 2, 10);
    expect(Math.hypot(ball.vx, ball.vy, ball.vz)).toBeCloseTo(SHORE.muzzleSpeed, 9);
    expect(ball.vx).toBeCloseTo(0, 9);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.z).toBe(SHORE.gunHeight);
    expect(ball.damage).toBe(SHORE.damage);
    expect(ball.shipId).toBe(-1);
  });

  it('the range is close to the textbook formula and grows with the elevation', () => {
    // From height h: t = (vz + sqrt(vz^2 + 2 g h)) / g, range = vh x t.
    const deg = 10;
    const vz = SHORE.muzzleSpeed * Math.sin((deg * Math.PI) / 180);
    const vh = SHORE.muzzleSpeed * Math.cos((deg * Math.PI) / 180);
    const t = (vz + Math.sqrt(vz * vz + 2 * GUNS.gravity * SHORE.gunHeight)) / GUNS.gravity;
    const flight = shoreFlight(deg, STEP_SECONDS);
    expect(flight.range).toBeGreaterThan(vh * t * 0.97);
    expect(flight.range).toBeLessThan(vh * t * 1.03);
    expect(shoreFlight(12, STEP_SECONDS).range).toBeGreaterThan(flight.range);
  });

  it('the guns reach every place within the law range of both real ports, and the ball lands in time', () => {
    const longest = shoreFlight(SHORE.maxElevationDeg, STEP_SECONDS);
    expect(longest.seconds).toBeLessThan(GUNS.maxBallSeconds);
    for (const p of PORTS) {
      expect(p.guns).toHaveLength(3);
      for (let a = 0; a < 360; a += 15) {
        const x = p.x + Math.cos((a * Math.PI) / 180) * lawRange();
        const y = p.y + Math.sin((a * Math.PI) / 180) * lawRange();
        const nearest = Math.min(...p.guns!.map((g) => Math.hypot(g.x - x, g.y - y)));
        expect(nearest).toBeLessThan(longest.range);
      }
    }
  });

  it('shoreElevation lands the ball at the wanted distance (within one step of flight); too far gives null', () => {
    for (const d of [60, 150, 300, 450, 600]) {
      const e = shoreElevation(d, STEP_SECONDS)!;
      expect(Math.abs(shoreFlight(e.elevationDeg, STEP_SECONDS).range - d)).toBeLessThan(SHORE.muzzleSpeed * STEP_SECONDS + 1);
    }
    expect(shoreElevation(2000, STEP_SECONDS)).toBeNull();
  });

  it('shoreAim leads a moving ship: the aim point is ahead of it by speed x flight time', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    Object.assign(ship, { x: 300, y: 0, headingRad: Math.PI / 2, speed: 10 }); // sailing south, 300 m east of the gun
    const aim = shoreAim({ x: 0, y: 0 }, ship, STEP_SECONDS)!;
    const still = shoreAim({ x: 0, y: 0 }, { ...ship, speed: 0 }, STEP_SECONDS)!;
    expect(still.bearingRad).toBeCloseTo(0, 6);
    const seconds = shoreElevation(300, STEP_SECONDS)!.seconds;
    expect(Math.tan(aim.bearingRad) * 300).toBeGreaterThan(10 * seconds * 0.9);
    expect(Math.tan(aim.bearingRad) * 300).toBeLessThan(10 * seconds * 1.2);
  });
});

describe('shore guns: who they fire at', () => {
  it('only an offender of this port, afloat, within the law range', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    Object.assign(ship, { x: 1000, y: 1200 });
    expect(shoreTarget(world, 0, ports)).toBeNull();
    makeOffender(world, ship, 0, 'fired');
    expect(shoreTarget(world, 0, ports)).toBe(ship);
    ship.y = 1000 + lawRange() + 1;
    expect(shoreTarget(world, 0, ports)).toBeNull();
    ship.y = 1200;
    ship.sunk = true;
    expect(shoreTarget(world, 0, ports)).toBeNull();
  });

  it('the guns fire one after another: one gun every reloadSeconds / guns', () => {
    const world = createWorld(1);
    const ship = world.ships[0]!;
    Object.assign(ship, { x: 1000, y: 1200 });
    makeOffender(world, ship, 0, 'fired');
    const shots: number[] = [];
    for (let i = 0; i < 30 * 21; i++) {
      world.events = [];
      stepShore(world, STEP_SECONDS, ports);
      if (world.events.some((e) => e.type === 'shoreFired')) shots.push(world.tick * STEP_SECONDS);
      world.tick++;
    }
    const gap = SHORE.reloadSeconds / 3;
    expect(shots.length).toBe(Math.floor(21 / gap) + 1);
    for (let i = 1; i < shots.length; i++) expect(shots[i]! - shots[i - 1]!).toBeGreaterThanOrEqual(gap - 0.11);
    expect(world.balls.every((b) => b.shipId === -1 && b.damage === SHORE.damage)).toBe(true);
  });

  it('nobody to fire at: silence', () => {
    const world = createWorld(1);
    Object.assign(world.ships[0]!, { x: 1000, y: 1200 });
    for (let i = 0; i < 300; i++) {
      stepShore(world, STEP_SECONDS, ports);
      world.tick++;
    }
    expect(world.balls).toHaveLength(0);
  });
});

describe('shore guns: scenarios in the real port', () => {
  const p = PORTS[0]!;

  /** You lie in port and fire a broadside at nothing. What do the shore guns do in `seconds`? */
  function offend(seed: number, seconds: number, sails: number, headingRad: number) {
    const world = createWorld(seed);
    const [me, other] = world.ships;
    Object.assign(other!, { x: p.x + 2500, y: p.y - 1500 });
    Object.assign(me!, { x: p.x, y: p.y + 120, headingRad, sailLevel: sails });
    applyCommand(world, { type: 'fire', shipId: me!.id, side: 'starboard' });
    let shots = 0;
    let hits = 0;
    let pardonedAt = -1;
    let lastShotAt = -1;
    for (let i = 0; i < 30 * seconds && !me!.sunk; i++) {
      stepWorld(world);
      for (const e of world.events) {
        if (e.type === 'shoreFired') {
          shots++;
          lastShotAt = i * STEP_SECONDS;
        }
        if (e.type === 'hit' && e.byShipId < 0 && e.zone === 'hull') hits++;
        if (e.type === 'pardoned') pardonedAt = i * STEP_SECONDS;
      }
    }
    return { world, me: me!, other: other!, shots, hits, pardonedAt, lastShotAt };
  }

  it('an offender that stays in port is sunk by the shore guns within a few minutes; the kill is the port\'s', () => {
    let sunk = 0;
    let seconds = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = offend(seed, 300, 0, 0);
      if (r.me.sunk) sunk++;
      seconds += r.world.tick * STEP_SECONDS;
      expect(r.hits).toBeGreaterThan(0);
    }
    expect(sunk).toBe(6);
    const mean = seconds / 6;
    expect(mean).toBeGreaterThan(40);
    expect(mean).toBeLessThan(200);
  });

  it('an offender that sails straight out is fired at only inside the law range, gets away and is pardoned', () => {
    let survived = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = offend(seed, 240, 1, Math.PI / 2); // south, out to the open sea, the wind on the beam
      if (!r.me.sunk) survived++;
      expect(r.shots).toBeGreaterThan(0);
      if (r.me.sunk) continue;
      expect(r.pardonedAt).toBeGreaterThan(DAMAGE.port.law.forgiveSeconds);
      expect(r.lastShotAt).toBeLessThan(r.pardonedAt - DAMAGE.port.law.forgiveSeconds + 1);
      expect(r.me.offender).toBeUndefined();
    }
    expect(survived).toBeGreaterThanOrEqual(5);
  });

  it('the shore guns never hurt a law-abiding ship, even one lying next to the offender', () => {
    const world = createWorld(9);
    const [me, other] = world.ships;
    Object.assign(me!, { x: p.x, y: p.y + 120, headingRad: 0 });
    Object.assign(other!, { x: p.x, y: p.y + 120 + 25, headingRad: 0 });
    const before = other!.hull;
    makeOffender(world, me!, 0, 'fired');
    for (let i = 0; i < 30 * 120 && !me!.sunk; i++) stepWorld(world);
    expect(other!.hull).toBe(before);
    expect(me!.hull).toBeLessThan(SHIP_CLASSES[me!.shipClass]!.hullPoints);
  });

  it('the same seed gives the same shots', () => {
    const a = offend(11, 60, 0, 0);
    const b = offend(11, 60, 0, 0);
    expect(a.shots).toBe(b.shots);
    expect(a.me.hull).toBe(b.me.hull);
  });
});
