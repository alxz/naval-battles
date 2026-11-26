import { describe, expect, it } from 'vitest';
import sailsJson from '../data/sails.json';
import { pickSail, sailTint, tintNumber } from './sailColour';

describe('sail colours (D78)', () => {
  const list = [
    { name: 'a', tint: '#000001', weight: 1 },
    { name: 'b', tint: '#000002', weight: 3 },
  ];

  it('pickSail follows the weights', () => {
    expect(pickSail(list, 0).name).toBe('a');
    expect(pickSail(list, 0.24).name).toBe('a');
    expect(pickSail(list, 0.26).name).toBe('b');
    expect(pickSail(list, 0.999999).name).toBe('b');
  });

  it('tintNumber reads #rrggbb', () => {
    expect(tintNumber('#ffffff')).toBe(0xffffff);
    expect(tintNumber('#2e2e34')).toBe(0x2e2e34);
  });

  it('is the same for the same seed and ship, black only for a renegade', () => {
    expect(sailTint(7, 3, false, false)).toBe(sailTint(7, 3, false, false));
    expect(sailTint(7, 3, false, true)).toBe(tintNumber(sailsJson.black));
    for (let id = 0; id < 40; id++) {
      expect(sailTint(9, id, false, false)).not.toBe(tintNumber(sailsJson.black));
      expect(sailTint(9, id, true, false)).not.toBe(tintNumber(sailsJson.black));
    }
  });

  it('warships are never tanned; some traders are', () => {
    const tanned = tintNumber(sailsJson.trader.find((c) => c.name === 'tanned')!.tint);
    const warship = new Set<number>();
    const trader = new Set<number>();
    for (let id = 0; id < 200; id++) {
      warship.add(sailTint(5, id, false, false));
      trader.add(sailTint(5, id, true, false));
    }
    expect(warship.has(tanned)).toBe(false);
    expect(trader.has(tanned)).toBe(true);
    expect(warship.size).toBeGreaterThan(1);
  });
});
