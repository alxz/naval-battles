import Phaser from 'phaser';
import { touchButtonRects } from '../view/hudLayout';
import type { ButtonName } from '../view/hudLayout';
import { ICON_SIZE } from './icons';
import { paint, textStyle } from './text';

interface Button {
  name: ButtonName;
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  small: boolean;
}

/**
 * On-screen buttons for phones and tablets (places: `touchButtonRects` in view/hudLayout.ts):
 *   left:  "<" ">" rudder (held); "L" "R" fire the port / starboard broadside (one tap = one salvo),
 *          "B" between them the bow chaser (M3 step 7c);
 *          they also show the reload (see setReload)
 *   right: "-" "+" sails (one step per tap); above "+" the gun up / gun down icons (held)
 *   top:   a small spyglass button (look far for a while) and a pause button "II" (M3 step 7c)
 * They only report what the finger does; SeaScene turns it into commands.
 */
/** Alpha of the words and icons on the touch buttons. */
const LABEL_ALPHA = 0.55;

export class TouchControls {
  /** True while the finger is on the button. */
  left = false;
  right = false;
  raise = false;
  lower = false;
  private readonly buttons: Button[] = [];
  private spyglass: Button | null = null;
  private pause: Button | null = null;

  constructor(
    scene: Phaser.Scene,
    onSails: (direction: 1 | -1) => void,
    onZoom: () => void,
    onFire: (side: 'port' | 'starboard' | 'bow') => void,
    onAmmo: () => void,
    onPause: () => void,
  ) {
    scene.input.addPointer(2); // allow up to 3 fingers at once (rudder + sails + guns)

    this.add(scene, 'rudderLeft', '<', (down) => (this.left = down));
    this.add(scene, 'rudderRight', '>', (down) => (this.right = down));
    this.add(scene, 'firePort', 'L', undefined, () => onFire('port'));
    this.add(scene, 'fireBow', 'B', undefined, () => onFire('bow')); // M3 step 7c: the bow chaser, between L and R
    this.add(scene, 'fireStarboard', 'R', undefined, () => onFire('starboard'));
    this.add(scene, 'sailsLess', '-', undefined, () => onSails(-1));
    this.add(scene, 'sailsMore', '+', undefined, () => onSails(1));
    this.add(scene, 'gunsUp', 'icon-gun-up', (down) => (this.raise = down));
    this.add(scene, 'gunsDown', 'icon-gun-down', (down) => (this.lower = down));
    // Above "L": the kind of shot; each tap loads the next kind (round, chain, grape).
    this.add(scene, 'ammo', 'RND', undefined, onAmmo, true);
    // The button at the top ("zoom" in the layout) is the spyglass: tap to look far for a while.
    this.spyglass = this.add(scene, 'zoom', 'icon-spyglass', undefined, onZoom, true);
    // M3 step 7c: pause (the ESC key on a computer); also in the arena.
    this.pause = this.add(scene, 'pause', 'II', undefined, onPause, true);
  }

  /** Show or hide the ship buttons (the auto-bot arena has no ship of yours; the spyglass stays). */
  setShipButtonsVisible(on: boolean): void {
    for (const b of this.buttons) {
      if (b === this.spyglass || b === this.pause) continue;
      b.box.setVisible(on);
      b.label.setVisible(on);
      if (on) b.box.setInteractive();
      else b.box.disableInteractive();
    }
    if (!on) {
      this.left = this.right = this.raise = this.lower = false;
    }
  }

  /** Put the buttons in place for a screen of this logical size. */
  layout(width: number, height: number): void {
    const rects = touchButtonRects(width, height);
    for (const b of this.buttons) {
      const r = rects[b.name];
      const x = r.x + r.w / 2;
      const y = r.y + r.h / 2;
      b.box.setPosition(x, y).setSize(r.w, r.h);
      b.box.input?.hitArea.setTo(0, 0, r.w, r.h);
      b.label.setPosition(x, y);
      // Icons: as big as fits in whole steps (pixel art stays sharp), at least x1.
      if (b.label instanceof Phaser.GameObjects.Image) b.label.setScale(Math.max(1, Math.floor((r.w * 0.8) / ICON_SIZE)));
    }
  }

  /**
   * The fire buttons show the guns of their side: a yellow letter when loaded; while reloading
   * the button is dark and counts the seconds down.
   */
  setReload(portSeconds: number, starboardSeconds: number, bowSeconds = 0): void {
    for (const [name, letter, left] of [
      ['firePort', 'L', portSeconds],
      ['fireBow', 'B', bowSeconds],
      ['fireStarboard', 'R', starboardSeconds],
    ] as const) {
      const b = this.buttons.find((x) => x.name === name);
      if (!b || !(b.label instanceof Phaser.GameObjects.Text)) continue;
      const ready = left <= 0;
      const text = ready ? letter : String(Math.ceil(left));
      if (b.label.text !== text) b.label.setText(text);
      paint(b.label, b.label.text, ready ? '#ffe066' : '#b8c4cc');
      b.box.setStrokeStyle(1, ready ? 0xffe066 : 0xffffff, ready ? 0.9 : 0.35);
      if (!ready) b.box.setFillStyle(0x000000, 0.3);
      else if (b.box.fillColor === 0x000000) b.box.setFillStyle(0xffffff, 0.22);
    }
  }

  /** The ammunition button shows the loaded kind and what is left of it ("CHN 5"). */
  setAmmo(label: string): void {
    const b = this.buttons.find((x) => x.name === 'ammo');
    if (b && b.label instanceof Phaser.GameObjects.Text && b.label.text !== label) b.label.setText(label);
  }

  /** The spyglass button is lit (yellow frame) while you look through it. */
  setSpyglass(on: boolean): void {
    this.spyglass?.box.setStrokeStyle(1, on ? 0xffe066 : 0xffffff, on ? 1 : 0.6);
  }

  /** `text` is a label, or the key of an icon texture when it starts with "icon-". */
  private add(
    scene: Phaser.Scene,
    name: ButtonName,
    text: string,
    onHold: ((down: boolean) => void) | undefined,
    onTap?: () => void,
    small = false,
  ): Button {
    const box = scene.add
      .rectangle(0, 0, 40, 40, 0xffffff, 0.22)
      .setStrokeStyle(1, 0xffffff, 0.6)
      .setScrollFactor(0)
      .setDepth(110)
      .setInteractive();
    const label = text.startsWith('icon-')
      ? scene.add.image(0, 0, text).setScrollFactor(0).setDepth(111)
      : scene.add
          .text(0, 0, text, textStyle(small ? 'main' : 'huge'))
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(111);

    label.setAlpha(LABEL_ALPHA); // M3 step 7e: the labels are fainter, so they hide less of the sea
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

    const button: Button = { name, box, label, small };
    this.buttons.push(button);
    return button;
  }
}
