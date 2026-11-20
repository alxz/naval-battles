// What a roll of the mouse wheel does (M3 step 7e): in = one zoom step in (or the spyglass back in);
// out = one zoom step out, and when the view is already as close to the sea as it goes (the lowest step) the
// spyglass look-out opens for a few seconds, then the view returns to the usual zoom.

export type WheelAction = 'zoomIn' | 'zoomOut' | 'spyglassOn' | 'spyglassOff';

/** dy < 0 = rolled forward (in). `lowestZoom` = the view is at its lowest zoom step. */
export function wheelAction(dy: number, spyglassOn: boolean, lowestZoom: boolean): WheelAction | null {
  if (dy === 0) return null;
  if (dy < 0) return spyglassOn ? 'spyglassOff' : 'zoomIn';
  if (spyglassOn) return 'spyglassOn'; // more out: the look-out stays open, its time starts again
  return lowestZoom ? 'spyglassOn' : 'zoomOut';
}
