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
 *   icon-sound-on  a speaker with sound waves                         (sound is on; tap to mute)
 *   icon-sound-off the speaker with a red cross                       (sound is off)
 *   icon-chart     a folded sea chart with an island and a red cross  (open the chart)
 */
export function makeHudIcons(scene: Phaser.Scene): void {
  drawGun(scene, 'icon-gun-up', -35);
  drawGun(scene, 'icon-gun-down', 12);
  drawSpeaker(scene, 'icon-sound-on', true);
  drawSpeaker(scene, 'icon-sound-off', false);
  drawChart(scene, 'icon-chart');
}

/** A small sea chart: parchment, an island, a dotted course and a red cross. */
function drawChart(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
  g.fillStyle(DARK, 1);
  g.fillRect(1, 2, 14, 12);
  g.fillStyle(0xe6d5a8, 1);
  g.fillRect(2, 3, 12, 10);
  g.fillStyle(0xcdb98a, 1); // two fold lines
  g.fillRect(6, 3, 1, 10);
  g.fillRect(10, 3, 1, 10);
  g.fillStyle(0x5f9e4b, 1); // an island
  g.fillRect(3, 5, 3, 2);
  g.fillRect(4, 7, 2, 1);
  g.fillStyle(0x5a4326, 1); // a dotted course
  g.fillRect(7, 9, 1, 1);
  g.fillRect(9, 8, 1, 1);
  g.fillRect(11, 7, 1, 1);
  g.fillStyle(0xe0533d, 1); // the cross
  g.fillRect(11, 10, 1, 1);
  g.fillRect(13, 10, 1, 1);
  g.fillRect(12, 11, 1, 1);
  g.fillRect(11, 12, 1, 1);
  g.fillRect(13, 12, 1, 1);
  g.generateTexture(key, ICON_SIZE, ICON_SIZE);
  g.destroy();
}

/** A speaker; with two waves when the sound is on, with a red cross when it is off. */
function drawSpeaker(scene: Phaser.Scene, key: string, on: boolean): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
  const white = 0xffffff;
  g.fillStyle(DARK, 1);
  g.fillRect(1, 5, 5, 7);
  g.fillTriangle(4, 8, 10, 1, 10, 15);
  g.fillStyle(white, 1);
  g.fillRect(2, 6, 3, 5);
  g.fillTriangle(5, 8, 9, 3, 9, 13);
  if (on) {
    g.fillStyle(white, 1);
    g.fillRect(12, 6, 1, 5);
    g.fillRect(14, 4, 1, 9);
    g.fillRect(13, 5, 1, 1);
    g.fillRect(13, 11, 1, 1);
  } else {
    g.fillStyle(0xe0533d, 1);
    for (let i = 0; i < 5; i++) {
      g.fillRect(11 + i, 5 + i, 1, 1);
      g.fillRect(11 + i, 9 - i, 1, 1);
    }
  }
  g.generateTexture(key, ICON_SIZE, ICON_SIZE);
  g.destroy();
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
