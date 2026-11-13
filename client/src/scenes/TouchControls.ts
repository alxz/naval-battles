import Phaser from 'phaser';

const BUTTON_SIZE = 52; // logical pixels (the game is 640x360)
const MARGIN = 10;

/**
 * Four on-screen buttons for phones and tablets:
 * "<" and ">" for the rudder (held), "-" and "+" for the sails (one step per tap).
 * They only report what the finger does; SeaScene turns it into commands.
 */
export class TouchControls {
  /** True while the finger is on the button. */
  left = false;
  right = false;

  constructor(scene: Phaser.Scene, onSails: (direction: 1 | -1) => void) {
    scene.input.addPointer(2); // allow up to 3 fingers at once (rudder + sails)

    const y = 360 - MARGIN - BUTTON_SIZE / 2;
    const leftX = MARGIN + BUTTON_SIZE / 2;
    const rightX = leftX + BUTTON_SIZE + MARGIN;
    const plusX = 640 - MARGIN - BUTTON_SIZE / 2;
    const minusX = plusX - BUTTON_SIZE - MARGIN;

    this.makeButton(scene, leftX, y, '<', (down) => (this.left = down), undefined);
    this.makeButton(scene, rightX, y, '>', (down) => (this.right = down), undefined);
    this.makeButton(scene, minusX, y, '-', undefined, () => onSails(-1));
    this.makeButton(scene, plusX, y, '+', undefined, () => onSails(1));
  }

  private makeButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    onHold: ((down: boolean) => void) | undefined,
    onTap: (() => void) | undefined,
  ): void {
    const box = scene.add
      .rectangle(x, y, BUTTON_SIZE, BUTTON_SIZE, 0xffffff, 0.22)
      .setStrokeStyle(1, 0xffffff, 0.6)
      .setScrollFactor(0)
      .setDepth(100)
      .setInteractive();
    scene.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '28px', color: '#ffffff', resolution: 3 })
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
  }
}
