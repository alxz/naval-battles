// Angle helpers (plan D34). One place for the three angle systems:
//  - sim heading: radians, 0 = east, clockwise (y points south)   -> fields named ...Rad
//  - compass bearing: degrees, 0 = north, clockwise                -> fields named ...BearingDeg
//  - wind angle (TWA): degrees between the bow and where the wind
//    comes FROM, 0 = bow into the wind, 180 = wind from astern     -> fields named twaDeg

const TWO_PI = Math.PI * 2;

/** Wrap any angle into the range (-PI, PI]. */
export function normalizeAngle(angle: number): number {
  let a = angle % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  if (a <= -Math.PI) a += TWO_PI;
  return a;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Sim heading (0 = east) -> compass bearing (0 = north), in 0 <= bearing < 360. */
export function headingRadToBearingDeg(headingRad: number): number {
  const b = (radToDeg(headingRad) + 90) % 360;
  return b < 0 ? b + 360 : b;
}

/** Compass bearing (0 = north) -> sim heading (0 = east), in (-PI, PI]. */
export function bearingDegToHeadingRad(bearingDeg: number): number {
  return normalizeAngle(degToRad(bearingDeg - 90));
}

/**
 * True wind angle: how far the bow is from the direction the wind comes from.
 * 0 = head to wind ("in irons"), 90 = wind on the beam, 180 = wind from astern.
 * The same for both sides of the ship.
 */
export function twaDeg(headingRad: number, windFromRad: number): number {
  return Math.abs(radToDeg(normalizeAngle(headingRad - windFromRad)));
}

/** Compass bearing as a point name: N, NNE, NE, ENE, E, ... (16 points). */
export function compassPoint(bearingDeg: number): string {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const i = Math.round((((bearingDeg % 360) + 360) % 360) / 22.5) % 16;
  return names[i] ?? 'N';
}
