import Phaser from 'phaser';
import { GAME_H, GAME_W, COLORS, textStyle } from '../ui/theme';
import { IsoView, TH, TW, isoX, isoY } from './iso';
import { FXTEX, SPEC_TEX } from './specVisuals';
import { TEX } from './textures';
import type { SpecId } from '../../core';

export interface Layers {
  world: Phaser.GameObjects.Container;
  groundC: Phaser.GameObjects.Container;
  groundFxC: Phaser.GameObjects.Container;
  entityC: Phaser.GameObjects.Container;
  fxC: Phaser.GameObjects.Container;
}

const ADD = Phaser.BlendModes.ADD;
const MAX_FLOATS = 20;

interface FloatText {
  text: Phaser.GameObjects.Text;
  key: string;
  age: number;
  x: number;
  y: number;
}

interface Ring {
  img: Phaser.GameObjects.Image;
  age: number;
  scale: number;
}

const FLOAT_IN = 0.18;
const FLOAT_DELAY = 0.38;
const FLOAT_OUT = 0.52;
const RING_TIME = 0.33;

function backOut(t: number): number {
  const c1 = 1.70158;
  const u = t - 1;
  return 1 + (c1 + 1) * u * u * u + c1 * u * u;
}

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
  private readonly trailGold: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rocketSmoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rocketFire: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flame: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ropeBits: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flashRect: Phaser.GameObjects.Rectangle;
  private readonly vignette: Phaser.GameObjects.Image;
  private shakeLeft = 0;
  private shakeMax = 0;
  private shakeMag = 0;
  /** screen px -> world px */
  private readonly k: number;
  /** Pooled floating "+gold" texts and explosion rings: animated by hand in update() (no tween / Text churn per kill). */
  private readonly floats: FloatText[] = [];
  private readonly floatPool = new Map<string, Phaser.GameObjects.Text[]>();
  private readonly rings: Ring[] = [];
  private readonly ringPool: Phaser.GameObjects.Image[] = [];

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
      scale: { start: 0.85, end: 0.1 },
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
      scale: { start: 1.0, end: 0.4 },
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

    this.trailGold = mk(TEX.glow, {
      lifespan: 340,
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xffd34e,
      blendMode: ADD,
    });
    this.rocketSmoke = mk(TEX.smoke, {
      lifespan: { min: 380, max: 620 },
      speed: { min: 4, max: 20 },
      scale: { start: 0.22, end: 0.8 },
      alpha: { start: 0.5, end: 0 },
      tint: 0xb9b6c6,
      angle: { min: 0, max: 360 },
    });
    this.rocketFire = mk(TEX.glow, {
      lifespan: 170,
      scale: { start: 0.42, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: 0xffa23a,
      blendMode: ADD,
    });
    this.flame = mk(FXTEX.flame, {
      lifespan: { min: 320, max: 560 },
      speedY: { min: -70, max: -35 },
      speedX: { min: -14, max: 14 },
      scale: { start: 0.65, end: 0.1 },
      alpha: { start: 0.95, end: 0 },
      color: [0xfff1a0, 0xffa23a, 0xe0562a],
      colorEase: 'quad.out',
      blendMode: ADD,
    });
    this.ropeBits = mk(TEX.debris, {
      lifespan: { min: 300, max: 560 },
      speed: { min: 30, max: 120 },
      gravityY: 300,
      angle: { min: 200, max: 340 },
      rotate: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0.3 },
      alpha: { start: 1, end: 0 },
      color: [0xefe3b8, 0xc9b87a],
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
    this.updateFloats(dt);
    this.updateRings(dt);
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
    const n = size === 'small' ? 8 : size === 'big' ? 16 : 40;
    this.fire.explode(n, p.x, p.y);
    this.sparkWhite.explode(size === 'small' ? 6 : 14, p.x, p.y);
    this.debris.explode(size === 'small' ? 5 : size === 'big' ? 10 : 24, p.x, p.y);
    this.smoke.explode(size === 'small' ? 3 : 7, p.x, p.y);
    let img = this.ringPool.pop();
    if (!img) {
      img = this.scene.add.image(0, 0, TEX.glow).setBlendMode(ADD).setTint(0xffd27a);
      this.L.fxC.add(img);
    }
    img.setPosition(p.x, p.y).setScale(0.3).setAlpha(0.9).setVisible(true);
    this.rings.push({ img, age: 0, scale: size === 'small' ? 1.2 : size === 'big' ? 2.0 : 4.2 });
  }

  private updateRings(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const t = Math.min(1, r.age / RING_TIME);
      const e = 1 - (1 - t) * (1 - t);
      r.img.setScale(0.3 + (r.scale - 0.3) * e).setAlpha(0.9 * (1 - e));
      if (t >= 1) {
        r.img.setVisible(false);
        this.ringPool.push(r.img);
        this.rings[i] = this.rings[this.rings.length - 1];
        this.rings.pop();
      }
    }
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

  trail(gx: number, gy: number, h: number, gold = false): void {
    const p = this.pt(gx, gy, h);
    (gold ? this.trailGold : this.trailBlue).emitParticleAt(p.x, p.y, 1);
  }

  /** Rocket exhaust at a grid position raised by h (smoke + hot core). */
  rocketTrail(gx: number, gy: number, h: number): void {
    const p = this.pt(gx, gy, h);
    this.rocketSmoke.emitParticleAt(p.x, p.y, 1);
    this.rocketFire.emitParticleAt(p.x, p.y, 1);
  }

  /** One small flame lick at a world-local px point. */
  flameAt(x: number, y: number): void {
    this.flame.emitParticleAt(x, y, 1);
  }

  /** Small embers at a world-local px point. */
  emberPx(x: number, y: number): void {
    this.ember.emitParticleAt(x, y, 1);
  }

  /** Rope fibres flying when a net is torn / expires. */
  ropeSnap(gx: number, gy: number, h: number): void {
    const p = this.pt(gx, gy, h);
    this.ropeBits.explode(7, p.x, p.y);
    this.puff(gx, gy, h);
  }

  /** The net lands: dust, rope bits and a pale ring. */
  netLand(gx: number, gy: number, radius: number): void {
    const p = this.pt(gx, gy, 6);
    this.dust(gx, gy, 10);
    this.ropeBits.explode(10, p.x, p.y);
    this.shockwave(gx, gy, radius * 0.9, 0xf3ead0, 0.35, 5);
  }

  /** Celebration when a tower buys a specialization: emblem pop, coloured ring, sparks. */
  specBurst(gx: number, gy: number, spec: SpecId, color: number, h: number): void {
    const p = this.pt(gx, gy, h);
    this.shockwave(gx, gy, 0.9, color, 0.55, 8);
    this.shockwave(gx, gy, 0.5, 0xffffff, 0.4, 5);
    this.hitSpark(gx, gy, h, 'gold', 18);
    this.hitSpark(gx, gy, h, 'white', 8);
    this.glowFlash(gx, gy, h, color, 260, 0.45);
    const img = this.scene.add.image(p.x, p.y, SPEC_TEX[spec]).setScale(0.1);
    this.L.fxC.add(img);
    img.setDepth(1e6);
    this.scene.tweens.add({ targets: img, scale: 1.5, y: p.y - 26, duration: 360, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: img, alpha: 0, scale: 1.9, y: p.y - 56, delay: 620, duration: 380, ease: 'Quad.easeIn', onComplete: () => img.destroy() });
  }

  emberAt(gx: number, gy: number): void {
    const p = this.pt(gx, gy, 2);
    this.ember.emitParticleAt(p.x, p.y, 1);
  }

  // ------------------------------------------------------------------ text

  floatText(gx: number, gy: number, text: string, color: string, h = 60, size = 22): void {
    if (this.floats.length >= MAX_FLOATS) return;
    const p = this.pt(gx, gy, h);
    // pool by content: identical "+9" labels reuse the same rendered canvas
    const key = `${text}|${color}|${size}`;
    let t = this.floatPool.get(key)?.pop();
    if (!t) {
      t = this.scene.add.text(0, 0, text, textStyle(size, color)).setOrigin(0.5);
      this.L.fxC.add(t);
    }
    t.setPosition(p.x, p.y).setScale(this.k * 0.4).setAlpha(1).setVisible(true);
    this.floats.push({ text: t, key, age: 0, x: p.x, y: p.y });
  }

  private updateFloats(dt: number): void {
    const rise = 70 * this.k * 1.3;
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.age += dt;
      const t = f.text;
      if (f.age < FLOAT_IN) t.setScale(this.k * (0.4 + 0.6 * backOut(f.age / FLOAT_IN)));
      else if (f.age < FLOAT_IN + 0.05) t.setScale(this.k);
      if (f.age > FLOAT_DELAY) {
        const u = Math.min(1, (f.age - FLOAT_DELAY) / FLOAT_OUT);
        t.y = f.y - rise * u * u;
        t.setAlpha(1 - u * u);
        if (u >= 1) {
          t.setVisible(false);
          let pool = this.floatPool.get(f.key);
          if (!pool) this.floatPool.set(f.key, (pool = []));
          pool.push(t);
          this.floats[i] = this.floats[this.floats.length - 1];
          this.floats.pop();
        }
      }
    }
  }

  coinPop(gx: number, gy: number, amount: number, h = 50): void {
    if (amount <= 0) return;
    this.floatText(gx, gy, `+${amount}`, COLORS.textGold, h, 17);
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
  lightning(points: { gx: number; gy: number; h: number }[], color = 0x9fe0ff, intensity = 1): void {
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
    const wk = 0.55 + 0.45 * intensity;
    draw(9 * wk * this.k * 0.8, color, 0.35 * intensity);
    draw(4 * wk * this.k * 0.8, color, 0.9 * intensity);
    draw(1.6 * wk * this.k * 0.8, 0xffffff, intensity);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
  }

  /** Quick additive flash sprite (muzzle flash, hangar launch...). */
  glowFlash(gx: number, gy: number, h: number, color: number, size: number, seconds = 0.25): void {
    const p = this.pt(gx, gy, h);
    const img = this.scene.add.image(p.x, p.y, TEX.glow).setBlendMode(ADD).setTint(color).setScale(size / 64 * 0.5);
    this.L.fxC.add(img);
    this.scene.tweens.add({ targets: img, scale: size / 64, alpha: 0, duration: seconds * 1000, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  /** Mortar launch at a world-local px point (the barrel mouth): hot flash + smoke puff drifting up-right. */
  muzzleBlast(x: number, y: number, size = 1): void {
    const flash = this.scene.add.image(x, y, TEX.glow).setBlendMode(ADD).setTint(0xffd27a).setScale(0.3 * size).setAlpha(1);
    const core = this.scene.add.image(x, y, TEX.glow).setBlendMode(ADD).setTint(0xffffff).setScale(0.15 * size).setAlpha(1);
    this.L.fxC.add([flash, core]);
    flash.setDepth(1e6);
    core.setDepth(1e6 + 1);
    this.scene.tweens.add({ targets: flash, scale: 1.5 * size, alpha: 0, duration: 190 + 40 * (size - 1), ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    this.scene.tweens.add({ targets: core, scale: 0.7 * size, alpha: 0, duration: 110, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
    this.smoke.explode(Math.round(4 * size), x + 6, y - 6);
    this.sparkGold.explode(Math.round(5 * size), x, y);
    this.sparkWhite.explode(Math.round(3 * size), x, y);
  }

  /**
   * Bomb tower blast (shell or bomblet) scaled to the sim's splash `radius` (tiles): flash, fireball, smoke, debris,
   * a shockwave ellipse that ends exactly on the radius and a scorch decal fading over ~2 s. Only a Lv3 shell shakes the view.
   */
  bombBlast(gx: number, gy: number, radius: number, shell: boolean, shake: boolean): void {
    const p = this.pt(gx, gy, 10);
    const k = Math.max(0.5, radius);
    this.glowFlash(gx, gy, 12, 0xfff0b0, shell ? 220 * k : 130 * k, 0.2);
    this.glowFlash(gx, gy, 10, 0xff8a2a, shell ? 330 * k : 190 * k, 0.32);
    this.fire.explode(shell ? 16 : 6, p.x, p.y);
    this.fire.explode(shell ? 8 : 3, p.x, p.y - 16);
    this.sparkWhite.explode(shell ? 8 : 3, p.x, p.y);
    this.debris.explode(shell ? 9 : 3, p.x, p.y);
    this.smoke.explode(shell ? 6 : 2, p.x, p.y - 8);
    this.dust(gx, gy, shell ? 8 : 3);
    this.shockwave(gx, gy, radius / 1.1, shell ? 0xffc060 : 0xffd890, shell ? 0.42 : 0.3, shell ? 7 : 4);
    const rx = radius * TW * 0.7071 * 0.85;
    const ry = radius * TH * 0.7071 * 0.85;
    const g = this.scene.add.graphics({ x: p.x, y: p.y + 10 });
    g.fillStyle(0x1a1020, 0.34).fillEllipse(0, 0, rx * 2, ry * 2);
    g.fillStyle(0x1a1020, 0.3).fillEllipse(0, 0, rx * 1.1, ry * 1.1);
    this.L.groundFxC.add(g);
    this.scene.tweens.add({ targets: g, alpha: 0, delay: 500, duration: 1500, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
    if (shell && shake) this.shake(3.5, 0.22);
  }

  /** Drops a sprite-ish pop ring when a tower is built/upgraded. */
  buildBurst(gx: number, gy: number, upgrade: boolean): void {
    this.dust(gx, gy, upgrade ? 10 : 16);
    this.shockwave(gx, gy, 0.55, upgrade ? 0xfff0a0 : 0xffffff, 0.4, 5);
    if (upgrade) this.hitSpark(gx, gy, 60, 'gold', 10);
  }
}
