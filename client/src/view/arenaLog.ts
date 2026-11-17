// The auto-bot arena log (M3 step 2): plain lines a person can read, kept to a fixed size.
// Pure: no Phaser and no browser here; the scene stores it and offers it as a download.

import { SHIP_CLASSES } from '../sim/data';
import { PORTS } from '../sim/port';
import type { ArenaState, SimEvent, World } from '../sim/types';

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

  constructor(max = LOG_MAX_LINES) {
    this.max = max;
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
      if (e.type === 'targetChosen') this.add(now, `${who(world, e.shipId)} goes after ${who(world, e.targetId)}, ${Math.round(e.distance)} m away`);
      else if (e.type === 'sunk') {
        const winner = arena.pilots.find((p) => p.shipId === e.byShipId);
        const by = world.ships.find((s) => s.id === e.byShipId);
        const full = by ? hullOf(world, by.id) : 0;
        const left = by && full > 0 ? ` with ${Math.round((100 * by.hull) / full)}% of its hull left` : '';
        const wins = e.byShipId < 0 ? `Nobody's win, ${arena.totalWins} in all` : `Wins: ${winner?.wins ?? 0} for it, ${arena.totalWins} in all`;
        this.add(now, `SUNK: ${who(world, e.shipId)} sunk by ${who(world, e.byShipId)}${left}. ${wins}`);
      } else if (e.type === 'respawn') this.add(now, `${who(world, e.shipId)} is back at sea at (${Math.round(e.x)}, ${Math.round(e.y)})`);
      else if (e.type === 'offender') {
        const how = e.reason === 'fired' ? 'fired in its safe water' : 'hit a ship in its safe water';
        this.add(now, `PORT LAW: ${who(world, e.shipId)} ${how}: an offender of ${portName(e.port)}, the shore guns open fire`);
      } else if (e.type === 'pardoned') this.add(now, `PORT LAW: ${who(world, e.shipId)} is pardoned by ${portName(e.port)}`);
      else if (e.type === 'peace') this.add(now, `PEACE after ${e.totalWins} wins: nobody attacks any more; hurt ships sail to port`);
      else if (e.type === 'collision' && (e.damageA > 0 || e.damageB > 0)) {
        this.add(now, `collision: ${who(world, e.shipA)} (-${Math.round(e.damageA)}) and ${who(world, e.shipB)} (-${Math.round(e.damageB)})`);
      }
    }
    if (now >= this.nextStandings) {
      this.nextStandings += STANDINGS_EVERY_SECONDS;
      this.add(now, `standings (wins so far: ${arena.totalWins}):`);
      for (const row of standings(arena, world)) this.lines.push(row);
    }
  }

  /** Bot modes worth a line when they change (port, flee). */
  modeChanged(world: World, shipId: number, mode: string): void {
    const now = world.tick * (1 / 30);
    if (mode === 'flee') this.add(now, `${who(world, shipId)} is badly hit and flees`);
    else if (mode === 'port') this.add(now, `${who(world, shipId)} sails to port for repairs`);
    else if (mode === 'outlaw') this.add(now, `${who(world, shipId)} runs from the shore guns`);
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
    const tail = arena ? ['', `standings now (wins so far: ${arena.totalWins}${arena.peace ? ', PEACE' : ''}):`, ...standings(arena, world)] : [];
    return [...head, ...this.lines, ...tail].join('\n') + '\n';
  }

  /** For storing in the browser between visits. */
  toJson(): string {
    return JSON.stringify({ lines: this.lines, dropped: this.dropped });
  }
}

function hullOf(world: World, shipId: number): number {
  const ship = world.ships.find((s) => s.id === shipId);
  return ship ? (SHIP_CLASSES[ship.shipClass]?.hullPoints ?? 0) : 0;
}
