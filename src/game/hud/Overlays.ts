import Phaser from 'phaser';
import { Audio } from '../services/audio';
import { COLORS, GAME_H, GAME_W, UI_SCALE, textStyle } from '../ui/theme';
import { TEX } from '../render/textures';
import { DEPTH, UiButton, drawPanel, markHud } from './widgets';

export interface PauseActions {
  onResume(): void;
  onRestart(): void;
  onSettings(): void;
  /** Present only when the browser supports fullscreen. */
  onFullscreen?(): void;
  fullscreenLabel?: () => string;
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

interface Shell {
  root: Phaser.GameObjects.Container;
  dim: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Container;
  w: number;
  h: number;
  onOrphanTap?: () => void;
}

/** Pause menu, victory (animated stars) and defeat panels. */
export class Overlays {
  private pause?: Phaser.GameObjects.Container;
  private result?: Phaser.GameObjects.Container;
  private tap?: Phaser.GameObjects.Container;
  private k = 1;
  /** every dim / panel pair currently alive, with the size the panel is laid out for */
  private shells: Shell[] = [];
  private lastW = GAME_W;
  private lastH = GAME_H;

  constructor(private readonly scene: Phaser.Scene) {}

  get active(): boolean {
    return !!this.pause || !!this.result || !!this.tap;
  }

  /** the fail-safe "Tap to resume" card is up */
  get tapOpen(): boolean {
    return !!this.tap;
  }

  get pauseOpen(): boolean {
    return !!this.pause;
  }

  private shell(depth: number, w: number, h: number, title: string, titleColor: string, onOrphanTap?: () => void): { root: Phaser.GameObjects.Container; panel: Phaser.GameObjects.Container } {
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
    const sh: Shell = { root, dim, panel, w, h, onOrphanTap };
    this.shells.push(sh);
    this.fit(sh);
    root.setAlpha(0);
    panel.setScale(0.6 * this.k);
    s.tweens.add({ targets: root, alpha: 1, duration: 160 });
    s.tweens.add({ targets: panel, scale: this.k, duration: 360, ease: 'Back.easeOut' });
    // a tap on the bare dim (not on the panel / its buttons) while the panel is not actually on screen: self-heal
    dim.on('pointerdown', () => {
      if (!this.panelVisible(sh)) {
        this.fit(sh);
        sh.onOrphanTap?.();
      }
    });
    return { root, panel };
  }

  /** Sizes the dim to the live canvas and centres / scales the panel so it is fully visible. */
  private fit(sh: Shell): void {
    sh.dim.setPosition(GAME_W / 2, GAME_H / 2).setSize(GAME_W, GAME_H);
    // setSize on a Rectangle game object doesn't resize its hit area / geometry: refresh both
    const geom = sh.dim as unknown as { setDisplaySize(w: number, h: number): void };
    geom.setDisplaySize(GAME_W, GAME_H);
    if (sh.dim.input) sh.dim.input.hitArea = new Phaser.Geom.Rectangle(0, 0, GAME_W, GAME_H);
    const k = Math.max(0.5, Math.min(UI_SCALE, 1.25, (GAME_H - 24) / (sh.h + 60), (GAME_W - 24) / (sh.w + 20)));
    this.k = k;
    sh.panel.setPosition(GAME_W / 2, GAME_H / 2);
    sh.panel.setScale(k);
  }

  /** The panel exists, is shown and lies inside the canvas. */
  private panelVisible(sh: Shell): boolean {
    if (!sh.root.active || !sh.panel.active || !sh.panel.visible || !sh.root.visible || sh.root.alpha < 0.05) return false;
    const hw = (sh.w / 2) * sh.panel.scaleX;
    const hh = (sh.h / 2) * sh.panel.scaleY;
    return sh.panel.x - hw >= -2 && sh.panel.x + hw <= GAME_W + 2 && sh.panel.y - hh >= -2 && sh.panel.y + hh <= GAME_H + 2;
  }

  /**
   * Called every frame by the scene: re-lays-out every dim / panel when the logical size changed, and removes any
   * dim that has lost its panel (an interactive full-screen blocker without a visible panel locks the player out).
   */
  validate(): void {
    const resized = GAME_W !== this.lastW || GAME_H !== this.lastH;
    this.lastW = GAME_W;
    this.lastH = GAME_H;
    this.shells = this.shells.filter((sh) => {
      if (!sh.root.active) return false;
      if (!sh.panel.active) {
        sh.root.destroy(); // orphaned dim
        if (this.pause === sh.root) this.pause = undefined;
        if (this.result === sh.root) this.result = undefined;
        if (this.tap === sh.root) this.tap = undefined;
        return false;
      }
      if (resized || sh.dim.width !== GAME_W || sh.dim.height !== GAME_H) {
        this.scene.tweens.killTweensOf(sh.panel);
        this.scene.tweens.killTweensOf(sh.root);
        sh.root.setAlpha(1);
        this.fit(sh);
      } else if (sh.root.alpha > 0.99 && !this.panelVisible(sh)) {
        this.fit(sh);
      }
      return true;
    });
  }

  /** Small fail-safe card: the game is paused for a reason nobody can see; any tap resumes. */
  showTapResume(onResume: () => void): void {
    if (this.tap) return;
    const { root, panel } = this.shell(DEPTH.overlay + 8, 360, 150, 'PAUSED', COLORS.text, () => onResume());
    this.tap = root;
    const label = this.scene.add.text(0, 20, 'Tap to resume', textStyle(34, COLORS.textGold)).setOrigin(0.5);
    panel.add(label);
    // any tap on the dim (anywhere on the screen) resumes
    this.shells[this.shells.length - 1]?.dim.on('pointerdown', () => onResume());
  }

  hideTapResume(): void {
    const t = this.tap;
    if (!t) return;
    this.tap = undefined;
    this.shells = this.shells.filter((sh) => sh.root !== t);
    t.destroy();
  }

  showPause(a: PauseActions): void {
    if (this.pause) return;
    const items: { label: string; fill: number; fn: () => void }[] = [
      { label: 'Resume', fill: 0x4d9a3f, fn: a.onResume },
      { label: 'Restart', fill: 0x4c6fd0, fn: a.onRestart },
      { label: 'Settings', fill: 0x6b5a8a, fn: a.onSettings },
    ];
    if (a.onFullscreen) items.push({ label: a.fullscreenLabel?.() ?? 'Fullscreen', fill: 0x3f8aa8, fn: a.onFullscreen });
    items.push({ label: 'Quit to Map', fill: 0xb0504a, fn: a.onQuit });
    const n = items.length;
    const { root, panel } = this.shell(DEPTH.overlay, 380, 120 + n * 70, 'PAUSED', COLORS.text, () => a.onResume());
    this.pause = root;
    items.forEach((it, i) => {
      const y = -((n - 1) * 70) / 2 + i * 70 + 24;
      const b = new UiButton(this.scene, 0, y, { w: 280, h: 56, label: it.label, fontSize: 28, fill: it.fill, onClick: it.fn, radius: 16 });
      panel.add(b);
    });
  }

  hidePause(): void {
    const p = this.pause;
    if (!p) return;
    this.pause = undefined;
    // fading out: stop it blocking input right away and drop it from the live set
    this.shells = this.shells.filter((sh) => sh.root !== p);
    p.list.forEach((o) => (o as Phaser.GameObjects.GameObject).input && (o as Phaser.GameObjects.GameObject).disableInteractive());
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
        this.sparkle(panel.x + st.x * this.k, panel.y + st.y * this.k);
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
    this.tap?.destroy();
    for (const sh of this.shells) sh.root.destroy();
    this.shells = [];
    this.pause = undefined;
    this.result = undefined;
    this.tap = undefined;
  }
}
