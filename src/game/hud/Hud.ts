import Phaser from 'phaser';
import type { Sim } from '../../core';
import { Audio } from '../services/audio';
import { COLORS, GAME_H, GAME_W, FONT, textStyle } from '../ui/theme';
import { TEX } from '../render/textures';
import { Tooltip } from './Tooltip';
import { DEPTH, UiButton, drawPanel, markHud } from './widgets';

export interface HudCallbacks {
  onPause(): void;
  onSpeed(): void;
}

/** Top-left stats, top-right controls, toast, banners, boss bar and the hint banner. */
export class Hud {
  readonly tooltip: Tooltip;
  private readonly livesBox: Phaser.GameObjects.Container;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly goldIcon: Phaser.GameObjects.Image;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly speedBtn: UiButton;
  private readonly pauseBtn: UiButton;
  private goldShown: number;
  private lastGold: number;
  private lastLives: number;

  // boss bar
  private readonly bossBox: Phaser.GameObjects.Container;
  private readonly bossGfx: Phaser.GameObjects.Graphics;
  private readonly bossName: Phaser.GameObjects.Text;
  private bossShown = false;
  private bossFrac = 1;

  // hint
  private hintBox?: Phaser.GameObjects.Container;
  private hintText = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sim: Sim,
    cb: HudCallbacks,
  ) {
    const s = sim.state;
    this.tooltip = new Tooltip(scene);
    this.goldShown = s.gold;
    this.lastGold = s.gold;
    this.lastLives = s.lives;

    // ---- stats pills ----
    const pill = (x: number, w: number) => {
      const c = scene.add.container(x, 14).setDepth(DEPTH.hud);
      const g = scene.add.graphics();
      drawPanel(g, 0, 0, w, 42, { r: 14, fill: COLORS.panel, bw: 3.5 });
      c.add(g);
      return c;
    };
    this.livesBox = pill(14, 112);
    const heart = scene.add.image(26, 22, TEX.heart).setScale(0.62);
    this.livesText = scene.add.text(46, 22, String(s.lives), textStyle(26)).setOrigin(0, 0.5);
    this.livesBox.add([heart, this.livesText]);
    const goldBox = pill(134, 138);
    this.goldIcon = scene.add.image(26, 22, TEX.coin).setScale(0.62);
    this.goldText = scene.add.text(46, 22, String(s.gold), textStyle(26, COLORS.textGold)).setOrigin(0, 0.5);
    goldBox.add([this.goldIcon, this.goldText]);
    const waveBox = pill(280, 164);
    this.waveText = scene.add.text(100, 22, '', textStyle(24)).setOrigin(0.5);
    const ufo = scene.add.image(28, 22, TEX.ufo).setScale(0.62);
    waveBox.add([ufo, this.waveText]);
    for (const [box, w, tip] of [
      [this.livesBox, 112, () => ({ title: 'Lives', rows: [{ text: 'UFOs that reach the exit cost lives.' }, { text: 'Lose them all and the base falls!', color: COLORS.textRed }] })],
      [goldBox, 138, () => ({ title: 'Gold', rows: [{ text: 'Earn gold from kills and early calls.' }] })],
    ] as const) {
      box.setSize(w, 42).setInteractive({ hitArea: new Phaser.Geom.Rectangle(0, 0, w, 42), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      markHud(box);
      box.on('pointerover', () => this.tooltip.show(tip(), box.x + w / 2, box.y + 46, 'below'));
      box.on('pointerout', () => this.tooltip.hide());
    }

    // ---- top-right ----
    this.pauseBtn = new UiButton(scene, GAME_W - 14 - 22, 14 + 21, { w: 44, h: 42, icon: TEX.pause, iconSize: 26, onClick: cb.onPause, radius: 12 });
    this.pauseBtn.onHover = (o) => (o ? this.tooltip.show({ title: 'Pause', rows: [{ text: 'Esc / P' }] }, this.pauseBtn.x, this.pauseBtn.y + 28, 'below') : this.tooltip.hide());
    this.speedBtn = new UiButton(scene, GAME_W - 14 - 44 - 10 - 38, 14 + 21, { w: 76, h: 42, icon: TEX.ff, iconSize: 24, label: '1x', fontSize: 22, onClick: cb.onSpeed, radius: 12 });
    this.speedBtn.onHover = (o) => (o ? this.tooltip.show({ title: 'Game speed', rows: [{ text: 'Toggle 1x / 2x', right: 'Space' }] }, this.speedBtn.x, this.speedBtn.y + 28, 'below') : this.tooltip.hide());
    this.pauseBtn.setDepth(DEPTH.hud);
    this.speedBtn.setDepth(DEPTH.hud);
    scene.add.existing(this.pauseBtn);
    scene.add.existing(this.speedBtn);

    // ---- boss bar ----
    this.bossBox = scene.add.container(GAME_W / 2 + 40, -60).setDepth(DEPTH.bar).setVisible(false);
    this.bossGfx = scene.add.graphics();
    this.bossName = scene.add.text(0, -4, 'MOTHERSHIP', textStyle(24, '#ff8a80')).setOrigin(0.5, 1);
    const skull = scene.add.image(-196, 14, TEX.skull).setScale(0.5);
    this.bossBox.add([this.bossGfx, this.bossName, skull]);

    this.refreshWave();
  }

  // ------------------------------------------------------------------------------------------ public

  setSpeed(n: number): void {
    this.speedBtn.setLabel(`${n}x`);
    this.speedBtn.setFill(n > 1 ? 0x4c8bf5 : COLORS.panelLight);
  }

  shakeLives(): void {
    this.scene.tweens.add({ targets: this.livesBox, x: { from: 14 - 8, to: 14 }, duration: 380, ease: 'Elastic.easeOut' });
    this.scene.tweens.add({ targets: this.livesText, scale: { from: 1.5, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    this.livesText.setColor(COLORS.textRed);
    this.scene.time.delayedCall(450, () => this.livesText.active && this.livesText.setColor(COLORS.text));
  }

  /** Screen position of the gold counter (for coin fly-ins). */
  get goldPos(): { x: number; y: number } {
    return { x: 134 + 26, y: 14 + 22 };
  }

  toast(msg: string, x?: number, y?: number, color: string = COLORS.textRed): void {
    const p = this.scene.input.activePointer;
    const tx = Phaser.Math.Clamp(x ?? p.x, 100, GAME_W - 100);
    const ty = Phaser.Math.Clamp(y ?? p.y - 36, 80, GAME_H - 40);
    const c = this.scene.add.container(tx, ty).setDepth(DEPTH.toast);
    const t = this.scene.add.text(0, 0, msg, textStyle(20, color)).setOrigin(0.5);
    const g = this.scene.add.graphics();
    drawPanel(g, -t.width / 2 - 12, -t.height / 2 - 4, t.width + 24, t.height + 8, { r: 10, fill: 0x2c2240, bw: 3, alpha: 0.95 });
    c.add([g, t]);
    c.setScale(0.6).setAlpha(0);
    this.scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: c, y: ty - 34, alpha: 0, delay: 900, duration: 420, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
  }

  /** Big centre banner ("Wave 3", "MOTHERSHIP INBOUND"). */
  banner(text: string, opts: { color?: string; band?: number; sub?: string; hold?: number } = {}): void {
    const c = this.scene.add.container(GAME_W / 2, 150).setDepth(DEPTH.banner);
    const band = this.scene.add.rectangle(0, 0, GAME_W, opts.sub ? 120 : 96, opts.band ?? 0x2e222f, 0.62);
    const t = this.scene.add.text(0, opts.sub ? -14 : 0, text, textStyle(58, opts.color ?? COLORS.text, { strokeThickness: 9 })).setOrigin(0.5);
    c.add([band, t]);
    if (opts.sub) c.add(this.scene.add.text(0, 36, opts.sub, textStyle(24, '#ffd7d7')).setOrigin(0.5));
    c.setAlpha(0);
    t.setScale(0.4);
    band.setScale(1, 0.1);
    this.scene.tweens.add({ targets: c, alpha: 1, duration: 120 });
    this.scene.tweens.add({ targets: band, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, scale: 1, duration: 360, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: c, alpha: 0, y: 120, delay: (opts.hold ?? 1.5) * 1000, duration: 380, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
  }

  showHint(text: string): void {
    if (this.hintText === text && this.hintBox) return;
    this.hideHint(true);
    this.hintText = text;
    const w = 600;
    const c = this.scene.add.container(GAME_W / 2 + 40, GAME_H + 20).setDepth(DEPTH.bar);
    const txt = this.scene.add.text(-w / 2 + 70, 0, text, { fontFamily: FONT, fontSize: '20px', color: '#fff4d6', wordWrap: { width: w - 130 }, lineSpacing: 3, stroke: '#2e222f', strokeThickness: 3 });
    const h = Math.max(70, txt.height + 28);
    txt.y = -h / 2 + 14;
    const g = this.scene.add.graphics();
    drawPanel(g, -w / 2, -h / 2, w, h, { r: 16, fill: 0x3d3150, bw: 4 });
    const bubble = this.scene.add.graphics();
    bubble.fillStyle(COLORS.ink, 1).fillCircle(-w / 2 + 36, 0, 22);
    bubble.fillStyle(COLORS.gold, 1).fillCircle(-w / 2 + 36, 0, 18);
    const bang = this.scene.add.text(-w / 2 + 36, 1, '!', textStyle(30, '#2e222f', { strokeThickness: 0 })).setOrigin(0.5);
    const close = new UiButton(this.scene, w / 2 - 22, -h / 2 + 22, { w: 32, h: 32, icon: TEX.close, iconSize: 18, radius: 9, fill: 0x6b5a8a, onClick: () => this.hideHint(false), keepMenu: true });
    c.add([g, bubble, bang, txt, close]);
    this.hintBox = c;
    const targetY = GAME_H - 14 - h / 2;
    this.scene.tweens.add({ targets: c, y: targetY, duration: 480, ease: 'Back.easeOut' });
    Audio.sfx('ui_click', { volume: 0.3, throttleMs: 200 });
  }

  hideHint(instant: boolean): void {
    const c = this.hintBox;
    if (!c) return;
    this.hintBox = undefined;
    this.scene.tweens.killTweensOf(c);
    if (instant) c.destroy();
    else this.scene.tweens.add({ targets: c, y: GAME_H + 120, alpha: 0, duration: 300, ease: 'Back.easeIn', onComplete: () => c.destroy() });
  }

  get hintVisible(): boolean {
    return !!this.hintBox;
  }

  // ------------------------------------------------------------------------------------------ per frame

  private refreshWave(): void {
    const w = this.sim.state.wave;
    this.waveText.setText(`Wave ${w.index}/${w.total}`);
  }

  update(time: number, dt: number): void {
    const s = this.sim.state;
    // gold: smooth count
    const diff = s.gold - this.goldShown;
    if (Math.abs(diff) < 1) this.goldShown = s.gold;
    else this.goldShown += diff * Math.min(1, dt * 12);
    this.goldText.setText(String(Math.round(this.goldShown)));
    if (s.gold !== this.lastGold) {
      if (s.gold > this.lastGold) this.scene.tweens.add({ targets: this.goldIcon, scale: { from: 0.85, to: 0.62 }, duration: 220, ease: 'Back.easeOut' });
      this.lastGold = s.gold;
    }
    if (s.lives !== this.lastLives) {
      if (s.lives < this.lastLives) this.shakeLives();
      this.lastLives = s.lives;
    }
    this.livesText.setText(String(s.lives));
    this.refreshWave();

    // boss bar
    const boss = s.boss;
    if (boss && !this.bossShown) {
      this.bossShown = true;
      this.bossFrac = 1;
      this.bossBox.setVisible(true).setY(-60);
      this.scene.tweens.add({ targets: this.bossBox, y: 44, duration: 520, ease: 'Back.easeOut' });
    } else if (!boss && this.bossShown) {
      this.bossShown = false;
      this.scene.tweens.add({ targets: this.bossBox, y: -80, duration: 400, ease: 'Back.easeIn', onComplete: () => this.bossBox.setVisible(false) });
    }
    if (boss) {
      const f = boss.hp / boss.maxHp;
      this.bossFrac += (f - this.bossFrac) * Math.min(1, dt * 8);
      const g = this.bossGfx;
      g.clear();
      const w = 400;
      const h = 22;
      drawPanel(g, -w / 2, 0, w, h, { r: 8, fill: 0x4a2a38, bw: 3.5, gloss: false });
      if (this.bossFrac > 0.002) {
        g.fillStyle(0xff6f61, 0.35).fillRoundedRect(-w / 2 + 2, 2, (w - 4) * Math.max(this.bossFrac, f), h - 4, 6);
        g.fillStyle(0xe5484d, 1).fillRoundedRect(-w / 2 + 2, 2, (w - 4) * f, h - 4, 6);
        g.fillStyle(0xffffff, 0.3).fillRoundedRect(-w / 2 + 5, 4, Math.max(0, (w - 10) * f), 5, 3);
      }
      this.bossName.setScale(1 + 0.02 * Math.sin(time * 0.006));
    }
  }
}
