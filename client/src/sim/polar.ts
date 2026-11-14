import type { Polar } from './types';

/**
 * Share of top speed (0..1) at a given wind angle, read from a polar table.
 * Closer to the wind than the no-go angle: 0 (the sails flap, "in irons").
 * Between two points of the table: a straight line between them (linear interpolation).
 */
export function polarShare(polar: Polar, twaDeg: number): number {
  if (twaDeg < polar.noGoDeg) return 0;
  const pts = polar.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return 0;
  if (twaDeg <= first.twaDeg) return first.share;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (twaDeg <= b.twaDeg) {
      const t = (twaDeg - a.twaDeg) / (b.twaDeg - a.twaDeg);
      return a.share + (b.share - a.share) * t;
    }
  }
  return last.share;
}
