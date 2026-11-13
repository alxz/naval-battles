// Angle helpers. Units: radians. 0 = east, clockwise (y points south).

/** Wrap any angle into the range (-PI, PI]. */
export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a > Math.PI) a -= twoPi;
  if (a <= -Math.PI) a += twoPi;
  return a;
}