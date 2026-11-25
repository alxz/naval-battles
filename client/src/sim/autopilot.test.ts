// D73: the player's route and the autopilot.
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { routeOf, routeTacking, thinkAutopilot, withPoint } from './autopilot';
import { AUTOPILOT } from './data';
import { Simulation } from './simulation';
import { createWorld } from './world';
import { bearingDegToHeadingRad } from './angles';
import type { SimEvent } from './types';

function sim() {
  const s = new Simulation(createWorld(7, 1));
  s.world.ships = s.world.ships.slice(0, 1); // you alone (no target in the way)
  s.world.bots = [];
  s.queueCommand({ type: 'setSails', shipId: 1, value: 1 });
  return s;
}

function run(s: Simulation, seconds: number, until?: () => boolean): SimEvent[] {
  const events: SimEvent[] = [];
  for (let t = 0; t < seconds * 30; t++) {
    s.update(1 / 30);
    events.push(...s.takeEvents());
    if (until?.()) break;
  }
  return events;
}

describe('route commands (D73)', () => {
  it('setRoute keeps at most maxPoints, the newest; withPoint wipes the oldest', () => {
    const w = createWorld(1, 1);
    const pts = [1, 2, 3, 4, 5].map((i) => ({ x: i * 100, y: 0 }));
    applyCommand(w, { type: 'setRoute', shipId: 1, points: pts });
    expect(routeOf(w, 1)!.points.map((p) => p.x)).toEqual([200, 300, 400, 500]);
    expect(withPoint(pts.slice(0, 4), { x: 9, y: 9 }).map((p) => p.x)).toEqual([200, 300, 400, 9]);
    expect(AUTOPILOT.maxPoints).toBe(4);
  });

  it('your rudder switches the autopilot off; the helmsman\'s own rudder does not; clearRoute wipes it', () => {
    const w = createWorld(1, 1);
    applyCommand(w, { type: 'setRoute', shipId: 1, points: [{ x: 0, y: -800 }] });
    applyCommand(w, { type: 'setRudder', shipId: 1, value: 0.3, auto: true });
    expect(routeOf(w, 1)).toBeDefined();
    applyCommand(w, { type: 'setRudder', shipId: 1, value: 0.3 });
    expect(routeOf(w, 1)).toBeUndefined();
    applyCommand(w, { type: 'setRoute', shipId: 1, points: [{ x: 0, y: -800 }] });
    applyCommand(w, { type: 'clearRoute', shipId: 1 });
    expect(routeOf(w, 1)).toBeUndefined();
  });

  it('a sunk ship loses its route', () => {
    const w = createWorld(1, 1);
    applyCommand(w, { type: 'setRoute', shipId: 1, points: [{ x: 0, y: -800 }] });
    w.ships[0]!.sunk = true;
    w.tick = 0;
    expect(thinkAutopilot(w)).toEqual([]);
    expect(routeOf(w, 1)).toBeUndefined();
  });
});

describe('autopilot steering (D73)', () => {
  it('sails a reach through two points, crosses them off and switches off after the last', () => {
    const s = sim();
    const me = s.world.ships[0]!;
    // The wind comes from the ENE: north and then west of the start are reaches.
    s.queueCommand({ type: 'setRoute', shipId: 1, points: [{ x: me.x, y: me.y - 500 }, { x: me.x - 400, y: me.y - 700 }] });
    const events = run(s, 150, () => !routeOf(s.world, 1));
    const left = events.filter((e) => e.type === 'routePoint').map((e) => (e.type === 'routePoint' ? e.left : -1));
    expect(left).toEqual([1, 0]);
    expect(routeOf(s.world, 1)).toBeUndefined();
    expect(Math.hypot(me.x - (160 - 400), me.y - (90 - 700))).toBeLessThan(AUTOPILOT.arriveM + 5);
  });

  it('beats in tacks to a point dead upwind and gets there', () => {
    const s = sim();
    const me = s.world.ships[0]!;
    const up = bearingDegToHeadingRad(67.5); // toward where the wind comes from
    const goal = { x: me.x + Math.cos(up) * 450, y: me.y + Math.sin(up) * 450 };
    s.queueCommand({ type: 'setWind', fromRad: up, strength: 0.8 });
    s.queueCommand({ type: 'setRoute', shipId: 1, points: [goal] });
    let tacked = false;
    run(s, 300, () => {
      tacked ||= routeTacking(routeOf(s.world, 1));
      return !routeOf(s.world, 1);
    });
    expect(tacked).toBe(true);
    expect(routeOf(s.world, 1)).toBeUndefined(); // reached within 5 minutes
  });
});

describe('the helmsman sets the sails (M4b step 5b-2)', () => {
  it('a route starts with full sail; your own sail input keeps them in your hand', () => {
    const s = sim();
    s.queueCommand({ type: 'setSails', shipId: 1, value: 0.3 });
    s.update(1 / 30);
    s.queueCommand({ type: 'setRoute', shipId: 1, points: [{ x: 2000, y: 0 }] });
    run(s, 1);
    expect(s.world.ships[0]!.sailLevel).toBeCloseTo(AUTOPILOT.sails, 5);
    s.queueCommand({ type: 'setSails', shipId: 1, value: 0.5 });
    run(s, 2);
    expect(s.world.ships[0]!.sailLevel).toBeCloseTo(0.5, 5);
    expect(routeOf(s.world, 1)!.handSails).toBe(true);
  });

  it('a new route hands the sails to the helmsman again', () => {
    const s = sim();
    s.queueCommand({ type: 'setRoute', shipId: 1, points: [{ x: 2000, y: 0 }] });
    s.queueCommand({ type: 'setSails', shipId: 1, value: 0.2 });
    run(s, 1);
    s.queueCommand({ type: 'setRoute', shipId: 1, points: [{ x: 0, y: 2000 }] });
    run(s, 1);
    expect(s.world.ships[0]!.sailLevel).toBeCloseTo(AUTOPILOT.sails, 5);
  });
});
