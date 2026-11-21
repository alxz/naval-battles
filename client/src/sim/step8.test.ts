// M3 step 8: out of the Isla Verde harbour along the inlet's middle line (the arena logs: ships ground on the
// inside of the inlet's bend when they cut straight from the harbour to the mouth).
import { describe, expect, it } from 'vitest';
import { createArenaWorld } from './arena';
import { inletWayOut, PORTS } from './port';
import { tradeStops } from './morale';
import { DAMAGE, ISLANDS, SHIP_CLASSES } from './data';
import { Simulation } from './simulation';

const inletPort = PORTS.find((p) => p.path && p.path.length > 2);

describe('inletWayOut', () => {
  it('on the inlet: a point of the middle line nearer the mouth; at the mouth or outside: none', () => {
    if (!inletPort?.path) return; // a sea without an inlet (a developer's own islands.json may differ)
    const path = inletPort.path;
    const mid = path[Math.floor(path.length / 2)]!;
    const out = inletWayOut(mid.x, mid.y + 20, inletPort);
    expect(out).not.toBeNull();
    const idx = path.findIndex((q) => q.x === out!.x && q.y === out!.y);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(Math.floor(path.length / 2));
    expect(inletWayOut(inletPort.x, inletPort.y, inletPort)).not.toBeNull(); // the round harbour at the head
    expect(inletWayOut(path[0]!.x, path[0]!.y, inletPort)).toBeNull();
    expect(inletWayOut(path[0]!.x + 500, path[0]!.y + 500, inletPort)).toBeNull();
  });
  it('the harbour boats tow along the whole width of the channel (towPathM), at 2.5 m/s', () => {
    expect(DAMAGE.port.towPathM).toBeGreaterThanOrEqual(60);
    expect(DAMAGE.port.towMps).toBeGreaterThanOrEqual(2.5);
  });
});

describe('a brigantine and a caravel leave the Isla Verde harbour without grinding on the bend', () => {
  for (const shipClass of ['brigantine', 'caravel']) {
    it(shipClass, () => {
      if (!inletPort?.path) return;
      const w = createArenaWorld(31, 4);
      const me = w.ships[0]!;
      me.shipClass = shipClass;
      me.x = inletPort.x + 20;
      me.y = inletPort.y;
      me.headingRad = 0;
      me.speed = 0;
      // The others far to the east: the bot wants to go out and hunt (or trade).
      w.ships.slice(1).forEach((s, i) => {
        s.x = 1500 + 300 * i;
        s.y = -600;
      });
      const sim = new Simulation(w);
      let agroundSteps = 0;
      let out = false;
      for (let t = 0; t < 300 * 30 && !out; t++) {
        sim.update(1 / 30);
        const s = sim.world.ships[0]!;
        if (s.aground) agroundSteps++;
        // Out: through the mouth (a trader may come back later: Isla Verde can be a stop on its trade run).
        const mouth = inletPort.path[0]!;
        if (Math.hypot(s.x - inletPort.x, s.y - inletPort.y) > Math.hypot(mouth.x - inletPort.x, mouth.y - inletPort.y) + 30) out = true;
      }
      const last = sim.world.ships[0]!;
      const bot = sim.world.bots[0];
      expect(`${out} ${Math.round(last.x)},${Math.round(last.y)} ${bot?.mode} ${JSON.stringify(bot?.tradeTo)}`).toMatch(/^true/);
      expect(agroundSteps).toBeLessThan(30 * 3);
    });
  }
});

describe('trade stops (M3 step 8)', () => {
  it('a port up an inlet: the stop lies off the mouth, outside the harbour', () => {
    if (!inletPort?.path) return;
    const stops = tradeStops(SHIP_CLASSES['caravel']!, ISLANDS, PORTS);
    const mouth = inletPort.path[0]!;
    expect(stops.some((s) => s.x === inletPort.x && s.y === inletPort.y)).toBe(false);
    const near = stops.reduce((m, s) => Math.min(m, Math.hypot(s.x - mouth.x, s.y - mouth.y)), Infinity);
    expect(near).toBeGreaterThan(100);
    expect(near).toBeLessThan(450);
  });
});
