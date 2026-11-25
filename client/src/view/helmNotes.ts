// The two short notes next to my ship panel (pure, no Phaser; drawn by scenes/HelmNotes.ts):
// - D73: "AUTO" while the autopilot steers, with "HEADWIND - TACKING" while it beats toward the next point;
// - your idea of 24 Nov: the bosun's word when the hull falls below half: make for port, or strike sails to mend at sea.
//   It shows for a few seconds each time the hull drops into a lower tenth (50%, 40%, ...), not all the time.

export function autoNote(hasRoute: boolean, tacking: boolean): string {
  if (!hasRoute) return '';
  return tacking ? 'AUTO  HEADWIND - TACKING' : 'AUTO';
}

export interface BosunMemory {
  band: number; // the lowest tenth of the hull already reported (10 = none)
  until: number; // seconds: show the note until then
}

export function newBosunMemory(): BosunMemory {
  return { band: 10, until: -1 };
}

/** The bosun's note now ('' = nothing). `hullShare` 0..1; `mending`: repairing or in a port already (nothing to say). */
export function bosunNote(m: BosunMemory, hullShare: number, mending: boolean, nowSeconds: number, below: number, showSeconds: number): string {
  if (hullShare >= below) {
    m.band = 10;
    m.until = -1;
    return '';
  }
  const band = Math.floor(hullShare * 10);
  if (band < m.band) {
    m.band = band;
    m.until = nowSeconds + showSeconds;
  }
  if (mending || nowSeconds >= m.until) return '';
  return `BOSUN: HULL ${Math.round(hullShare * 100)}%! MAKE FOR PORT, OR STRIKE SAILS TO MEND`;
}
