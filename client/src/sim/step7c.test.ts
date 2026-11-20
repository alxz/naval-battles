// M3 step 7c: bow chasers for every ship, and bot skills (seamanship, gunnery, courage, loner / pack).
import { describe, expect, it } from 'vitest';
import { createArenaWorld } from './arena';
import { fleeHeading, thinkBot } from './bot';
import { applyCommand } from './commands';
import { SHIP_CLASSES, SKILLS } from './data';
import { batteryAmmo, gunPosition, gunsOn, predictLanding, reloadSecondsOf, sideAngleRad, stepGunsAndBalls } from './guns';
import { crowdWeight, gunneryReload, rollSkills, seamanshipTurn, skillsText } from './skills';
import { STEP_SECONDS, stepShip, targetSpeed } from './step';
import { withPerfectGuns } from './testing';
import { newBot } from './bot';
import type { ShipState, World } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const frigate = SHIP_CLASSES['frigate']!;

function emptyWorld(ships: ShipState[]): World {
  return { tick: 0, rngState: 7, wind: { fromRad: 0, strength: 0.8, baseFromRad: 0 }, ships, balls: [], pendingShots: [], nextBallId: 1, events: [], bots: [] };
}

function shipOf(id: number, shipClass: string, x: number, y: number, headingRad = 0): ShipState {
  return {
    id, shipClass, x, y, headingRad, speed: 0, rudder: 0, sailLevel: 0, aground: false, elevationDeg: 5,
    reloadPort: 0, reloadStarboard: 0, hull: SHIP_CLASSES[shipClass]!.hullPoints, sunk: false, battleSkill: 4, team: id, repairing: false,
  };
}

describe('bow chasers (M3 step 7c)', () => {
  withPerfectGuns();
  it('every class has a bow chaser (the frigate two); it sits at the bow and fires ahead', () => {
    for (const params of Object.values(SHIP_CLASSES)) expect(gunsOn(params, 'bow')).toBeGreaterThanOrEqual(1);
    expect(gunsOn(frigate, 'bow')).toBe(2);
    const s = shipOf(1, 'sloop', 0, 0, 0);
    expect(gunPosition(s, sloop, 'bow', 0).x).toBeCloseTo(sloop.length / 2);
    expect(sideAngleRad(1, 'bow')).toBeCloseTo(1);
    expect(predictLanding(s, sloop, 'bow', STEP_SECONDS).x).toBeGreaterThan(100);
  });

  it('fires round shot only (chain stays in the locker), reloads on its own, is not trained', () => {
    const w = emptyWorld([shipOf(1, 'sloop', 0, 0, 0)]);
    const me = w.ships[0]!;
    applyCommand(w, { type: 'setAmmo', shipId: 1, ammo: 'chain' });
    expect(batteryAmmo(me, 'bow')).toBe('round');
    applyCommand(w, { type: 'fire', shipId: 1, side: 'bow', trainDeg: 50 });
    const shot = w.pendingShots.find((p) => p.side === 'bow');
    expect(shot?.ammo).toBe('round');
    expect(shot?.trainDeg).toBeUndefined(); // M3 step 7f: no training
    expect(me.ammoLeft).toBeUndefined(); // no chain spent
    expect(me.reloadBow).toBeGreaterThan(0);
    expect(me.reloadPort).toBe(0); // the broadsides are still loaded
    // The ball flies dead ahead (perfect guns in this test; the 50 degrees asked for are ignored).
    for (let i = 0; i < 3; i++) {
      w.tick++;
      stepGunsAndBalls(w, STEP_SECONDS, undefined, []);
    }
    const ball = w.balls[0]!;
    expect((Math.atan2(ball.vy, ball.vx) * 180) / Math.PI).toBeCloseTo(0, 0);
    // The reload runs down and the gun is ready again.
    for (let i = 0; i < 30 * 40; i++) stepGunsAndBalls(w, STEP_SECONDS, undefined, []);
    expect(me.reloadBow).toBeUndefined();
  });

  it('a hunter fires its bow chaser at an enemy dead ahead', () => {
    const hunter = shipOf(1, 'brigantine', 0, 0, 0);
    hunter.speed = 6;
    hunter.sailLevel = 1;
    const prey = shipOf(2, 'fluyt', 200, 0, 0);
    prey.speed = 4;
    prey.sailLevel = 1;
    const w = emptyWorld([hunter, prey]);
    const bot = newBot(1, 2, w);
    bot.mode = 'chase';
    bot.aimErrorDeg = 0;
    w.bots.push(bot);
    let fired = false;
    for (let i = 0; i < 30 * 20 && !fired; i++) {
      w.tick++;
      const commands = thinkBot(w, bot, []);
      fired = commands.some((c) => c.type === 'fire' && c.side === 'bow');
      for (const c of commands) applyCommand(w, c);
    }
    expect(fired).toBe(true);
  });
});

describe('bot skills (M3 step 7c)', () => {
  it('rollSkills draws seamanship, gunnery, courage and loner within the ranges, the same for the same seed', () => {
    const a = emptyWorld([shipOf(1, 'sloop', 0, 0)]);
    const b = emptyWorld([shipOf(1, 'sloop', 0, 0)]);
    const botA = newBot(1, -1, a);
    const botB = newBot(1, -1, b);
    rollSkills(a.ships[0]!, botA, a);
    rollSkills(b.ships[0]!, botB, b);
    expect(a.ships[0]!.seamanship).toBe(b.ships[0]!.seamanship);
    expect(a.ships[0]!.battleSkill).toBe(b.ships[0]!.battleSkill);
    let lo = Infinity;
    let hi = -Infinity;
    let loners = 0;
    for (let i = 0; i < 400; i++) {
      const s = shipOf(1, 'sloop', 0, 0);
      const bot = newBot(1, -1, a);
      rollSkills(s, bot, a);
      lo = Math.min(lo, s.seamanship!);
      hi = Math.max(hi, s.seamanship!);
      expect(s.battleSkill).toBeGreaterThanOrEqual(SKILLS.gunneryMin);
      expect(s.battleSkill).toBeLessThanOrEqual(SKILLS.gunneryMax);
      expect(bot.personality.courage).toBeDefined();
      if (bot.personality.loner) loners++;
    }
    expect(lo).toBeGreaterThanOrEqual(SKILLS.seamanshipMin);
    expect(hi).toBeLessThanOrEqual(SKILLS.seamanshipMax);
    expect(hi - lo).toBeGreaterThan(0.2);
    expect(loners / 400).toBeCloseTo(SKILLS.lonerShare, 1);
  });

  it('seamanship multiplies the top speed and speeds up the turning', () => {
    const wind = { fromRad: Math.PI / 2, strength: 0.8, baseFromRad: Math.PI / 2 };
    const s = shipOf(1, 'sloop', 0, 0, 0);
    s.sailLevel = 1;
    const plain = targetSpeed(s, sloop, wind);
    expect(targetSpeed({ ...s, seamanship: 1.2 }, sloop, wind)).toBeCloseTo(plain * 1.2, 6);
    expect(targetSpeed({ ...s, seamanship: 0.85 }, sloop, wind)).toBeCloseTo(plain * 0.85, 6);
    expect(seamanshipTurn({ ...s, seamanship: 1.2 })).toBeCloseTo(1 + SKILLS.turnPerSeamanship * 0.2, 6);
    const good = { ...s, seamanship: 1.2, speed: 10, rudder: 1 };
    const poor = { ...s, seamanship: 0.85, speed: 10, rudder: 1 };
    stepShip(good, sloop, wind, 1);
    stepShip(poor, sloop, wind, 1);
    expect(good.headingRad).toBeGreaterThan(poor.headingRad);
  });

  it('gunnery: skill 4 reloads as before, a good gun crew faster, a poor one slower', () => {
    const s = shipOf(1, 'sloop', 0, 0);
    expect(gunneryReload(s)).toBeCloseTo(1, 9);
    expect(gunneryReload({ ...s, battleSkill: 8 })).toBeCloseTo(0.9, 9);
    expect(gunneryReload({ ...s, battleSkill: 1 })).toBeCloseTo(1.075, 9);
    expect(reloadSecondsOf({ ...s, battleSkill: 8 })).toBeCloseTo(sloop.reloadSeconds * 0.9, 6);
  });

  it('loners avoid crowded enemies, pack bots join them; no flag: as before', () => {
    const w = emptyWorld([shipOf(1, 'sloop', 0, 0)]);
    const bot = newBot(1, -1, w);
    expect(crowdWeight(bot)).toBe(1);
    bot.personality.loner = true;
    expect(crowdWeight(bot)).toBe(SKILLS.lonerCrowd);
    bot.personality.loner = false;
    expect(crowdWeight(bot)).toBe(SKILLS.packCrowd);
  });

  it('the arena gives every bot its skills, and the log text shows them', () => {
    const w = createArenaWorld(123);
    for (const s of w.ships) expect(s.seamanship).toBeDefined();
    const text = skillsText(w.ships[0], w.bots[0]);
    expect(text).toMatch(/^sea \d\.\d\d gun \d heart \d\.\d\d (loner|pack)$/);
  });

  it('a battle bot gets skills only when asked (setBot skilled), with a skills event', () => {
    const w = emptyWorld([shipOf(1, 'sloop', 0, 0), shipOf(2, 'sloop', 400, 0)]);
    applyCommand(w, { type: 'setBot', shipId: 2, enemyId: 1 });
    expect(w.ships[1]!.seamanship).toBeUndefined();
    applyCommand(w, { type: 'setBot', shipId: 2, enemyId: 1, skilled: true });
    expect(w.ships[1]!.seamanship).toBeDefined();
    expect(w.events.some((e) => e.type === 'skills' && e.shipId === 2)).toBe(true);
  });
});

describe('a runner picks the course where it is faster than its pursuer (M3 step 7c)', () => {
  it('against a pursuer that is fast straight downwind, it turns further off the wind', () => {
    // The wind comes from the west (fromRad PI: it blows toward the east). The enemy is west of us,
    // so "straight away" is dead downwind: the frigate's square rig is at its best there.
    const wind = { fromRad: Math.PI, strength: 0.8, baseFromRad: Math.PI };
    const runner = shipOf(1, 'sloop', 0, 0, 0);
    runner.sailLevel = 1;
    runner.speed = 6;
    const enemy = shipOf(2, 'frigate', -400, 0, 0);
    const bearing = Math.PI; // the enemy is to the west
    const alone = fleeHeading(runner, sloop, wind, bearing, []);
    const chased = fleeHeading(runner, sloop, wind, bearing, [], { ship: enemy, params: frigate });
    const off = (h: number): number => Math.abs(Math.atan2(Math.sin(h), Math.cos(h)));
    expect(off(chased)).toBeGreaterThanOrEqual(off(alone));
    // Wherever it goes, it is not slower than the frigate on that course.
    const mine = targetSpeed({ ...runner, headingRad: chased }, sloop, wind);
    const theirs = targetSpeed({ ...enemy, headingRad: chased, sailLevel: 1 }, frigate, wind);
    expect(mine).toBeGreaterThanOrEqual(theirs * 0.95);
  });
});
