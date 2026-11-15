// Helpers for tests only (not used by the game).
import { afterEach, beforeEach } from 'vitest';
import { GUNS } from './data';

/**
 * Inside the describe block that calls this, the guns have no random error:
 * every ball flies exactly as aimed. For tests of ballistics and hits, not of luck.
 */
export function withPerfectGuns(): void {
  let saved = { gun: 0, salvo: 0 };
  beforeEach(() => {
    saved = { gun: GUNS.gunSigmaDeg, salvo: GUNS.salvoSigmaDeg };
    GUNS.gunSigmaDeg = 0;
    GUNS.salvoSigmaDeg = 0;
  });
  afterEach(() => {
    GUNS.gunSigmaDeg = saved.gun;
    GUNS.salvoSigmaDeg = saved.salvo;
  });
}
