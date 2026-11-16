import Phaser from 'phaser';

const W = 160; // the ring is drawn small, in big pixels, then stretched over the screen
const H = 100;

/**
 * Looking through the spyglass: the view zooms out (SeaScene) and the edge of the screen
 * goes dark in a soft round ring, as if seen through a telescope. A picture only.
 */
export class Spyglass {
  private readonly ring: Phaser.GameObjects.Image;
  private shown = 0; // 0 = off, 1 = fully on (fades in and out)

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists('spyglass-ring')) {
      // Dark outside an ellipse, in four steps of darkness (pixel art, no smooth gradient).
      const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const r = Math.hypot((x + 0.5 - W / 2) / (W * 0.47), (y + 0.5 - H / 2) / (H * 0.47));
          const step = r < 0.86 ? 0 : r < 0.93 ? 1 : r < 1 ? 2 : 3;
          if (step === 0) continue;
          g.fillStyle(0x05070a, [0, 0.25, 0.55, 0.85][step] ?? 0.85);
          g.fillRect(x, y, 1, 1);
        }
      }
      g.generateTexture('spyglass-ring', W, H);
      g.destroy();
    }
    // Depth 95: above the sea, ships and fog, below the HUD (100+).
    this.ring = scene.add.image(0, 0, 'spyglass-ring').setOrigin(0, 0).setScrollFactor(0).setDepth(95).setAlpha(0);
  }

  update(on: boolean, seconds: number, width: number, height: number): void {
    this.shown += ((on ? 1 : 0) - this.shown) * Math.min(1, seconds * 6);
    this.ring.setAlpha(this.shown).setVisible(this.shown > 0.01).setScale(width / W, height / H);
  }
}
