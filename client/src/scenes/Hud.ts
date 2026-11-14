import Phaser from 'phaser';
import { compassPoint, headingRadToBearingDeg } from '../sim/angles';
import type { SailingInfo } from '../sim/step';
import type { ShipState, Wind } from '../sim/types';
import { TEXT_RESOLUTION } from './text';

const SAIL_PIPS = 4; // the sails go 0, 25, 50, 75, 100 %

/** Extra lines for the scale test: what the screen shows and how far the target is. */
export interface ScaleInfo {
  viewWidthM: number; // metres visible across the screen
  viewHeightM: number;
  pixelScale: number; // device pixels per logical pixel
  logicalWidth: number;
  logicalHeight: number;
  zoom: number;
  targetDistance: number; // metres
}

/**
 * The numbers on the screen.
 *  - On a computer: small text with all the details.
 *  - On a phone or tablet: a big panel with a large speed number and sail pips,
 *    plus one small line with the target distance.
 */
export class Hud {
  private readonly touch: boolean;
  private readonly text: Phaser.GameObjects.Text;
  private readonly speed: Phaser.GameObjects.Text | null = null;
  private readonly unit: Phaser.GameObjects.Text | null = null;
  private readonly gfx: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, touch: boolean) {
    this.touch = touch;

    if (touch) {
      this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(100);
      this.speed = scene.add
        .text(16, 12, '0.0', {
          fontFamily: 'monospace',
          fontSize: '26px',
          fontStyle: 'bold',
          color: '#ffffff',
          resolution: TEXT_RESOLUTION,
        })
        .setScrollFactor(0)
        .setDepth(101);
      this.unit = scene.add
        .text(80, 26, 'm/s', { fontFamily: 'monospace', fontSize: '14px', color: '#cfe6f7', resolution: TEXT_RESOLUTION })
        .setScrollFactor(0)
        .setDepth(101);
      this.text = scene.add
        .text(10, 80, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff', resolution: TEXT_RESOLUTION })
        .setScrollFactor(0)
        .setDepth(101);
    } else {
      this.text = scene.add
        .text(8, 8, '', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', resolution: TEXT_RESOLUTION })
        .setScrollFactor(0)
        .setDepth(100);
    }
  }

  update(ship: ShipState, tick: number, info: ScaleInfo, sailing: SailingInfo, wind: Wind): void {
    const inIrons = sailing.twaDeg < sailing.noGoDeg;
    if (this.touch) {
      this.updateTouch(ship, info, sailing, inIrons);
      return;
    }
    const bearing = headingRadToBearingDeg(ship.headingRad);
    const windFrom = headingRadToBearingDeg(wind.fromRad);
    const deg = (n: number): string => String(Math.round(n) % 360).padStart(3, '0');
    this.text.setText(
      [
        'Naval-Battles M1 - sailing',
        'A / D rudder   W / S sails   Z / X zoom',
        `sails ${Math.round(ship.sailLevel * 100)}%   speed ${ship.speed.toFixed(1)} m/s`,
        `heading ${deg(bearing)} ${compassPoint(bearing)}   tick ${tick}`,
        `wind from ${deg(windFrom)} ${compassPoint(windFrom)}, strength ${wind.strength.toFixed(2)}`,
        `wind angle ${Math.round(sailing.twaDeg)} deg   sail power ${Math.round(sailing.share * 100)}%`,
        inIrons ? 'IN IRONS - turn away from the wind' : '',
        `target ${Math.round(info.targetDistance)} m`,
        `view ${Math.round(info.viewWidthM)} x ${Math.round(info.viewHeightM)} m   zoom x${info.zoom}`,
        `screen ${info.logicalWidth} x ${info.logicalHeight} px, pixel x${info.pixelScale}`,
      ]
        .filter((line) => line !== '')
        .join('\n'),
    );
  }

  private updateTouch(ship: ShipState, info: ScaleInfo, sailing: SailingInfo, inIrons: boolean): void {
    const g = this.gfx;
    if (!g || !this.speed || !this.unit) return;
    this.speed.setText(ship.speed.toFixed(1));
    this.text.setText(
      inIrons
        ? `target ${Math.round(info.targetDistance)} m\nIN IRONS!`
        : `target ${Math.round(info.targetDistance)} m\nwind ${Math.round(sailing.twaDeg)} deg ${Math.round(sailing.share * 100)}%`,
    );
    this.text.setColor(inIrons ? '#ff8070' : '#ffffff');

    g.clear();
    // Dark panel behind the numbers.
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(8, 8, 118, 100, 8);

    // Sail icon: a small triangle sail on a mast.
    g.fillStyle(0xf2e8c9, 1);
    g.fillRect(21, 46, 2, 22);
    g.fillTriangle(25, 46, 25, 66, 41, 66);

    // Sail pips: filled = sails set.
    const set = Math.round(ship.sailLevel * SAIL_PIPS);
    for (let i = 0; i < SAIL_PIPS; i++) {
      const x = 50 + i * 17;
      if (i < set) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x, 48, 13, 18);
      } else {
        g.lineStyle(2, 0xffffff, 0.5);
        g.strokeRect(x + 1, 49, 11, 16);
      }
    }
  }
}
