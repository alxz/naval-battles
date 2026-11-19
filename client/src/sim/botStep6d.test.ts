// M3 step 6d (your test of 6c): wrecks run for a port, not along the edge of the sea; big ships keep
// out of small harbours; no wearing on a lee shore; bots slow down in a harbour; no "turn round"
// onto a bank when every heading looks blocked.
import { describe, expect, it } from 'vitest';
import { avoidHarbour, avoidLand, enemyInSmallHarbour, fleeHeading, harbourSails, onLeeShore, rudderFor } from './bot';
import { BOTS, SHIP_CLASSES } from './data';
import { landAhead } from './bot';
import type { Port } from './port';
import type { Island, ShipState } from './types';

const sloop = SHIP_CLASSES['sloop']!;
const brig = SHIP_CLASSES['brigantine']!;
const frigate = SHIP_CLASSES['frigate']!;

function at(id: number, x: number, y: number, headingRad = 0, speed = 0, shipClass = 'sloop'): ShipState {
  return {
    id, shipClass, x, y, headingRad, speed, rudder: 0, sailLevel: 0.5,
    aground: false, elevationDeg: 5, reloadPort: 0, reloadStarboard: 0, hull: SHIP_CLASSES[shipClass]!.hullPoints, sunk: false, battleSkill: 4, team: id, repairing: false,
  };
}

const square = (name: string, x0: number, y0: number, x1: number, y1: number): Island => ({
  name,
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
});
const fromEast = { fromRad: 0, strength: 0.8 };

describe('fleeHeading with land', () => {
  it('a reef straight ahead of "away": it runs along it, never onto it', () => {
    const reef = [square('West reef', -1000, -2000, -900, 2000)];
    const ship = at(1, -820, 0, Math.PI, 5);
    // The enemy is to the east: "away" is west, into the reef.
    const h = fleeHeading(ship, sloop, fromEast, 0, reef);
    expect(Math.abs(Math.cos(h))).toBeLessThan(0.6); // mostly north or south
    expect(landAhead(ship, sloop, reef, h, 150)).toBe(false);
    // Without land it is plain "away" (or a faster course near it).
    expect(Math.cos(fleeHeading(ship, sloop, fromEast, 0))).toBeLessThan(-0.7);
  });
});

describe('small harbours', () => {
  const ports: Port[] = [{ name: 'Inlet', x: 0, y: 0, berths: 2, harbourR: 85, path: [{ x: 300, y: 0 }, { x: 0, y: 0 }] }];
  it('an enemy up the inlet is out of reach for a frigate, not for a sloop', () => {
    const enemy = at(2, 150, 10);
    expect(enemyInSmallHarbour(enemy, frigate, ports)).toBe(true);
    expect(enemyInSmallHarbour(enemy, sloop, ports)).toBe(false);
    expect(enemyInSmallHarbour(at(2, 150, 400), frigate, ports)).toBe(false);
  });
});

describe('avoidHarbour (with a real island set)', () => {
  // A port island with an inlet: the harbour is the inlet line and the anchorage.
  const island: Island = { ...square('Port Isle', -400, -200, -50, 200), port: { x: -100, y: 0 }, inlet: { x: 200, y: 0, headX: -100, headY: 0, path: [{ x: 200, y: 0 }, { x: -100, y: 0 }] } };
  const islands = [island];
  it('a ship outside does not steer into the harbour; one already inside may go on', () => {
    const outside = at(1, 330, 0, Math.PI, 5);
    const h = avoidHarbour(outside, islands, Math.PI);
    expect(h).not.toBeNull();
    expect(Math.abs(Math.sin(h!))).toBeGreaterThan(0.6);
    expect(avoidHarbour(at(1, 100, 0, Math.PI, 5), islands, Math.PI)).toBeNull();
    expect(avoidHarbour(outside, islands, 0)).toBeNull(); // sailing away from it
  });
  it('in a harbour the sails are cut to harbourSpeedMps; outside they are left alone', () => {
    const inside = at(1, 100, 0, Math.PI / 2, 3);
    const s = harbourSails(inside, sloop, fromEast, islands, 1);
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThanOrEqual(0.1);
    expect(harbourSails(at(1, 900, 900), sloop, fromEast, islands, 1)).toBe(1);
  });
});

describe('lee shore', () => {
  it('land close downwind: a slow brigantine tacks instead of wearing', () => {
    const reef = [square('West reef', -1000, -2000, -900, 2000)];
    // Wind from the east, the reef to the west (downwind), heading north-east; wanted: south-east.
    const ship = at(1, -840, 0, -Math.PI / 4, 2, 'brigantine');
    expect(onLeeShore(ship, brig, reef, fromEast)).toBe(true);
    const goal = Math.PI / 4;
    expect(rudderFor(ship, brig, goal, fromEast, BOTS, false)).toBeLessThan(0); // wears: the long way, through west
    expect(rudderFor(ship, brig, goal, fromEast, BOTS, true)).toBeGreaterThan(0); // tacks: through east
    expect(onLeeShore(at(1, 0, 0, 0, 2, 'brigantine'), brig, reef, fromEast)).toBe(false);
  });
});

describe('avoidLand hard by a shore', () => {
  it('when the fat test finds land everywhere, it keeps an open heading instead of turning onto the bank', () => {
    const bank = [square('bank', -100, -40, 100, -15)]; // a shore just north of the ship
    const ship = at(1, 0, 0, Math.PI / 2, 2); // heading south, away from the bank
    const h = avoidLand(ship, sloop, bank, Math.PI / 2, BOTS);
    // Whatever it picks, it is not north into the bank.
    if (h !== null) expect(Math.sin(h)).toBeGreaterThan(-0.5);
  });
});
