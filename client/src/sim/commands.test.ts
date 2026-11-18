import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { createWorld } from './world';

describe('applyCommand', () => {
  it('sets the rudder', () => {
    const w = createWorld();
    applyCommand(w, { type: 'setRudder', shipId: 1, value: 0.5 });
    expect(w.ships[0]!.rudder).toBe(0.5);
  });

  it('limits the rudder to -1..1', () => {
    const w = createWorld();
    applyCommand(w, { type: 'setRudder', shipId: 1, value: 7 });
    expect(w.ships[0]!.rudder).toBe(1);
    applyCommand(w, { type: 'setRudder', shipId: 1, value: -7 });
    expect(w.ships[0]!.rudder).toBe(-1);
  });

  it('sets sails and limits them to 0..1', () => {
    const w = createWorld();
    applyCommand(w, { type: 'setSails', shipId: 1, value: 0.75 });
    expect(w.ships[0]!.sailLevel).toBe(0.75);
    applyCommand(w, { type: 'setSails', shipId: 1, value: 3 });
    expect(w.ships[0]!.sailLevel).toBe(1);
    applyCommand(w, { type: 'setSails', shipId: 1, value: -1 });
    expect(w.ships[0]!.sailLevel).toBe(0);
  });

  it('ignores a command for a ship that does not exist', () => {
    const w = createWorld();
    applyCommand(w, { type: 'setSails', shipId: 99, value: 1 });
    expect(w.ships[0]!.sailLevel).toBe(0);
  });

  it('placeShip moves a ship, stops it and can change its class', () => {
    const w = createWorld();
    w.ships[1]!.speed = 5;
    applyCommand(w, { type: 'placeShip', shipId: 2, x: 10, y: 20, headingRad: 1, shipClass: 'frigate' });
    const s = w.ships[1]!;
    expect([s.x, s.y, s.headingRad, s.speed, s.shipClass]).toEqual([10, 20, 1, 0, 'frigate']);
  });

  it('placeShip keeps the old class if the new one is unknown', () => {
    const w = createWorld();
    applyCommand(w, { type: 'placeShip', shipId: 2, x: 0, y: 0, headingRad: 0, shipClass: 'galleon' });
    expect(w.ships[1]!.shipClass).toBe('sloop');
  });

  it('setWind changes the wind and keeps the strength within 0..1', () => {
    const w = createWorld();
    applyCommand(w, { type: 'setWind', fromRad: 1, strength: 3 });
    expect(w.wind).toEqual({ fromRad: 1, strength: 1, baseFromRad: 1 });
  });

  it('setWind wraps the direction into (-PI, PI]', () => {
    const w = createWorld();
    applyCommand(w, { type: 'setWind', fromRad: 2 * Math.PI + 0.5, strength: 0.5 });
    expect(w.wind.fromRad).toBeCloseTo(0.5);
  });
});

describe('placeShip never puts a ship on land', () => {
  it("a place on an island becomes the nearest open water; open water stays as asked", async () => {
    const { ISLANDS: islands, SHIP_CLASSES: classes } = await import('./data');
    const { pointInPolygon } = await import('./geometry');
    const { touchesLand } = await import('./land');
    const island = islands.find((i) => i.kind === 'big' || i.kind === 'medium')!;
    let land = { x: 0, y: 0 };
    outer: for (let x = Math.min(...island.points.map((p) => p.x)); x < Math.max(...island.points.map((p) => p.x)); x += 10) {
      for (let y = Math.min(...island.points.map((p) => p.y)); y < Math.max(...island.points.map((p) => p.y)); y += 10) {
        if (pointInPolygon({ x, y }, island.points)) {
          land = { x, y };
          break outer;
        }
      }
    }
    const w = createWorld(1, 1);
    applyCommand(w, { type: 'placeShip', shipId: 2, x: land.x, y: land.y, headingRad: 1, shipClass: 'frigate' });
    const ship = w.ships.find((s) => s.id === 2)!;
    expect(ship.shipClass).toBe('frigate');
    expect(touchesLand(ship, classes['frigate']!, islands)).toBe(false);
    // The test buttons' normal case is untouched: open water stays exactly where it was asked.
    applyCommand(w, { type: 'placeShip', shipId: 2, x: 160, y: 250, headingRad: 0 });
    expect({ x: ship.x, y: ship.y }).toEqual({ x: 160, y: 250 });
  });

  it('step 4b: a sunk ship takes no orders until it is placed again', () => {
    const w = createWorld();
    const ship = w.ships[0]!;
    ship.sunk = true;
    ship.elevationDeg = 5;
    applyCommand(w, { type: 'setRudder', shipId: 1, value: 1 });
    applyCommand(w, { type: 'setSails', shipId: 1, value: 1 });
    applyCommand(w, { type: 'setElevation', shipId: 1, valueDeg: 1 });
    applyCommand(w, { type: 'setAmmo', shipId: 1, ammo: 'grape' });
    expect(ship.rudder).toBe(0);
    expect(ship.sailLevel).toBe(0);
    expect(ship.elevationDeg).toBe(5);
    expect(ship.ammo).toBeUndefined();
    applyCommand(w, { type: 'placeShip', shipId: 1, x: ship.x, y: ship.y, headingRad: 0 });
    expect(ship.sunk).toBe(false);
    applyCommand(w, { type: 'setRudder', shipId: 1, value: 1 });
    expect(ship.rudder).toBe(1);
  });
});
