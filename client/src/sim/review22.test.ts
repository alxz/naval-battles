// Review of 22 Nov 2026 (D69): fixes found in the review, and tests for formulas that had none (rule 6).
import { describe, expect, it } from 'vitest';
import { newBot, thinkBots } from './bot';
import { applyCommand } from './commands';
import { BOTS, ISLANDS, SHIP_CLASSES } from './data';
import { nearMiss } from './morale';
import { isPirate, nationFor, NATIONS } from './nation';
import { contactOf, levelAt, levelForMasts, mastScale, SIGHT } from './perception';
import { seamanshipSpeed } from './skills';
import { STEP_SECONDS, stepWorld } from './step';
import { terrainFor } from './terrain';
import type { ShipState, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const frigate = SHIP_CLASSES['frigate']!;
const steady = { speedScale: 1, windDrift: false };
const mk = (id: number, x: number): ShipState => ({
  id, shipClass: 'sloop', x, y: 0, headingRad: Math.PI, speed: 0, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 5,
  reloadPort: 0, reloadStarboard: 0, hull: sloop.hullPoints, sunk: false, battleSkill: 4, team: id, repairing: false,
});
const duel = (gap: number): World => ({
  tick: 0, rngState: 7, wind: { fromRad: -Math.PI / 2, strength: 0.7, baseFromRad: -Math.PI / 2 },
  ships: [mk(1, 0), mk(2, gap)], balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [newBot(2, 1, { rngState: 99 })],
});

describe('sight: the masts help only over the horizon', () => {
  it('the flag (400 m) and the deck (200 m) do not grow with the masts', () => {
    expect(levelAt(210, frigate)).toBe(3);
    expect(levelAt(420, frigate)).toBe(2);
    expect(levelForMasts(420, 10)).toBe(2);
  });
  it('the silhouette and "something there" do, at most by mastScaleMax', () => {
    expect(levelAt(700, frigate)).toBe(2); // 600 x 1.35 = 810 m
    expect(levelAt(700, sloop)).toBe(1);
    expect(levelForMasts(1400, 5)).toBe(0); // capped: 1000 x 1.35 = 1350 m
    expect(mastScale(frigate.mastHeight)).toBe(SIGHT.mastScaleMax);
  });
});

describe('the search ends at the last known place', () => {
  it('nobody there: the bot drops the contact and sails on, instead of circling the empty spot', () => {
    const w = duel(400);
    for (let i = 0; i < 30; i++) { for (const c of thinkBots(w, [])) applyCommand(w, c); stepWorld(w, STEP_SECONDS, steady, []); }
    expect(contactOf(w, 2, 1)?.visible).toBe(true);
    w.ships[0]!.x = -9000; // gone far out of sight
    let gaveUp = -1;
    for (let t = 0; t < 30 * 55 && gaveUp < 0; t++) {
      for (const c of thinkBots(w, [])) applyCommand(w, c);
      stepWorld(w, STEP_SECONDS, steady, []);
      if (!contactOf(w, 2, 1)) gaveUp = t / 30;
    }
    expect(gaveUp).toBeGreaterThan(0);
    expect(gaveUp).toBeLessThan(SIGHT.forgetSeconds - 10); // well before the contact would be forgotten anyway
    expect(w.bots[0]!.mode).toBe('trade');
  });
});

describe('formulas without a test before the review', () => {
  it('nationFor: the same seed and ship give the same flag; the flags vary', () => {
    expect(nationFor(5150, 3)).toBe(nationFor(5150, 3));
    const seen = new Set(Array.from({ length: 40 }, (_v, i) => nationFor(5150, i)));
    expect(seen.size).toBeGreaterThan(2);
    for (const n of seen) expect(NATIONS).toContain(n);
  });
  it('isPirate: only the black flag', () => {
    expect(isPirate({ nation: 'pirates' })).toBe(true);
    expect(isPirate({ nation: 'spain' })).toBe(false);
    expect(isPirate({})).toBe(false);
  });
  it('seamanshipSpeed: the ship\'s seamanship, 1 when it has none', () => {
    expect(seamanshipSpeed(mk(1, 0))).toBe(1);
    expect(seamanshipSpeed({ ...mk(1, 0), seamanship: 1.1 })).toBe(1.1);
  });
  it('terrainFor: one grid per island list (built once)', () => {
    expect(terrainFor(ISLANDS)).toBe(terrainFor(ISLANDS));
  });
  it('nearMiss: a ball close by frightens a bot, not the shooter, not a ship far off', () => {
    const w = duel(1000);
    w.bots.push(newBot(1, 2, { rngState: 5 }));
    nearMiss(w, 1000 + BOTS.nearMissM / 2, 0, 1);
    expect(w.bots[0]!.fear ?? 0).toBeGreaterThan(0);
    expect(w.bots[1]!.fear ?? 0).toBe(0);
  });
});
