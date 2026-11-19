// The headless arena (M3 step 6, D46): `npm run headless-arena`.
//
// Runs the auto-bot arena with the real game rules (src/sim), without Phaser or a browser, as fast
// as the computer allows, one run after another, and writes each run's log to a file in
// `arena-logs/`. A small web page lists the logs for download, so a server can run it day and
// night and you fetch the logs from any browser.
//
//   npm run headless-arena                          runs of 60 game minutes, forever, page on port 4180
//   npm run headless-arena -- --minutes 120 --runs 4 --seed 7 --port 4180 --dir arena-logs
//
// The simulation is done one game minute at a time, so the web page still answers during a run.

import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createArenaWorld } from '../src/sim/arena';
import { Simulation } from '../src/sim/simulation';
import { STEP_SECONDS } from '../src/sim/step';
import { ArenaLog, BUILD_LABEL, headerLines } from '../src/view/arenaLog';

interface Options {
  minutes: number; // game minutes per run
  runs: number; // 0 = forever
  seed: number; // the first run's seed; each run adds 1
  port: number; // 0 = no web page
  dir: string;
}

function options(argv: readonly string[]): Options {
  const get = (name: string, fallback: string): string => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1]! : fallback;
  };
  return {
    minutes: Number(get('minutes', '60')),
    runs: Number(get('runs', '0')),
    seed: Number(get('seed', String(Date.now() % 100000))),
    port: Number(get('port', '4180')),
    dir: resolve(get('dir', 'arena-logs')),
  };
}

const opt = options(process.argv.slice(2));
if (!existsSync(opt.dir)) mkdirSync(opt.dir, { recursive: true });
let status = 'starting';
let currentText = '';

/** A date and time for file names: 2026-11-19-1405. */
function stamp(d = new Date()): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
}

/** One arena run; resolves with the file it wrote. */
function run(seed: number, index: number): Promise<string> {
  return new Promise((done) => {
    const sim = new Simulation(createArenaWorld(seed));
    const log = new ArenaLog(200000);
    for (const line of headerLines(sim.world, seed)) log.add(0, line);
    log.add(0, `headless arena: run ${index + 1}${opt.runs > 0 ? ` of ${opt.runs}` : ''}, ${opt.minutes} game minutes, seed ${seed}`);
    const modes = new Map<number, string>();
    const stepsPerMinute = Math.round(60 / STEP_SECONDS);
    let minute = 0;
    const started = Date.now();
    const file = join(opt.dir, `naval-arena-log-${stamp()}-seed${seed}.txt`);
    const chunk = (): void => {
      for (let i = 0; i < stepsPerMinute; i++) {
        sim.update(STEP_SECONDS + 1e-9);
        log.record(sim.world, sim.takeEvents());
        for (const b of sim.world.bots) {
          if (modes.get(b.shipId) === b.mode) continue;
          modes.set(b.shipId, b.mode);
          log.modeChanged(sim.world, b.shipId, b.mode);
        }
      }
      minute++;
      status = `run ${index + 1}, seed ${seed}: game minute ${minute} of ${opt.minutes}, ${sim.world.arena?.totalWins ?? 0} wins`;
      if (minute % 10 === 0 || minute === opt.minutes) {
        currentText = log.text(sim.world, 'headless');
        writeFileSync(file, currentText); // also mid-run, so a long run can be read before it ends
        console.log(`${new Date().toLocaleTimeString()}  ${status}  (${Math.round((Date.now() - started) / 1000)} s real)`);
      }
      if (minute < opt.minutes) setImmediate(chunk);
      else done(file);
    };
    setImmediate(chunk);
  });
}

async function main(): Promise<void> {
  console.log(`Naval Battles headless arena: ${BUILD_LABEL}`);
  console.log(`logs in ${opt.dir}${opt.port > 0 ? `, page on http://localhost:${opt.port}/` : ''}`);
  for (let i = 0; opt.runs === 0 || i < opt.runs; i++) {
    const file = await run(opt.seed + i, i);
    console.log(`written ${file}`);
  }
  status = 'all runs done';
  console.log(status);
  if (opt.port <= 0) process.exit(0);
}

/** The web page: the list of logs (newest first), each a download link, and what is running now. */
if (opt.port > 0) {
  createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    if (url.startsWith('/logs/')) {
      const name = url.slice('/logs/'.length);
      const path = join(opt.dir, name);
      if (name.includes('/') || name.includes('..') || !name.endsWith('.txt') || !existsSync(path)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` });
      res.end(readFileSync(path));
      return;
    }
    if (url === '/current') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(currentText || 'no log yet');
      return;
    }
    const files = readdirSync(opt.dir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => ({ f, s: statSync(join(opt.dir, f)) }))
      .sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
    const rows = files
      .map(({ f, s }) => `<tr><td><a href="/logs/${encodeURIComponent(f)}">${f}</a></td><td>${Math.round(s.size / 1024)} KB</td><td>${s.mtime.toLocaleString()}</td></tr>`)
      .join('\n');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Naval Battles: arena logs</title>
<meta http-equiv="refresh" content="30">
<style>body{font:14px monospace;background:#0d2233;color:#cfe6f7;margin:24px}a{color:#ffe066}td{padding:2px 12px}</style></head>
<body><h2>Naval Battles: headless arena</h2><p>${BUILD_LABEL}</p><p>now: ${status} · <a href="/current">the running log</a></p>
<table>${rows || '<tr><td>no logs yet</td></tr>'}</table></body></html>`);
  }).listen(opt.port, () => undefined);
}

void main();
