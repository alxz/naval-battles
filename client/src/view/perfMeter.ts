// A small speed meter for the help text (H) (M3 step 6e): frames a second, the time between frames,
// and how long the game rules (the simulation) took in this frame, as running averages and the worst
// of the last 2 seconds. Pure: no Phaser here; SeaScene feeds it.

export class PerfMeter {
  private frameMs = 16.7;
  private simMs = 0;
  private worstSimMs = 0;
  private worstFrameMs = 0;
  private windowMs = 0;
  private shownWorstSim = 0;
  private shownWorstFrame = 0;

  /** One frame: `frameMs` since the last one, `simMs` spent in the simulation. */
  note(frameMs: number, simMs: number): void {
    this.frameMs += (frameMs - this.frameMs) * 0.05;
    this.simMs += (simMs - this.simMs) * 0.05;
    this.worstSimMs = Math.max(this.worstSimMs, simMs);
    this.worstFrameMs = Math.max(this.worstFrameMs, frameMs);
    this.windowMs += frameMs;
    if (this.windowMs >= 2000) {
      this.shownWorstSim = this.worstSimMs;
      this.shownWorstFrame = this.worstFrameMs;
      this.worstSimMs = 0;
      this.worstFrameMs = 0;
      this.windowMs = 0;
    }
  }

  /** e.g. "fps 60  frame 16.7 ms (max 18)  sim 0.4 ms (max 2.1)". */
  line(fps: number): string {
    return `fps ${Math.round(fps)}  frame ${this.frameMs.toFixed(1)} ms (max ${Math.round(this.shownWorstFrame)})  sim ${this.simMs.toFixed(1)} ms (max ${this.shownWorstSim.toFixed(1)})`;
  }
}
