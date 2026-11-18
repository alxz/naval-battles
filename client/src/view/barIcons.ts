// Tiny pixel icons in front of the HUD bars (M3 step 4b), so it is clear which bar is which:
// the hull (a ship's hull, brown), the sails (a sail, canvas colour) and the crew (a sailor, blue).
// Pure: rows of '#' (a pixel) and '.' (empty); scenes/Hud.ts draws them with fillRect.

export type BarIconName = 'hull' | 'sails' | 'crew';

export interface BarIcon {
  rows: readonly string[];
  colour: number;
}

export const BAR_ICONS: Readonly<Record<BarIconName, BarIcon>> = {
  hull: {
    colour: 0xb07a45,
    rows: [
      '#....#', //
      '######',
      '.####.',
    ],
  },
  sails: {
    colour: 0xf2e8c9,
    rows: [
      '#...', //
      '##..',
      '###.',
      '####',
    ],
  },
  crew: {
    colour: 0x8fd3ff,
    rows: [
      '.#.', // head
      '###', // arms
      '.#.',
      '#.#', // legs
    ],
  },
};

/** Width of an icon in pixels (at scale 1). */
export function barIconWidth(name: BarIconName): number {
  return Math.max(...BAR_ICONS[name].rows.map((r) => r.length));
}

/** Height of an icon in pixels (at scale 1). */
export function barIconHeight(name: BarIconName): number {
  return BAR_ICONS[name].rows.length;
}

/** The lit pixels of an icon: x, y from its top left corner. */
export function barIconPixels(name: BarIconName): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  BAR_ICONS[name].rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') out.push({ x, y });
  });
  return out;
}
