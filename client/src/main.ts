import Phaser from 'phaser';
import './style.css';
import { SeaScene } from './scenes/SeaScene';
import { loadFonts } from './scenes/text';
import { BUILD_INFO, TEST_BUILD } from './assets';

function start(): void {
  // The size here is only a first guess. SeaScene measures the screen and picks
  // a logical size with integer pixel scaling (plan D27, see scenes/ScreenFit.ts).
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 640,
    height: 360,
    backgroundColor: '#1d5b8f',
    pixelArt: true,
    // Draw everything on whole pixels: no shimmering text or sprites between two pixels.
    roundPixels: true,
    scale: {
      // NONE: we set the canvas size and its CSS zoom ourselves.
      mode: Phaser.Scale.NONE,
    },
    scene: [SeaScene],
  });

  // Development only: lets automated browser tests reach the game (window.naval). Not in the release build.
  if (import.meta.env.DEV) (window as unknown as { naval?: Phaser.Game }).naval = game;
  if (TEST_BUILD) showVersion();
}

/** The test build's version in the lower right corner (a page element over the canvas, not part of the game). */
function showVersion(): void {
  const label = document.createElement('div');
  label.textContent = `TEST BUILD ${BUILD_INFO}`;
  label.style.cssText =
    'position:fixed;right:4px;bottom:2px;font:10px monospace;color:#ffffff;opacity:0.55;pointer-events:none;z-index:10;text-shadow:0 0 2px #000';
  document.body.appendChild(label);
}

// The pixel fonts must be ready before Phaser draws any text (see scenes/text.ts).
void loadFonts().then(start);
