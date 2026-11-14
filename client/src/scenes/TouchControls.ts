import Phaser from 'phaser';
import { TEXT_RESOLUTION } from './text';

const MARGIN = 10;

interface Button {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** Where the button goes for a screen of this size (its centre) and how big it is. */
  place: (width: number, height: number, size: number) => { x: number; y: number };
  small: boolean;
}

/**
 * On-screen buttons for phones and tablets:
 * "<" and ">" for the rudder (held), "-" and "+" for the sails (one step per tap),
 * and a small zoom button at the top. They only report what the finger does;
 * SeaScene turns it into commands. `layout()` moves them when the screen size changes.
 */
export class TouchControls {
  /** True while the finger is on the button. */
  left = false;
  right = false;
  private readonly buttons: Button[] = [];
  private zoomButton: Button | null = null;

  constructor(scene: Phaser.Scene, onSails: (direction: 1 | -1) => void, onZoom: () => void) {
    scene.input.addPointer(2); // allow up to 3 fingers at once (rudder + sails)

    const bottom = (h: number, size: number): number => h - MARGIN - size / 2;
    this.add(scene, '<', (_w, h, s) => ({ x: MARGIN + s / 2, y: bottom(h, s) }), (down) => (this.left = down), undefined);
    this.add(scene, '>', (_w, h, s) => ({ x: MARGIN * 2 + s * 1.5, y: bottom(h, s) }), (down) => (this.right = down), undefined);
    this.add(scene, '-', (w, h, s) => ({ x: w - MARGIN * 2 - s * 1.5, y: bottom(h, s) }), undefined, () => onSails(-1));
    this.add(scene, '+', (w, h, s) => ({ x: w - MARGIN - s / 2, y: bottom(h, s) }), undefined, () => onSails(1));
    // The zoom button sits right of the HUD panel (the panel is 118 px wide at x = 8).
    this.zoomButton = this.add(scene, 'x1', (_w, _h, s) => ({ x: 134 + s / 2, y: 8 + s / 2 }), undefined, onZoom, true);
  }

  /** Put the buttons in place for a screen of this logical size. */
  layout(width: number, height: number): void {
    const size = Math.round(Math.min(52, height * 0.2));
    for (const b of this.buttons) {
      const s = b.small ? Math.round(size * 0.75) : size;
      const { x, y } = b.place(width, height, s);
      b.box.setPosition(x, y).setSize(s, s);
      b.box.input?.hitArea.setTo(0, 0, s, s);
      b.label.setPosition(x, y);
    }
  }

  /** Show the zoom step on the zoom button, e.g. "x2". */
  setZoomLabel(zoom: number): void {
    this.zoomButton?.label.setText(`x${zoom}`);
  }

  private add(
    scene: Phaser.Scene,
    text: string,
    place: Button['place'],
    onHold: ((down: boolean) => void) | undefined,
    onTap: (() => void) | undefined,
    small = false,
  ): Button {
    const box = scene.add
      .rectangle(0, 0, 40, 40, 0xffffff, 0.22)
      .setStrokeStyle(1, 0xffffff, 0.6)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive();
    const label = scene.add
      .text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize: small ? '16px' : '28px',
        color: '#ffffff',
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101);

    box.on('pointerdown', () => {
      box.setFillStyle(0xffffff, 0.45);
      onHold?.(true);
      onTap?.();
    });
    const release = (): void => {
      box.setFillStyle(0xffffff, 0.22);
      onHold?.(false);
    };
    box.on('pointerup', release);
    box.on('pointerout', release);
    box.on('pointerupoutside', release);

    const button: Button = { box, label, place, small };
    this.buttons.push(button);
    return button;
  }
}
