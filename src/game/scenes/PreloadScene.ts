import Phaser from 'phaser';
import { applyViewCamera } from '../ui/viewport';
import { loadSprites } from '../assets';
import { initAudio, loadAudio } from '../services/audio';
import { COLORS, GAME_H, GAME_W, textStyle } from '../ui/theme';
import { addSky } from '../ui/background';
import { drawOutlinedRect } from '../ui/widgets';
import { urlParam } from './metaData';

const TIPS = [
  'Knights from the Barracks block UFOs so your archers can keep shooting.',
  'Call the next wave early for bonus gold and faster ability cooldowns.',
  'Plated UFOs shrug off arrows. Wizards cut right through.',
  'Prism UFOs resist magic. Send in the archers.',
  'Spend your stars on upgrades between levels.',
  'Orbital Strike hits fliers too. Time it on a crowd.',
  'Bomb towers blast whole groups of ground UFOs, but cannot hit fliers.',
];

const DEV_SCENES = ['Title', 'LevelSelect', 'Upgrades', 'Ending', 'Game'];

/** Loads sprites + audio behind a progress bar, then routes to the Title (or a `?scene=` dev shortcut). */
export class PreloadScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private pct!: Phaser.GameObjects.Text;
  private ufo!: Phaser.GameObjects.Image;
  private shown = 0;
  private target = 0;
  private loaded = false;
  private startedAt = 0;
  private readonly barW = 640;

  constructor() {
    super('Preload');
  }

  init(): void {
    applyViewCamera(this);
  }

  preload(): void {
    this.startedAt = this.time.now;
    addSky(this, 'dusk', { clouds: 5 });

    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    this.add.text(cx, cy - 170, 'UFO DEFENSE', textStyle(76, COLORS.textGold, { strokeThickness: 14 })).setOrigin(0.5);
    this.ufo = this.add.image(cx - this.barW / 2, cy - 36, 'ufo/ufo_1').setScale(0.9);
    this.tweens.add({ targets: this.ufo, y: this.ufo.y - 10, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.bar = this.add.graphics();
    this.pct = this.add.text(cx, cy + 62, 'Loading... 0%', textStyle(30)).setOrigin(0.5);
    this.drawBar();
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.add.text(cx, GAME_H - 64, tip, textStyle(24, '#ffe9bf', { strokeThickness: 4, align: 'center', wordWrap: { width: GAME_W - 200 } })).setOrigin(0.5);

    this.load.on('progress', (v: number) => (this.target = v));
    this.load.on('complete', () => (this.loaded = true));
    loadSprites(this);
    loadAudio(this);
  }

  create(): void {
    // nothing: routing happens in update() once the bar has visually filled
  }

  private drawBar(): void {
    const x = GAME_W / 2 - this.barW / 2;
    const y = GAME_H / 2;
    const g = this.bar;
    g.clear();
    drawOutlinedRect(g, x - 6, y - 6, this.barW + 12, 44, 22, 0x2a2038, 5);
    const fw = Math.max(0, this.barW * this.shown);
    if (fw > 8) {
      g.fillStyle(0xd88a1a, 1);
      g.fillRoundedRect(x, y, fw, 32, 16);
      g.fillStyle(0xffd34e, 1);
      g.fillRoundedRect(x, y, fw, 22, { tl: 16, tr: 16, bl: 6, br: 6 });
      g.fillStyle(0xffffff, 0.4);
      g.fillRoundedRect(x + 8, y + 4, Math.max(0, fw - 16), 5, 2.5);
    }
  }

  update(_t: number, dt: number): void {
    if (this.shown < this.target) {
      this.shown = Math.min(this.target, this.shown + dt / 1000 * 1.6);
      this.drawBar();
      this.ufo.x = GAME_W / 2 - this.barW / 2 + this.barW * this.shown;
      this.pct.setText(`Loading... ${Math.round(this.shown * 100)}%`);
    }
    if (this.loaded && this.shown >= 0.999 && !this.routing) {
      this.routing = true;
      this.finish();
    }
  }

  private routing = false;

  private finish(): void {
    initAudio(this.game);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const ready = fonts ? fonts.load('32px "Lilita One"').then(() => undefined, () => undefined) : Promise.resolve();
    const wait = Math.max(0, 450 - (this.time.now - this.startedAt));
    ready.then(() => {
      this.time.delayedCall(wait, () => {
        this.pct.setText('Ready!');
        this.cameras.main.fadeOut(260, 18, 12, 28);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.route());
      });
    });
  }

  private route(): void {
    const want = urlParam('scene');
    if (want && DEV_SCENES.includes(want)) {
      if (want === 'Game') this.scene.start('Game', { levelId: urlParam('level') ?? 'level01' });
      else this.scene.start(want);
      return;
    }
    this.scene.start('Title');
  }
}
