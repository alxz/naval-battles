import type Phaser from 'phaser';
import { assetUrl } from '../assets';

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

/**
 * Change a text's words and colour only when they really change (M3 step 6e, speed). Phaser draws a
 * text again into its own picture and sends that picture to the graphics card on every setColor, even
 * with the same colour: the HUD did that 7 times a frame, the arena 14 times.
 */
export function paint(t: Phaser.GameObjects.Text, text: string, colour?: string): Phaser.GameObjects.Text {
  if (t.text !== text) t.setText(text);
  if (colour !== undefined && t.style.color !== colour) t.setColor(colour);
  return t;
}

/** The text style for one kind of text. */
export function textStyle(kind: TextKind, colour = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  const k = KINDS[kind];
  return { fontFamily: k.family, fontSize: `${k.size}px`, color: colour, resolution: TEXT_RESOLUTION };
}

const FONT_FILES: [family: string, file: string][] = [
  ['Press Start 2P', 'assets/fonts/press-start-2p.woff2'],
  ['Silkscreen', 'assets/fonts/silkscreen.woff2'],
];

/**
 * Load both fonts before the game starts: Phaser draws text once into a texture and measures
 * the font only once, so a font that arrives later leaves fallback letters and cut-off digits
 * (seen on the iPhone, 15 Nov: Safari said "ready" before the files were there).
 * So we fetch the font files ourselves (FontFace), add them to the page, and then make sure
 * the browser can really draw with them before the game starts.
 */
export async function loadFonts(): Promise<void> {
  try {
    const faces = await Promise.all(FONT_FILES.map(([family, file]) => new FontFace(family, `url(${assetUrl(file)})`).load()));
    for (const face of faces) document.fonts.add(face);
    await document.fonts.ready;
    // Belt and braces: wait (at most 3 s) until both fonts answer "yes, I can draw this".
    const ready = (): boolean => document.fonts.check(`8px ${FONT_MAIN}`) && document.fonts.check(`8px ${FONT_SMALL}`);
    for (let i = 0; i < 60 && !ready(); i++) await new Promise((resolve) => setTimeout(resolve, 50));
  } catch {
    // No font? The game still runs with the browser's fallback font.
  }
}
