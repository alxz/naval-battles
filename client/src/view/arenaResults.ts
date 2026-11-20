// The arena's results (M3 step 4c): who did best, for the end screen. Pure: no Phaser.

import { pilotScore } from '../sim/arena';
import type { Pilot } from '../sim/types';

export interface ResultRow {
  place: number; // 1, 2, 3, ...
  roman: string; // I, II, III, ...
  shipId: number;
  number: number;
  name: string;
  shipClass: string;
  wins: number;
  escapes: number; // M3 step 7a: got away alive, hurt (half a win each)
  score: number; // wins + 0.5 x escapes
  losses: number;
  hitsPerBall: number; // its share of balls that hit an enemy hull (0 if it never fired)
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** A whole number as a Roman numeral (1..10; beyond that the plain number). */
export function roman(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

/**
 * The table, best first: the best score (wins + half the escapes, M3 step 7a); then fewer losses; then better shooting; then the lower number
 * (so the order never depends on the order of the list). Equal scores share no place: it is a ranking.
 */
export function arenaResults(pilots: readonly Pilot[], classOf: (shipId: number) => string): ResultRow[] {
  const rate = (p: Pilot): number => (p.balls > 0 ? p.hullHits / p.balls : 0);
  return [...pilots]
    .sort((a, b) => pilotScore(b) - pilotScore(a) || a.losses - b.losses || rate(b) - rate(a) || a.number - b.number)
    .map((p, i) => ({
      place: i + 1,
      roman: roman(i + 1),
      shipId: p.shipId,
      number: p.number,
      name: p.name,
      shipClass: classOf(p.shipId),
      wins: p.wins,
      escapes: p.escapes ?? 0,
      score: pilotScore(p),
      losses: p.losses,
      hitsPerBall: rate(p),
    }));
}
