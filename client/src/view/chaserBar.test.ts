import { describe, expect, it } from 'vitest';
import { chaserBars } from './chaserBar';

const panel = { x: 100, y: 300, w: 210, h: 46 };
const none = { guns: 0, left: 0, total: 15 };

describe('chaserBars', () => {
  it('draws no bar for a gun the ship does not have', () => {
    expect(chaserBars(panel, none, none)).toEqual([]);
    expect(chaserBars(panel, { guns: 1, left: 0, total: 15 }, none).map((b) => b.side)).toEqual(['bow']);
  });
  it('is half as long as the panel, centred, bow above stern', () => {
    const [bow, stern] = chaserBars(panel, { guns: 1, left: 0, total: 15 }, { guns: 2, left: 0, total: 15 });
    expect(bow?.track.w).toBe(105);
    expect(bow?.track.x).toBe(152);
    expect(stern?.track.y).toBeGreaterThan(bow?.track.y ?? 0);
  });
  it('fills with the reload and is ready when loaded', () => {
    const [half] = chaserBars(panel, { guns: 1, left: 7.5, total: 15 }, none);
    expect(half?.fill.w).toBe(53);
    expect(half?.ready).toBe(false);
    const [full] = chaserBars(panel, { guns: 1, left: 0, total: 15 }, none);
    expect(full?.fill.w).toBe(105);
    expect(full?.ready).toBe(true);
  });
});
