// M3 step 7c: the pause window (ESC) and the end of a battle the player stops himself.
// Pure: no Phaser, so the words and the verdict are tested in pauseStats.test.ts.

import type { ResultRow } from './arenaResults';

/** One ship in a battle, as the pause window shows it. */
export interface BattleShipRow {
  name: string; // YOU, or the enemy's name (class and number)
  shipClass: string;
  hullShare: number; // 0..1
  sailShare: number;
  crewShare: number;
  sunk: boolean;
  gone: boolean; // a trader that got clean away
}

export type Winner = 'you' | 'enemy' | 'draw';

/** How far ahead one side must be (in ship hulls of damage) to win a battle stopped early. */
export const VERDICT_MARGIN = 0.1;

/**
 * Who won a battle that the player ended (END GAME):
 *   your ship sunk -> the enemy; every enemy sunk or gone -> you;
 *   otherwise the damage done: a sunk enemy counts 1, a hurt one its lost hull share;
 *   against your own lost hull share. Closer than VERDICT_MARGIN: a draw.
 */
export function battleVerdict(me: BattleShipRow, foes: readonly BattleShipRow[]): { winner: Winner; dealt: number; taken: number } {
  const dealt = foes.reduce((sum, f) => sum + (f.sunk ? 1 : 1 - f.hullShare), 0);
  const taken = me.sunk ? 1 : 1 - me.hullShare;
  if (me.sunk) return { winner: 'enemy', dealt, taken };
  if (foes.length > 0 && foes.every((f) => f.sunk || f.gone)) return { winner: 'you', dealt, taken };
  if (dealt > taken + VERDICT_MARGIN) return { winner: 'you', dealt, taken };
  if (taken > dealt + VERDICT_MARGIN) return { winner: 'enemy', dealt, taken };
  return { winner: 'draw', dealt, taken };
}

const pct = (share: number): string => `${Math.round(Math.max(0, share) * 100)}%`.padStart(5);

/** One line per ship: name, class, hull / sails / crew (or SUNK / GOT AWAY). */
export function battleLines(time: string, me: BattleShipRow, foes: readonly BattleShipRow[], hitsLine: string): string[] {
  const row = (r: BattleShipRow): string => {
    const head = `${r.name.slice(0, 11).padEnd(11)} ${r.shipClass.padEnd(10)}`;
    if (r.sunk) return `${head} SUNK`;
    if (r.gone) return `${head} GOT AWAY`;
    return `${head}${pct(r.hullShare)}${pct(r.sailShare)}${pct(r.crewShare)}`;
  };
  // A monospaced font (Press Start 2P, 8 px a letter): short lines, so it fits a phone.
  return [`time ${time}  ${hitsLine}`, '', `${'ship'.padEnd(11)} ${'class'.padEnd(10)} hull  sail  crew`, row(me), ...foes.map(row)];
}

/** The arena table: place, name, class, wins / escapes / losses, score. */
export function arenaLines(time: string, rows: readonly ResultRow[], sunkIds: ReadonlySet<number>): string[] {
  const out = [`time ${time}`, '', `${''.padEnd(4)} ${'bot'.padEnd(13)} ${'class'.padEnd(10)} W  E  L score`];
  for (const r of rows) {
    const name = `#${r.number} ${r.name}`.slice(0, 13).padEnd(13);
    const score = r.score.toFixed(1).padStart(5);
    const mark = sunkIds.has(r.shipId) ? ' +' : '';
    out.push(`${r.roman.padEnd(4)} ${name} ${r.shipClass.padEnd(10)}${String(r.wins).padStart(2)} ${String(r.escapes).padStart(2)} ${String(r.losses).padStart(2)}${score}${mark}`);
  }
  out.push('', '+ = sunk now (waiting to sail again)');
  return out;
}

/** The title and the line of the end banner of a battle stopped with END GAME. */
export function endWords(winner: Winner, dealt: number, taken: number): { title: string; line: string } {
  const title = winner === 'you' ? 'VICTORY!' : winner === 'enemy' ? 'DEFEAT' : 'A DRAW';
  const who = winner === 'you' ? 'Winner: YOU' : winner === 'enemy' ? 'Winner: the enemy' : 'No winner';
  return { title, line: `${who}  (damage done ${dealt.toFixed(2)}, taken ${taken.toFixed(2)})` };
}
