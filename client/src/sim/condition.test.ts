import { describe, expect, it } from 'vitest';
import { cargoSpeedFactor, crewAccelFactor, crewExposure, crewOf, crewShare, crewSpeedFactor, crewTurnFactor, crewShortage, damageSails, gunsManned, killCrew, refitShip, reloadFactor, rollCargo, sailShare, sailSpeedFactor, sailsOf } from './condition';
import { DAMAGE, GUNS, SHIP_CLASSES } from './data';
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

  it('step 7a: with its sailing crew aboard a ship keeps almost all its speed; below it the speed falls to 0.5', () => {
    const s = createWorld(1).ships[0]!;
    s.sailLevel = 1;
    const wind = { fromRad: s.headingRad - (Math.PI * 3) / 4, strength: 0.8 };
    const full = targetSpeed(s, sloop, wind);
    expect(crewSpeedFactor(s)).toBe(1);
    expect(crewTurnFactor(s)).toBe(1);
    s.crew = sloop.crew / 2; // 30 of 60, well above the 10 who sail her
    expect(crewSpeedFactor(s)).toBeCloseTo(0.975);
    expect(crewTurnFactor(s)).toBeCloseTo(0.7);
    expect(targetSpeed(s, sloop, wind)).toBeCloseTo(full * 0.975);
    s.crew = sloop.sailCrew; // just the sailing crew
    const atSail = 1 - DAMAGE.crew.speedLossFull * (1 - sloop.sailCrew / sloop.crew);
    expect(crewSpeedFactor(s)).toBeCloseTo(atSail);
    s.crew = sloop.sailCrew / 2;
    expect(crewSpeedFactor(s)).toBeCloseTo((DAMAGE.crew.speedMinFactor + atSail) / 2);
    s.crew = 0;
    expect(crewSpeedFactor(s)).toBeCloseTo(DAMAGE.crew.speedMinFactor);
    expect(crewTurnFactor(s)).toBeCloseTo(0.4);
  });

  it('step 7a: a short crew gathers way slower (time constant x 1 + men lost share)', () => {
    const s = createWorld(1).ships[0]!;
    expect(crewAccelFactor(s)).toBe(1);
    s.crew = sloop.crew / 2;
    expect(crewAccelFactor(s)).toBeCloseTo(1 + DAMAGE.crew.accelSlowdown * 0.5);
    const run = (crew: number): number => {
      const t = createWorld(1).ships[0]!;
      t.crew = crew;
      t.sailLevel = 1;
      const wind = { fromRad: t.headingRad - (Math.PI * 3) / 4, strength: 0.8 };
      for (let i = 0; i < 90; i++) stepShip(t, sloop, wind, 1 / 30);
      return t.speed;
    };
    expect(run(sloop.crew / 3)).toBeLessThan(run(sloop.crew));
  });

  it('step 7a: a ball kills fewer men on an emptier deck and grape fewer behind high sides', () => {
    const s = createWorld(1).ships[0]!;
    expect(crewExposure(s, sloop, 'round')).toBeCloseTo(sloop.crew / (sloop.length * DAMAGE.crew.crowdPerMetre));
    const fluyt = SHIP_CLASSES['fluyt']!;
    const caravel = SHIP_CLASSES['caravel']!;
    const f = { ...s, shipClass: 'fluyt' };
    delete f.crew;
    expect(crewExposure(f, fluyt, 'round')).toBeLessThan(0.25);
    const c = { ...s, shipClass: 'caravel' };
    delete c.crew;
    expect(crewExposure(c, caravel, 'grape')).toBeCloseTo(crewExposure(c, caravel, 'round') * (DAMAGE.crew.grapeCoverHeightM / caravel.hullHeight));
    expect(crewExposure(s, sloop, 'grape')).toBeCloseTo(crewExposure(s, sloop, 'round')); // 6 m sides: no cover
  });

  it('step 7a: a full hold slows a trader; warships carry no cargo', () => {
    const fluyt = SHIP_CLASSES['fluyt']!;
    expect(rollCargo(sloop, 0.5)).toBeUndefined();
    expect(rollCargo(fluyt, 0)).toBe(fluyt.cargoMin);
    expect(rollCargo(fluyt, 1)).toBe(fluyt.cargoMax);
    const s = { ...createWorld(1).ships[0]!, shipClass: 'fluyt', cargo: 1 };
    expect(cargoSpeedFactor(s)).toBeCloseTo(1 - (fluyt.ladenSlowdown ?? 0));
    s.cargo = 0;
    expect(cargoSpeedFactor(s)).toBe(1);
    const w = createWorld(1).ships[0]!;
    w.cargo = 1; // a sloop has no ladenSlowdown
    expect(cargoSpeedFactor(w)).toBe(1);
    refitShip(s);
    expect(s.cargo).toBeUndefined();
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
