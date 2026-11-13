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
});
