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
    expect(w.wind).toEqual({ fromRad: 1, strength: 1 });
  });

  it('setWind wraps the direction into (-PI, PI]', () => {
    const w = createWorld();
    applyCommand(w, { type: 'setWind', fromRad: 2 * Math.PI + 0.5, strength: 0.5 });
    expect(w.wind.fromRad).toBeCloseTo(0.5);
  });
});
