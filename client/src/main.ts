import Phaser from 'phaser';
import './style.css';
import { SeaScene } from './scenes/SeaScene';

// Logical resolution is 640 x 360 (see the plan, section 4.1).
// Phaser scales it up to fill the window with sharp pixels.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 360,
  backgroundColor: '#1d5b8f',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [SeaScene],
});
