// M4b step 4: the arena switch "what the watched bot sees" and the log lines SIGHTED / LOST SIGHT.
import { describe, expect, it } from 'vitest';
import { ArenaLog, lostSightLine, sightedLine } from './arenaLog';
import { knownShips, observerSeesAll } from './knownShips';
import { createArenaWorld } from '../sim/arena';
import { SIGHT, stepPerception } from '../sim/perception';
import { createWorld } from '../sim/world';
import type { Island, World } from '../sim/types';

function pair(gap: number): World {
  const w = createWorld(7, 1);
  w.ships[0]!.x = 0; w.ships[0]!.y = 0;
  w.ships[1]!.x = gap; w.ships[1]!.y = 0;
  return w;
}

function look(w: World, islands: readonly Island[] = []): void {
  w.tick = Math.ceil((w.tick + 1) / SIGHT.updateEveryTicks) * SIGHT.updateEveryTicks;
  w.events = [];
  stepPerception(w, islands);
}

const hill: Island[] = [{ name: 'test hill', points: [{ x: 150, y: -100 }, { x: 250, y: -100 }, { x: 250, y: 100 }, { x: 150, y: 100 }] }];

describe('the arena switch', () => {
  it('a battle never sees all; the arena sees all unless bot eyes are on', () => {
    expect(observerSeesAll(false, false)).toBe(false);
    expect(observerSeesAll(false, true)).toBe(false);
    expect(observerSeesAll(true, false)).toBe(true);
    expect(observerSeesAll(true, true)).toBe(false);
  });
  it("with bot eyes the arena screen shows exactly the watched bot's contacts", () => {
    const w = createArenaWorld(5150, 10);
    look(w);
    const viewer = w.ships[0]!;
    const all = knownShips(w, viewer.id, observerSeesAll(true, false));
    const eyes = knownShips(w, viewer.id, observerSeesAll(true, true));
    expect(all.every((k) => k.shown)).toBe(true);
    const contacts = w.sight!.find((s) => s.shipId === viewer.id)!.contacts;
    w.ships.forEach((ship, i) => {
      if (ship.id === viewer.id) return expect(eyes[i]!.shown).toBe(true);
      const c = contacts.find((q) => q.id === ship.id);
      expect(eyes[i]!.shown).toBe(!!c?.visible && c.levelNow >= 2);
      expect(eyes[i]!.dot).toBe(!!c?.visible && c.levelNow === 1);
    });
    // The 10-bot arena is spread wide: some ships are out of this bot's sight.
    expect(eyes.some((k) => !k.shown)).toBe(true);
  });
});

describe('sight events for the log', () => {
  it('back in view after a loss: sighted again; a better level is not "again"', () => {
    const w = pair(500);
    look(w);
    expect(w.events.find((e) => e.type === 'sighted' && e.shipId === 1)).toMatchObject({ first: true, again: false, levelNow: 2 });
    w.ships[1]!.x = 300; // flag range: a better level
    look(w);
    expect(w.events.find((e) => e.type === 'sighted' && e.shipId === 1)).toMatchObject({ first: false, again: false, levelNow: 3 });
    w.ships[1]!.x = 3000;
    look(w);
    w.ships[1]!.x = 500;
    look(w);
    expect(w.events.find((e) => e.type === 'sighted' && e.shipId === 1)).toMatchObject({ first: false, again: true, levelNow: 2, level: 3 });
  });
  it('lost sight: out of range, or behind land (with the distance)', () => {
    const w = pair(400);
    w.ships[1]!.y = 450;
    look(w, hill);
    w.ships[1]!.y = 0; // behind the hill now
    look(w, hill);
    expect(w.events.find((e) => e.type === 'lostSight' && e.shipId === 1)).toMatchObject({ why: 'land', distance: 602 });
    const far = pair(300);
    look(far);
    far.ships[1]!.x = 3000;
    look(far);
    expect(far.events.find((e) => e.type === 'lostSight' && e.shipId === 1)).toMatchObject({ why: 'range', distance: 300 });
  });
});

describe('log lines', () => {
  it('SIGHTED and LOST SIGHT read like this', () => {
    const w = pair(500);
    delete w.ships[1]!.nation; // (a battle name carries the flag: "SLOOP 2 [england]")
    expect(sightedLine(w, 1, 2, 2, 512.4, false)).toBe('SIGHTED: YOU (sloop) sees SLOOP 2: silhouette, 512 m');
    expect(sightedLine(w, 2, 1, 1, 950, true)).toBe('SIGHTED again: SLOOP 2 sees YOU (sloop): a sail, 950 m');
    expect(lostSightLine(w, 1, 2, 10, -20, 990, 'range')).toBe('LOST SIGHT: YOU (sloop) loses SLOOP 2 out of sight range, 990 m, last seen at (10, -20)');
    expect(lostSightLine(w, 1, 2, 10, -20, 400, 'land')).toContain('behind land, 400 m');
  });
  it('every pair writes a line when it comes into view and when it is lost, not for a better level', () => {
    const w = pair(500);
    const log = new ArenaLog();
    const lines = (): number => log.text(w, '').split('\n').filter((l) => l.includes('SIGHTED') || l.includes('LOST SIGHT')).length;
    look(w);
    log.record(w, w.events);
    expect(lines()).toBe(2); // both ships see each other
    w.ships[1]!.x = 300;
    look(w);
    log.record(w, w.events);
    expect(lines()).toBe(2); // a better level: no line
    w.ships[1]!.x = 3000;
    look(w);
    log.record(w, w.events);
    expect(lines()).toBe(4); // both lose sight
    expect(log.text(w, '')).toContain('back in view 0x');
  });
});

describe('mode lines (5c)', () => {
  it('every change of a bot mode gets a line, the old ones keep their words', () => {
    const w = createWorld(7, 1);
    const log = new ArenaLog();
    log.modeChanged(w, w.ships[0]!.id, 'chase');
    log.modeChanged(w, w.ships[0]!.id, 'flee');
    const text = log.text(w, '');
    expect(text).toContain('MODE chase');
    expect(text).toContain('flees');
  });
});
