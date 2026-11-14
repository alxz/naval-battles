import { applyCommand } from './commands';
import { lerp, lerpAngle } from './interpolate';
import { STEP_SECONDS, stepWorld } from './step';
import type { Command, SimEvent, Tuning, World } from './types';

/** Never run more than this many steps in one frame (protects after a long pause). */
export const MAX_STEPS_PER_UPDATE = 10;

/** Where to draw a ship: a blend between the last two simulation steps. */
export interface Pose {
  x: number;
  y: number;
  headingRad: number;
}

/**
 * Runs the world at a fixed 30 steps per second, however fast the screen refreshes.
 * The screen calls `update(seconds)` every frame and gets back `alpha` (0..1):
 * how far we are between the previous step and the next one.
 */
export class Simulation {
  readonly world: World;
  /** Live tuning (lil-gui). Change the fields; the next step uses them. */
  readonly tuning: Tuning = { speedScale: 1, windDrift: true };
  private previous: Pose[] = [];
  private accumulator = 0;
  private queue: Command[] = [];
  private events: SimEvent[] = [];

  constructor(world: World) {
    this.world = world;
    this.previous = this.snapshot();
  }

  /** Commands wait here and are applied at the start of the next step. */
  queueCommand(command: Command): void {
    this.queue.push(command);
  }

  /** Feed in the real time that passed. Returns alpha for drawing. */
  update(deltaSeconds: number): number {
    this.accumulator += deltaSeconds;
    let steps = 0;
    while (this.accumulator >= STEP_SECONDS && steps < MAX_STEPS_PER_UPDATE) {
      this.previous = this.snapshot();
      for (const command of this.queue) applyCommand(this.world, command);
      this.queue = [];
      stepWorld(this.world, STEP_SECONDS, this.tuning);
      this.events.push(...this.world.events);
      this.accumulator -= STEP_SECONDS;
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_UPDATE) this.accumulator = 0; // too far behind: drop the rest
    return this.accumulator / STEP_SECONDS;
  }

  /** Events since the last call (gun flashes, splashes), oldest first. The screen plays them. */
  takeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** The smooth drawing position of a ship, for a given alpha. */
  pose(shipIndex: number, alpha: number): Pose {
    const now = this.world.ships[shipIndex];
    const before = this.previous[shipIndex];
    if (!now) throw new Error(`No ship with index ${shipIndex}`);
    if (!before) return { x: now.x, y: now.y, headingRad: now.headingRad };
    return {
      x: lerp(before.x, now.x, alpha),
      y: lerp(before.y, now.y, alpha),
      headingRad: lerpAngle(before.headingRad, now.headingRad, alpha),
    };
  }

  private snapshot(): Pose[] {
    return this.world.ships.map((s) => ({ x: s.x, y: s.y, headingRad: s.headingRad }));
  }
}
