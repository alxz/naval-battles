import Phaser from 'phaser';

/** Size of the small HUD icons in logical pixels. Shown at x1 on a computer, x2 on touch buttons. */
export const ICON_SIZE = 16;

const DARK = 0x1b1b1b;
const IRON = 0x5d646b;
const IRON_LIGHT = 0x9aa3ab;
const WOOD = 0x8a5a2b;
const ARROW = 0xffe066;

/**
 * Draw the HUD icons once into textures (plain pixels, no text in between; see the
 * note about Text after Graphics in RangeRings.ts):
 *   icon-gun-up    a gun on its carriage, barrel raised, arrow up    (raise the guns)
 *   icon-gun-down  the same gun, barrel lowered, arrow down          (lower the guns)
 */
export function makeHudIcons(scene: Phaser.Scene): void {
  drawGun(scene, 'icon-gun-up', -35);
  drawGun(scene, 'icon-gun-down', 12);
}

/** One gun icon. `barrelDeg`: barrel angle on screen, negative = muzzle up. */
function drawGun(scene: Phaser.Scene, key: string, barrelDeg: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
  const up = barrelDeg < 0;

  // Barrel: a thick line of 2x2 pixels from the breech (on the carriage) to the muzzle.
  const bx = 3;
  const by = 10;
  const a = (barrelDeg * Math.PI) / 180;
  const length = 9;
  for (let t = 0; t <= length; t += 0.5) {
    const x = Math.round(bx + Math.cos(a) * t);
    const y = Math.round(by + Math.sin(a) * t);
    g.fillStyle(DARK, 1);
    g.fillRect(x - 1, y - 1, 3, 3);
  }
  for (let t = 0; t <= length; t += 0.5) {
    const x = Math.round(bx + Math.cos(a) * t);
    const y = Math.round(by + Math.sin(a) * t);
    g.fillStyle(t > length - 1.5 ? IRON_LIGHT : IRON, 1);
    g.fillRect(x, y - 1, 1, 2);
  }

  // Carriage and two wheels.
  g.fillStyle(DARK, 1);
  g.fillRect(0, 10, 9, 4);
  g.fillStyle(WOOD, 1);
  g.fillRect(1, 11, 7, 2);
  g.fillStyle(DARK, 1);
  g.fillRect(1, 13, 3, 3);
  g.fillRect(5, 13, 3, 3);

  // Arrow at the right: up or down.
  g.fillStyle(ARROW, 1);
  const ax = 13;
  if (up) {
    g.fillRect(ax - 2, 3, 5, 1);
    g.fillRect(ax - 1, 2, 3, 1);
    g.fillRect(ax, 1, 1, 1);
    g.fillRect(ax - 3, 4, 7, 1);
    g.fillRect(ax - 1, 5, 3, 5);
  } else {
    g.fillRect(ax - 1, 6, 3, 5);
    g.fillRect(ax - 3, 11, 7, 1);
    g.fillRect(ax - 2, 12, 5, 1);
    g.fillRect(ax - 1, 13, 3, 1);
    g.fillRect(ax, 14, 1, 1);
  }

  g.generateTexture(key, ICON_SIZE, ICON_SIZE);
  g.destroy();
}
