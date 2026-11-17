import { describe, expect, it } from 'vitest';
import { createArenaWorld } from '../sim/arena';
import { ArenaLog, clock, standings } from './arenaLog';

describe('arena log', () => {
  it('clock writes game time as mm:ss and h:mm:ss', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(75.9)).toBe('01:15');
    expect(clock(3725)).toBe('1:02:05');
  });

  it('writes readable lines for sinkings, targets and respawns, and never grows past its size', () => {
    const w = createArenaWorld(1);
    const log = new ArenaLog(5);
    w.arena!.pilots[0]!.wins = 1;
    w.arena!.totalWins = 1;
    log.record(w, [
      { type: 'targetChosen', shipId: 1, targetId: 2, distance: 812 },
      { type: 'sunk', shipId: 2, byShipId: 1, x: 0, y: 0 },
      { type: 'respawn', shipId: 2, x: 10, y: 20 },
    ]);
    const text = log.text(w, 'today');
    expect(text).toContain('#1 Black Gull (sloop) goes after #2 Sea Wolf (brigantine), 812 m away');
    expect(text).toContain('SUNK: #2 Sea Wolf (brigantine) sunk by #1 Black Gull (sloop)');
    expect(text).toContain('is back at sea');
    for (let i = 0; i < 20; i++) log.add(i, `line ${i}`);
    expect(log.size).toBe(5);
    expect(log.text(w, 'today')).toContain('lines were dropped');
  });

  it('standings put the most wins first', () => {
    const w = createArenaWorld(1);
    w.arena!.pilots[3]!.wins = 7;
    expect(standings(w.arena!, w)[0]).toContain('#4');
  });
});
