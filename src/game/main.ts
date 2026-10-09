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
import { BASE_H, BASE_W } from './ui/theme';
import { installViewport, syncViewMetrics } from './ui/viewport';

const game = new Phaser.Game({
  callbacks: {
    // before any scene is created: the theme's live size must already match the canvas
    postBoot: (g) => syncViewMetrics(g),
  },
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_W,
  height: BASE_H,
  backgroundColor: '#120c1c',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  scale: {
    // EXPAND: the logical canvas is at least 1280x720 and grows on one axis to match the window aspect,
    // so there are no letterbox bars; scenes lay themselves out against this.scale.width/height.
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_W,
    height: BASE_H,
    fullscreenTarget: 'game',
  },
  input: {
    // phones: allow a second finger without losing the first, no right-click menu
    activePointers: 3,
  },
  render: { powerPreference: 'high-performance' },
  scene: [BootScene, PreloadScene, TitleScene, LevelSelectScene, UpgradesScene, SettingsScene, EndingScene, GameScene],
});

installViewport(game);

if (import.meta.env.DEV) {
  // handy for debugging / automated screenshots
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
