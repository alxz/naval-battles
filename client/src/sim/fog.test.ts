// M4b step 5a: fog banks for the rules, a shot gives the shooter away, the rough hull at 200-450 m.
import { describe, expect, it } from 'vitest';
import { FOG, fogAt, fogBetween, fogVisibility, makeFog, stepFog } from './fog';
import { contactOf, firedLately, noteGunfire, roughHull, SIGHT, stepPerception } from './perception';
import { createWorld } from './world';
import { knownShips, shotSeen } from '../view/knownShips';
import type { FogState, Island, World } from './types';

/** One round bank of one puff, 600 m across, at (x, y). */
function blob(x: number, y: number): FogState {
  return { banks: [{ x, y, speed: 1, reachM: 300, puffs: [{ along: 0, across: 0, size: 600 }] }] };
}

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

const east = { fromRad: 0, strength: 1 }; // the wind comes from the east: it blows toward the west (-x)
const hill: Island[] = [{ name: 'test hill', points: [{ x: 150, y: -100 }, { x: 250, y: -100 }, { x: 250, y: 100 }, { x: 150, y: 100 }] }];

describe('fog banks', () => {
  it('the same seed gives the same fog; another seed another', () => {
    expect(makeFog(42)).toEqual(makeFog(42));
    expect(makeFog(42)).not.toEqual(makeFog(43));
    expect(makeFog(42).banks).toHaveLength(FOG.banks);
  });
  it('banks drift down the wind', () => {
    const fog = blob(0, 0);
    stepFog(fog, east, 10);
    expect(fog.banks[0]!.x).toBeCloseTo(-(FOG.driftBaseMps + FOG.driftPerWindMps) * 10, 6);
    expect(fog.banks[0]!.y).toBeCloseTo(0, 6);
  });
  it('thick in the middle of a puff, thinner at its edge, clear outside', () => {
    const fog = blob(0, 0);
    expect(fogAt(fog, east, 0, 0)).toBe(1);
    const edge = fogAt(fog, east, 250, 0);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
    expect(fogAt(fog, east, 400, 0)).toBe(0);
    expect(fogAt(undefined, east, 0, 0)).toBe(0);
    expect(fogBetween(fog, east, -1000, 0, 1000, 0)).toBe(1); // the line crosses the bank
  });
  it('visibility: 1 in clear air, visibilityInFog in thick fog', () => {
    expect(fogVisibility(0)).toBe(1);
    expect(fogVisibility(1)).toBeCloseTo(FOG.visibilityInFog, 9);
  });
  it('a ship in a fog bank is lost from sight at 500 m and seen again when the bank has gone', () => {
    const w = pair(500);
    look(w);
    expect(contactOf(w, 1, 2)?.levelNow).toBe(2);
    w.fog = blob(500, 0);
    look(w);
    expect(contactOf(w, 1, 2)?.visible).toBe(false);
    delete w.fog;
    look(w);
    expect(contactOf(w, 1, 2)?.visible).toBe(true);
  });
  it('close by a ship is still seen in fog (sight shrinks, it does not vanish)', () => {
    const w = pair(150);
    w.fog = blob(150, 0);
    look(w);
    expect(contactOf(w, 1, 2)?.visible).toBe(true);
  });
});

describe('a shot gives the shooter away', () => {
  it('a ship behind an island that fires is heard at once (level 1) and while it keeps firing', () => {
    const w = pair(400);
    look(w, hill);
    expect(contactOf(w, 1, 2)).toBeUndefined();
    w.events = [{ type: 'gunFired', shipId: 2, side: 'port', x: 400, y: 0, ammo: 'round' }];
    noteGunfire(w);
    expect(firedLately(w, 2)).toBe(true);
    expect(contactOf(w, 1, 2)).toMatchObject({ visible: true, levelNow: 1 });
    expect(w.events.some((e) => e.type === 'sighted' && e.shipId === 1 && e.otherId === 2 && e.heard)).toBe(true);
    look(w, hill); // the 3-a-second update keeps it while the mark lasts
    expect(contactOf(w, 1, 2)?.visible).toBe(true);
    w.tick += Math.round(SIGHT.revealSeconds * 30);
    look(w, hill);
    expect(contactOf(w, 1, 2)?.visible).toBe(false);
  });
  it('gunfire is not heard beyond revealM', () => {
    const w = pair(SIGHT.revealM + 300);
    look(w);
    w.events = [{ type: 'gunFired', shipId: 2, side: 'port', x: w.ships[1]!.x, y: 0, ammo: 'round' }];
    noteGunfire(w);
    expect(contactOf(w, 1, 2)?.visible ?? false).toBe(false);
  });
  it('the screen shows the smoke of a ship it knows, not of one it cannot see or hear', () => {
    const w = pair(400);
    look(w, hill);
    expect(shotSeen(knownShips(w, 1, false, hill), w, 2, false)).toBe(false);
    expect(shotSeen(knownShips(w, 1, true, hill), w, 2, true)).toBe(true);
    expect(shotSeen(knownShips(w, 1, false, hill), w, -1, false)).toBe(true); // shore guns
    w.events = [{ type: 'gunFired', shipId: 2, side: 'port', x: 400, y: 0, ammo: 'round' }];
    noteGunfire(w);
    expect(shotSeen(knownShips(w, 1, false, hill), w, 2, false)).toBe(true);
  });
});

describe('the rough hull (200-450 m)', () => {
  it('quarters, rounded up; a ship afloat never looks sunk', () => {
    expect(roughHull(1)).toBe(1);
    expect(roughHull(0.76)).toBe(1);
    expect(roughHull(0.6)).toBe(0.75);
    expect(roughHull(0.5)).toBe(0.5);
    expect(roughHull(0.01)).toBe(0.25);
    expect(roughHull(0)).toBe(0);
  });
  it('a bot learns the rough hull within 450 m and the true hull within 200 m; the screen bars follow', () => {
    const w = pair(300);
    w.ships[1]!.hull = w.ships[1]!.hull * 0.6;
    look(w);
    expect(contactOf(w, 1, 2)?.hullShare).toBe(0.75);
    expect(knownShips(w, 1, false)[1]?.detail).toBe(1);
    w.ships[1]!.x = 150;
    look(w);
    expect(contactOf(w, 1, 2)?.hullShare).toBeCloseTo(0.6, 9);
    expect(knownShips(w, 1, false)[1]?.detail).toBe(2);
    w.ships[1]!.x = 520;
    look(w);
    expect(knownShips(w, 1, false)[1]).toMatchObject({ shown: true, detail: 0 });
  });
  it('the flag from level 3: a ship at 300 m shows it, at 500 m not', () => {
    const w = pair(300);
    look(w);
    expect(knownShips(w, 1, false)[1]?.level).toBe(3);
    w.ships[1]!.x = 500;
    look(w);
    expect(knownShips(w, 1, false)[1]?.level).toBe(2);
  });
});

describe('wrecks', () => {
  it('a wreck behind an island is not drawn', () => {
    const w = pair(400);
    w.ships[1]!.sunk = true;
    expect(knownShips(w, 1, false, [])[1]?.shown).toBe(true);
    look(w, hill);
    expect(knownShips(w, 1, false, hill)[1]?.shown).toBe(false);
  });
});
