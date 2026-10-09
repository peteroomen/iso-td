import Phaser from 'phaser';
import { ENEMIES, type EnemyState } from '../../core';
import { Layers } from './Fx';
import { BarInfo } from './KnightView';
import { depthOf, isoX, isoY } from './iso';
import { BOSS_SCALE, SLOW_TINT, enemyScale, hoverOf } from './style';
import { TEX } from './textures';

const ADD = Phaser.BlendModes.ADD;

/** One UFO: sprite, shadow, status effects (shield bubble, glint, red pulse, slow tint, hit flash). */
export class EnemyView {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly extra: Phaser.GameObjects.Image[] = [];
  private shield?: Phaser.GameObjects.Image;
  private pulse?: Phaser.GameObjects.Image;
  private glints: Phaser.GameObjects.Image[] = [];
  private engine?: Phaser.GameObjects.Image;
  private flashUntil = 0;
  private lastAttacking = false;
  /** 0 none, 1 slowed, 2 hit flash: avoids re-setting the tint every frame. */
  private tintMode = 0;
  /** Frame stamp used by SimRenderer to purge views of removed entities without allocating. */
  stamp = 0;
  private readonly phase = Math.random() * Math.PI * 2;
  private readonly baseScale: number;
  readonly hover: number;
  readonly type: EnemyState['type'];
  private squash = { v: 0 };
  /** Rendered top of the sprite (px above the container origin). */
  readonly spriteH: number;

  constructor(
    private readonly scene: Phaser.Scene,
    L: Layers,
    st: EnemyState,
  ) {
    const def = ENEMIES[st.type];
    this.type = st.type;
    this.hover = hoverOf(st);
    this.baseScale = st.boss ? BOSS_SCALE : enemyScale(def.scale);
    this.sprite = scene.add.image(0, 0, `ufo/${def.sprite}`).setOrigin(0.5, st.boss ? 0.62 : 0.88).setScale(this.baseScale);
    this.spriteH = this.sprite.displayHeight * (st.boss ? 0.62 : 0.88);
    this.container = scene.add.container(isoX(st.x, st.y), isoY(st.x, st.y));
    this.container.setDepth(depthOf(st.x, st.y) + 0.5);
    L.entityC.add(this.container);
    this.shadow = scene.add.image(0, 0, TEX.shadow);
    L.groundFxC.add(this.shadow);

    const w = this.sprite.displayWidth;
    if (st.type === 'dread' || st.boss) {
      this.pulse = scene.add.image(0, -this.sprite.displayHeight * 0.4, TEX.glow).setBlendMode(ADD).setTint(st.boss ? 0xff5a4a : 0xff3030).setAlpha(0.4);
      this.pulse.setDisplaySize(w * 1.5, w * 1.5);
      this.container.add(this.pulse);
    }
    if (st.boss) {
      this.engine = scene.add.image(0, this.sprite.displayHeight * 0.3, TEX.glow).setBlendMode(ADD).setTint(0xffa040).setAlpha(0.6);
      this.engine.setDisplaySize(w * 0.9, w * 0.35);
      this.container.add(this.engine);
    }
    this.container.add(this.sprite);
    if (st.type === 'prism') {
      this.shield = scene.add.image(0, -this.sprite.displayHeight * 0.45, TEX.bubble);
      this.shield.setDisplaySize(w * 1.18, this.sprite.displayHeight * 1.05);
      this.container.add(this.shield);
    }
    if (st.type === 'plated') {
      for (let i = 0; i < 2; i++) {
        const g = scene.add.image(-w * 0.18 + i * w * 0.34, -this.spriteH * (0.72 - i * 0.18), TEX.spark).setBlendMode(ADD).setScale(0);
        this.glints.push(g);
        this.container.add(g);
      }
    }
  }

  flash(): void {
    this.flashUntil = this.scene.time.now + 75;
  }

  /** Mothership hangar launch flash position (container-local) in world coords. */
  hangarWorld(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y + this.sprite.displayHeight * 0.3 };
  }

  update(st: EnemyState, time: number): void {
    const t = time / 1000 + this.phase;
    const px = isoX(st.x, st.y);
    const py = isoY(st.x, st.y);
    const bobAmp = st.boss ? 3 : st.flier ? 4 : 2.5;
    const bob = Math.sin(t * (st.boss ? 1.4 : 3.2)) * bobAmp;
    const alt = this.hover + bob;
    this.container.setPosition(px, py - alt);
    this.container.setDepth(depthOf(st.x, st.y) + 0.5);
    const tilt = Phaser.Math.Clamp((st.dirX - st.dirY) * 0.07 + Math.sin(t * 2.2) * 0.02, -0.12, 0.12);
    this.sprite.setRotation(st.boss ? tilt * 0.4 : tilt);

    // spawn / exit fade
    let fade = 1;
    if (st.progress < 0.8) fade = Math.max(0, st.progress / 0.8);
    else if (st.pathLength - st.progress < 0.5) fade = Math.max(0, (st.pathLength - st.progress) / 0.5);
    this.container.setAlpha(fade);

    const sh = this.hover / 80;
    const wBase = (st.boss ? 3.4 : 1.0 * this.baseScale) * (1 - Math.min(0.4, sh * 0.45));
    this.shadow.setPosition(px, py + 3);
    this.shadow.setScale(wBase * (st.boss ? 1 : 1) * 0.9, wBase * 0.9);
    this.shadow.setAlpha(fade * (st.flier ? 0.55 : 0.9) * (st.boss ? 0.8 : 1));

    // squash on attack
    if (st.attacking && !this.lastAttacking) {
      this.squash.v = 0;
      this.scene.tweens.add({ targets: this.squash, v: 1, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    }
    this.lastAttacking = st.attacking;
    const sq = this.squash.v;
    this.sprite.setScale(this.baseScale * (1 + sq * 0.08), this.baseScale * (1 - sq * 0.1));

    // tint
    const tintMode = this.flashUntil > this.scene.time.now ? 2 : st.slowed ? 1 : 0;
    if (tintMode !== this.tintMode) {
      this.tintMode = tintMode;
      if (tintMode === 2) this.sprite.setTintFill(0xffffff);
      else if (tintMode === 1) this.sprite.setTint(SLOW_TINT);
      else this.sprite.clearTint();
    }

    if (this.shield) this.shield.setAlpha(0.5 + 0.2 * Math.sin(t * 4));
    if (this.pulse) {
      const p = 0.5 + 0.5 * Math.sin(t * (st.boss ? 2.2 : 4));
      this.pulse.setAlpha(0.18 + 0.32 * p);
    }
    if (this.engine) this.engine.setAlpha(0.45 + 0.25 * Math.sin(t * 6));
    if (this.glints.length) {
      const cycle = (t * 0.6) % 2.4;
      for (let i = 0; i < this.glints.length; i++) {
        const g = this.glints[i];
        const k = Phaser.Math.Clamp(1 - Math.abs(cycle - (0.5 + i * 0.35)) / 0.25, 0, 1);
        g.setScale(k * 0.9);
        g.setRotation(k * 1.2);
      }
    }
  }

  /** Fills `out` (reused by the caller, no allocation) with this unit's hp bar. */
  bar(st: EnemyState, out: BarInfo): BarInfo {
    out.x = this.container.x;
    out.y = this.container.y - this.spriteH - 3;
    out.frac = st.hp / st.maxHp;
    out.width = st.type === 'dread' || st.type === 'carrier' ? 34 : 28;
    out.show = !st.boss && st.hp < st.maxHp - 0.01;
    return out;
  }

  destroy(): void {
    this.container.destroy();
    this.shadow.destroy();
    for (const e of this.extra) e.destroy();
  }
}
