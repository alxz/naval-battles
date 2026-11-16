import type Phaser from 'phaser';

// Text in a pixel-art game (M2 UI review, 15 Nov).
//
// The whole picture is drawn in "logical" pixels and then scaled up by a whole number
// (x3 on a computer, x4 on a phone). Text must therefore be drawn exactly on that logical
// grid, one texture pixel per logical pixel (resolution 1). Fonts drawn bigger and then
// squeezed into the grid look broken and shimmer, which is what you saw.
//
// So we use two real pixel fonts (SIL Open Font License, files in public/assets/fonts):
//   Press Start 2P  the main font: clear letters and digits; crisp only at 8, 16, 24 or 32 px
//   Silkscreen      narrow, for dense text (debug, labels); crisp at 8 or 16 px
// Use only the sizes below, and whole-pixel positions.

export const FONT_MAIN = '"Press Start 2P"';
export const FONT_SMALL = 'Silkscreen';

/** One texture pixel per logical pixel (see above). */
export const TEXT_RESOLUTION = 1;

export type TextKind = 'small' | 'main' | 'big' | 'huge';

const KINDS: Record<TextKind, { family: string; size: number }> = {
  small: { family: FONT_SMALL, size: 8 }, // debug text, ring labels, units
  main: { family: FONT_MAIN, size: 8 }, // most HUD text
  big: { family: FONT_MAIN, size: 16 }, // speed, banner title
  huge: { family: FONT_MAIN, size: 24 }, // touch button labels
};

/** The text style for one kind of text. */
export function textStyle(kind: TextKind, colour = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  const k = KINDS[kind];
  return { fontFamily: k.family, fontSize: `${k.size}px`, color: colour, resolution: TEXT_RESOLUTION };
}

/**
 * Load both fonts before the game starts: Phaser draws text once into a texture,
 * and a font that is not loaded yet would be drawn with a fallback font.
 */
export async function loadFonts(): Promise<void> {
  try {
    await Promise.all([document.fonts.load(`8px ${FONT_MAIN}`), document.fonts.load(`8px ${FONT_SMALL}`)]);
  } catch {
    // No font? The game still runs with the browser's fallback font.
  }
}
