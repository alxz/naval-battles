// Where the game's pictures, sounds and fonts come from (M3 step 6d, `npm run build:test`).
// A normal build loads them as files from `assets/...`. The single-file test build puts every file
// into the one HTML page as a data URL (vite.test.config.ts swaps assetSource for assetSource.inline),
// so the page needs no web server: it opens straight from the disk.

import { INLINE } from './assetSource';

/** The URL to load for this asset path (as written in the code: 'assets/ships/sloop.png'). */
export function assetUrl(path: string): string {
  return INLINE[path] ?? path;
}

/** Is this the single-file test build (no tuning panel, a version label on the screen)? */
export const TEST_BUILD = import.meta.env.VITE_TEST_BUILD === '1';

/** The version label of the test build, e.g. "M3 step 6d · 2026-11-19 21:40". */
export const BUILD_INFO = import.meta.env.VITE_BUILD_INFO ?? 'dev';
