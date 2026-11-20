import { describe, expect, it } from 'vitest';
import { arenaLines, battleLines, battleVerdict, endWords } from './pauseStats';
import type { BattleShipRow } from './pauseStats';
import type { ResultRow } from './arenaResults';

const row = (o: Partial<BattleShipRow>): BattleShipRow => ({ name: 'X', shipClass: 'sloop', hullShare: 1, sailShare: 1, crewShare: 1, sunk: false, gone: false, ...o });

describe('battleVerdict (M3 step 7c)', () => {
  it('your ship sunk: the enemy wins', () => {
    expect(battleVerdict(row({ sunk: true }), [row({ sunk: true })]).winner).toBe('enemy');
  });
  it('every enemy sunk or gone: you win', () => {
    expect(battleVerdict(row({ hullShare: 0.1 }), [row({ sunk: true }), row({ gone: true })]).winner).toBe('you');
  });
  it('otherwise the damage done against the damage taken, with a margin for a draw', () => {
    expect(battleVerdict(row({ hullShare: 0.9 }), [row({ hullShare: 0.5 })]).winner).toBe('you');
    expect(battleVerdict(row({ hullShare: 0.4 }), [row({ hullShare: 0.8 })]).winner).toBe('enemy');
    const draw = battleVerdict(row({ hullShare: 0.7 }), [row({ hullShare: 0.75 })]);
    expect(draw.winner).toBe('draw');
    expect(draw.dealt).toBeCloseTo(0.25, 6);
    expect(draw.taken).toBeCloseTo(0.3, 6);
  });
});

describe('pause window lines', () => {
  it('battle: one line per ship', () => {
    const lines = battleLines('3:05', row({ name: 'YOU', hullShare: 0.5 }), [row({ name: 'FLUYT 2', shipClass: 'fluyt', sunk: true })], 'hits: you 4  enemy 2');
    expect(lines[0]).toContain('3:05');
    expect(lines[3]).toContain(' 50%');
    expect(lines[4]).toContain('SUNK');
  });
  it('arena: the table with the sunk marked', () => {
    const r: ResultRow = { place: 1, roman: 'I', shipId: 7, number: 3, name: 'Kidd', shipClass: 'frigate', wins: 2, escapes: 1, score: 2.5, losses: 0, hitsPerBall: 0.2 };
    const lines = arenaLines('10:00', [r], new Set([7]));
    expect(lines[3]).toContain('#3 Kidd');
    expect(lines[3]).toContain('2.5');
    expect(lines[3].endsWith(' +')).toBe(true);
  });
  it('end words name the winner', () => {
    expect(endWords('you', 1, 0.2).title).toBe('VICTORY!');
    expect(endWords('draw', 0.2, 0.2).line).toContain('No winner');
  });
});
