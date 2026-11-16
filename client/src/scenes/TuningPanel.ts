import GUI from 'lil-gui';
import { GUNS, SHIP_CLASSES } from '../sim/data';

/** What the second ship does: lie still, sail round a circle, or fight you (the bot, M2 step 4). */
export type TargetBehaviour = 'moored' | 'circle' | 'bot';

/** Everything the sliders change. The scene reads these values every frame. */
export interface TuningValues {
  pixelsPerMetre: number;
  zoom: number;
  logicalHeight: number;
  speedScale: number;
  combatCamera: boolean;
  autoZoom: boolean;
  closeFightRange: number; // metres
  shipArt: 0 | 16 | 32; // 0 = plain boxes, else pictures in that many directions
  detailAtZoom: boolean; // use the double-detail pictures at zoom x2
  rangeRings: boolean;
  targetClass: string;
  targetBehaviour: TargetBehaviour; // what ship 2 does
  targetSailsPercent: number; // its sail setting while moving
  targetCircleRadius: number; // metres
  windFromBearingDeg: number; // compass degrees, where the wind comes from
  windStrength: number; // 0..1
  windDrift: boolean;
  debugText: boolean; // the debug text with keys and numbers (H on a computer)
  minimap: boolean; // the small map on the screen
  enemyCount: number; // how many bots fight you (1-3); used when a duel starts
  sound: boolean; // sound effects on / off (M on a computer)
  volume: number; // 0..1
  screenShake: boolean; // shake the view when your ship is hit or fires
}

/** Read-only numbers shown in the panel. The scene fills them in. */
export interface TuningInfo {
  pixelScale: string;
  view: string;
  zoomNow: string;
}

export interface TuningCallbacks {
  onLogicalHeight: (height: number) => void;
  onSpeedScale: (scale: number) => void;
  /** Put the target on your starboard beam at this distance (metres). */
  onPlaceTarget: (distance: number) => void;
  /** The target class was changed: swap the ship, keep its place. */
  onTargetClass: () => void;
  /** The wind sliders moved. */
  onWind: (fromBearingDeg: number, strength: number) => void;
  onWindDrift: (on: boolean) => void;
  /** The circle radius changed: start a new circle from where the target is now. */
  onTargetCircle: () => void;
  /** The target behaviour changed (moored / circle / bot). */
  onTargetBehaviour: () => void;
  /** Start the duel again: a new world, both ships repaired. */
  onRestart: () => void;
  /** Put the target `distance` metres to windward of you (the bot comes down on you at once). */
  onPlaceUpwind: (distance: number) => void;
  /** Start counting your hits again. */
  onResetHits: () => void;
}

/**
 * The lil-gui panel for the scale test (top right). Drag a slider, see the result at once.
 * It is a tool for us, not part of the game; it will be hidden in the release build later.
 */
export class TuningPanel {
  readonly values: TuningValues;
  readonly info: TuningInfo = { pixelScale: '', view: '', zoomNow: '' };
  private readonly gui: GUI;
  private readonly zoomController;
  private readonly debugController;
  private readonly soundController;

  constructor(start: TuningValues, callbacks: TuningCallbacks, startClosed: boolean) {
    this.values = { ...start };
    const v = this.values;
    this.gui = new GUI({ title: 'Tuning' });
    if (startClosed) {
      // Touch screens: when closed, the panel is a small gear button in the corner, so it covers
      // nothing; opened, it is the full panel (it scrolls when it is taller than the screen).
      const root = this.gui;
      const fit = (): void => {
        const closed = root._closed;
        root.title(closed ? '\u2699' : 'Tuning');
        root.domElement.style.setProperty('--width', closed ? '44px' : '245px');
      };
      root.onOpenClose((changed) => {
        if (changed === root) fit();
      });
      root.close();
      fit();
    }

    const view = this.gui.addFolder('View');
    view.add(v, 'pixelsPerMetre', 0.5, 3, 0.5).name('pixels / metre');
    this.zoomController = view.add(v, 'zoom', 1, 4, 1).name('zoom (sailing)');
    view
      .add(v, 'logicalHeight', 160, 480, 20)
      .name('logical height')
      .onFinishChange((h: number) => callbacks.onLogicalHeight(h));
    view.add(v, 'combatCamera').name('combat camera');
    view.add(v, 'autoZoom').name('auto combat zoom');
    view.add(v, 'closeFightRange', 60, 250, 10).name('close fight (m)');
    view.add(v, 'rangeRings').name('range rings');
    this.debugController = view.add(v, 'debugText').name('debug text (H)');
    view.add(v, 'minimap').name('minimap');

    const fx = this.gui.addFolder('Sound & effects');
    this.soundController = fx.add(v, 'sound').name('sound (M)');
    fx.add(v, 'volume', 0, 1, 0.05).name('volume');
    fx.add(v, 'screenShake').name('screen shake');
    view.add(this.info, 'pixelScale').name('pixel scale').listen().disable();
    view.add(this.info, 'view').name('view (m)').listen().disable();
    view.add(this.info, 'zoomNow').name('zoom now').listen().disable();

    const art = this.gui.addFolder('Art (test)');
    art.add(v, 'shipArt', { boxes: 0, '16 directions': 16, '32 directions': 32 }).name('ships');
    art.add(v, 'detailAtZoom').name('detail at zoom x2');

    const wind = this.gui.addFolder('Wind');
    const windChanged = (): void => callbacks.onWind(v.windFromBearingDeg, v.windStrength);
    wind.add(v, 'windFromBearingDeg', 0, 359, 1).name('from (base, deg)').onChange(windChanged);
    wind.add(v, 'windStrength', 0, 1, 0.05).name('strength').onChange(windChanged);
    wind.add(v, 'windDrift').name('drift').onChange((on: boolean) => callbacks.onWindDrift(on));

    const sailing = this.gui.addFolder('Sailing');
    sailing
      .add(v, 'speedScale', 0.5, 2, 0.1)
      .name('speed scale')
      .onChange((s: number) => callbacks.onSpeedScale(s));

    const target = this.gui.addFolder('Target');
    target
      .add(v, 'targetBehaviour', { 'bot (fights you)': 'bot', 'circle (slow)': 'circle', moored: 'moored' })
      .name('behaviour')
      .onChange(() => callbacks.onTargetBehaviour());
    target.add(v, 'enemyCount', 1, 3, 1).name('bots (next battle)');
    target.add({ restart: () => callbacks.onRestart() }, 'restart').name('restart battle');
    target
      .add(v, 'targetClass', Object.keys(SHIP_CLASSES))
      .name('class')
      .onChange(() => callbacks.onTargetClass());
    const place = {
      at100: () => callbacks.onPlaceTarget(100),
      at150: () => callbacks.onPlaceTarget(150),
      at200: () => callbacks.onPlaceTarget(200),
      at400: () => callbacks.onPlaceTarget(400),
      upwind: () => callbacks.onPlaceUpwind(400),
    };
    target.add(place, 'at100').name('put at 100 m');
    target.add(place, 'at150').name('put at 150 m');
    target.add(place, 'at200').name('put at 200 m');
    target.add(place, 'at400').name('put at 400 m');
    target.add(place, 'upwind').name('put 400 m upwind');
    target.add(v, 'targetSailsPercent', 0, 100, 5).name('circle sails %');
    target
      .add(v, 'targetCircleRadius', 60, 400, 10)
      .name('circle radius (m)')
      .onFinishChange(() => callbacks.onTargetCircle());

    // Accuracy (plan 4.4): these change the numbers from guns.json while the game runs.
    // Write the values you like back into guns.json; tools/hit_table.py shows what they mean.
    const accuracy = this.gui.addFolder('Accuracy');
    accuracy.add(GUNS, 'gunSigmaDeg', 0, 4, 0.1).name('gun sigma (deg)');
    accuracy.add(GUNS, 'salvoSigmaDeg', 0, 3, 0.1).name('salvo sigma (deg)');
    accuracy.add({ reset: () => callbacks.onResetHits() }, 'reset').name('reset hit count');

    // After any change, give the keyboard back to the game. Otherwise a focused
    // drop-down list or number box keeps the keys, and W A S D stop steering the ship.
    this.gui.onFinishChange(() => releaseFocus());
    // Buttons and check boxes report no "finished change", so also release after a click on them.
    // Boxes you type in (numbers) and drop-down lists keep the focus while you use them.
    this.gui.domElement.addEventListener('click', (event) => {
      const el = event.target;
      const typing = el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type !== 'checkbox');
      if (!typing) releaseFocus();
    });

    if (startClosed) this.gui.close();
  }

  /** Width of the open panel in CSS pixels (0 when closed), so the minimap can step aside. */
  openWidthCss(): number {
    return this.gui._closed ? 0 : this.gui.domElement.offsetWidth;
  }

  /** The M key switches the sound; keep the check box in step. */
  toggleSound(): void {
    this.values.sound = !this.values.sound;
    this.soundController.updateDisplay();
  }

  /** The H key switches the debug text; keep the check box in step. */
  toggleDebugText(): void {
    this.values.debugText = !this.values.debugText;
    this.debugController.updateDisplay();
  }

  /** The keys and the zoom button change the zoom too; keep the slider in step. */
  setZoom(zoom: number): void {
    this.values.zoom = zoom;
    this.zoomController.updateDisplay();
  }
}

/** Take the keyboard focus away from any panel control (input, select, button). */
export function releaseFocus(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el !== document.body) el.blur();
}
