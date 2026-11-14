// Plain 2D geometry for the simulation. Positions in game metres.

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Is the point inside the polygon? ("ray casting")
 * Imagine a ray going from the point to the right (east) forever.
 * Count how many polygon edges it crosses: odd = inside, even = outside.
 * The polygon is a list of corners; the last corner joins back to the first.
 */
export function pointInPolygon(p: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    // Does edge a-b cross the horizontal line through p, to the right of p?
    const crossesLine = a.y > p.y !== b.y > p.y;
    if (crossesLine) {
      const xAtLine = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (p.x < xAtLine) inside = !inside;
    }
  }
  return inside;
}

/** The smallest box around a polygon. */
export function bounds(polygon: readonly Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
