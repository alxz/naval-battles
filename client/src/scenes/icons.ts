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
 *   icon-spyglass  a brass spyglass                                   (look far: the view zooms out for a while)
 *   icon-autozoom-on / -off  a magnifying glass with an "A" (the combat zoom is on) or crossed out (off)
 */
export function makeHudIcons(scene: Phaser.Scene): void {
  drawGun(scene, 'icon-gun-up', -35);
  drawGun(scene, 'icon-gun-down', 12);
  drawSpeaker(scene, 'icon-sound-on', true);
  drawSpeaker(scene, 'icon-sound-off', false);
  drawChart(scene, 'icon-chart');
  drawSpyglass(scene, 'icon-spyglass');
  drawAutoZoom(scene, 'icon-autozoom-on', true);
  drawAutoZoom(scene, 'icon-autozoom-off', false);
}

/** A magnifying glass; "A" in the lens when the automatic combat zoom is on, a red slash when it is off. */
function drawAutoZoom(scene: Phaser.Scene, key: string, on: boolean): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
  g.fillStyle(DARK, 1);
  g.fillCircle(6.5, 6.5, 6.5);
  for (let t = 0; t < 5; t++) g.fillRect(10 + t, 10 + t, 3, 3); // the handle, dark outline
  g.fillStyle(0xbfe3ff, 1);
  g.fillCircle(6.5, 6.5, 4.5);
  g.fillStyle(WOOD, 1);
  for (let t = 0; t < 4; t++) g.fillRect(11 + t, 11 + t, 2, 2);
  if (on) {
    g.fillStyle(DARK, 1); // a small "A"
    g.fillRect(6, 3, 2, 1);
    g.fillRect(5, 4, 1, 6);
    g.fillRect(8, 4, 1, 6);
    g.fillRect(5, 7, 4, 1);
  } else {
    g.fillStyle(0xe0533d, 1);
    for (let i = 0; i < 9; i++) g.fillRect(2 + i, 10 - i, 2, 2);
  }
  g.generateTexture(key, ICON_SIZE, ICON_SIZE);
  g.destroy();
}

/** A spyglass lying from bottom left to top right: three brass sections, a dark eyepiece, a lit lens. */
function drawSpyglass(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
  const sections: [number, number, number][] = [
    [2, 13, 2], // eyepiece end: thin
    [6, 9, 3],
    [10, 5, 4], // objective end: thick
  ];
  for (const [x, y, r] of sections) {
    for (let t = 0; t < 4; t++) {
      g.fillStyle(DARK, 1);
      g.fillRect(x + t - r / 2 - 1, y - t - r / 2 - 1, r + 2, r + 2);
    }
  }
  for (const [x, y, r] of sections) {
    for (let t = 0; t < 4; t++) {
      g.fillStyle(t < 2 ? 0xd9a441 : 0xb07d2a, 1);
      g.fillRect(x + t - r / 2, y - t - r / 2, r, r);
    }
  }
  g.fillStyle(0x3a2a18, 1);
  g.fillRect(1, 14, 2, 2); // eyepiece
  g.fillStyle(0xbfe3ff, 1);
  g.fillRect(13, 1, 2, 2); // the lens catches the light
  g.generateTexture(key, ICON_SIZE, ICON_SIZE);
  g.destroy();
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
