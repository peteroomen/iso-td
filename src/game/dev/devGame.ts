import Phaser from 'phaser';
import { loadSprites } from '../assets';
import { initAudio, loadAudio } from '../services/audio';
import { GameScene } from '../scenes/GameScene';
import { GAME_H, GAME_W } from '../ui/theme';

/**
 * Standalone dev entry for the Game scene:  /dev-game.html?level=level01
 * Boots a tiny loader, then starts 'Game'. Stub LevelSelect / Settings scenes are registered
 * when the real ones are not part of this bundle.
 */
class DevLoader extends Phaser.Scene {
  constructor() {
    super('DevLoader');
  }
  preload(): void {
    const t = this.add.text(GAME_W / 2, GAME_H / 2, 'Loading...', { fontFamily: 'sans-serif', fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => t.setText(`Loading ${Math.round(p * 100)}%`));
    loadSprites(this);
    loadAudio(this);
  }
  create(): void {
    initAudio(this.game);
    const params = new URLSearchParams(window.location.search);
    this.scene.start('Game', { levelId: params.get('level') ?? 'level01' });
  }
}

class StubScene extends Phaser.Scene {
  private data0: Record<string, unknown> = {};
  constructor(key: string) {
    super(key);
  }
  init(data: Record<string, unknown>): void {
    this.data0 = data ?? {};
  }
  create(): void {
    const key = this.scene.key;
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x202838, key === 'Settings' ? 0.8 : 1);
    this.add.text(GAME_W / 2, GAME_H / 2 - 40, `[stub ${key}] ${JSON.stringify(this.data0)}`, { fontFamily: 'sans-serif', fontSize: '26px', color: '#fff' }).setOrigin(0.5);
    const b = this.add.text(GAME_W / 2, GAME_H / 2 + 30, key === 'Settings' ? '[ close ]' : '[ play level01 ]', { fontFamily: 'sans-serif', fontSize: '30px', color: '#ffd34e' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    b.on('pointerup', () => {
      if (key === 'Settings') {
        this.scene.stop();
        this.scene.resume('Game');
      } else {
        this.scene.start('Game', { levelId: 'level01' });
      }
    });
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0b0f1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [DevLoader, GameScene, new StubScene('LevelSelect'), new StubScene('Settings')],
});
if (import.meta.env.DEV) (window as unknown as { __phaser: Phaser.Game }).__phaser = game;
