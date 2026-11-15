// Pure helper: which picture of a ship to show for its heading.

/**
 * The frame number for a heading, when a sprite sheet has `directions` pictures:
 * frame 0 points east (heading 0), then clockwise in equal steps, like the sim heading.
 * The nearest picture wins, so with 16 directions the picture changes every 22.5 degrees.
 */
export function directionFrame(headingRad: number, directions: number): number {
  const step = (2 * Math.PI) / directions;
  // The remainder can be negative (or -0) for headings west of north; adding a full circle fixes both.
  return ((Math.round(headingRad / step) % directions) + directions) % directions;
}
