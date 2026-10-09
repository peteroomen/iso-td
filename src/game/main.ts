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
import { GAME_H, GAME_W } from './ui/theme';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#120c1c',
  pixelArt: false,
  antialias: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
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
