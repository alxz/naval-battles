// M4b step 5b-2 (D82): renegades and false flags.
import { describe, expect, it } from 'vitest';
import { falseFlagFor, shownNation } from './nation';
import { hashUnit, hideSomePirates, idleFor, mostRams, rammersIn, rebirthFlag, startsHidden, stepRenegades, RENEGADE } from './renegade';
import { nationFor } from './nation';
import { createArenaWorld } from './arena';
import type { SimEvent } from './types';

type Collision = Extract<SimEvent, { type: 'collision' }>;
const hit = (shipA: number, shipB: number, damageA: number, damageB: number): Collision => ({ type: 'collision', shipA, shipB, damageA, damageB, x: 0, y: 0 });
const TICKS_MIN = 30 * 60;

describe('shownNation', () => {
  it('shows the false flag beyond hoistM and the black one inside', () => {
    const s = { nation: 'pirates', falseFlag: 'spain' };
    expect(shownNation(s, 301, 300)).toBe('spain');
    expect(shownNation(s, 300, 300)).toBe('pirates');
    expect(shownNation({ nation: 'england' }, 900, 300)).toBe('england');
  });
  it('falseFlagFor is an honest nation, always the same', () => {
    for (let id = 1; id < 30; id++) {
      const f = falseFlagFor(7, id);
      expect(f).not.toBe('pirates');
      expect(falseFlagFor(7, id)).toBe(f);
    }
  });
});

describe('rams and idleness', () => {
  it('only a bot ramming on purpose (mode ram) counts, and only when the collision did damage', () => {
    const bots = [{ shipId: 2, mode: 'ram' as const }, { shipId: 3, mode: 'chase' as const }];
    expect(rammersIn(hit(2, 3, 5, 40), bots)).toEqual([2]);
    expect(rammersIn(hit(3, 2, 40, 5), bots)).toEqual([2]);
    expect(rammersIn(hit(2, 3, 0, 0), bots)).toEqual([]);
    expect(rammersIn(hit(3, 4, 5, 40), bots)).toEqual([]); // an accidental bump
  });
  it('hashUnit is an integer hash in [0, 1), the same for the same input', () => {
    for (let id = 0; id < 50; id++) {
      const u = hashUnit(5150, id, 1);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      expect(hashUnit(5150, id, 1)).toBe(u);
    }
    expect(hashUnit(1, 2, 3)).toBe(hashUnit(1, 2, 3));
  });
  it('mostRams needs the minimum and a single leader', () => {
    expect(mostRams([{ shipId: 2, rams: 2 }, { shipId: 3, rams: 1 }], 3)).toBeUndefined();
    expect(mostRams([{ shipId: 2, rams: 3 }, { shipId: 3, rams: 1 }], 3)).toBe(2);
    expect(mostRams([{ shipId: 2, rams: 3 }, { shipId: 3, rams: 3 }], 3)).toBeUndefined();
  });
  it('idleFor counts seconds since the last sinking', () => {
    expect(idleFor({ sinceTick: 0 }, 600 * 30 - 1, 600)).toBe(false);
    expect(idleFor({ sinceTick: 0 }, 600 * 30, 600)).toBe(true);
  });
  it('startsHidden is deterministic and about the given share', () => {
    let n = 0;
    for (let id = 1; id <= 200; id++) if (startsHidden(5, id, 0.5)) n++;
    expect(n).toBeGreaterThan(60);
    expect(n).toBeLessThan(140);
    expect(startsHidden(5, 3, 0.5)).toBe(startsHidden(5, 3, 0.5));
    expect(startsHidden(5, 3, 0)).toBe(false);
  });
});

describe('stepRenegades', () => {
  function setup() {
    const w = createArenaWorld(3, 4);
    for (const s of w.ships) {
      s.nation = 'england';
      s.shipClass = 'sloop';
    }
    return w;
  }
  it('an offender becomes a renegade: black flag, false flag gone, one event', () => {
    const w = setup();
    const ship = w.ships[0]!;
    ship.falseFlag = 'spain';
    ship.offender = { port: 0, forgiveLeft: 100 };
    w.tick = TICKS_MIN;
    stepRenegades(w);
    expect(ship.nation).toBe('pirates');
    expect(ship.falseFlag).toBeUndefined();
    expect(w.bots.find((b) => b.shipId === ship.id)!.renegade).toBe(true);
    expect(w.events.filter((e) => e.type === 'pirateTurn')).toHaveLength(1);
  });
  it('the ram leader becomes a renegade; only its deliberate rams are counted', () => {
    const w = setup();
    const a = w.ships[0]!.id;
    const b = w.ships[1]!.id;
    w.bots.find((x) => x.shipId === a)!.mode = 'ram';
    w.bots.find((x) => x.shipId === b)!.mode = 'chase';
    for (let i = 0; i < 3; i++) {
      w.events = [hit(a, b, 2, 30)];
      stepRenegades(w);
    }
    expect(w.bots.find((x) => x.shipId === a)!.rams).toBe(3);
    w.events = [];
    w.tick = TICKS_MIN;
    stepRenegades(w);
    expect(w.bots.find((x) => x.shipId === a)!.renegade).toBe(true);
    expect(w.bots.find((x) => x.shipId === b)!.renegade).toBeUndefined();
  });
  it('an idle bot may turn pirate under its old flag as a false one; a sinking resets the idle time', () => {
    const w = setup();
    const p = { ...RENEGADE, idleChance: 1 };
    const bot = w.bots[0]!;
    bot.sinceTick = 0;
    w.tick = 600 * 30 + TICKS_MIN - (600 * 30) % TICKS_MIN; // a check tick after 10 minutes
    stepRenegades(w, p);
    const ship = w.ships.find((s) => s.id === bot.shipId)!;
    expect(ship.nation).toBe('pirates');
    expect(ship.falseFlag).toBe('england');
    expect(bot.renegade).toBeUndefined();
    // the other bot sank somebody a minute ago: not idle
    const other = w.bots[1]!;
    other.sinceTick = w.tick - 1;
    expect(idleFor(other, w.tick, 600)).toBe(false);
  });
  it('traders never turn pirate', () => {
    const w = setup();
    const ship = w.ships[0]!;
    ship.shipClass = 'fluyt';
    ship.offender = { port: 0, forgiveLeft: 100 };
    w.tick = TICKS_MIN;
    stepRenegades(w);
    expect(ship.nation).toBe('england');
  });
  it('hideSomePirates hides pirates only (a share of them), never a non-pirate', () => {
    const w = setup();
    w.ships[0]!.nation = 'pirates';
    w.ships[1]!.nation = 'pirates';
    hideSomePirates(w, 5, { ...RENEGADE, falseFlagShare: 1 });
    expect(w.ships[0]!.falseFlag).toBeDefined();
    expect(w.ships[1]!.falseFlag).toBeDefined();
    hideSomePirates(w, 5, { ...RENEGADE, falseFlagShare: 0 });
    expect(w.ships[2]!.falseFlag).toBeUndefined();
  });
  it('rebirthFlag: the birth flag back, the false flag gone unless the birth flag is black and the lot hides it', () => {
    const w = setup();
    const ship = w.ships[0]!;
    ship.nation = 'pirates';
    ship.falseFlag = 'spain';
    rebirthFlag(ship, 77, { ...RENEGADE, falseFlagShare: 0 });
    expect(ship.nation).toBe(nationFor(77, ship.id));
    expect(ship.falseFlag).toBeUndefined();
  });
});
