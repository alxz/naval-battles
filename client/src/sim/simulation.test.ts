import { describe, expect, it } from 'vitest';
import { MAX_STEPS_PER_UPDATE, Simulation } from './simulation';
import { STEP_SECONDS } from './step';
import { createWorld } from './world';

describe('Simulation', () => {
  it('runs no step until enough time has passed', () => {
    const sim = new Simulation(createWorld());
    sim.update(STEP_SECONDS / 2);
    expect(sim.world.tick).toBe(0);
  });

  it('runs one step and reports alpha for the leftover time', () => {
    const sim = new Simulation(createWorld());
    const alpha = sim.update(STEP_SECONDS * 1.5);
    expect(sim.world.tick).toBe(1);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('adds up small frames (60 fps screen, 30 steps per second)', () => {
    const sim = new Simulation(createWorld());
    for (let i = 0; i < 61; i++) sim.update(1 / 60);
    expect(sim.world.tick).toBeGreaterThanOrEqual(29);
    expect(sim.world.tick).toBeLessThanOrEqual(31);
  });

  it('applies queued commands at the start of the next step, not at once', () => {
    const sim = new Simulation(createWorld());
    sim.queueCommand({ type: 'setSails', shipId: 1, value: 1 });
    expect(sim.world.ships[0]!.sailLevel).toBe(0);
    sim.update(STEP_SECONDS * 1.01);
    expect(sim.world.ships[0]!.sailLevel).toBe(1);
  });

  it('gives the same result for the same commands (deterministic)', () => {
    const run = () => {
      const sim = new Simulation(createWorld());
      sim.queueCommand({ type: 'setSails', shipId: 1, value: 1 });
      sim.queueCommand({ type: 'setRudder', shipId: 1, value: 0.5 });
      for (let i = 0; i < 300; i++) sim.update(0.05);
      return JSON.stringify(sim.world);
    };
    expect(run()).toBe(run());
  });

  it('drops time after a very long pause', () => {
    const sim = new Simulation(createWorld());
    const alpha = sim.update(60);
    expect(sim.world.tick).toBe(MAX_STEPS_PER_UPDATE);
    expect(alpha).toBe(0);
  });

  it('draws between the previous and the current step', () => {
    const sim = new Simulation(createWorld());
    sim.queueCommand({ type: 'setSails', shipId: 1, value: 1 });
    for (let i = 0; i < 90; i++) sim.update(STEP_SECONDS); // get moving
    const alpha = sim.update(STEP_SECONDS * 0.5);
    const ship = sim.world.ships[0]!;
    const pose = sim.pose(0, alpha);
    expect(pose.x).toBeLessThan(ship.x);
    expect(pose.x).toBeGreaterThan(ship.x - 1);
  });

  it('keeps the world plain JSON data', () => {
    const sim = new Simulation(createWorld());
    sim.update(1);
    expect(JSON.parse(JSON.stringify(sim.world))).toEqual(sim.world);
  });
});
