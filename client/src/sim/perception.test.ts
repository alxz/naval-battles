// M4b step 1: what a ship can see (sim/perception.ts).
import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from './data';
import { contactOf, levelAt, mastScale, SIGHT, stepPerception, visibleContacts } from './perception';
import { createWorld } from './world';
import type { Island, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const frigate = SHIP_CLASSES['frigate']!;

/** Two sloops on open water, `gap` metres apart (ship 1 at the origin), and no land at all. */
function pair(gap: number): World {
  const w = createWorld(7, 1);
  const [a, b] = w.ships as [World['ships'][0], World['ships'][0]];
  a.x = 0; a.y = 0;
  b.x = gap; b.y = 0;
  b.nation = 'spain';
  return w;
}

/** One update at the next update tick. */
function look(w: World, islands: readonly Island[] = []): void {
  w.tick = Math.ceil(w.tick / SIGHT.updateEveryTicks) * SIGHT.updateEveryTicks;
  w.events = [];
  stepPerception(w, islands);
}

describe('ranges', () => {
  it('a sloop is seen: detail 200, flag 400, silhouette 600, something there 1000 m', () => {
    expect(levelAt(150, sloop)).toBe(4);
    expect(levelAt(300, sloop)).toBe(3);
    expect(levelAt(500, sloop)).toBe(2);
    expect(levelAt(900, sloop)).toBe(1);
    expect(levelAt(1100, sloop)).toBe(0);
  });
  it('tall masts are seen further, within the limits', () => {
    expect(mastScale(sloop.mastHeight)).toBeCloseTo(1, 5);
    expect(mastScale(frigate.mastHeight)).toBeGreaterThan(1);
    expect(mastScale(1000)).toBe(SIGHT.mastScaleMax);
    expect(mastScale(1)).toBe(SIGHT.mastScaleMin);
    expect(levelAt(1100, frigate)).toBe(1);
  });
  it('bad visibility (fog, night) shrinks every range', () => {
    expect(levelAt(150, sloop, 0.5)).toBe(3);
    expect(levelAt(900, sloop, 0.5)).toBe(0);
  });
});

describe('the lists', () => {
  it('level 4: everything known; level 2: class, course and speed but no flag and no hull; far: nothing', () => {
    const w = pair(150);
    look(w);
    const near = contactOf(w, 1, 2)!;
    expect(near.level).toBe(4);
    expect(near.nation).toBe('spain');
    expect(near.hullShare).toBe(1);
    expect(w.events.some((e) => e.type === 'sighted' && e.shipId === 1 && e.otherId === 2 && e.first)).toBe(true);

    const mid = pair(500);
    look(mid);
    const c = contactOf(mid, 1, 2)!;
    expect(c.level).toBe(2);
    expect(c.shipClass).toBe('sloop');
    expect(c.nation).toBeUndefined();
    expect(c.hullShare).toBeUndefined();

    const far = pair(1500);
    look(far);
    expect(contactOf(far, 1, 2)).toBeUndefined();
    expect(visibleContacts(far, 1)).toHaveLength(0);
  });
  it('it is a two-way thing: the other ship sees you too', () => {
    const w = pair(300);
    look(w);
    expect(contactOf(w, 2, 1)?.level).toBe(3);
  });
  it('only on every updateEveryTicks-th tick', () => {
    const w = pair(150);
    w.tick = 3;
    w.events = [];
    stepPerception(w, []);
    expect(w.sight ?? []).toHaveLength(0);
  });
  it('what was learned stays: the flag stays known when the ship drifts out to the silhouette range', () => {
    const w = pair(300);
    look(w);
    expect(contactOf(w, 1, 2)?.nation).toBe('spain');
    w.ships[1]!.x = 500;
    look(w);
    const c = contactOf(w, 1, 2)!;
    expect(c.visible).toBe(true);
    expect(c.level).toBe(3);
    expect(c.nation).toBe('spain');
  });
});

describe('losing and forgetting', () => {
  it('out of range: lost sight once, the last place is kept; after forgetSeconds it is forgotten', () => {
    const w = pair(300);
    look(w);
    w.ships[1]!.x = 3000;
    look(w);
    expect(w.events.filter((e) => e.type === 'lostSight' && e.shipId === 1)).toHaveLength(1);
    const c = contactOf(w, 1, 2)!;
    expect(c.visible).toBe(false);
    expect(c.x).toBe(300); // where it was when last seen
    look(w);
    expect(w.events.filter((e) => e.type === 'lostSight' && e.shipId === 1)).toHaveLength(0); // said only once
    w.tick += SIGHT.forgetSeconds * 30;
    look(w);
    expect(contactOf(w, 1, 2)).toBeUndefined();
    expect(w.events.some((e) => e.type === 'forgotten' && e.shipId === 1 && e.otherId === 2)).toBe(true);
  });
  it('a sunk ship sees nothing and is not seen', () => {
    const w = pair(150);
    look(w);
    w.ships[1]!.sunk = true;
    look(w);
    expect(contactOf(w, 1, 2)).toBeUndefined();
    expect(w.sight?.find((s) => s.shipId === 2)).toBeUndefined();
  });
  it('the same world gives the same lists', () => {
    const a = pair(420);
    const b = pair(420);
    look(a);
    look(b);
    expect(JSON.stringify(a.sight)).toBe(JSON.stringify(b.sight));
  });
});

describe('land hides ships', () => {
  const hill: Island[] = [{ name: 'test hill', points: [{ x: 150, y: -100 }, { x: 250, y: -100 }, { x: 250, y: 100 }, { x: 150, y: 100 }] }];
  it('a ship behind an island is not seen; sailing out from behind it, it is', () => {
    const w = pair(400); // 400 m apart, the hill in the middle
    look(w, hill);
    expect(contactOf(w, 1, 2)).toBeUndefined();
    w.ships[1]!.y = 450; // clear of the hill's end
    look(w, hill);
    expect(contactOf(w, 1, 2)?.visible).toBe(true);
  });
  it('it is lost when it goes behind the island, and the place where it was last seen is kept', () => {
    const w = pair(400);
    w.ships[1]!.y = 450;
    look(w, hill);
    expect(contactOf(w, 1, 2)?.visible).toBe(true);
    w.ships[1]!.y = 0;
    look(w, hill);
    const c = contactOf(w, 1, 2)!;
    expect(c.visible).toBe(false);
    expect(c.y).toBe(450);
  });
});
