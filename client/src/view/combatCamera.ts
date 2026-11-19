// Pure helpers for the camera (plan section 4.1, D43). Positions in game metres.

export interface Point {
  x: number;
  y: number;
}

/**
 * The camera circle (D43, M3 step 6b): the camera stays where it is while your ship sails inside a
 * circle of `radiusM` metres round the middle of the screen; when the ship would leave the circle,
 * the camera is pulled along so the ship stays on its edge. (Until v0.7 the camera slid toward the
 * nearest enemy, which pulled your own ship away from the middle.) Radius 0: exactly on the ship.
 */
export function circleCamera(centre: Point, ship: Point, radiusM: number): Point {
  const dx = ship.x - centre.x;
  const dy = ship.y - centre.y;
  const d = Math.hypot(dx, dy);
  if (d <= radiusM) return { x: centre.x, y: centre.y };
  const k = (d - radiusM) / d;
  return { x: centre.x + dx * k, y: centre.y + dy * k };
}

/** The circle's radius: `hulls` ship lengths, but at most `maxShare` of the shorter half of the view (a phone). */
export function cameraCircleRadius(lengthM: number, halfWidthM: number, halfHeightM: number, hulls: number, maxShare: number): number {
  return Math.max(0, Math.min(lengthM * hulls, Math.min(halfWidthM, halfHeightM) * maxShare));
}

/** The closest point from a list, or null if the list is empty. */
export function nearest(from: Point, others: readonly Point[]): Point | null {
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const p of others) {
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d < bestDistance) {
      best = p;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Smooth camera motion: move a share of the way toward the goal every frame.
 * `timeConstant` seconds: after that time about 63% of the distance is covered, whatever the frame rate.
 */
export function smoothToward(current: Point, goal: Point, dt: number, timeConstant: number): Point {
  const k = timeConstant <= 0 ? 1 : 1 - Math.exp(-dt / timeConstant);
  return { x: current.x + (goal.x - current.x) * k, y: current.y + (goal.y - current.y) * k };
}
