import Phaser from 'phaser';
import viewJson from '../data/view.json';
import { isPhoneScreen, pixelLayout } from '../view/pixelLayout';
import type { PixelLayout } from '../view/pixelLayout';

/**
 * Keeps the canvas at integer pixel scaling (plan D27).
 * It measures the window, chooses a whole pixel scale near the target height,
 * resizes the game to that logical size and tells the scene through `onChange`.
 */
export class ScreenFit {
  readonly isPhone: boolean;
  targetHeight: number;
  layout: PixelLayout;
  private readonly scale: Phaser.Scale.ScaleManager;
  private readonly onChange: (layout: PixelLayout) => void;

  constructor(scene: Phaser.Scene, onChange: (layout: PixelLayout) => void) {
    this.scale = scene.scale;
    this.onChange = onChange;
    const touch = scene.sys.game.device.input.touch;
    this.isPhone = isPhoneScreen(window.innerWidth, window.innerHeight, touch, viewJson.phoneMaxShortSide);
    this.targetHeight = this.isPhone ? viewJson.logicalHeightPhone : viewJson.logicalHeightComputer;
    this.layout = this.measure();

    window.addEventListener('resize', () => this.apply());
    // Turning a phone: the new size is ready only a moment later.
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.apply(), 300));
  }

  /** Measure the window again and resize the game. */
  apply(): void {
    this.layout = this.measure();
    this.scale.setZoom(this.layout.cssZoom);
    this.scale.resize(this.layout.width, this.layout.height);
    this.onChange(this.layout);
  }

  setTargetHeight(height: number): void {
    this.targetHeight = height;
    this.apply();
  }

  private measure(): PixelLayout {
    return pixelLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, this.targetHeight);
  }
}
