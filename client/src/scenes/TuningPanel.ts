import GUI from 'lil-gui';
import { GUNS, SHIP_CLASSES } from '../sim/data';

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
  targetMoving: boolean; // the target sails slowly in a circle
  targetSailsPercent: number; // its sail setting while moving
  targetCircleRadius: number; // metres
  windFromBearingDeg: number; // compass degrees, where the wind comes from
  windStrength: number; // 0..1
  windDrift: boolean;
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

  constructor(start: TuningValues, callbacks: TuningCallbacks, startClosed: boolean) {
    this.values = { ...start };
    const v = this.values;
    this.gui = new GUI({ title: 'Tuning' });

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
      .add(v, 'targetClass', Object.keys(SHIP_CLASSES))
      .name('class')
      .onChange(() => callbacks.onTargetClass());
    const place = {
      at100: () => callbacks.onPlaceTarget(100),
      at150: () => callbacks.onPlaceTarget(150),
      at200: () => callbacks.onPlaceTarget(200),
      at400: () => callbacks.onPlaceTarget(400),
    };
    target.add(place, 'at100').name('put at 100 m');
    target.add(place, 'at150').name('put at 150 m');
    target.add(place, 'at200').name('put at 200 m');
    target.add(place, 'at400').name('put at 400 m');
    target.add(v, 'targetMoving').name('moving (circle)');
    target.add(v, 'targetSailsPercent', 0, 100, 5).name('sails %');
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
