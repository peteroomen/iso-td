import Phaser from 'phaser';

class PlaceholderScene extends Phaser.Scene {
  constructor() {
    super('Placeholder');
  }
  create(): void {
    this.add
      .text(640, 360, 'UFO Defense', { fontFamily: 'sans-serif', fontSize: '64px', color: '#ffffff' })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0b0f1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [PlaceholderScene],
});
