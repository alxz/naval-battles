import { describe, expect, it } from 'vitest';
import { nextRouteStop, planRoute, routeKind } from './routes';
import type { ShipState } from './types';

const sets = {
  ports: [
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
  ],
  islands: [
    { x: -1000, y: 500 },
    { x: 1000, y: 800 },
    { x: 1500, y: -900 },
    { x: -2000, y: -700 },
  ],
};
const ship = { x: 0, y: 0 } as ShipState;
const rng = (seed: number): { rngState: number } => ({ rngState: seed });

describe('default routes (M4b step 5b-1)', () => {
  it('a trader sails port to port, a warship island to island', () => {
    expect(routeKind(true, sets)).toBe('ports');
    expect(routeKind(false, sets)).toBe('islands');
    const t = planRoute(rng(7), ship, sets, true, 3, 300);
    expect(t.kind).toBe('ports');
    for (const s of t.stops) expect(sets.ports).toContainEqual(s);
    const w = planRoute(rng(7), ship, sets, false, 3, 300);
    expect(w.kind).toBe('islands');
    expect(w.stops).toHaveLength(3);
    for (const s of w.stops) expect(sets.islands).toContainEqual(s);
  });

  it('the stops are different, and the same seed gives the same route', () => {
    const a = planRoute(rng(11), ship, sets, false, 3, 300);
    const b = planRoute(rng(11), ship, sets, false, 3, 300);
    expect(a).toEqual(b);
    expect(new Set(a.stops.map((s) => `${s.x},${s.y}`)).size).toBe(3);
  });

  it('different seeds give different routes (not always the shortest one)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) seen.add(JSON.stringify(planRoute(rng(seed), ship, sets, false, 3, 300).stops));
    expect(seen.size).toBeGreaterThan(5);
  });

  it('with fewer than two stops of its kind it uses all stops', () => {
    const few = { ports: [{ x: 0, y: 0 }], islands: sets.islands };
    expect(routeKind(true, few)).toBe('islands');
    const r = planRoute(rng(3), ship, few, true, 3, 300);
    expect(r.stops.length).toBe(3);
    expect(planRoute(rng(3), ship, { ports: [], islands: [] }, true, 3, 300).stops).toEqual([]);
  });

  it('the first stop is not where the ship is', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = planRoute(rng(seed), ship, sets, true, 2, 300); // ports: (0,0) is under the ship
      expect(Math.hypot(r.stops[0]!.x - ship.x, r.stops[0]!.y - ship.y)).toBeGreaterThan(900);
    }
  });

  it('the route is made once and sailed round in turn', () => {
    const bot: { plan?: { x: number; y: number }[]; planIndex?: number } = {};
    const r = rng(5);
    const first = nextRouteStop(r, bot, ship, sets, false, 3, 300)!;
    expect(first.planned?.stops).toHaveLength(3);
    const order = [first.stop];
    for (let i = 0; i < 5; i++) {
      const n = nextRouteStop(r, bot, { x: 9000, y: 9000 } as ShipState, sets, false, 3, 300)!;
      expect(n.planned).toBeUndefined();
      order.push(n.stop);
    }
    expect(order[3]).toEqual(order[0]);
    expect(order[4]).toEqual(order[1]);
    expect(order[5]).toEqual(order[2]);
  });

  it('a stop the ship is already at is skipped', () => {
    const bot = { plan: [{ x: 0, y: 0 }, { x: 3000, y: 0 }], planIndex: 0 };
    const n = nextRouteStop(rng(1), bot, ship, sets, false, 3, 300)!;
    expect(n.stop).toEqual({ x: 3000, y: 0 });
  });
});
