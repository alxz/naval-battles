// A wreck is a picture, not a ship: it fades after the sinking, stays a while, then goes (M3 step 7e).
// The sunk ship stays in the world's list (the log, the verdict and the ship numbers need it); only the picture,
// the chart mark and the HUD fading of it are ended here.

export interface WreckParams {
  minAlpha: number; // the faint wreck (0..1)
  sinkRate: number; // alpha lost per second right after the sinking
  keepSeconds: number; // how long the faint wreck stays
  fadeSeconds: number; // how long it takes to melt away after that
}

/** The alpha of a wreck `ageSeconds` after it sank: 1 falls to minAlpha, stays, then melts to 0. */
export function wreckAlpha(ageSeconds: number, p: WreckParams): number {
  const sinking = Math.max(p.minAlpha, 1 - p.sinkRate * ageSeconds);
  const melting = ageSeconds <= p.keepSeconds ? 1 : Math.max(0, 1 - (ageSeconds - p.keepSeconds) / Math.max(0.001, p.fadeSeconds));
  return sinking * melting;
}

/** Is the wreck gone for good (not drawn, no chart mark)? */
export function wreckGone(ageSeconds: number, p: WreckParams): boolean {
  return ageSeconds >= p.keepSeconds + p.fadeSeconds;
}

/** The speed scale of a game: the panel's value, and in a solo battle the extra solo factor. */
export function speedScaleFor(panelScale: number, arena: boolean, soloFactor: number): number {
  return panelScale * (arena ? 1 : soloFactor);
}
