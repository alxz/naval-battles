// The auto-bot arena log (M3 step 2): plain lines a person can read, kept to a fixed size.
// Pure: no Phaser and no browser here; the scene stores it and offers it as a download.

import { skillsText } from '../sim/skills';
import { loadableAmmo } from '../sim/ammo';
import { crewOf, crewShare, sailShare } from '../sim/condition';
import { damageSpeedFactor } from '../sim/step';
import { ARENA, pilotScore } from '../sim/arena';
import { compassPoint, headingRadToBearingDeg, twaDeg } from '../sim/angles';
import { BOTS, DAMAGE, GUNS, ISLANDS, SHIP_CLASSES, SHORE, WIND, WORLD } from '../sim/data';
import { distanceToLand, touchesLand } from '../sim/land';
import { nearestPort, PORTS } from '../sim/port';
import type { ArenaState, ShipState, SimEvent, World } from '../sim/types';
import { battleName } from './wanted';

/** Your ship in a battle against bots (the log names it YOU). */
export const BATTLE_PLAYER_ID = 1;

/** Which build wrote the log. Change it with every delivery, so a log says which code it came from. */
export const BUILD_LABEL = 'M4b 5b-3 (sail colours, D78: a separate cloth layer tinted canvas / cream / grey-brown, tanned on some traders, black only for renegades); M4b 5b-2b3 (test switch Tuning > Solo: pirates hide (false flag); the battle log names a false flag at the start); M4b 5b-2b2 (review fixes: only deliberate rams count, a respawn gets its birth flag back, the screen shows the flag your ship believes, integer hash for false flags); M4b 5b-2b (renegades and false flags, D82: an offender or the bot with the most rams hoists the black flag for good; a bot with no sinking for 10 min may turn pirate under its old flag; a false flag shows beyond 300 m; RENEGADE / PIRATE (hidden) log lines); M4b 5b-2a2 (time x2/x4 slows to x1 only for a ship within 600 m; the game stops while the win / lose banner is up); M4b 5b-2a (Solo test aids: time x1/x2/x4 held at x1 while a ship is in view, T or the new button; the autopilot sets the sails; TEST switch bots hunt me); M4b 5b-1 (default routes: 3 stops by lot, sailed round; traders port to port, warships and pirates island to island, D79; ROUTE log line); M3b 2b (chart buttons big at the sides on touch screens; the goal is in the battle log); M3b 2 (a goal in Solo: sink the named pirate or 3 ships, D77); M3b 1b (DONE closes the chart; a route point is picked up with a tap and put down with the next; phone buttons as in your mock-up; arena results list in two columns); D73 autopilot (your route on the chart, N; rudder only; tacks against a headwind), the bosun below half the hull, at least one pirate in a battle; M4b step 5d2 (bots start 1100-2000 m away in a battle too, PORT BLOCKED log line, loser: player); M4b step 5d (a bot gives up a port after 3 groundings or working free near it and tries another, D74; foes list in a battle, mode and target over bots in the arena, bots start 1100-2000 m away, smaller ship panel on a computer, D75); M4b step 5c (a ram hurts again only after 2 s apart; shore guns fire only at what the port sees: fog, range, heard shots (D72); bots steer with a dead band and a slow helm; every bot mode change is logged); M4b step 5a (fog banks for the rules, a shot reveals the shooter within 1200 m, rough hull at 200-450 m, no smoke of unseen ships, wrecks hidden by land); M4b step 4 (arena switch: everything / what the watched bot sees, key B; log lines SIGHTED / LOST SIGHT for every pair); M4b review 22 Nov (search ends at the last known place, flag and deck ranges fixed); M4b step 3 (the screen shows only what your ship knows: ships out of sight are not drawn, a dot at the edge, arrows and the target card by sight); M4b step 2 (bots decide only from their contacts: no shot at what they cannot see, a search at the last known place, a cruise when nothing is known); M4b step 1 (perception lists); M3 step 8b + 8 (camera in the middle, smoke and gun-port fire, Space fires the bow chaser, out of the inlet along its line, trade stops off the mouth; 7f: chasers not trained, stern bar at the bottom, one-line arena table, arena size 4-10; 7e: 10 bots, chaser bars, wheel look-out, phone layout; wrecks fade, solo speed; bow chasers, ESC pause, minimap view, bot skills: seamanship, gunnery, courage, loner/pack; runners pick their course) after 7b + 7d, 21 Nov 2026';
/** A ship aground longer than this is "stuck": it gets a line of its own. */
export const STUCK_SECONDS = 20;
/** A ship that spawns closer to land than this gets a WARNING line. */
export const SPAWN_LAND_WARN_M = 60;

/** Keep at most this many lines (about 1 MB; M4b step 4: the sight lines add about 1,000 an hour); the oldest go first. */
export const LOG_MAX_LINES = 12000;
/** A table of the scores every this many game seconds. */
export const STANDINGS_EVERY_SECONDS = 120;

/** M4b step 4: the sight levels as words (1 something there, 2 silhouette, 3 flag, 4 hull / sails / crew). */
export const SIGHT_LEVEL_WORDS = ['', 'a sail', 'silhouette', 'flag', 'deck'] as const;

/** "SIGHTED: #1 A (sloop) sees #4 B (frigate): silhouette, 870 m" (`again`: it was in view before). */
export function sightedLine(world: World, watcherId: number, otherId: number, level: number, distance: number, again: boolean, heard = false): string {
  // M4b step 5a: `heard` = it gave itself away by firing (behind land or in fog).
  return `SIGHTED${again ? ' again' : ''}: ${who(world, watcherId)} ${heard ? 'hears the guns of' : 'sees'} ${who(world, otherId)}: ${heard ? 'gunfire' : SIGHT_LEVEL_WORDS[level] ?? '?'}, ${Math.round(distance)} m`;
}

/** "LOST SIGHT: #1 A (sloop) loses #4 B (frigate) behind land, 520 m, last seen at (x, y)". */
export function lostSightLine(world: World, watcherId: number, otherId: number, x: number, y: number, distance?: number, why?: 'land' | 'range'): string {
  const how = why === 'land' ? ' behind land' : why === 'range' ? ' out of sight range' : '';
  return `LOST SIGHT: ${who(world, watcherId)} loses ${who(world, otherId)}${how}${distance !== undefined ? `, ${distance} m` : ''}, last seen at (${x}, ${y})`;
}

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
  if (pilot) return `#${pilot.number} ${pilot.name} (${ship?.shipClass ?? '?'})`;
  // M3 step 7d: a battle against bots has no names: YOU, or the class and number.
  if (!world.arena && ship) return ship.id === BATTLE_PLAYER_ID ? `YOU (${ship.shipClass})` : `${battleName(ship, BATTLE_PLAYER_ID)}${ship.nation ? ` [${ship.nation}]` : ''}`;
  return `ship ${shipId}`;
}

/** The score table, best first. */
export function standings(arena: ArenaState, world: World): string[] {
  const rows = [...arena.pilots].sort((a, b) => pilotScore(b) - pilotScore(a) || a.losses - b.losses);
  return rows.map((p) => {
    const hitRate = p.balls > 0 ? (p.hullHits / p.balls).toFixed(2) : '-';
    return `   ${who(world, p.shipId).padEnd(32)} score ${pilotScore(p).toFixed(1).padStart(5)}  wins ${String(p.wins).padStart(3)}  escapes ${String(p.escapes ?? 0).padStart(3)}  losses ${String(p.losses).padStart(3)}  balls ${String(p.balls).padStart(4)}  hull hits ${String(p.hullHits).padStart(4)}  hits/ball ${hitRate}`;
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
  private finishGoing = new Map<number, { enemyId: number; since: number }>(); // who went in to finish whom, and when
  private escapes = 0;
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
  // M3 step 7b
  private leaves: Record<string, number> = { fear: 0, odds: 0, trader: 0 };
  private jettisons = 0;
  private desperateRams = 0;
  private sternSalvos = 0;
  private bowShots = 0;
  /** M3 step 7c: wins and losses by skill level (low / mid / high seamanship and gunnery). */
  private readonly skillWins: Record<string, { wins: number; losses: number }> = {};
  private landHits = 0;
  // M4b step 1 (perception): how often ships saw, lost and forgot each other (counted, not written line by line).
  private sightFirst = 0;
  private sightBetter = 0;
  private sightAgain = 0; // M4b step 4: back in view after it was lost
  private sightLost = 0;
  private sightForgotten = 0;
  private sightSamples = 0; // how many updates of the lists were counted
  private sightVisible = 0; // ... and how many ships were in view in all of them
  private escapePoints = 0;
  // M3 step 7d (a battle against bots): balls and hull hits per ship, and the result
  private shots = new Map<number, { balls: number; hits: number; hullLost: number }>();
  private sunkShips: string[] = [];


  constructor(max = LOG_MAX_LINES) {
    this.max = max;
  }

  private tally(shipClass: string): ClassTally {
    let t = this.classes.get(shipClass);
    if (!t) {
      t = { ships: 0, wins: 0, escapes: 0, losses: 0, lifeSeconds: 0, shoreDeaths: 0, agroundCount: 0, agroundSeconds: 0, stuck: 0, unsticks: 0 };
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

  /** M3 step 7c: count a win or a loss for the skill levels of this ship (ships without skills are left out). */
  private skillTally(ship: ShipState | undefined, what: 'wins' | 'losses'): void {
    if (!ship || ship.seamanship === undefined) return;
    const sea = ship.seamanship < 0.97 ? 'low' : ship.seamanship > 1.08 ? 'high' : 'mid';
    const gun = ship.battleSkill < 4 ? 'low' : ship.battleSkill > 6 ? 'high' : 'mid';
    for (const key of [`sea ${sea}`, `gun ${gun}`]) (this.skillWins[key] ??= { wins: 0, losses: 0 })[what]++;
  }

  get size(): number {
    return this.lines.length;
  }

  /** Read what happened in this frame's events and write the lines worth keeping. */
  record(world: World, events: readonly SimEvent[]): void {
    const now = world.tick * (1 / 30);
    const arena = world.arena;
    if (world.sight && world.tick % 10 === 0) {
      for (const s of world.sight) {
        this.sightSamples++;
        this.sightVisible += s.contacts.filter((c) => c.visible).length;
      }
    }
    for (const e of events) {
      if (e.type === 'hit') {
        this.ammoHits[e.ammo] = (this.ammoHits[e.ammo] ?? 0) + 1;
        this.menLost += e.crewLost;
        this.sailsTorn += e.sailsLost;
        if (e.zone === 'hull') this.shotsOf(e.byShipId).hits++;
        this.shotsOf(e.shipId).hullLost += e.hullLost;
      }
      if (e.type === 'gunFired') {
        this.shotsOf(e.shipId).balls += e.balls ?? 1;
        if (e.side === 'stern') this.sternSalvos++;
        if (e.side === 'bow') this.bowShots++;
      }
      if (e.type === 'landHit') this.landHits++;
      if (e.type === 'sighted') {
        if (e.first) this.sightFirst++;
        else if (e.again) this.sightAgain++;
        else this.sightBetter++;
        // M4b step 4: a line when a ship comes into view (first time or again), not for a better level.
        if (e.first || e.again) this.add(now, sightedLine(world, e.shipId, e.otherId, e.levelNow ?? e.level, e.distance, !e.first, e.heard));
      }
      if (e.type === 'lostSight') {
        this.sightLost++;
        this.add(now, lostSightLine(world, e.shipId, e.otherId, e.x, e.y, e.distance, e.why));
      }
      if (e.type === 'forgotten') this.sightForgotten++;
      if (e.type === 'targetChosen') {
        // A trader (M3 step 7b) does not hunt: it keeps an eye on the nearest danger.
        const trader = SHIP_CLASSES[world.ships.find((x) => x.id === e.shipId)?.shipClass ?? '']?.trader === true;
        this.add(now, `${who(world, e.shipId)} ${trader ? 'keeps an eye on' : 'goes after'} ${who(world, e.targetId)}, ${Math.round(e.distance)} m away`);
      }
      else if (e.type === 'sunk') {
        const winner = arena?.pilots.find((p) => p.shipId === e.byShipId);
        const by = world.ships.find((s) => s.id === e.byShipId);
        const full = by ? hullOf(world, by.id) : 0;
        const left = by && full > 0 ? ` with ${Math.round((100 * by.hull) / full)}% of its hull left` : '';
        const wins = !arena ? '' : e.byShipId < 0 ? `Nobody's win, ${arena.totalWins} in all` : `Wins: ${winner?.wins ?? 0} for it, ${arena.totalWins} in all`;
        if (!arena) this.sunkShips.push(`${clock(now)} ${who(world, e.shipId)} by ${who(world, e.byShipId)}`);
        // M3 step 7a fix: the killer is often already an offender ('outlaw') when its last ball lands
        // (the port law marks it in the same step), so the attack is remembered from its decision.
        const going = this.finishGoing.get(e.byShipId);
        const finished = world.bots.find((b) => b.shipId === e.byShipId)?.mode === 'finish' || (going !== undefined && going.enemyId === e.shipId && now - going.since <= BOTS.finishSeconds + 5);
        if (finished) this.finishGoing.delete(e.byShipId);
        if (finished) this.finishKills++;
        this.add(now, `SUNK: ${who(world, e.shipId)} sunk by ${who(world, e.byShipId)}${left}${finished ? ' (a finishing attack in safe water)' : ''}. ${wins}`);
        this.lines.push(`            ${this.sinkDetails(world, e)}`);
        const loser = world.ships.find((x) => x.id === e.shipId);
        const pilot = arena?.pilots.find((x) => x.shipId === e.shipId);
        if (loser) {
          const t = this.tally(loser.shipClass);
          t.losses++;
          t.lifeSeconds += pilot?.sinceSeconds ?? 0;
          if (e.byShipId < 0) t.shoreDeaths++;
        }
        if (by) this.tally(by.shipClass).wins++;
        this.skillTally(by, 'wins');
        this.skillTally(loser, 'losses');
        this.endAground(now, e.shipId, false, world);
      } else if (e.type === 'skills') {
        this.add(now, `${who(world, e.shipId)} skills: ${skillsText(world.ships.find((sh) => sh.id === e.shipId), world.bots.find((b) => b.shipId === e.shipId))}`);
      } else if (e.type === 'respawn') {
        const land = distanceToLand(e.x, e.y, ISLANDS);
        const skills = skillsText(world.ships.find((sh) => sh.id === e.shipId), world.bots.find((b) => b.shipId === e.shipId));
        this.add(now, `${who(world, e.shipId)} is back at sea at ${placeText(e.x, e.y)}${skills ? `; ${skills}` : ''}`);
        if (land.distance < SPAWN_LAND_WARN_M) this.warn(now, `${who(world, e.shipId)} appeared only ${Math.round(land.distance)} m from land (${land.name})`);
      }
      else if (e.type === 'offender') {
        const how = e.reason === 'fired' ? 'fired in its safe water' : 'hit a ship in its safe water';
        this.add(now, `PORT LAW: ${who(world, e.shipId)} ${how}: an offender of ${portName(e.port)}, the shore guns open fire`);
      } else if (e.type === 'pardoned') this.add(now, `PORT LAW: ${who(world, e.shipId)} is pardoned by ${portName(e.port)}`);
      else if (e.type === 'escaped') {
        this.escapes++;
        const ship = world.ships.find((x) => x.id === e.shipId);
        if (ship) this.tally(ship.shipClass).escapes++;
        this.escapePoints += e.points ?? 0.5;
        this.add(now, `ESCAPED: ${who(world, e.shipId)} got away from ${who(world, e.byShipId)} ${e.how === 'port' ? 'into safe water' : 'out of reach'} (+${e.points ?? 0.5} of a win)${ship ? ` [${conditionText(ship)}]` : ''}`);
      } else if (e.type === 'peace') this.add(now, `PEACE after ${e.totalWins} wins: nobody attacks any more; hurt ships sail to port`);
      // Bots (M3 step 4c / 5).
      else if (e.type === 'botUnstick') {
        const ship = world.ships.find((x) => x.id === e.shipId);
        if (ship) this.tally(ship.shipClass).unsticks++;
        const mode = world.bots.find((b) => b.shipId === e.shipId)?.mode ?? '?';
        this.add(now, `${who(world, e.shipId)} made no way for ${BOTS.stuckCheckSeconds} s (mode ${mode}${ship?.aground ? ', aground' : ''}): works free heading ${Math.round(headingRadToBearingDeg(e.headingRad))}\u00b0 at ${placeText(e.x, e.y)}`);
      } else if (e.type === 'finishDecision') {
        this.finishDecisions++;
        if (e.go) {
          this.finishAttacks++;
          this.finishGoing.set(e.shipId, { enemyId: e.enemyId, since: now });
        }
        const why = e.canFinish ? `can sink it (expects ${Math.round(e.expected)} damage, it has ${Math.round(e.enemyHull)} hull)` : `cannot sink it (expects ${Math.round(e.expected)}, it has ${Math.round(e.enemyHull)})`;
        this.add(now, `FINISH? ${who(world, e.shipId)} vs ${who(world, e.enemyId)} in safe water: ${why} -> ${e.go ? (e.canFinish ? 'GOES IN' : 'GOES IN anyway (reckless)') : 'waits outside'}`);
      } else if (e.type === 'ramDecision') {
        this.ramDecisions++;
        if (e.go) this.ramTries++;
        if (e.desperate) this.desperateRams++;
        this.add(now, e.desperate ? `RAM! ${who(world, e.shipId)} cannot get away from ${who(world, e.enemyId)} (${Math.round(e.distance)} m): turns and rams in despair` : `RAM? ${who(world, e.shipId)} vs ${who(world, e.enemyId)} at ${Math.round(e.distance)} m -> ${e.go ? 'RAMS' : 'keeps firing'}`);
      } else if (e.type === 'rammerLearned') {
        this.rammers++;
        this.add(now, `${who(world, e.shipId)} rammed ${who(world, e.enemyId)} on purpose: it is a RAMMER now (chain, grape, ram)`);
      } else if (e.type === 'botLeaves') {
        this.leaves[e.reason] = (this.leaves[e.reason] ?? 0) + 1;
        const why = e.reason === 'fear' ? `its crew is afraid (fear ${e.fear.toFixed(2)})` : e.reason === 'odds' ? `the odds are poor (${e.odds.toFixed(2)})` : `a trader does not fight (odds ${e.odds.toFixed(2)})`;
        const ship = world.ships.find((x) => x.id === e.shipId);
        this.add(now, `LEAVES: ${who(world, e.shipId)} turns away from ${who(world, e.enemyId)}: ${why}${ship ? ` [${conditionText(ship)}]` : ''}`);
      } else if (e.type === 'jettison') {
        this.jettisons++;
        this.add(now, `${who(world, e.shipId)} throws its cargo over the side (${Math.round(e.cargo * 100)}% of the hold) to run faster`);
      } else if (e.type === 'berthWait') {
        this.berthWaits++;
        this.add(now, `${who(world, e.shipId)} finds the berths of ${e.port} full (${e.occupied}/${e.berths}): waits off the port`);
      } else if (e.type === 'routePlanned') {
        this.add(now, `ROUTE: ${who(world, e.shipId)} sails ${e.kind === 'ports' ? 'port to port' : 'island to island'}: ${e.stops.map((s) => `(${Math.round(s.x)}, ${Math.round(s.y)})`).join(' > ')}`);
      } else if (e.type === 'pirateTurn') {
        this.add(now, e.renegade
          ? `RENEGADE: ${who(world, e.shipId)} (${e.was}) ${e.reason === 'law' ? 'broke a port\'s law' : 'rams more than anybody'}: black flag up, it hunts anyone now`
          : `PIRATE (hidden): ${who(world, e.shipId)} sank nobody for 10 minutes and turns pirate under a false ${e.falseFlag} flag`);
      } else if (e.type === 'portBlocked') {
        this.add(now, `PORT BLOCKED: ${who(world, e.shipId)} gives up ${e.port} for ${Math.round(e.seconds)} s (D74: failed to get in)`);
      }
      else if (e.type === 'collision' && (e.damageA > 0 || e.damageB > 0)) {
        this.collisions++;
        this.collisionDamage += e.damageA + e.damageB;
        if (world.bots.some((b) => b.mode === 'ram' && (b.shipId === e.shipA || b.shipId === e.shipB))) this.ramHits++;
        this.add(now, `collision: ${who(world, e.shipA)} (-${Math.round(e.damageA)}) and ${who(world, e.shipB)} (-${Math.round(e.damageB)})`);
      }
    }
    this.watch(world, now);
    if (arena && now >= this.nextStandings) {
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
      parts.push(`loser: ${bot?.mode ?? 'player'}, speed ${(e.speedBefore ?? loser.speed).toFixed(1)} m/s, sails set ${Math.round((e.sailLevelBefore ?? loser.sailLevel) * 100)}%, sails left ${Math.round(sailShare(loser) * 100)}%, crew ${crewOf(loser)}, ammo ${loadableAmmo(loser)}${lParams ? `, speed left ${Math.round(damageSpeedFactor(loser, lParams) * 100)}%` : ''}, wind angle ${twa}\u00b0${loser.aground ? ', AGROUND' : ''}${loser.offender ? ', offender' : ''}`);
    }
    if (killer && loser) {
      const kBot = world.bots.find((b) => b.shipId === killer.id);
      const full = SHIP_CLASSES[killer.shipClass]?.hullPoints ?? 1;
      parts.push(`killer: ${kBot?.mode ?? 'player'}, ${Math.round(Math.hypot(killer.x - loser.x, killer.y - loser.y))} m away, hull ${Math.round((100 * killer.hull) / full)}%, ${killer.speed.toFixed(1)} m/s`);
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

  /** Bot modes: a line when they change (M4b 5c: all of them, so that a bot that circles can be explained). */
  modeChanged(world: World, shipId: number, mode: string): void {
    const now = world.tick * (1 / 30);
    const ship = world.ships.find((s) => s.id === shipId);
    const state = ship ? ` [${conditionText(ship)}]` : '';
    if (mode === 'flee') this.add(now, `${who(world, shipId)} flees${state}`);
    else if (mode === 'finish') this.add(now, `${who(world, shipId)} goes into safe water to finish its enemy${state}`);
    else if (mode === 'ram') this.add(now, `${who(world, shipId)} turns to ram its enemy${state}`);
    else if (mode === 'port') this.add(now, `${who(world, shipId)} sails to port for repairs${state}`);
    else if (mode === 'outlaw') this.add(now, `${who(world, shipId)} runs from the shore guns${state}`);
    else this.add(now, `${who(world, shipId)} MODE ${mode}${state}`); // M4b 5c: every other change (chase, engage, idle, trade, repair), to find out why a bot circles
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
        `   ${kind.padEnd(12)} ships ${r.ships}  wins ${String(t.wins).padStart(3)}  escapes ${String(t.escapes).padStart(3)}  losses ${String(t.losses).padStart(3)}  mean life ${life.padStart(6)}  balls ${String(r.balls).padStart(4)}  hits/ball ${r.balls > 0 ? (r.hits / r.balls).toFixed(2) : '-'}  shore deaths ${t.shoreDeaths}  aground ${t.agroundCount}x ${Math.round(t.agroundSeconds)} s  stuck ${t.stuck}  worked free ${t.unsticks}x`,
      );
    }
    out.push(`   hits by ammunition: round ${this.ammoHits.round}, chain ${this.ammoHits.chain}, grape ${this.ammoHits.grape}; men lost ${Math.round(this.menLost)}, sail points torn ${Math.round(this.sailsTorn)}`);
    out.push(`   collisions ${this.collisions} (hull points lost ${Math.round(this.collisionDamage)}), warnings ${this.warnings}`);
    out.push(`   rams: tried ${this.ramTries} of ${this.ramDecisions} chances, ${this.ramHits} collisions while ramming, ${this.rammers} bots became rammers`);
    out.push(`   finishing attacks in safe water: ${this.finishAttacks} of ${this.finishDecisions} chances, ${this.finishKills} sank their enemy; waits for a berth: ${this.berthWaits}`);
    const levels = ['low', 'mid', 'high'].map((lv) => {
      const sea = this.skillWins[`sea ${lv}`] ?? { wins: 0, losses: 0 };
      const gun = this.skillWins[`gun ${lv}`] ?? { wins: 0, losses: 0 };
      return `${lv} sea ${sea.wins}/${sea.losses} gun ${gun.wins}/${gun.losses}`;
    });
    out.push(`   skills (wins/losses): ${levels.join('; ')}  (sea low < 0.97 < mid < 1.08 < high; gun low < 4 < mid < 6 < high)`);
    out.push(`   spirit: left a fight ${this.leaves['fear'] ?? 0}x from fear, ${this.leaves['odds'] ?? 0}x on poor odds, traders ran ${this.leaves['trader'] ?? 0}x; desperate rams ${this.desperateRams}; cargo thrown over the side ${this.jettisons}x; stern salvos ${this.sternSalvos}; bow chaser shots ${this.bowShots}; balls stopped by the land ${this.landHits}; escape points ${this.escapePoints.toFixed(2)}`);
    out.push(`   sight (M4b): ships sighted ${this.sightFirst}x (a better level ${this.sightBetter}x, back in view ${this.sightAgain}x), lost from view ${this.sightLost}x, forgotten ${this.sightForgotten}x; a ship had on average ${(this.sightSamples > 0 ? this.sightVisible / this.sightSamples : 0).toFixed(1)} others in view`);
    return out;
  }

  /** The whole log as one text file: a header, the lines, and the scores now. */
  text(world: World, startedAt: string): string {
    const arena = world.arena;
    const head = [
      arena ? 'Naval Battles — auto-bot arena log' : 'Naval Battles — battle log (you against bots)',
      `started ${startedAt}, game time now ${clock(world.tick / 30)}`,
      this.dropped > 0 ? `(the oldest ${this.dropped} lines were dropped: the log keeps the last ${this.max})` : '',
      '',
    ].filter((l, i) => l !== '' || i === 3);
    const tail = arena ? ['', `standings now (wins so far: ${arena.totalWins}${arena.peace ? ', PEACE' : ''}):`, ...standings(arena, world), '', ...this.classSummary(world)] : ['', ...this.battleSummary(world)];
    return [...head, ...this.lines, ...tail].join('\n') + '\n';
  }

  private shotsOf(shipId: number): { balls: number; hits: number; hullLost: number } {
    let s = this.shots.get(shipId);
    if (!s) {
      s = { balls: 0, hits: 0, hullLost: 0 };
      this.shots.set(shipId, s);
    }
    return s;
  }

  /** M3 step 7d: the end of a battle log: every ship, what it fired and hit, what it lost, who sank. */
  battleSummary(world: World): string[] {
    const out = ['battle summary:'];
    for (const ship of world.ships) {
      const s = this.shotsOf(ship.id);
      const bot = world.bots.find((b) => b.shipId === ship.id);
      const mode = bot ? `, mode ${bot.mode}${bot.fear ? `, fear ${bot.fear.toFixed(2)}` : ''}${bot.personality.courage !== undefined ? `, courage ${bot.personality.courage.toFixed(2)}` : ''}` : '';
      out.push(`   ${who(world, ship.id).padEnd(30)} ${ship.sunk ? 'SUNK' : 'afloat'}  balls ${String(s.balls).padStart(4)}  hull hits ${String(s.hits).padStart(3)}  hits/ball ${s.balls > 0 ? (s.hits / s.balls).toFixed(2) : '-'}  hull lost ${Math.round(s.hullLost)}  [${conditionText(ship)}${mode}]`);
    }
    out.push(`   sunk: ${this.sunkShips.length > 0 ? this.sunkShips.join('; ') : 'none'}`);
    out.push(...this.classSummary(world).slice(-3));
    return out;
  }

  /** For storing in the browser between visits. */
  toJson(): string {
    return JSON.stringify({ lines: this.lines, dropped: this.dropped });
  }
}

interface ClassTally {
  ships: number;
  wins: number;
  escapes: number; // M3 step 7a: got away alive, hurt
  losses: number;
  lifeSeconds: number;
  shoreDeaths: number;
  agroundCount: number;
  agroundSeconds: number;
  stuck: number;
  unsticks: number; // times a bot made no way and worked free (M3 step 4c)
}

/** "hull 40%, sails 80%, crew 55%, speed left 70%, cargo 60%, (x, y), land ..., port ..." */
function conditionText(ship: ShipState): string {
  const params = SHIP_CLASSES[ship.shipClass];
  const full = params?.hullPoints ?? 1;
  const cond = params ? `, sails ${Math.round(sailShare(ship) * 100)}%, crew ${Math.round(crewShare(ship) * 100)}%, speed left ${Math.round(damageSpeedFactor(ship, params) * 100)}%` : '';
  const cargo = ship.cargo !== undefined ? `, cargo ${Math.round(ship.cargo * 100)}%` : '';
  return `hull ${Math.round((100 * ship.hull) / full)}%${cond}${cargo}, ${placeText(ship.x, ship.y)}`;
}

function hullOf(world: World, shipId: number): number {
  const ship = world.ships.find((s) => s.id === shipId);
  return ship ? (SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 0) : 0;
}
