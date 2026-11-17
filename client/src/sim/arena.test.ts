import { describe, expect, it } from 'vitest';
import { ARENA, chooseTargets, createArenaWorld, stepArena, targetScore } from './arena';
import { ISLANDS, SHIP_CLASSES } from './data';
import { touchesLand } from './land';
import { Simulation } from './simulation';
import { STEP_SECONDS } from './step';

describe('createArenaWorld', () => {
  it('six bots of mixed classes, each on its own side, named and numbered, in open water and apart', () => {
    const w = createArenaWorld(42);
    expect(w.ships).toHaveLength(ARENA.bots);
    expect(new Set(w.ships.map((s) => s.team)).size).toBe(ARENA.bots);
    expect(new Set(w.ships.map((s) => s.shipClass)).size).toBeGreaterThanOrEqual(4);
    expect(w.bots).toHaveLength(ARENA.bots);
    expect(w.arena!.pilots.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(w.arena!.pilots.map((p) => p.name)).size).toBe(ARENA.bots);
    for (const s of w.ships) {
      expect(touchesLand(s, SHIP_CLASSES[s.shipClass]!, ISLANDS)).toBe(false);
      for (const o of w.ships) if (o !== s) expect(Math.hypot(o.x - s.x, o.y - s.y)).toBeGreaterThan(400);
    }
  });
});

describe('choosing targets', () => {
  it('targetScore: nearer is better; a badly hurt ship is worth going farther for; a crowded one less', () => {
    const w = createArenaWorld(1);
    const [a, b] = w.ships;
    const near = { ...b!, x: a!.x + 300, y: a!.y };
    const far = { ...b!, x: a!.x + 500, y: a!.y };
    expect(targetScore(a!, near, 0)).toBeLessThan(targetScore(a!, far, 0));
    const farHurt = { ...far, hull: SHIP_CLASSES[far.shipClass]!.hullPoints * 0.1 };
    expect(targetScore(a!, farHurt, 0)).toBeLessThan(targetScore(a!, near, 0));
    expect(targetScore(a!, near, 2)).toBeGreaterThan(targetScore(a!, far, 0));
  });

  it('every bot gets a target that is not itself, and says so', () => {
    const w = createArenaWorld(3);
    chooseTargets(w);
    for (const bot of w.bots) {
      expect(bot.enemyId).not.toBe(bot.shipId);
      expect(w.ships.some((s) => s.id === bot.enemyId)).toBe(true);
    }
    expect(w.events.filter((e) => e.type === 'targetChosen')).toHaveLength(ARENA.bots);
  });
});

describe('stepArena', () => {
  it('counts every ball fired, hull hits, wins; a sunk ship comes back after respawnSeconds', () => {
    const w = createArenaWorld(5);
    w.events = [
      { type: 'gunFired', shipId: 1, side: 'port', x: 0, y: 0 },
      { type: 'gunFired', shipId: 1, side: 'port', x: 0, y: 0 },
      { type: 'hit', shipId: 2, byShipId: 1, zone: 'hull', x: 0, y: 0, z: 1 },
      { type: 'hit', shipId: 2, byShipId: 1, zone: 'rigging', x: 0, y: 0, z: 9 },
    ];
    stepArena(w, STEP_SECONDS);
    const p1 = w.arena!.pilots[0]!;
    expect(p1.balls).toBe(2);
    expect(p1.hullHits).toBe(1);
    w.ships[1]!.sunk = true;
    w.ships[1]!.hull = 0;
    w.events = [{ type: 'sunk', shipId: 2, byShipId: 1, x: 0, y: 0 }];
    stepArena(w, STEP_SECONDS);
    expect(p1.wins).toBe(1);
    expect(w.arena!.pilots[1]!.losses).toBe(1);
    expect(w.arena!.totalWins).toBe(1);
    for (let t = 0; t < ARENA.respawnSeconds - 1; t++) {
      w.events = [];
      stepArena(w, 1);
    }
    expect(w.ships[1]!.sunk).toBe(true);
    w.events = [];
    stepArena(w, 1.5);
    expect(w.ships[1]!.sunk).toBe(false);
    expect(w.ships[1]!.hull).toBe(SHIP_CLASSES[w.ships[1]!.shipClass]!.hullPoints);
    expect(w.events.some((e) => e.type === 'respawn' && e.shipId === 2)).toBe(true);
  });

  it('turns to peace at winsToPeace: no targets any more', () => {
    const w = createArenaWorld(6);
    const p = { ...ARENA, winsToPeace: 1 };
    chooseTargets(w, p);
    w.ships[2]!.sunk = true;
    w.events = [{ type: 'sunk', shipId: 3, byShipId: 4, x: 0, y: 0 }];
    stepArena(w, STEP_SECONDS, ISLANDS, p);
    expect(w.arena!.peace).toBe(true);
    expect(w.events.some((e) => e.type === 'peace')).toBe(true);
    expect(w.bots.every((b) => b.enemyId === -1)).toBe(true);
  });
});

describe('arena scenario (headless)', () => {
  it('six bots on their own: within 12 minutes they fight, sink ships and the sunk come back', () => {
    const sim = new Simulation(createArenaWorld(2026));
    let respawns = 0;
    for (let t = 0; t < 12 * 60 * 30; t++) {
      sim.update(STEP_SECONDS);
      respawns += sim.takeEvents().filter((e) => e.type === 'respawn').length;
    }
    const arena = sim.world.arena!;
    expect(arena.pilots.reduce((n, p) => n + p.balls, 0)).toBeGreaterThan(100);
    expect(arena.totalWins).toBeGreaterThanOrEqual(1);
    expect(respawns).toBeGreaterThanOrEqual(1);
  }, 60000);
});
