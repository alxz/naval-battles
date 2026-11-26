import Phaser from 'phaser';
import { assetUrl } from '../assets';
import artJson from '../data/shipArt.json';
import { SHIP_CLASSES } from '../sim/data';
import { directionFrame } from '../view/shipFrame';

/** Hull colours of the plain placeholder boxes: your ship brown, the target dark red. */
export const PLAYER_HULL = 0x8b5a2b;
export const TARGET_HULL = 0x7a2626;

export type Owner = 'player' | 'enemy';
/** 0 = plain boxes; 16 or 32 = pre-rendered pictures in that many directions. */
export type ArtChoice = 0 | 16 | 32;

const MASTS: Record<string, number> = { sloop: 1, brigantine: 2, caravel: 3, fluyt: 3, frigate: 3 };

/** Frame size (pixels at detail 1) of a class's pictures; big ships have bigger frames. */
function frameSize(shipClass: string): number {
  const frames: Record<string, number> = artJson.frames ?? {};
  return frames[shipClass] ?? artJson.frame;
}

function sheetKey(shipClass: string, owner: Owner, directions: number, detail: number): string {
  return `${shipClass}_${owner}_${directions}_${detail}x`;
}

function sailsKey(shipClass: string, directions: number, detail: number): string {
  return `${shipClass}_sails_${directions}_${detail}x`;
}

function boxKey(shipClass: string, owner: Owner): string {
  return `box-${shipClass}-${owner}`;
}

/** Call from the scene's preload(): loads every sprite sheet listed in data/shipArt.json. */
export function loadShipSheets(scene: Phaser.Scene): void {
  for (const shipClass of artJson.classes) {
    for (const owner of artJson.owners) {
      for (const directions of artJson.directions) {
        for (const detail of artJson.details) {
          const key = sheetKey(shipClass, owner as Owner, directions, detail);
          const size = frameSize(shipClass) * detail;
          scene.load.spritesheet(key, assetUrl(`assets/ships/${key}.png`), { frameWidth: size, frameHeight: size });
        }
      }
    }
    // D78: the cloth alone (white), laid over the hull picture and coloured with setTint.
    if (!('sails' in artJson) || !artJson.sails) continue;
    for (const directions of artJson.directions) {
      for (const detail of artJson.details) {
        const key = sailsKey(shipClass, directions, detail);
        const size = frameSize(shipClass) * detail;
        scene.load.spritesheet(key, assetUrl(`assets/ships/${key}.png`), { frameWidth: size, frameHeight: size });
      }
    }
  }
}

/**
 * Draws a plain top view for every ship class and owner, at 1 pixel per game metre
 * (a 30 m sloop is 30 x 10 pixels). Used for classes without pictures yet and for "boxes" in the panel.
 */
export function makeShipTextures(scene: Phaser.Scene): void {
  for (const [id, p] of Object.entries(SHIP_CLASSES)) {
    for (const [owner, hull] of [['player', PLAYER_HULL], ['enemy', TARGET_HULL]] as [Owner, number][]) {
      const key = boxKey(id, owner);
      if (scene.textures.exists(key)) continue;
      const L = p.length;
      const B = p.beam;
      const g = scene.make.graphics(new Phaser.Math.Vector2(0, 0), false);
      g.fillStyle(hull, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(0, 1),
          new Phaser.Math.Vector2(L * 0.67, 0),
          new Phaser.Math.Vector2(L, B / 2),
          new Phaser.Math.Vector2(L * 0.67, B),
          new Phaser.Math.Vector2(0, B - 1),
        ],
        true,
      );
      // Sails: one light bar per mast, spread along the hull.
      const masts = MASTS[id] ?? 1;
      g.fillStyle(0xf2e8c9, 1);
      for (let i = 0; i < masts; i++) {
        const x = Math.round((L * (i + 1)) / (masts + 1)) - 2;
        g.fillRect(x, 2, 3, B - 4);
      }
      g.generateTexture(key, L, B);
      g.destroy();
    }
  }
}

/**
 * Show a ship: the right picture, size and place for its heading.
 *  - Pictures (16 or 32 directions): the image is NOT turned; we choose the frame that was
 *    drawn for the nearest direction. At zoom x2 the sheet with double detail is used at its
 *    own size, so every picture pixel stays one clean block of screen pixels.
 *  - Boxes, or a class without pictures: one top view, turned to the heading.
 * x, y in game metres; s = screen pixels per metre.
 */
export function showShip(
  image: Phaser.GameObjects.Image,
  shipClass: string,
  owner: Owner,
  art: ArtChoice,
  detailAtZoom: boolean,
  x: number,
  y: number,
  headingRad: number,
  s: number,
): void {
  const hasPictures = art !== 0 && artJson.classes.includes(shipClass) && artJson.directions.includes(art);
  if (!hasPictures) {
    const key = boxKey(shipClass, owner);
    if (image.texture.key !== key) image.setTexture(key);
    image.setOrigin(0.5, 0.5).setRotation(headingRad).setScale(s).setPosition(x * s, y * s);
    return;
  }
  const detail = detailAtZoom && s >= 1.5 && artJson.details.includes(2) ? 2 : 1;
  const key = sheetKey(shipClass, owner, art, detail);
  const frame = directionFrame(headingRad, art);
  if (image.texture.key !== key || image.frame.name !== String(frame)) image.setTexture(key, frame);
  image
    .setOrigin(artJson.anchorX, artJson.anchorY)
    .setRotation(0)
    .setScale(s / detail)
    .setPosition(x * s, y * s);
}

/**
 * D78: puts the cloth layer over a ship's picture, in the same place, size and frame, coloured with `tint`.
 * `flash` = the hit flash: the cloth goes white with the hull. Boxes and classes without cloth sheets: the layer is hidden.
 */
export function showSails(
  sails: Phaser.GameObjects.Image,
  hull: Phaser.GameObjects.Image,
  shipClass: string,
  art: ArtChoice,
  detailAtZoom: boolean,
  s: number,
  tint: number,
  flash: boolean,
): void {
  const hasSails = 'sails' in artJson && artJson.sails === true;
  const hasPictures = art !== 0 && hasSails && artJson.classes.includes(shipClass) && artJson.directions.includes(art);
  if (!hasPictures) {
    sails.setVisible(false);
    return;
  }
  const detail = detailAtZoom && s >= 1.5 && artJson.details.includes(2) ? 2 : 1;
  const key = sailsKey(shipClass, art, detail);
  // The hull image already holds the frame for the heading; the cloth sheet has the same frame layout.
  const frame = hull.frame.name;
  if (sails.texture.key !== key || sails.frame.name !== String(frame)) sails.setTexture(key, frame);
  sails
    .setOrigin(hull.originX, hull.originY)
    .setRotation(hull.rotation)
    .setScale(hull.scaleX, hull.scaleY)
    .setPosition(hull.x, hull.y)
    .setAlpha(hull.alpha)
    .setVisible(hull.visible);
  if (flash) sails.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  else sails.setTint(tint).setTintMode(Phaser.TintModes.MULTIPLY);
}
