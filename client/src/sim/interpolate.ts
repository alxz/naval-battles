import { normalizeAngle } from './angles';

/** Linear blend: t = 0 gives a, t = 1 gives b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Like lerp, but for angles: always turns the short way round. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + normalizeAngle(b - a) * t;
}
