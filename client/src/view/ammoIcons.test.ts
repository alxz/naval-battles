import { describe, expect, it } from 'vitest';
import { createWorld } from '../sim/world';
import { AMMO_ICON_ROWS, ammoIconPixels, ammoIconSize, ammoSlots } from './ammoIcons';

describe('ammoIcons (M3 step 4c)', () => {
  it('every icon is small and uses only known colour letters', () => {
    for (const type of ['round', 'chain', 'grape'] as const) {
      const size = ammoIconSize(type);
      expect(size.w).toBeLessThanOrEqual(7);
      expect(size.h).toBeLessThanOrEqual(5);
      for (const row of AMMO_ICON_ROWS[type]) expect(row).toMatch(/^[.kgbdr]+$/);
      expect(ammoIconPixels(type).length).toBeGreaterThan(5);
    }
  });

  it('slots: keys 1 2 3, counts for chain and grape, the loaded one marked; an empty kind falls back to round', () => {
    const ship = createWorld(1).ships[0]!;
    let slots = ammoSlots(ship);
    expect(slots.map((s) => s.key)).toEqual(['1', '2', '3']);
    expect(slots.map((s) => s.count)).toEqual(['', '6', '6']);
    expect(slots.find((s) => s.loaded)?.type).toBe('round');
    ship.ammo = 'grape';
    ship.ammoLeft = { chain: 6, grape: 0 };
    slots = ammoSlots(ship);
    expect(slots.find((s) => s.type === 'grape')).toMatchObject({ count: '0', empty: true, loaded: false });
    expect(slots.find((s) => s.loaded)?.type).toBe('round');
  });
});
