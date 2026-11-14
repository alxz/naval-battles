import { describe, expect, it } from 'vitest';
import { ISLANDS, SHIP_CLASSES } from './data';
import { hullPoints, touchesLand } from './land';
import { STEP_SECONDS, stepWorld } from './step';
import type { Island, ShipState, World } from './types';
import { createWorld } from './world';

const sloop = SHIP_CLASSES['sloop']!;
const noDrift = { speedScale: 1, windDrift: false };
// A square island, 100 m wide, its west shore at x = 100.
const square: Island = {
  name: 'Test',
  points: [
    { x: 100, y: -50 },
    { x: 200, y: -50 },
    { x: 200, y: 50 },
    { x: 100, y: 50 },
  ],
};

function ship(x: number, headingRad = 0): ShipState {
  return { id: 1, shipClass: 'sloop', x, y: 0, headingRad, speed: 0, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 0, reloadPort: 0, reloadStarboard: 0 };
}

/** A world with one ship and a full wind from the north (a beam reach when heading east). */
function worldWith(s: ShipState): World {
  return { tick: 0, rngState: 1, wind: { fromRad: -Math.PI / 2, strength: 1, baseFromRad: -Math.PI / 2 }, ships: [s], balls: [], pendingShots: [], nextBallId: 1, events: [] };
}

function run(w: World, seconds: number, islands: Island[]): void {
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) stepWorld(w, STEP_SECONDS, noDrift, islands);
}

describe('hullPoints', () => {
  it('bow and stern are half a length from the middle', () => {
    const [bow, stern] = hullPoints(ship(0), sloop);
    expect(bow!.x).toBeCloseTo(sloop.length / 2);
    expect(stern!.x).toBeCloseTo(-sloop.length / 2);
  });
});

describe('touchesLand', () => {
  it('a ship whose bow is on the shore touches land', () => {
    expect(touchesLand(ship(100 - sloop.length / 2 + 1), sloop, [square])).toBe(true);
    expect(touchesLand(ship(100 - sloop.length / 2 - 1), sloop, [square])).toBe(false);
  });
});

describe('grounding in stepWorld', () => {
  it('a ship sailing at the island stops at the shore and never enters it', () => {
    const w = worldWith(ship(0));
    w.ships[0]!.sailLevel = 1;
    run(w, 30, [square]);
    const s = w.ships[0]!;
    expect(s.aground).toBe(true);
    expect(s.speed).toBe(0);
    expect(s.x + sloop.length / 2).toBeLessThanOrEqual(100);
    expect(s.x + sloop.length / 2).toBeGreaterThan(98);
  });

  it('an aground ship can turn away and sail off', () => {
    const w = worldWith(ship(0));
    const s = w.ships[0]!;
    s.sailLevel = 1;
    run(w, 30, [square]);
    s.rudder = 1; // turn to starboard (south, away from the wind from the north)
    run(w, 4, [square]); // about 115 deg: now heading south-south-west, away from the shore
    s.rudder = 0;
    run(w, 10, [square]);
    expect(s.aground).toBe(false);
    expect(s.speed).toBeGreaterThan(1);
  });
});

describe('the test sea', () => {
  it('Pelican Cay: turned into the wind (in irons) with the stern on the sand, it can still turn free', () => {
    const w = createWorld();
    const s = w.ships[0]!;
    s.sailLevel = 1;
    for (let i = 0; i < 90 * 30 && !s.aground; i++) stepWorld(w, STEP_SECONDS, noDrift);
    for (let i = 0; i < 2 * 30; i++) stepWorld(w, STEP_SECONDS, noDrift);
    // Turn to port, through the wind's eye, and keep the rudder over for 15 s.
    s.rudder = -1;
    const turned: number[] = [];
    for (let i = 0; i < 15 * 30; i++) {
      stepWorld(w, STEP_SECONDS, noDrift);
      turned.push(s.headingRad);
    }
    // It never gets stuck: the heading keeps changing during the last 5 s too.
    const last = turned.slice(-150);
    expect(Math.max(...last) - Math.min(...last)).toBeGreaterThan(0.3);
  });

  it('Pelican Cay: run aground on the start course, wait, then turn either way (push-off)', () => {
    for (const rudder of [1, -1]) {
      const w = createWorld();
      const s = w.ships[0]!;
      s.sailLevel = 1;
      for (let i = 0; i < 90 * 30 && !s.aground; i++) stepWorld(w);
      expect(s.aground).toBe(true);
      // Stay aground for 2 s with the sails set: the bow creeps right up to the sand.
      for (let i = 0; i < 2 * 30; i++) stepWorld(w);
      const headingAground = s.headingRad;
      s.rudder = rudder;
      for (let i = 0; i < 4 * 30; i++) stepWorld(w);
      expect(Math.abs(s.headingRad - headingAground)).toBeGreaterThan(0.5);
    }
  });

  it('neither ship starts on land', () => {
    const w = createWorld();
    for (const s of w.ships) expect(touchesLand(s, SHIP_CLASSES[s.shipClass]!, ISLANDS)).toBe(false);
  });
});
