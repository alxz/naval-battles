// The auto-bot arena log (M3 step 2): plain lines a person can read, kept to a fixed size.
// Pure: no Phaser and no browser here; the scene stores it and offers it as a download.

import { loadableAmmo } from '../sim/ammo';
import { crewOf, crewShare, sailShare } from '../sim/condition';
import { damageSpeedFactor } from '../sim/step';
import { ARENA } from '../sim/arena';
import { compassPoint, headingRadToBearingDeg, twaDeg } from '../sim/angles';
import { BOTS, DAMAGE, GUNS, ISLANDS, SHIP_CLASSES, SHORE, WIND, WORLD } from '../sim/data';
import { distanceToLand, touchesLand } from '../sim/land';
import { nearestPort, PORTS } from '../sim/port';
import type { ArenaState, SimEvent, World } from '../sim/types';

/** Which build wrote the log. Change it with every delivery, so a log says which code it came from. */
export const BUILD_LABEL = 'M3 step 6d (wrecks run for port, harbours, lee shores, test build) after 6c + 6b, 19 Nov 2026';
/** A ship aground longer than this is "stuck": it gets a line of its own. */
export const STUCK_SECONDS = 20;
/** A ship that spawns closer to land than this gets a WARNING line. */
export const SPAWN_LAND_WARN_M = 60;

/** Keep at most this many lines (about 300 KB); the oldest go first. */
export const LOG_MAX_LINES = 4000;
/** A table of the scores every this many game seconds. */
export const STANDINGS_EVERY_SECONDS = 120;

/** "mm:ss" (or "h:mm:ss") of game time. */
export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`;
}

/** "the port of Isla Verde" for a port index. */
export function portName(port: number): string {
  return `the port of ${PORTS[port]?.name ?? '?'}`;
}

/** A short fingerprint of a piece of data (FNV-1a, 32 bits, in hex): equal data, equal fingerprint. */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** "N 045 (NE)" for a wind that comes from this direction. */
function windText(fromRad: number, strength: number): string {
  const b = Math.round(headingRadToBearingDeg(fromRad));
  return `from ${String(b).padStart(3, '0')}\u00b0 ${compassPoint(b)}, strength ${strength.toFixed(2)}`;
}

/** Where a ship is, and how far the nearest land and port are: "(x, y), land 310 m (Gull Rock), port 1200 m". */
export function placeText(x: number, y: number): string {
  const land = distanceToLand(x, y, ISLANDS);
  const port = nearestPort(x, y);
  const landText = land.distance === 0 ? `ON LAND (${land.name})` : `land ${Math.round(land.distance)} m (${land.name})`;
  return `(${Math.round(x)}, ${Math.round(y)}), ${landText}${port ? `, port ${Math.round(port.distance)} m` : ''}`;
}

/**
 * The top of the log: which code and which data made it. When the developer's islands or numbers
 * differ from the ones in the workspace, the fingerprints differ, and that is the first thing to check.
 */
export function headerLines(world: World, seed: number): string[] {
  const lines = [
    `build: ${BUILD_LABEL}`,
    `data fingerprints: islands ${ISLANDS.length} shapes ${fingerprint(ISLANDS)}, ships ${fingerprint(SHIP_CLASSES)}, guns ${fingerprint(GUNS)}, damage ${fingerprint(DAMAGE)}, bots ${fingerprint(BOTS)}, shore ${fingerprint(SHORE)}, arena ${fingerprint(ARENA)}, wind ${fingerprint(WIND)}, world ${fingerprint(WORLD)}`,
    `sea: x ${WORLD.minX}..${WORLD.maxX}, y ${WORLD.minY}..${WORLD.maxY}, reef ${WORLD.reefWidth} m; wind ${windText(world.wind.fromRad, world.wind.strength)}`,
    `ports: ${PORTS.map((p) => `${p.name} at (${Math.round(p.x)}, ${Math.round(p.y)}), ${p.guns?.length ?? 0} guns`).join('; ') || 'none'}`,
    `seed ${seed}`,
  ];
  return lines;
}

/** "#3 Black Gull (brigantine)"; a ball owner below 0 is a shore battery: "the shore guns of ...". */
export function who(world: World, shipId: number): string {
  if (shipId < 0) return `the shore guns of ${PORTS[-shipId - 1]?.name ?? 'a port'}`;
  const pilot = world.arena?.pilots.find((p) => p.shipId === shipId);
  const ship = world.ships.find((s) => s.id === shipId);
  return pilot ? `#${pilot.number} ${pilot.name} (${ship?.shipClass ?? '?'})` : `ship ${shipId}`;
}

/** The score table, best first. */
export function standings(arena: ArenaState, world: World): string[] {
  const rows = [...arena.pilots].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  return rows.map((p) => {
    const hitRate = p.balls > 0 ? (p.hullHits / p.balls).toFixed(2) : '-';
    return `   ${who(world, p.shipId).padEnd(32)} wins ${String(p.wins).padStart(3)}  losses ${String(p.losses).padStart(3)}  balls ${String(p.balls).padStart(4)}  hull hits ${String(p.hullHits).padStart(4)}  hits/ball ${hitRate}`;
  });
}

export class ArenaLog {
  private lines: string[] = [];
  private nextStandings = STANDINGS_EVERY_SECONDS;
  private dropped = 0;
  private readonly max: number;

  // What the log keeps count of, for the summary at the end (not stored between visits).
  private classes = new Map<string, ClassTally>();
  private agroundSince = new Map<number, number>();
  private stuckWarned = new Set<number>();
  private finishDecisions = 0;
  private finishAttacks = 0;
  private finishKills = 0;
  private berthWaits = 0;
  private ramDecisions = 0;
  private ramTries = 0;
  private ramHits = 0;
  private rammers = 0;
  private onLandWarned = new Set<number>();
  private nextWatch = 0;
  private lastWind: { fromRad: number; strength: number } | null = null;
  private collisions = 0;
  private ammoHits: Record<string, number> = { round: 0, chain: 0, grape: 0 };
  private menLost = 0;
  private sailsTorn = 0;
  private collisionDamage = 0;
  private warnings = 0;


  constructor(max = LOG_MAX_LINES) {
    this.max = max;
  }

  private tally(shipClass: string): ClassTally {
    let t = this.classes.get(shipClass);
    if (!t) {
      t = { ships: 0, wins: 0, losses: 0, lifeSeconds: 0, shoreDeaths: 0, agroundCount: 0, agroundSeconds: 0, stuck: 0, unsticks: 0 };
      this.classes.set(shipClass, t);
    }
    return t;
  }

  /** A line that needs a person's eyes: it is counted and shown in the summary. */
  warn(seconds: number, text: string): void {
    this.warnings++;
    this.add(seconds, `WARNING: ${text}`);
  }

  add(seconds: number, text: string): void {
    this.lines.push(`${clock(seconds).padStart(8)}  ${text}`);
    const over = this.lines.length - this.max;
    if (over > 0) {
      this.lines.splice(0, over);
      this.dropped += over;
    }
  }

  get size(): number {
    return this.lines.length;
  }

  /** Read what happened in this frame's events and write the lines worth keeping. */
  record(world: World, events: readonly SimEvent[]): void {
    const now = world.tick * (1 / 30);
    const arena = world.arena;
    if (!arena) return;
    for (const e of events) {
      if (e.type === 'hit') {
        this.ammoHits[e.ammo] = (this.ammoHits[e.ammo] ?? 0) + 1;
        this.menLost += e.crewLost;
        this.sailsTorn += e.sailsLost;
      }
      if (e.type === 'targetChosen') this.add(now, `${who(world, e.shipId)} goes after ${who(world, e.targetId)}, ${Math.round(e.distance)} m away`);
      else if (e.type === 'sunk') {
        const winner = arena.pilots.find((p) => p.shipId === e.byShipId);
        const by = world.ships.find((s) => s.id === e.byShipId);
        const full = by ? hullOf(world, by.id) : 0;
        const left = by && full > 0 ? ` with ${Math.round((100 * by.hull) / full)}% of its hull left` : '';
        const wins = e.byShipId < 0 ? `Nobody's win, ${arena.totalWins} in all` : `Wins: ${winner?.wins ?? 0} for it, ${arena.totalWins} in all`;
        const finished = world.bots.find((b) => b.shipId === e.byShipId)?.mode === 'finish';
        if (finished) this.finishKills++;
        this.add(now, `SUNK: ${who(world, e.shipId)} sunk by ${who(world, e.byShipId)}${left}${finished ? ' (a finishing attack in safe water)' : ''}. ${wins}`);
        this.lines.push(`            ${this.sinkDetails(world, e)}`);
        const loser = world.ships.find((x) => x.id === e.shipId);
        const pilot = arena.pilots.find((x) => x.shipId === e.shipId);
        if (loser) {
          const t = this.tally(loser.shipClass);
          t.losses++;
          t.lifeSeconds += pilot?.sinceSeconds ?? 0;
          if (e.byShipId < 0) t.shoreDeaths++;
        }
        if (by) this.tally(by.shipClass).wins++;
        this.endAground(now, e.shipId, false, world);
      } else if (e.type === 'respawn') {
        const land = distanceToLand(e.x, e.y, ISLANDS);
        this.add(now, `${who(world, e.shipId)} is back at sea at ${placeText(e.x, e.y)}`);
        if (land.distance < SPAWN_LAND_WARN_M) this.warn(now, `${who(world, e.shipId)} appeared only ${Math.round(land.distance)} m from land (${land.name})`);
      }
      else if (e.type === 'offender') {
        const how = e.reason === 'fired' ? 'fired in its safe water' : 'hit a ship in its safe water';
        this.add(now, `PORT LAW: ${who(world, e.shipId)} ${how}: an offender of ${portName(e.port)}, the shore guns open fire`);
      } else if (e.type === 'pardoned') this.add(now, `PORT LAW: ${who(world, e.shipId)} is pardoned by ${portName(e.port)}`);
      else if (e.type === 'peace') this.add(now, `PEACE after ${e.totalWins} wins: nobody attacks any more; hurt ships sail to port`);
      // Bots (M3 step 4c / 5).
      else if (e.type === 'botUnstick') {
        const ship = world.ships.find((x) => x.id === e.shipId);
        if (ship) this.tally(ship.shipClass).unsticks++;
        const mode = world.bots.find((b) => b.shipId === e.shipId)?.mode ?? '?';
        this.add(now, `${who(world, e.shipId)} made no way for ${BOTS.stuckCheckSeconds} s (mode ${mode}${ship?.aground ? ', aground' : ''}): works free heading ${Math.round(headingRadToBearingDeg(e.headingRad))}\u00b0 at ${placeText(e.x, e.y)}`);
      } else if (e.type === 'finishDecision') {
        this.finishDecisions++;
        if (e.go) this.finishAttacks++;
        const why = e.canFinish ? `can sink it (expects ${Math.round(e.expected)} damage, it has ${Math.round(e.enemyHull)} hull)` : `cannot sink it (expects ${Math.round(e.expected)}, it has ${Math.round(e.enemyHull)})`;
        this.add(now, `FINISH? ${who(world, e.shipId)} vs ${who(world, e.enemyId)} in safe water: ${why} -> ${e.go ? (e.canFinish ? 'GOES IN' : 'GOES IN anyway (reckless)') : 'waits outside'}`);
      } else if (e.type === 'ramDecision') {
        this.ramDecisions++;
        if (e.go) this.ramTries++;
        this.add(now, `RAM? ${who(world, e.shipId)} vs ${who(world, e.enemyId)} at ${Math.round(e.distance)} m -> ${e.go ? 'RAMS' : 'keeps firing'}`);
      } else if (e.type === 'rammerLearned') {
        this.rammers++;
        this.add(now, `${who(world, e.shipId)} rammed ${who(world, e.enemyId)} on purpose: it is a RAMMER now (chain, grape, ram)`);
      } else if (e.type === 'berthWait') {
        this.berthWaits++;
        this.add(now, `${who(world, e.shipId)} finds the berths of ${e.port} full (${e.occupied}/${e.berths}): waits off the port`);
      }
      else if (e.type === 'collision' && (e.damageA > 0 || e.damageB > 0)) {
        this.collisions++;
        this.collisionDamage += e.damageA + e.damageB;
        if (world.bots.some((b) => b.mode === 'ram' && (b.shipId === e.shipA || b.shipId === e.shipB))) this.ramHits++;
        this.add(now, `collision: ${who(world, e.shipA)} (-${Math.round(e.damageA)}) and ${who(world, e.shipB)} (-${Math.round(e.damageB)})`);
      }
    }
    this.watch(world, now);
    if (now >= this.nextStandings) {
      this.nextStandings += STANDINGS_EVERY_SECONDS;
      this.add(now, `standings (wins so far: ${arena.totalWins}):`);
      for (const row of standings(arena, world)) this.lines.push(row);
    }
  }

  /** What a sinking looked like: where, how the loser was sailing, how far the killer was. */
  private sinkDetails(world: World, e: Extract<SimEvent, { type: 'sunk' }>): string {
    const loser = world.ships.find((s) => s.id === e.shipId);
    const killer = world.ships.find((s) => s.id === e.byShipId);
    const bot = world.bots.find((b) => b.shipId === e.shipId);
    const parts = [`at ${placeText(e.x, e.y)}`];
    if (loser) {
      const twa = Math.round(twaDeg(loser.headingRad, world.wind.fromRad));
      const lParams = SHIP_CLASSES[loser.shipClass];
      parts.push(`loser: ${bot?.mode ?? '?'}, speed ${(e.speedBefore ?? loser.speed).toFixed(1)} m/s, sails set ${Math.round((e.sailLevelBefore ?? loser.sailLevel) * 100)}%, sails left ${Math.round(sailShare(loser) * 100)}%, crew ${crewOf(loser)}, ammo ${loadableAmmo(loser)}${lParams ? `, speed left ${Math.round(damageSpeedFactor(loser, lParams) * 100)}%` : ''}, wind angle ${twa}\u00b0${loser.aground ? ', AGROUND' : ''}${loser.offender ? ', offender' : ''}`);
    }
    if (killer && loser) {
      const kBot = world.bots.find((b) => b.shipId === killer.id);
      const full = SHIP_CLASSES[killer.shipClass]?.hullPoints ?? 1;
      parts.push(`killer: ${kBot?.mode ?? '?'}, ${Math.round(Math.hypot(killer.x - loser.x, killer.y - loser.y))} m away, hull ${Math.round((100 * killer.hull) / full)}%, ${killer.speed.toFixed(1)} m/s`);
    }
    return parts.join('; ');
  }

  /** Aground and on-land checks, and the wind, once a second of game time. */
  private watch(world: World, now: number): void {
    if (now < this.nextWatch) return;
    this.nextWatch = now + 1;
    for (const ship of world.ships) {
      if (ship.sunk) {
        this.endAground(now, ship.id, false, world);
        continue;
      }
      if (ship.aground && !this.agroundSince.has(ship.id)) {
        this.agroundSince.set(ship.id, now);
        this.tally(ship.shipClass).agroundCount++;
        this.add(now, `${who(world, ship.id)} runs aground at ${placeText(ship.x, ship.y)}`);
      } else if (!ship.aground) this.endAground(now, ship.id, true, world);
      const since = this.agroundSince.get(ship.id);
      if (since !== undefined && now - since > STUCK_SECONDS && !this.stuckWarned.has(ship.id)) {
        this.stuckWarned.add(ship.id);
        this.tally(ship.shipClass).stuck++;
        const mode = world.bots.find((b) => b.shipId === ship.id)?.mode ?? '?';
        this.warn(now, `${who(world, ship.id)} is stuck aground for over ${STUCK_SECONDS} s (mode ${mode}, hull ${Math.round(ship.hull)}) at ${placeText(ship.x, ship.y)}`);
      }
      // A ship whose hull touches land without being "aground": it was put there (a spawn) or the collision test missed it.
      const params = SHIP_CLASSES[ship.shipClass];
      const onLand = !!params && !ship.aground && touchesLand(ship, params, ISLANDS);
      if (onLand && !this.onLandWarned.has(ship.id)) {
        this.onLandWarned.add(ship.id);
        this.warn(now, `${who(world, ship.id)} is ON LAND, not aground, at ${placeText(ship.x, ship.y)}, heading ${Math.round(headingRadToBearingDeg(ship.headingRad))}\u00b0`);
      } else if (!onLand) this.onLandWarned.delete(ship.id);
    }
    // The wind: a line when it has turned 15 degrees or changed by 0.1 since the last line.
    const w = world.wind;
    const last = this.lastWind;
    if (!last || Math.abs(twaDeg(w.fromRad, last.fromRad)) >= 15 || Math.abs(w.strength - last.strength) >= 0.1) {
      this.lastWind = { fromRad: w.fromRad, strength: w.strength };
      this.add(now, `wind now ${windText(w.fromRad, w.strength)}`);
    }
  }

  private endAground(now: number, shipId: number, floated: boolean, world?: World): void {
    const since = this.agroundSince.get(shipId);
    if (since === undefined) return;
    this.agroundSince.delete(shipId);
    this.stuckWarned.delete(shipId);
    const kind = world?.ships.find((s) => s.id === shipId)?.shipClass;
    const seconds = now - since;
    if (kind) this.tally(kind).agroundSeconds += seconds;
    if (floated && world && seconds >= 3) this.add(now, `${who(world, shipId)} floats free after ${Math.round(seconds)} s aground`);
  }

  /** Bot modes worth a line when they change (port, flee). */
  modeChanged(world: World, shipId: number, mode: string): void {
    const now = world.tick * (1 / 30);
    const ship = world.ships.find((s) => s.id === shipId);
    const full = ship ? (SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 1) : 1;
    const params = ship ? SHIP_CLASSES[ship.shipClass] : undefined;
    const cond = ship && params ? `, sails ${Math.round(sailShare(ship) * 100)}%, crew ${Math.round(crewShare(ship) * 100)}%, speed left ${Math.round(damageSpeedFactor(ship, params) * 100)}%` : '';
    const state = ship ? ` [hull ${Math.round((100 * ship.hull) / full)}%${cond}, ${placeText(ship.x, ship.y)}]` : '';
    if (mode === 'flee') this.add(now, `${who(world, shipId)} is badly hit and flees${state}`);
    else if (mode === 'finish') this.add(now, `${who(world, shipId)} goes into safe water to finish its enemy${state}`);
    else if (mode === 'ram') this.add(now, `${who(world, shipId)} turns to ram its enemy${state}`);
    else if (mode === 'port') this.add(now, `${who(world, shipId)} sails to port for repairs${state}`);
    else if (mode === 'outlaw') this.add(now, `${who(world, shipId)} runs from the shore guns${state}`);
  }

  /** Wins, losses, life and trouble per ship class: the table for balancing the classes. */
  classSummary(world: World): string[] {
    const arena = world.arena;
    // Count the ships of each class and add the balls and hits of their pilots.
    const rows = new Map<string, { ships: number; balls: number; hits: number }>();
    for (const ship of world.ships) {
      const r = rows.get(ship.shipClass) ?? { ships: 0, balls: 0, hits: 0 };
      r.ships++;
      const pilot = arena?.pilots.find((p) => p.shipId === ship.id);
      r.balls += pilot?.balls ?? 0;
      r.hits += pilot?.hullHits ?? 0;
      rows.set(ship.shipClass, r);
    }
    const out = ['by class (all lives, since the log began):'];
    for (const [kind, r] of rows) {
      const t = this.tally(kind);
      const life = t.losses > 0 ? `${Math.round(t.lifeSeconds / t.losses)} s` : '-';
      out.push(
        `   ${kind.padEnd(12)} ships ${r.ships}  wins ${String(t.wins).padStart(3)}  losses ${String(t.losses).padStart(3)}  mean life ${life.padStart(6)}  balls ${String(r.balls).padStart(4)}  hits/ball ${r.balls > 0 ? (r.hits / r.balls).toFixed(2) : '-'}  shore deaths ${t.shoreDeaths}  aground ${t.agroundCount}x ${Math.round(t.agroundSeconds)} s  stuck ${t.stuck}  worked free ${t.unsticks}x`,
      );
    }
    out.push(`   hits by ammunition: round ${this.ammoHits.round}, chain ${this.ammoHits.chain}, grape ${this.ammoHits.grape}; men lost ${Math.round(this.menLost)}, sail points torn ${Math.round(this.sailsTorn)}`);
    out.push(`   collisions ${this.collisions} (hull points lost ${Math.round(this.collisionDamage)}), warnings ${this.warnings}`);
    out.push(`   rams: tried ${this.ramTries} of ${this.ramDecisions} chances, ${this.ramHits} collisions while ramming, ${this.rammers} bots became rammers`);
    out.push(`   finishing attacks in safe water: ${this.finishAttacks} of ${this.finishDecisions} chances, ${this.finishKills} sank their enemy; waits for a berth: ${this.berthWaits}`);
    return out;
  }

  /** The whole log as one text file: a header, the lines, and the scores now. */
  text(world: World, startedAt: string): string {
    const arena = world.arena;
    const head = [
      'Naval Battles — auto-bot arena log',
      `started ${startedAt}, game time now ${clock(world.tick / 30)}`,
      this.dropped > 0 ? `(the oldest ${this.dropped} lines were dropped: the log keeps the last ${this.max})` : '',
      '',
    ].filter((l, i) => l !== '' || i === 3);
    const tail = arena ? ['', `standings now (wins so far: ${arena.totalWins}${arena.peace ? ', PEACE' : ''}):`, ...standings(arena, world), '', ...this.classSummary(world)] : [];
    return [...head, ...this.lines, ...tail].join('\n') + '\n';
  }

  /** For storing in the browser between visits. */
  toJson(): string {
    return JSON.stringify({ lines: this.lines, dropped: this.dropped });
  }
}

interface ClassTally {
  ships: number;
  wins: number;
  losses: number;
  lifeSeconds: number;
  shoreDeaths: number;
  agroundCount: number;
  agroundSeconds: number;
  stuck: number;
  unsticks: number; // times a bot made no way and worked free (M3 step 4c)
}

function hullOf(world: World, shipId: number): number {
  const ship = world.ships.find((s) => s.id === shipId);
  return ship ? (SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 0) : 0;
}
