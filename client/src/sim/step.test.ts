import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from './data';
import { STEP_SECONDS, stepShip, stepWorld } from './step';
import type { ShipState } from './types';
import { createWorld } from './world';

function newShip(): ShipState {
  return { ...createWorld().ships[0]! };
}
const sloop = SHIP_CLASSES['sloop']!;

describe('stepShip', () => {
  it('stays still with the sails furled', () => {
    const s = newShip();
    for (let i = 0; i < 100; i++) stepShip(s, sloop, STEP_SECONDS);
    expect(s.speed).toBe(0);
    expect(s.x).toBe(160);
  });

  it('speeds up gradually and stops at max speed', () => {
    const s = newShip();
    s.sailLevel = 1;
    stepShip(s, sloop, STEP_SECONDS);
    expect(s.speed).toBeCloseTo(sloop.acceleration * STEP_SECONDS);
    for (let i = 0; i < 30 * 30; i++) stepShip(s, sloop, STEP_SECONDS);
    expect(s.speed).toBeCloseTo(sloop.maxSpeed);
  });

  it('half sails give half speed', () => {
    const s = newShip();
    s.sailLevel = 0.5;
    for (let i = 0; i < 30 * 30; i++) stepShip(s, sloop, STEP_SECONDS);
    expect(s.speed).toBeCloseTo(sloop.maxSpeed / 2);
  });

  it('slows down again when the sails are furled', () => {
    const s = newShip();
    s.speed = sloop.maxSpeed;
    s.sailLevel = 0;
    for (let i = 0; i < 30 * 30; i++) stepShip(s, sloop, STEP_SECONDS);
    expect(s.speed).toBe(0);
  });

  it('heading east moves x up', () => {
    const s = newShip();
    s.speed = 6;
    s.sailLevel = 6 / sloop.maxSpeed; // target speed 6, so speed stays 6
    stepShip(s, sloop, 1);
    expect(s.x).toBeCloseTo(166);
    expect(s.y).toBeCloseTo(90);
  });

  it('heading south (PI/2) moves y up, because y points south', () => {
    const s = newShip();
    s.heading = Math.PI / 2;
    s.speed = 6;
    s.sailLevel = 6 / sloop.maxSpeed;
    stepShip(s, sloop, 1);
    expect(s.x).toBeCloseTo(160);
    expect(s.y).toBeCloseTo(96);
  });

  it('the rudder does nothing without way on', () => {
    const s = newShip();
    s.rudder = 1;
    for (let i = 0; i < 30; i++) stepShip(s, sloop, STEP_SECONDS);
    expect(s.heading).toBe(0);
  });

  it('positive rudder turns clockwise (heading grows)', () => {
    const s = newShip();
    s.speed = sloop.maxSpeed;
    s.sailLevel = 1;
    s.rudder = 1;
    stepShip(s, sloop, 1);
    expect(s.heading).toBeCloseTo(sloop.turnRate);
  });

  it('negative rudder turns the other way', () => {
    const s = newShip();
    s.speed = sloop.maxSpeed;
    s.sailLevel = 1;
    s.rudder = -1;
    stepShip(s, sloop, 1);
    expect(s.heading).toBeCloseTo(-sloop.turnRate);
  });

  it('keeps the heading inside (-PI, PI]', () => {
    const s = newShip();
    s.speed = sloop.maxSpeed;
    s.sailLevel = 1;
    s.rudder = 1;
    for (let i = 0; i < 30 * 60; i++) stepShip(s, sloop, STEP_SECONDS);
    expect(s.heading).toBeLessThanOrEqual(Math.PI);
    expect(s.heading).toBeGreaterThan(-Math.PI);
  });
});

describe('speedScale (live tuning)', () => {
  it('speedScale 2 doubles the top speed', () => {
    const s = newShip();
    s.sailLevel = 1;
    for (let i = 0; i < 30 * 30; i++) stepShip(s, sloop, STEP_SECONDS, { speedScale: 2 });
    expect(s.speed).toBeCloseTo(sloop.maxSpeed * 2);
  });

  it('speedScale keeps the time needed to reach full speed', () => {
    const normal = newShip();
    const fast = newShip();
    normal.sailLevel = 1;
    fast.sailLevel = 1;
    for (let i = 0; i < 30; i++) {
      stepShip(normal, sloop, STEP_SECONDS);
      stepShip(fast, sloop, STEP_SECONDS, { speedScale: 2 });
    }
    expect(fast.speed).toBeCloseTo(normal.speed * 2);
  });
});

describe('ship data (game metres)', () => {
  it('every class has a size and sane speeds', () => {
    for (const p of Object.values(SHIP_CLASSES)) {
      expect(p.length).toBeGreaterThan(p.beam);
      expect(p.maxSpeed).toBeGreaterThan(0);
      expect(p.acceleration).toBeGreaterThan(0);
    }
  });

  it('the sloop is 30 game metres long (plan section 4.0)', () => {
    expect(sloop.length).toBe(30);
  });
});

describe('stepWorld', () => {
  it('leaves the moored target where it is', () => {
    const w = createWorld();
    const before = { ...w.ships[1]! };
    for (let i = 0; i < 90; i++) stepWorld(w);
    expect(w.ships[1]!.x).toBe(before.x);
    expect(w.ships[1]!.y).toBe(before.y);
  });

  it('counts ticks', () => {
    const w = createWorld();
    stepWorld(w);
    stepWorld(w);
    expect(w.tick).toBe(2);
  });
});
