import { describe, expect, it } from 'vitest';
import { crewOf, crewShare, crewSpeedFactor, crewTurnFactor, crewShortage, damageSails, gunsManned, killCrew, refitShip, reloadFactor, sailShare, sailSpeedFactor, sailsOf } from './condition';
import { GUNS, SHIP_CLASSES } from './data';
import { stepShip, targetSpeed } from './step';
import { createWorld } from './world';

const sloop = SHIP_CLASSES['sloop']!;

describe('sails and crew (M3 step 4)', () => {
  it('a new ship (no fields) has full sails and a full crew', () => {
    const s = createWorld(1).ships[0]!;
    expect(sailsOf(s)).toBe(sloop.sailPoints);
    expect(crewOf(s)).toBe(sloop.crew);
    expect(sailShare(s)).toBe(1);
    expect(crewShare(s)).toBe(1);
    expect(crewShortage(s)).toBe(0);
  });

  it('damage never goes below zero; killCrew counts whole men', () => {
    const s = createWorld(1).ships[0]!;
    expect(damageSails(s, 30)).toBe(30);
    expect(sailsOf(s)).toBe(sloop.sailPoints - 30);
    expect(damageSails(s, 1000)).toBe(sloop.sailPoints - 30);
    expect(sailsOf(s)).toBe(0);
    expect(killCrew(s, 2.4)).toBe(2);
    expect(crewOf(s)).toBe(sloop.crew - 2);
    expect(killCrew(s, 999)).toBe(sloop.crew - 2);
    refitShip(s);
    expect(sailsOf(s)).toBe(sloop.sailPoints);
    expect(crewOf(s)).toBe(sloop.crew);
  });

  it('plan 4.3: speed x (0.2 + 0.8 x sails); with no sails left a fifth of the speed', () => {
    const w = createWorld(1);
    const s = w.ships[0]!;
    s.sailLevel = 1;
    const wind = { fromRad: s.headingRad - (Math.PI * 3) / 4, strength: 0.8 };
    const full = targetSpeed(s, sloop, wind);
    s.sails = sloop.sailPoints / 2;
    expect(sailSpeedFactor(s)).toBeCloseTo(0.6);
    expect(targetSpeed(s, sloop, wind)).toBeCloseTo(full * 0.6);
    s.sails = 0;
    expect(targetSpeed(s, sloop, wind)).toBeCloseTo(full * 0.2);
  });

  it('plan 4.4: reload x min(2.5, full / crew); guns manned = crew / 4', () => {
    const s = createWorld(1).ships[0]!;
    expect(reloadFactor(s)).toBe(1);
    s.crew = sloop.crew / 2;
    expect(reloadFactor(s)).toBeCloseTo(2);
    s.crew = 5;
    expect(reloadFactor(s)).toBe(GUNS.maxReloadFactor);
    expect(gunsManned(s, sloop)).toBe(1);
    s.crew = 60;
    expect(gunsManned(s, sloop)).toBe(sloop.gunsPerSide);
    s.crew = 0;
    expect(reloadFactor(s)).toBe(GUNS.maxReloadFactor);
    expect(gunsManned(s, sloop)).toBe(0);
  });

  it('step 4b: a short-handed ship sails slower (0.7 + 0.3 x crew) and turns slower (0.4 + 0.6 x crew)', () => {
    const s = createWorld(1).ships[0]!;
    s.sailLevel = 1;
    const wind = { fromRad: s.headingRad - (Math.PI * 3) / 4, strength: 0.8 };
    const full = targetSpeed(s, sloop, wind);
    expect(crewSpeedFactor(s)).toBe(1);
    expect(crewTurnFactor(s)).toBe(1);
    s.crew = sloop.crew / 2;
    expect(crewSpeedFactor(s)).toBeCloseTo(0.85);
    expect(crewTurnFactor(s)).toBeCloseTo(0.7);
    expect(targetSpeed(s, sloop, wind)).toBeCloseTo(full * 0.85);
    s.crew = 0;
    expect(crewSpeedFactor(s)).toBeCloseTo(0.7);
    expect(crewTurnFactor(s)).toBeCloseTo(0.4);
  });

  it('step 4b: the turn per step shrinks with the crew', () => {
    const wind = { fromRad: 0, strength: 0.8 };
    const turn = (crew: number | undefined): number => {
      const s = createWorld(1).ships[0]!;
      if (crew !== undefined) s.crew = crew;
      s.speed = sloop.maxSpeed;
      s.rudder = 1;
      const h0 = s.headingRad;
      stepShip(s, sloop, wind, 0.1);
      return Math.abs(s.headingRad - h0);
    };
    expect(turn(0) / turn(undefined)).toBeCloseTo(0.4, 5);
  });
});
