import '@fontsource/lilita-one/latin-400.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { UpgradesScene } from './scenes/UpgradesScene';
import { SettingsScene } from './scenes/SettingsScene';
import { EndingScene } from './scenes/EndingScene';
// Scene key: 'Game'. Receives `{ levelId: string }` from the level map.
import { GameScene } from './scenes/GameScene';
import { initialBacking, installViewport } from './ui/viewport';

// physical size of the window (CSS size x capped devicePixelRatio); game code works in logical units, see ui/viewport.ts
const back = initialBacking();

const game = new Phaser.Game({
  callbacks: {
    // before any scene is created: canvas backing store, theme metrics and listeners must be in place
    postBoot: (g) => installViewport(g),
  },
  type: Phaser.AUTO,
  parent: 'game',
  width: back.pw,
  height: back.ph,
  backgroundColor: '#120c1c',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  scale: {
    // NONE: viewport.ts sizes the canvas (backing store = CSS size x DPR, CSS size = window) and zooms every scene
    // camera, so game code sees a logical canvas >= 1280x720 that grows on one axis to match the window aspect.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: back.pw,
    height: back.ph,
    fullscreenTarget: 'game',
  },
  input: {
    // phones: allow a second finger without losing the first, no right-click menu
    activePointers: 3,
  },
  render: { powerPreference: 'high-performance' },
  scene: [BootScene, PreloadScene, TitleScene, LevelSelectScene, UpgradesScene, SettingsScene, EndingScene, GameScene],
});

if (import.meta.env.DEV) {
  // handy for debugging / automated screenshots
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
