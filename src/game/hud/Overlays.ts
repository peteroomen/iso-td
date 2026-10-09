import Phaser from 'phaser';
import { Audio } from '../services/audio';
import { COLORS, GAME_H, GAME_W, textStyle } from '../ui/theme';
import { TEX } from '../render/textures';
import { DEPTH, UiButton, drawPanel, markHud } from './widgets';

export interface PauseActions {
  onResume(): void;
  onRestart(): void;
  onSettings(): void;
  onQuit(): void;
}

export interface VictoryInfo {
  levelName: string;
  stars: number;
  lives: number;
  maxLives: number;
  gained: number;
  onContinue(): void;
  onRetry(): void;
}

export interface DefeatInfo {
  levelName: string;
  wave: number;
  total: number;
  onRetry(): void;
  onQuit(): void;
}

/** Pause menu, victory (animated stars) and defeat panels. */
export class Overlays {
  private pause?: Phaser.GameObjects.Container;
  private result?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene) {}

  get active(): boolean {
    return !!this.pause || !!this.result;
  }

  get pauseOpen(): boolean {
    return !!this.pause;
  }

  private shell(depth: number, w: number, h: number, title: string, titleColor: string): { root: Phaser.GameObjects.Container; panel: Phaser.GameObjects.Container } {
    const s = this.scene;
    const root = s.add.container(0, 0).setDepth(depth);
    const dim = s.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0d0816, 0.62).setInteractive();
    markHud(dim);
    root.add(dim);
    const panel = s.add.container(GAME_W / 2, GAME_H / 2);
    const g = s.add.graphics();
    drawPanel(g, -w / 2, -h / 2, w, h, { r: 22, fill: 0x3d3150, bw: 5 });
    const ribbon = s.add.graphics();
    ribbon.fillStyle(COLORS.ink, 1).fillRoundedRect(-w / 2 + 40 - 4, -h / 2 - 34 - 4, w - 80 + 8, 68 + 8, 18);
    ribbon.fillStyle(titleColor === COLORS.textRed ? 0xb13a45 : 0x5a4a82, 1).fillRoundedRect(-w / 2 + 40, -h / 2 - 34, w - 80, 68, 15);
    ribbon.fillStyle(0xffffff, 0.14).fillRoundedRect(-w / 2 + 46, -h / 2 - 28, w - 92, 26, 10);
    const t = s.add.text(0, -h / 2 - 1, title, textStyle(46, titleColor, { strokeThickness: 8 })).setOrigin(0.5);
    panel.add([g, ribbon, t]);
    root.add(panel);
    root.setAlpha(0);
    panel.setScale(0.6);
    s.tweens.add({ targets: root, alpha: 1, duration: 160 });
    s.tweens.add({ targets: panel, scale: 1, duration: 360, ease: 'Back.easeOut' });
    return { root, panel };
  }

  showPause(a: PauseActions): void {
    if (this.pause) return;
    const { root, panel } = this.shell(DEPTH.overlay, 380, 400, 'PAUSED', COLORS.text);
    this.pause = root;
    const mk = (label: string, y: number, fill: number, fn: () => void) => {
      const b = new UiButton(this.scene, 0, y, { w: 280, h: 56, label, fontSize: 28, fill, onClick: fn, radius: 16 });
      panel.add(b);
    };
    mk('Resume', -90, 0x4d9a3f, a.onResume);
    mk('Restart', -20, 0x4c6fd0, a.onRestart);
    mk('Settings', 50, 0x6b5a8a, a.onSettings);
    mk('Quit to Map', 120, 0xb0504a, a.onQuit);
  }

  hidePause(): void {
    const p = this.pause;
    if (!p) return;
    this.pause = undefined;
    this.scene.tweens.add({ targets: p, alpha: 0, duration: 120, onComplete: () => p.destroy() });
  }

  showVictory(v: VictoryInfo): void {
    const s = this.scene;
    const { root, panel } = this.shell(DEPTH.overlay + 5, 560, 440, 'VICTORY!', COLORS.textGold);
    this.result = root;
    const name = s.add.text(0, -138, v.levelName, textStyle(26, '#e9dfff')).setOrigin(0.5);
    panel.add(name);
    const slots: Phaser.GameObjects.Image[] = [];
    const stars: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 130;
      const y = i === 1 ? -50 : -34;
      const empty = s.add.image(x, y, TEX.starEmpty).setScale(i === 1 ? 1.35 : 1.1);
      panel.add(empty);
      slots.push(empty);
      const full = s.add.image(x, y, TEX.starFull).setScale(0).setVisible(false);
      stars.push(full);
      panel.add(full);
    }
    const livesText = s.add.text(0, 66, `Lives left: ${v.lives} / ${v.maxLives}`, textStyle(26)).setOrigin(0.5);
    panel.add(livesText);
    const note = s.add.text(0, 100, v.gained > 0 ? `+${v.gained} star${v.gained > 1 ? 's' : ''} earned!` : 'Best result kept', textStyle(22, v.gained > 0 ? COLORS.textGold : '#cfc3ee')).setOrigin(0.5);
    panel.add(note);
    const cont = new UiButton(s, 130, 168, { w: 220, h: 58, label: 'Continue', fontSize: 28, fill: 0x4d9a3f, onClick: v.onContinue, radius: 16 });
    const retry = new UiButton(s, -130, 168, { w: 220, h: 58, label: 'Retry', fontSize: 28, fill: 0x4c6fd0, onClick: v.onRetry, radius: 16 });
    cont.setAlpha(0);
    retry.setAlpha(0);
    panel.add([cont, retry]);
    for (let i = 0; i < v.stars; i++) {
      s.time.delayedCall(550 + i * 520, () => {
        const st = stars[i];
        if (!st.active) return;
        st.setVisible(true).setScale(0).setAngle(-40);
        Audio.sfx('star_earned');
        s.tweens.add({ targets: st, scale: i === 1 ? 1.35 : 1.1, angle: 0, duration: 520, ease: 'Back.easeOut' });
        this.sparkle(panel.x + st.x, panel.y + st.y);
      });
    }
    s.time.delayedCall(550 + Math.max(1, v.stars) * 520 + 100, () => {
      if (!cont.active) return;
      s.tweens.add({ targets: [cont, retry], alpha: 1, duration: 260 });
    });
    this.confetti();
  }

  showDefeat(d: DefeatInfo): void {
    const s = this.scene;
    const { root, panel } = this.shell(DEPTH.overlay + 5, 520, 360, 'DEFEAT', COLORS.textRed);
    this.result = root;
    const name = s.add.text(0, -96, d.levelName, textStyle(26, '#e9dfff')).setOrigin(0.5);
    const msg = s.add.text(0, -36, 'The UFOs broke through!', textStyle(30, '#ffb3ad')).setOrigin(0.5);
    const w = s.add.text(0, 12, `You held out until wave ${d.wave} of ${d.total}`, textStyle(22)).setOrigin(0.5);
    const retry = new UiButton(s, -125, 100, { w: 220, h: 58, label: 'Retry', fontSize: 28, fill: 0x4d9a3f, onClick: d.onRetry, radius: 16 });
    const quit = new UiButton(s, 125, 100, { w: 220, h: 58, label: 'Level Select', fontSize: 26, fill: 0x6b5a8a, onClick: d.onQuit, radius: 16 });
    panel.add([name, msg, w, retry, quit]);
  }

  private sparkle(x: number, y: number): void {
    const e = this.scene.add.particles(x, y, TEX.spark, {
      emitting: false,
      lifespan: 700,
      speed: { min: 90, max: 260 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: 0xffe27a,
      blendMode: Phaser.BlendModes.ADD,
    });
    e.setDepth(DEPTH.overlayTop);
    e.explode(16);
    this.scene.time.delayedCall(900, () => e.destroy());
  }

  private confetti(): void {
    const colors = [0xffe27a, 0x7fd0ff, 0xff7a8a, 0x9bf06a];
    for (const c of colors) {
      const e = this.scene.add.particles(0, 0, TEX.debris, {
        x: { min: 0, max: GAME_W },
        y: -20,
        lifespan: 4200,
        speedY: { min: 120, max: 260 },
        speedX: { min: -50, max: 50 },
        rotate: { min: 0, max: 360 },
        scale: { min: 0.8, max: 1.6 },
        frequency: 140,
        tint: c,
      });
      e.setDepth(DEPTH.overlay + 2);
      this.scene.time.delayedCall(3400, () => e.stop());
      this.scene.time.delayedCall(8000, () => e.destroy());
    }
  }

  destroy(): void {
    this.pause?.destroy();
    this.result?.destroy();
    this.pause = undefined;
    this.result = undefined;
  }
}
