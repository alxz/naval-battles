import Phaser from 'phaser';
import { puffPlace } from '../sim/fog';
import type { FogState, WindNow } from '../sim/types';

const ALPHA = 0.3; // one puff; where puffs overlap the fog is thicker
const TEXTURE = 64; // pixels; one puff is drawn this big and then stretched

/**
 * Fog banks ("Open Sea" package C; for the rules since M4b step 5a): the banks themselves live in the world
 * (`world.fog`, sim/fog.ts) and drift there; this only draws them. Long bands (about 1-1.5 km) lying along the
 * wind that half hide ships and islands under them, and shrink every ship's sight (sim/perception.ts).
 * (Math.random is fine here: it only speckles the puff picture.)
 */
export class Fog {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (!scene.textures.exists('fog')) {
      // A soft round puff out of 2 x 2 pixel squares: thick in the middle, dotted at the edge.
      const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
      const half = TEXTURE / 2;
      for (let y = 0; y < TEXTURE; y += 2) {
        for (let x = 0; x < TEXTURE; x += 2) {
          const r = Math.hypot(x + 1 - half, y + 1 - half) / half;
          const thick = (1 - r) * 1.5 + (Math.random() - 0.5) * 0.3;
          if (thick <= 0) continue;
          g.fillStyle(0xe9eef0, Math.min(1, Math.ceil(thick * 4) / 4));
          g.fillRect(x, y, 2, 2);
        }
      }
      g.generateTexture('fog', TEXTURE, TEXTURE);
      g.destroy();
    }
  }

  /** Call every frame: draw the world's banks (none when `fog` is absent or the picture is switched off). */
  update(fog: FogState | undefined, wind: WindNow, pxPerMetre: number, visible: boolean): void {
    let n = 0;
    if (fog && visible) {
      for (const bank of fog.banks) {
        for (const puff of bank.puffs) {
          const at = puffPlace(bank, puff, wind);
          let image = this.images[n];
          if (!image) {
            image = this.scene.add.image(0, 0, 'fog').setDepth(40).setAlpha(ALPHA);
            this.images.push(image);
          }
          image
            .setVisible(true)
            .setPosition(Math.round(at.x * pxPerMetre), Math.round(at.y * pxPerMetre))
            .setScale((puff.size * pxPerMetre) / TEXTURE);
          n++;
        }
      }
    }
    for (let i = n; i < this.images.length; i++) this.images[i]!.setVisible(false);
  }
}
