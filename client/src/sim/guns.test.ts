import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { GUNS, SHIP_CLASSES } from './data';
import { predictLanding } from './guns';
import { STEP_SECONDS, stepWorld } from './step';
import type { ShipState, SimEvent, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const calm = { speedScale: 1, windDrift: false };

function ship(elevationDeg: number, speed = 0): ShipState {
  return {
    id: 1, shipClass: 'sloop', x: 0, y: 0, headingRad: 0, speed, rudder: 0, sailLevel: 0,
    aground: false, elevationDeg, reloadPort: 0, reloadStarboard: 0,
  };
}

function worldWith(s: ShipState): World {
  return {
    tick: 0, rngState: 1, wind: { fromRad: 0, strength: 0, baseFromRad: 0 }, ships: [s],
    balls: [], pendingShots: [], nextBallId: 1, events: [],
  };
}

/** Run steps and collect every event. No islands, so nothing gets in the way. */
function run(w: World, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) {
    stepWorld(w, STEP_SECONDS, calm, []);
    events.push(...w.events);
  }
  return events;
}

describe('predictLanding (range table)', () => {
  it('at 10 deg the ball flies about 200 m in about 2.8 s (plan 4.4)', () => {
    const p = predictLanding(ship(10), sloop, 'starboard', STEP_SECONDS);
    expect(p.y).toBeGreaterThan(195);
    expect(p.y).toBeLessThan(220);
    expect(p.seconds).toBeGreaterThan(2.6);
    expect(p.seconds).toBeLessThan(3);
  });

  it('at 0 deg it falls from the deck about 60 m away', () => {
    const p = predictLanding(ship(0), sloop, 'starboard', STEP_SECONDS);
    expect(p.y).toBeGreaterThan(50);
    expect(p.y).toBeLessThan(70);
  });

  it('more elevation always reaches farther (0 to 10 deg)', () => {
    let last = 0;
    for (let e = 0; e <= GUNS.maxElevationDeg; e++) {
      const r = predictLanding(ship(e), sloop, 'starboard', STEP_SECONDS).y;
      expect(r).toBeGreaterThan(last);
      last = r;
    }
  });

  it('port fires to the left: heading east, port lands north (negative y)', () => {
    expect(predictLanding(ship(5), sloop, 'port', STEP_SECONDS).y).toBeLessThan(0);
  });

  it('a moving ship carries its shot forward by about speed x flight time', () => {
    const still = predictLanding(ship(8, 0), sloop, 'starboard', STEP_SECONDS);
    const moving = predictLanding(ship(8, 10), sloop, 'starboard', STEP_SECONDS);
    expect(moving.x - still.x).toBeCloseTo(10 * GUNS.inheritVelocity * still.seconds, 0);
  });
});

describe('fire command', () => {
  it('fires every gun of the side, one after another (ripple), and the splashes land around the marker', () => {
    const s = ship(6);
    const w = worldWith(s);
    const marker = predictLanding(s, sloop, 'starboard', STEP_SECONDS);
    applyCommand(w, { type: 'fire', shipId: 1, side: 'starboard' });
    const events = run(w, 5);
    const shots = events.filter((e) => e.type === 'gunFired');
    const splashes = events.filter((e) => e.type === 'splash');
    expect(shots.length).toBe(sloop.gunsPerSide);
    expect(splashes.length).toBe(sloop.gunsPerSide);
    const meanX = splashes.reduce((a, e) => a + e.x, 0) / splashes.length;
    const meanY = splashes.reduce((a, e) => a + e.y, 0) / splashes.length;
    expect(Math.hypot(meanX - marker.x, meanY - marker.y)).toBeLessThan(1);
    expect(w.balls.length).toBe(0);
  });

  it('the ripple takes about rippleSeconds from the first gun to the last', () => {
    const w = worldWith(ship(6));
    applyCommand(w, { type: 'fire', shipId: 1, side: 'port' });
    const ticks: number[] = [];
    for (let i = 0; i < 30; i++) {
      stepWorld(w, STEP_SECONDS, calm, []);
      if (w.events.some((e) => e.type === 'gunFired')) ticks.push(w.tick);
    }
    expect((ticks[ticks.length - 1]! - ticks[0]!) * STEP_SECONDS).toBeCloseTo(GUNS.rippleSeconds, 1);
  });

  it('reloads: a second fire is ignored until reloadSeconds have passed', () => {
    const s = ship(6);
    const w = worldWith(s);
    applyCommand(w, { type: 'fire', shipId: 1, side: 'starboard' });
    expect(s.reloadStarboard).toBe(sloop.reloadSeconds);
    run(w, 2);
    applyCommand(w, { type: 'fire', shipId: 1, side: 'starboard' });
    expect(w.pendingShots.length).toBe(0); // nothing new was planned
    run(w, sloop.reloadSeconds);
    expect(s.reloadStarboard).toBe(0);
    expect(s.reloadPort).toBe(0); // the other side was never fired
  });
});

describe('setElevation', () => {
  it('keeps the elevation within 0 .. maxElevationDeg', () => {
    const w = worldWith(ship(0));
    applyCommand(w, { type: 'setElevation', shipId: 1, valueDeg: 25 });
    expect(w.ships[0]!.elevationDeg).toBe(GUNS.maxElevationDeg);
    applyCommand(w, { type: 'setElevation', shipId: 1, valueDeg: -3 });
    expect(w.ships[0]!.elevationDeg).toBe(0);
  });
});
