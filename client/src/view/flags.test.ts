import { describe, expect, it } from 'vitest';
import { FLAG_COLOURS, FLAGS, NATIONS, nationFor } from './flags';

describe('arena flags (D47)', () => {
  it('every flag is 9 x 6 pixels of known colours', () => {
    for (const nation of NATIONS) {
      const rows = FLAGS[nation];
      expect(rows).toHaveLength(6);
      for (const row of rows) {
        expect(row).toHaveLength(9);
        for (const ch of row) expect(ch === '.' || FLAG_COLOURS[ch] !== undefined).toBe(true);
      }
    }
  });
  it('the same arena and ship: the same nation; different arenas mix them', () => {
    expect(nationFor(1234, 3)).toBe(nationFor(1234, 3));
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) for (let id = 1; id <= 6; id++) seen.add(nationFor(seed, id));
    expect(seen.size).toBe(NATIONS.length);
  });
});
