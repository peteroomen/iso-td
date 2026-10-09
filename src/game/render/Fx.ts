import Phaser from 'phaser';
import { GAME_H, GAME_W, COLORS, textStyle } from '../ui/theme';
import { IsoView, TH, TW, isoX, isoY } from './iso';
import { TEX } from './textures';

export interface Layers {
  world: Phaser.GameObjects.Container;
  groundC: Phaser.GameObjects.Container;
  groundFxC: Phaser.GameObjects.Container;
  entityC: Phaser.GameObjects.Container;
  fxC: Phaser.GameObjects.Container;
}

const ADD = Phaser.BlendModes.ADD;

/** Particles, floating text, rings, beams, shake: every transient visual effect lives here. */
export class Fx {
  private readonly fire: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkWhite: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkBlue: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkGold: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dustEm: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ember: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly trailBlue: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flashRect: Phaser.GameObjects.Rectangle;
  private readonly vignette: Phaser.GameObjects.Image;
  private shakeLeft = 0;
  private shakeMax = 0;
  private shakeMag = 0;
  /** screen px -> world px */
  private readonly k: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly view: IsoView,
    private readonly L: Layers,
  ) {
    this.k = 1 / view.scale;
    const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, container: Phaser.GameObjects.Container = L.fxC) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      container.add(e);
      return e;
    };
    this.fire = mk(TEX.glow, {
      lifespan: { min: 320, max: 640 },
      speed: { min: 40, max: 230 },
      scale: { start: 1.1, end: 0.1 },
      alpha: { start: 0.95, end: 0 },
      color: [0xfff3b0, 0xffa23a, 0xd8442a],
      colorEase: 'quad.out',
      blendMode: ADD,
      angle: { min: 0, max: 360 },
    });
    this.sparkWhite = mk(TEX.spark, {
      lifespan: { min: 180, max: 380 },
      speed: { min: 60, max: 190 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: ADD,
      rotate: { min: 0, max: 360 },
    });
    this.sparkBlue = mk(TEX.spark, {
      lifespan: { min: 220, max: 460 },
      speed: { min: 50, max: 170 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: 0x7fd0ff,
      blendMode: ADD,
      rotate: { min: 0, max: 360 },
    });
    this.sparkGold = mk(TEX.spark, {
      lifespan: { min: 300, max: 600 },
      speed: { min: 60, max: 180 },
      gravityY: 220,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: 0xffe27a,
      blendMode: ADD,
    });
    this.smoke = mk(TEX.smoke, {
      lifespan: { min: 500, max: 900 },
      speed: { min: 10, max: 60 },
      scale: { start: 0.6, end: 1.7 },
      alpha: { start: 0.55, end: 0 },
      tint: 0x4a3f55,
      angle: { min: 0, max: 360 },
    });
    this.dustEm = mk(TEX.smoke, {
      lifespan: { min: 380, max: 700 },
      speedX: { min: -70, max: 70 },
      speedY: { min: -40, max: 0 },
      scale: { start: 0.35, end: 1.0 },
      alpha: { start: 0.65, end: 0 },
      tint: 0xe9deb8,
    });
    this.debris = mk(TEX.debris, {
      lifespan: { min: 500, max: 950 },
      speed: { min: 80, max: 260 },
      gravityY: 520,
      angle: { min: 200, max: 340 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1.3, end: 0.5 },
      alpha: { start: 1, end: 0 },
      color: [0xc9d1dc, 0x8e98a8, 0xe5484d],
    });
    this.ember = mk(TEX.dot, {
      lifespan: { min: 500, max: 1000 },
      speedY: { min: -60, max: -20 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: 0xff9a3a,
      blendMode: ADD,
    });
    this.trailBlue = mk(TEX.glow, {
      lifespan: 280,
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: 0x78c8ff,
      blendMode: ADD,
    });

    this.flashRect = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0).setDepth(60);
    this.vignette = scene.add.image(GAME_W / 2, GAME_H / 2, TEX.vignette).setDisplaySize(GAME_W, GAME_H).setDepth(61).setAlpha(0);
  }

  // ------------------------------------------------------------------ helpers

  /** world-local point of a grid position raised by `h` source px. */
  private pt(gx: number, gy: number, h = 0): { x: number; y: number } {
    return { x: isoX(gx, gy), y: isoY(gx, gy) - h };
  }

  update(dt: number): void {
    const world = this.L.world;
    if (this.shakeLeft > 0) {
      this.shakeLeft -= dt;
      const f = Math.max(0, this.shakeLeft / this.shakeMax);
      const m = this.shakeMag * f * f;
      world.setPosition(this.view.offX + (Math.random() - 0.5) * 2 * m, this.view.offY + (Math.random() - 0.5) * 2 * m);
    } else if (world.x !== this.view.offX || world.y !== this.view.offY) {
      world.setPosition(this.view.offX, this.view.offY);
    }
  }

  shake(magnitudePx: number, seconds: number): void {
    this.shakeMag = Math.max(this.shakeLeft > 0 ? this.shakeMag * (this.shakeLeft / this.shakeMax) : 0, magnitudePx);
    this.shakeMax = seconds;
    this.shakeLeft = seconds;
  }

  screenFlash(color: number, alpha: number, seconds: number): void {
    this.scene.tweens.killTweensOf(this.flashRect);
    this.flashRect.setFillStyle(color, alpha);
    this.flashRect.setAlpha(1);
    this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: seconds * 1000, ease: 'Quad.easeOut' });
  }

  /** Red screen-edge flash on a leak. */
  leakFlash(): void {
    this.scene.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(0.85);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: 650, ease: 'Quad.easeOut' });
  }

  // ------------------------------------------------------------------ particle effects

  explosion(gx: number, gy: number, size: 'small' | 'big' | 'huge', h = 40): void {
    const p = this.pt(gx, gy, h);
    const n = size === 'small' ? 10 : size === 'big' ? 20 : 46;
    this.fire.explode(n, p.x, p.y);
    this.sparkWhite.explode(size === 'small' ? 6 : 14, p.x, p.y);
    this.debris.explode(size === 'small' ? 5 : size === 'big' ? 10 : 24, p.x, p.y);
    this.smoke.explode(size === 'small' ? 3 : 7, p.x, p.y);
    const ring = this.scene.add.image(p.x, p.y, TEX.glow).setBlendMode(ADD).setTint(0xffd27a).setAlpha(0.9);
    this.L.fxC.add(ring);
    const s = size === 'small' ? 1.6 : size === 'big' ? 2.6 : 5;
    ring.setScale(0.3);
    this.scene.tweens.add({ targets: ring, scale: s, alpha: 0, duration: 330, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  hitSpark(gx: number, gy: number, h: number, kind: 'white' | 'blue' | 'gold' = 'white', n = 4): void {
    const p = this.pt(gx, gy, h);
    (kind === 'blue' ? this.sparkBlue : kind === 'gold' ? this.sparkGold : this.sparkWhite).explode(n, p.x, p.y);
  }

  dust(gx: number, gy: number, n = 8): void {
    const p = this.pt(gx, gy, 4);
    this.dustEm.explode(n, p.x, p.y);
  }

  puff(gx: number, gy: number, h = 30): void {
    const p = this.pt(gx, gy, h);
    this.smoke.explode(3, p.x, p.y);
    this.sparkWhite.explode(4, p.x, p.y);
  }

  trail(gx: number, gy: number, h: number): void {
    const p = this.pt(gx, gy, h);
    this.trailBlue.emitParticleAt(p.x, p.y, 1);
  }

  emberAt(gx: number, gy: number): void {
    const p = this.pt(gx, gy, 2);
    this.ember.emitParticleAt(p.x, p.y, 1);
  }

  // ------------------------------------------------------------------ text

  floatText(gx: number, gy: number, text: string, color: string, h = 60, size = 22): void {
    const p = this.pt(gx, gy, h);
    const t = this.scene.add.text(p.x, p.y, text, textStyle(size, color)).setOrigin(0.5).setScale(this.k * 0.4);
    this.L.fxC.add(t);
    this.scene.tweens.add({ targets: t, scale: this.k, duration: 180, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: t,
      y: p.y - 70 * this.k * 1.3,
      alpha: { from: 1, to: 0 },
      delay: 380,
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => t.destroy(),
    });
  }

  coinPop(gx: number, gy: number, amount: number, h = 50): void {
    if (amount <= 0) return;
    this.floatText(gx, gy, `+${amount}`, COLORS.textGold, h, 22);
    this.hitSpark(gx, gy, h, 'gold', 5);
  }

  // ------------------------------------------------------------------ rings & ground fx

  /** Expanding ground ring (iso ellipse) of a grid-space radius. */
  shockwave(gx: number, gy: number, radius: number, color = 0xffffff, seconds = 0.45, width = 8): void {
    const p = this.pt(gx, gy);
    const g = this.scene.add.graphics({ x: p.x, y: p.y });
    this.L.groundFxC.add(g);
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: seconds * 1000,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        const r = radius * (0.2 + 0.9 * state.t);
        g.clear();
        g.lineStyle(width * (1 - state.t) * this.k + 1, color, 1 - state.t);
        g.strokeEllipse(0, 0, 2 * r * TW * 0.7071, 2 * r * TH * 0.7071);
        g.fillStyle(color, 0.25 * (1 - state.t));
        g.fillEllipse(0, 0, 2 * r * TW * 0.7071, 2 * r * TH * 0.7071);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** Short lived scorch mark on the ground. */
  scorch(gx: number, gy: number, radius: number): void {
    const p = this.pt(gx, gy);
    const g = this.scene.add.graphics({ x: p.x, y: p.y });
    g.fillStyle(0x1a1020, 0.4).fillEllipse(0, 0, 2 * radius * TW * 0.7071, 2 * radius * TH * 0.7071);
    g.fillStyle(0x1a1020, 0.3).fillEllipse(0, 0, 1.2 * radius * TW * 0.7071, 1.2 * radius * TH * 0.7071);
    this.L.groundFxC.add(g);
    this.scene.tweens.add({ targets: g, alpha: 0, delay: 1800, duration: 1400, onComplete: () => g.destroy() });
  }

  /** Bright vertical beam from the top of the screen. */
  orbitalBeam(gx: number, gy: number, radius: number): void {
    const p = this.pt(gx, gy);
    const w = radius * TW * 0.7071 * 0.95;
    const beam = this.scene.add.image(p.x, p.y, TEX.beam).setOrigin(0.5, 1).setBlendMode(ADD).setTint(0xc7f1ff);
    beam.setDisplaySize(w, 3200);
    const core = this.scene.add.image(p.x, p.y, TEX.beam).setOrigin(0.5, 1).setBlendMode(ADD);
    core.setDisplaySize(w * 0.45, 3200);
    const glow = this.scene.add.image(p.x, p.y, TEX.glow).setBlendMode(ADD).setTint(0xdff7ff);
    glow.setDisplaySize(w * 2.2, w * 2.2 * (TH / TW));
    this.L.fxC.add([beam, core, glow]);
    this.scene.tweens.add({
      targets: [beam, core],
      scaleX: { from: beam.scaleX * 1.25, to: 0 },
      alpha: { from: 1, to: 0 },
      duration: 480,
      ease: 'Quad.easeIn',
      onComplete: () => {
        beam.destroy();
        core.destroy();
      },
    });
    this.scene.tweens.add({ targets: glow, alpha: 0, scale: glow.scale * 1.6, duration: 600, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
  }

  /** Jagged lightning line between world points (given as grid positions raised by h). */
  lightning(points: { gx: number; gy: number; h: number }[], color = 0x9fe0ff): void {
    const g = this.scene.add.graphics();
    this.L.fxC.add(g);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = this.pt(points[i].gx, points[i].gy, points[i].h);
      const b = this.pt(points[i + 1].gx, points[i + 1].gy, points[i + 1].h);
      const segs = 6;
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const jitter = s === 0 ? 0 : 14;
        pts.push({ x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * jitter, y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * jitter });
      }
      if (i === points.length - 2) pts.push(b);
    }
    const draw = (width: number, c: number, a: number) => {
      g.lineStyle(width, c, a);
      g.beginPath();
      pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();
    };
    g.setBlendMode(ADD);
    draw(9 * this.k * 0.8, color, 0.35);
    draw(4 * this.k * 0.8, color, 0.9);
    draw(1.6 * this.k * 0.8, 0xffffff, 1);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
  }

  /** Quick additive flash sprite (muzzle flash, hangar launch...). */
  glowFlash(gx: number, gy: number, h: number, color: number, size: number, seconds = 0.25): void {
    const p = this.pt(gx, gy, h);
    const img = this.scene.add.image(p.x, p.y, TEX.glow).setBlendMode(ADD).setTint(color).setScale(size / 64 * 0.5);
    this.L.fxC.add(img);
    this.scene.tweens.add({ targets: img, scale: size / 64, alpha: 0, duration: seconds * 1000, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  /** Drops a sprite-ish pop ring when a tower is built/upgraded. */
  buildBurst(gx: number, gy: number, upgrade: boolean): void {
    this.dust(gx, gy, upgrade ? 10 : 16);
    this.shockwave(gx, gy, 0.55, upgrade ? 0xfff0a0 : 0xffffff, 0.4, 5);
    if (upgrade) this.hitSpark(gx, gy, 60, 'gold', 10);
  }
}
