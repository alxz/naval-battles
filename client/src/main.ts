import Phaser from 'phaser';
import './style.css';
import { SeaScene } from './scenes/SeaScene';

// The size here is only a first guess. SeaScene measures the screen and picks
// a logical size with integer pixel scaling (plan D27, see scenes/ScreenFit.ts).
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 360,
  backgroundColor: '#1d5b8f',
  pixelArt: true,
  scale: {
    // NONE: we set the canvas size and its CSS zoom ourselves.
    mode: Phaser.Scale.NONE,
  },
  scene: [SeaScene],
});
