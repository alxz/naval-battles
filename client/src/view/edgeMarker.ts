// Pure helper for the edge markers (plan section 4.1). Positions in screen pixels.

export interface EdgeMarker {
  x: number; // screen pixels
  y: number;
  angle: number; // radians, the direction from the screen centre toward the ship
}

/**
 * A ship outside the view gets a marker on the screen edge, on the line from the screen centre
 * to the ship. Returns null when the ship is on the screen (it needs no marker).
 * (sx, sy): where the ship would be on the screen; width, height: the screen; margin: gap from the edge.
 */
export function edgeMarker(sx: number, sy: number, width: number, height: number, margin: number): EdgeMarker | null {
  if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) return null;

  const cx = width / 2;
  const cy = height / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  const halfW = cx - margin;
  const halfH = cy - margin;
  // Shrink the line until it touches the inner rectangle.
  const t = Math.min(dx === 0 ? Infinity : halfW / Math.abs(dx), dy === 0 ? Infinity : halfH / Math.abs(dy));
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx) };
}
