import { describe, expect, it } from 'vitest';
import { ISLANDS, SHIP_CLASSES, WORLD, reefs } from './data';
import { bounds, pointInPolygon } from './geometry';
import { touchesLand } from './land';
import { STEP_SECONDS, stepWorld } from './step';
import { createWorld } from './world';

const sloop = SHIP_CLASSES['sloop']!;

describe('the sea (data/world.json, islands)', () => {
  it('has a reef strip along each of its four sides', () => {
    const r = reefs(WORLD);
    expect(r.map((s) => s.kind)).toEqual(['reef', 'reef', 'reef', 'reef']);
    // A point just inside each edge is reef; the middle of the sea is not.
    const mid = { x: (WORLD.minX + WORLD.maxX) / 2, y: (WORLD.minY + WORLD.maxY) / 2 };
    const onReef = (p: { x: number; y: number }): boolean => r.some((s) => pointInPolygon(p, s.points));
    expect(onReef({ x: mid.x, y: WORLD.minY + 5 })).toBe(true);
    expect(onReef({ x: mid.x, y: WORLD.maxY - 5 })).toBe(true);
    expect(onReef({ x: WORLD.minX + 5, y: mid.y })).toBe(true);
    expect(onReef({ x: WORLD.maxX - 5, y: mid.y })).toBe(true);
    expect(onReef({ x: WORLD.minX + WORLD.reefWidth + 5, y: mid.y })).toBe(false);
  });

  it('every island lies inside the reef, and none of them touches another', () => {
    const land = ISLANDS.filter((i) => i.kind !== 'reef' && i.kind !== 'structure'); // piers stand on their own island's shore
    expect(land.length).toBeGreaterThan(10);
    for (const island of land) {
      const b = bounds(island.points);
      expect(b.minX).toBeGreaterThan(WORLD.minX + WORLD.reefWidth);
      expect(b.maxX).toBeLessThan(WORLD.maxX - WORLD.reefWidth);
      expect(b.minY).toBeGreaterThan(WORLD.minY + WORLD.reefWidth);
      expect(b.maxY).toBeLessThan(WORLD.maxY - WORLD.reefWidth);
      for (const other of land) {
        if (other === island) continue;
        expect(island.points.some((p) => pointInPolygon(p, other.points))).toBe(false);
      }
    }
  });

  it('a new game starts in open water, with room to sail', () => {
    const w = createWorld();
    for (const ship of w.ships) expect(touchesLand(ship, sloop, ISLANDS)).toBe(false);
    const me = w.ships[0]!;
    for (const dx of [-250, 0, 250]) for (const dy of [-250, 0, 250]) expect(touchesLand({ ...me, x: me.x + dx, y: me.y + dy }, sloop, ISLANDS)).toBe(false);
  });

  it('a ship cannot sail out of the sea: it grounds on the reef', () => {
    const w = createWorld();
    const me = w.ships[0]!;
    me.x = WORLD.maxX - WORLD.reefWidth - 35; // the bow is 20 m west of the east reef
    me.y = 0;
    me.headingRad = 0; // east
    me.speed = 8; // it coasts about 40 m without sails
    me.sailLevel = 0;
    let grounded = false;
    for (let i = 0; i < 20 / STEP_SECONDS; i++) {
      stepWorld(w, STEP_SECONDS, { speedScale: 1, windDrift: false });
      grounded ||= me.aground;
    }
    expect(grounded).toBe(true);
    expect(me.x + sloop.length / 2).toBeLessThan(WORLD.maxX - WORLD.reefWidth + 0.5);
  });
});

describe('the inlet (a river mouth ships can sail into)', () => {
  it('one big island has a winding inlet; a sloop, even half again as long, fits all along its middle line', () => {
    const withInlet = ISLANDS.filter((i) => i.inlet);
    expect(withInlet).toHaveLength(1);
    const path = withInlet[0]!.inlet!.path!;
    expect(path.length).toBeGreaterThan(10);
    // It winds: the middle line is not straight.
    const first = path[0]!;
    const last = path[path.length - 1]!;
    const straight = Math.hypot(last.x - first.x, last.y - first.y);
    const swing = Math.max(...path.map((p) => Math.abs((last.x - first.x) * (p.y - first.y) - (last.y - first.y) * (p.x - first.x)) / straight));
    expect(swing).toBeGreaterThan(20);
    const bigSloop = { ...sloop, length: sloop.length * 1.5, beam: sloop.beam * 1.5 };
    for (let i = 1; i < path.length - 2; i++) {
      const a = path[i - 1]!;
      const b = path[i + 1]!;
      const ship = { ...createWorld(1).ships[0]!, x: path[i]!.x, y: path[i]!.y, headingRad: Math.atan2(b.y - a.y, b.x - a.x) };
      expect(touchesLand(ship, sloop, ISLANDS)).toBe(false);
      expect(touchesLand(ship, bigSloop, ISLANDS)).toBe(false);
    }
  });
});

describe('the port (piers and moored boats are solid)', () => {
  it('the port island has a quay, three piers and five boats, all solid', () => {
    const structures = ISLANDS.filter((i) => i.kind === 'structure');
    expect(structures.filter((s) => s.name.endsWith('pier'))).toHaveLength(3);
    expect(structures.filter((s) => s.name.endsWith('boat'))).toHaveLength(5);
    expect(structures.filter((s) => s.name.endsWith('quay'))).toHaveLength(1);
  });

  it('a ship lying across the end of a pier touches it, even though no hull point is on the planks', () => {
    const pier = ISLANDS.find((i) => i.kind === 'structure' && i.name.endsWith('pier'))!;
    const ys = pier.points.map((p) => p.y);
    const xs = pier.points.map((p) => p.x);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    const y = Math.max(...ys) - 3; // 3 m from the end of the pier
    // Heading east, the hull's middle point 8 m east of the pier: bow and middle in the water, the hull over the planks.
    const ship = { ...createWorld(1).ships[0]!, x: x + 8, y, headingRad: 0 };
    expect(touchesLand(ship, sloop, ISLANDS)).toBe(true);
    expect(touchesLand({ ...ship, y: y + 30 }, sloop, ISLANDS)).toBe(false);
  });
});
