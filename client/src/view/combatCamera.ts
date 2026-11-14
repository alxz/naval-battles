// Pure helper for the combat camera (plan section 4.1). Positions in game metres.

export interface Point {
  x: number;
  y: number;
}

export interface CombatCameraOptions {
  range: number; // metres: an enemy closer than this pulls the camera
  keepInside: number; // 0..1: your ship stays inside this middle share of the screen (0.8 = 80%)
}

/**
 * Where the camera should look.
 *  - No enemy near: at your ship.
 *  - Enemy near: halfway between the two ships, but never so far that your ship
 *    leaves the middle part of the screen.
 * halfWidth, halfHeight: half the view size in metres.
 */
export function combatCameraCentre(
  player: Point,
  enemy: Point | null,
  halfWidth: number,
  halfHeight: number,
  options: CombatCameraOptions,
): Point {
  if (!enemy) return { x: player.x, y: player.y };
  const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  if (distance > options.range) return { x: player.x, y: player.y };

  const maxDx = halfWidth * options.keepInside;
  const maxDy = halfHeight * options.keepInside;
  const dx = Math.max(-maxDx, Math.min(maxDx, (enemy.x - player.x) / 2));
  const dy = Math.max(-maxDy, Math.min(maxDy, (enemy.y - player.y) / 2));
  return { x: player.x + dx, y: player.y + dy };
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
