// Pure helpers for the picture. No Phaser here, so they can be unit tested.

/** How the logical picture is laid onto the real screen. */
export interface PixelLayout {
  pixelScale: number; // device pixels per logical pixel: always a whole number
  width: number; // logical pixels
  height: number; // logical pixels
  cssZoom: number; // CSS pixels per logical pixel (pixelScale / devicePixelRatio)
}

/**
 * Integer pixel scaling (plan D27).
 * Every logical pixel becomes exactly `pixelScale` x `pixelScale` device pixels, so pixel art
 * never looks uneven. The height ends up close to `targetHeight`; the width follows the screen.
 *
 * cssWidth, cssHeight: the window size in CSS pixels; dpr: window.devicePixelRatio.
 */
export function pixelLayout(cssWidth: number, cssHeight: number, dpr: number, targetHeight: number): PixelLayout {
  const deviceWidth = Math.round(cssWidth * dpr);
  const deviceHeight = Math.round(cssHeight * dpr);
  const pixelScale = Math.max(1, Math.round(deviceHeight / targetHeight));
  return {
    pixelScale,
    // Round up: the picture may be a few device pixels bigger than the window (cut off at the edges),
    // never smaller (no black bars).
    width: Math.ceil(deviceWidth / pixelScale),
    height: Math.ceil(deviceHeight / pixelScale),
    cssZoom: pixelScale / dpr,
  };
}

/** A phone is a touch screen whose short side is small. A tablet counts as a computer here. */
export function isPhoneScreen(cssWidth: number, cssHeight: number, touch: boolean, maxShortSide: number): boolean {
  return touch && Math.min(cssWidth, cssHeight) < maxShortSide;
}
