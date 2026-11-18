import { describe, expect, it } from 'vitest';
import { createArenaWorld } from '../sim/arena';
import { ISLANDS } from '../sim/data';
import { pointInPolygon } from '../sim/geometry';
import { ArenaLog, BUILD_LABEL, clock, fingerprint, headerLines, placeText, standings } from './arenaLog';

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

/** A spot inside an island: where a ship must never be. */
function landSpot(): { x: number; y: number } {
  const island = ISLANDS.find((i) => i.kind === 'big' || i.kind === 'medium')!;
  for (const p of island.points) {
    for (let dx = -60; dx <= 60; dx += 20) for (let dy = -60; dy <= 60; dy += 20) if (pointInPolygon({ x: p.x + dx, y: p.y + dy }, island.points)) return { x: p.x + dx, y: p.y + dy };
  }
  throw new Error('no land');
}

describe('arena log v2', () => {
  it('the header says which build and which data wrote the log; fingerprints change with the data', () => {
    const w = createArenaWorld(1);
    const head = headerLines(w, 77).join('\n');
    expect(head).toContain(BUILD_LABEL);
    expect(head).toMatch(/islands \d+ shapes [0-9a-f]{8}/);
    expect(head).toContain('seed 77');
    expect(head).toContain('ports:');
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });

  it('placeText says how far the nearest land and port are, and ON LAND for a spot on land', () => {
    const land = landSpot();
    expect(placeText(land.x, land.y)).toContain('ON LAND');
    expect(placeText(160, 90)).toMatch(/\(160, 90\), land \d+ m \(.+\), port \d+ m/);
  });

  it('warns when a ship is on land without being aground, once, and when a respawn is close to land', () => {
    const w = createArenaWorld(1);
    const log = new ArenaLog();
    const land = landSpot();
    Object.assign(w.ships[0]!, { x: land.x, y: land.y, aground: false });
    log.record(w, []);
    log.record(w, []); // the same second: no second line
    w.tick = 31;
    log.record(w, []);
    const text = log.text(w, 'today');
    expect(text.match(/is ON LAND, not aground/g)).toHaveLength(1);
    log.record(w, [{ type: 'respawn', shipId: 2, x: land.x, y: land.y }]);
    expect(log.text(w, 'today')).toContain('appeared only 0 m from land');
  });

  it('aground: a line when it starts, one when it floats free, STUCK after 20 s; the summary counts them', () => {
    const w = createArenaWorld(1);
    const log = new ArenaLog();
    const ship = w.ships[0]!;
    ship.aground = true;
    for (let sec = 0; sec <= 25; sec++) {
      w.tick = sec * 30;
      log.record(w, []);
    }
    ship.aground = false;
    w.tick = 27 * 30;
    log.record(w, []);
    const text = log.text(w, 'today');
    expect(text).toContain('runs aground at');
    expect(text.match(/is stuck aground for over 20 s/g)).toHaveLength(1);
    expect(text).toContain('floats free after 27 s aground');
    expect(text).toMatch(/by class[\s\S]*aground 1x 27 s\s+stuck 1/);
  });

  it('a sinking gets a detail line; the class summary counts wins, losses and shore deaths', () => {
    const w = createArenaWorld(1);
    const log = new ArenaLog();
    w.arena!.pilots[1]!.sinceSeconds = 90;
    w.ships[1]!.sunk = true;
    log.record(w, [{ type: 'sunk', shipId: 2, byShipId: 1, x: 100, y: 100 }]);
    log.record(w, [{ type: 'sunk', shipId: 3, byShipId: -1, x: 100, y: 100 }]);
    const text = log.text(w, 'today');
    expect(text).toMatch(/loser: .*speed .* m\/s, sails set \d+%, sails left \d+%, crew \d+, ammo \w+, speed left \d+%, wind angle \d+/);
    expect(text).toMatch(/hits by ammunition: round \d+, chain \d+, grape \d+; men lost \d+/);
    expect(text).toMatch(/killer: .*m away, hull \d+%/);
    expect(text).toContain('mean life');
    expect(text).toMatch(/shore deaths 1/);
  });

  it('a wind line at the start and when the wind turns', () => {
    const w = createArenaWorld(1);
    const log = new ArenaLog();
    log.record(w, []);
    w.tick = 60;
    w.wind.fromRad += 0.5; // about 29 degrees
    log.record(w, []);
    expect(log.text(w, 'today').match(/wind now from/g)).toHaveLength(2);
  });

  it('M3 step 4c / 5: lines for working free, finishing attacks and full berths, and their counts in the summary', () => {
    const w = createArenaWorld(1);
    const log = new ArenaLog();
    const [a, b] = w.ships;
    log.record(w, [
      { type: 'botUnstick', shipId: a!.id, x: 0, y: 0, headingRad: 0 },
      { type: 'finishDecision', shipId: a!.id, enemyId: b!.id, go: true, canFinish: true, expected: 60, enemyHull: 40 },
      { type: 'finishDecision', shipId: b!.id, enemyId: a!.id, go: false, canFinish: false, expected: 20, enemyHull: 300 },
      { type: 'berthWait', shipId: b!.id, port: 'Empty Barrel Land', occupied: 3, berths: 3 },
    ]);
    const text = log.text(w, 'now');
    expect(text).toMatch(/works free heading 90/);
    expect(text).toMatch(/FINISH\? .* can sink it .* GOES IN/);
    expect(text).toMatch(/cannot sink it .* waits outside/);
    expect(text).toMatch(/berths of Empty Barrel Land full \(3\/3\)/);
    expect(text).toMatch(/finishing attacks in safe water: 1 of 2 chances, 0 sank their enemy; waits for a berth: 1/);
    expect(text).toMatch(/worked free 1x/);
  });
});

