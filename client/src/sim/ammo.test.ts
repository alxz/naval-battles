import { describe, expect, it } from 'vitest';
import { accuracyInputs, gunSigmaDeg } from './accuracy';
import { ammoGuns, ammoLeftOf, ammoOf, loadableAmmo, refillAmmo, spendAmmo } from './ammo';
import { chooseAmmo } from './bot';
import { applyCommand } from './commands';
import { AMMO, BOTS, GUNS, SHIP_CLASSES } from './data';
import { predictLanding } from './guns';
import { STEP_SECONDS } from './step';
import { createWorld } from './world';

const sloop = SHIP_CLASSES['sloop']!;

function reach(ammo: 'round' | 'chain' | 'grape'): number {
  const s = { ...createWorld(1).ships[0]!, elevationDeg: GUNS.maxElevationDeg, ammo };
  const p = predictLanding(s, sloop, 'starboard', STEP_SECONDS);
  return Math.hypot(p.x - s.x, p.y - s.y);
}

describe('ammunition (plan 4.5, M3 step 4)', () => {
  it('chain reaches about 60% and grape about 30% of the round shot range', () => {
    const round = reach('round');
    expect(reach('chain') / round).toBeGreaterThan(0.55);
    expect(reach('chain') / round).toBeLessThan(0.66);
    expect(reach('grape') / round).toBeGreaterThan(0.27);
    expect(reach('grape') / round).toBeLessThan(0.38);
    expect(ammoGuns('round')).toBe(GUNS); // round shot uses the guns as they are
  });

  it('chain and grape scatter more (sigma x 1.5 and x 2)', () => {
    const s = createWorld(1).ships[0]!;
    const base = gunSigmaDeg(accuracyInputs(s, 0.5));
    s.ammo = 'chain';
    expect(gunSigmaDeg(accuracyInputs(s, 0.5))).toBeCloseTo(base * 1.5);
    s.ammo = 'grape';
    expect(gunSigmaDeg(accuracyInputs(s, 0.5))).toBeCloseTo(base * 2);
  });

  it('chain and grape are counted in broadsides; with none left the guns load round shot; a port refills', () => {
    const s = createWorld(1).ships[0]!;
    expect(ammoOf(s)).toBe('round');
    expect(ammoLeftOf(s, 'round')).toBe(Infinity);
    s.ammo = 'chain';
    for (let i = 0; i < AMMO.startBroadsides.chain; i++) {
      expect(loadableAmmo(s)).toBe('chain');
      spendAmmo(s, 'chain');
    }
    expect(ammoLeftOf(s, 'chain')).toBe(0);
    expect(ammoLeftOf(s, 'grape')).toBe(AMMO.startBroadsides.grape);
    expect(loadableAmmo(s)).toBe('round');
    expect(refillAmmo(s)).toBe(true);
    expect(loadableAmmo(s)).toBe('chain');
    expect(refillAmmo(s)).toBe(false);
  });

  it('the setAmmo command loads a kind; an unknown kind is ignored', () => {
    const w = createWorld(1);
    applyCommand(w, { type: 'setAmmo', shipId: 1, ammo: 'grape' });
    expect(w.ships[0]!.ammo).toBe('grape');
    applyCommand(w, { type: 'setAmmo', shipId: 1, ammo: 'nails' as 'grape' });
    expect(w.ships[0]!.ammo).toBe('grape');
  });

  it('bot: grape close in (with a gap), chain at a faster enemy with sails, round otherwise', () => {
    const w = createWorld(1);
    const bot = w.ships[1]!;
    const enemy = w.ships[0]!;
    expect(chooseAmmo(bot, sloop, enemy, 150, BOTS)).toBe('round');
    expect(chooseAmmo(bot, sloop, enemy, 60, BOTS)).toBe('grape');
    bot.ammo = 'grape';
    expect(chooseAmmo(bot, sloop, enemy, 80, BOTS)).toBe('grape'); // inside the gap: keep it
    expect(chooseAmmo(bot, sloop, enemy, 95, BOTS)).toBe('round');
    bot.ammo = 'round';
    enemy.speed = 10;
    bot.speed = 4;
    expect(chooseAmmo(bot, sloop, enemy, 100, BOTS)).toBe('chain');
    expect(chooseAmmo(bot, sloop, enemy, 180, BOTS)).toBe('round'); // beyond the chain shot's reach
    enemy.sails = 0; // nothing left to tear
    expect(chooseAmmo(bot, sloop, enemy, 100, BOTS)).toBe('round');
    bot.ammoLeft = { chain: 0, grape: 0 };
    expect(chooseAmmo(bot, sloop, enemy, 50, BOTS)).toBe('round');
  });
});
