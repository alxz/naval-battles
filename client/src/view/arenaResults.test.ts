import { describe, expect, it } from 'vitest';
import type { Pilot } from '../sim/types';
import { arenaResults, roman } from './arenaResults';

const pilot = (number: number, wins: number, losses: number, balls = 0, hullHits = 0): Pilot => ({
  shipId: number * 10,
  number,
  name: `P${number}`,
  wins,
  losses,
  balls,
  hullHits,
  sinceSeconds: 0,
});

describe('arenaResults (M3 step 4c)', () => {
  it('Roman places', () => {
    expect([1, 2, 3, 4].map(roman)).toEqual(['I', 'II', 'III', 'IV']);
    expect(roman(12)).toBe('12');
  });

  it('most wins first, then fewer losses, then better shooting, then the lower number', () => {
    const rows = arenaResults(
      [pilot(1, 5, 9), pilot(2, 9, 3), pilot(3, 5, 4, 100, 30), pilot(4, 5, 4, 100, 40), pilot(5, 0, 0)],
      (id) => (id === 20 ? 'frigate' : 'sloop'),
    );
    expect(rows.map((r) => r.number)).toEqual([2, 4, 3, 1, 5]);
    expect(rows[0]).toMatchObject({ place: 1, roman: 'I', shipClass: 'frigate', wins: 9 });
    expect(rows[1]?.hitsPerBall).toBeCloseTo(0.4);
    expect(rows[4]?.hitsPerBall).toBe(0);
  });
});
