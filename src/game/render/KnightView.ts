import Phaser from 'phaser';
import type { KnightState } from '../../core';
import { Layers } from './Fx';
import { depthOf, isoX, isoY } from './iso';
import { KNIGHT_SCALE, MILITIA_TINT } from './style';
import { TEX } from './textures';

export interface BarInfo {
  x: number;
  y: number;
  frac: number;
  width: number;
  show: boolean;
}

/** Barracks knight / militia unit. */
export class KnightView {
  readonly container: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private flip = false;
  private lastAttacking = false;
  private wasDead = false;
  private flashUntil = 0;
  private lunge = { x: 0, y: 0 };
  private lungeTween?: Phaser.Tweens.Tween;
  private bob = Math.random() * 6;
  private level: number;
  /** Frame stamp used by SimRenderer to purge views of removed entities without allocating. */
  stamp = 0;
  private appear = 1;
  private readonly militia: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    L: Layers,
    st: KnightState,
  ) {
    this.militia = st.kind === 'militia';
    this.level = st.level;
    this.sprite = scene.add.image(0, 0, this.keyFor(st)).setOrigin(0.5, 0.94).setScale(KNIGHT_SCALE);
    if (this.militia) this.sprite.setTint(MILITIA_TINT);
    this.container = scene.add.container(isoX(st.x, st.y), isoY(st.x, st.y), [this.sprite]);
    this.container.setDepth(depthOf(st.x, st.y));
    L.entityC.add(this.container);
    this.shadow = scene.add.image(0, 0, TEX.shadow).setScale(1.05, 1.05).setAlpha(0.85);
    L.groundFxC.add(this.shadow);
  }

  private keyFor(st: KnightState): string {
    return `units/knight_level_${this.militia ? 1 : Math.max(1, Math.min(3, st.level))}`;
  }

  flash(): void {
    this.flashUntil = this.scene.time.now + 80;
  }

  dropIn(): void {
    this.appear = 0;
    this.sprite.setAlpha(0);
    this.scene.tweens.add({
      targets: this.sprite,
      y: { from: -260, to: 0 },
      alpha: { from: 0, to: 1 },
      duration: 420,
      ease: 'Bounce.easeOut',
      onComplete: () => (this.appear = 1),
    });
  }

  update(st: KnightState, _time: number, dt: number): void {
    const dead = st.mode === 'dead';
    const px = isoX(st.x, st.y);
    const py = isoY(st.x, st.y);
    if (dead !== this.wasDead) {
      this.wasDead = dead;
      this.scene.tweens.killTweensOf(this.sprite);
      if (dead) {
        this.scene.tweens.add({ targets: this.sprite, alpha: 0, scaleY: 0.2, duration: 220 });
      } else {
        this.sprite.setScale(KNIGHT_SCALE).setAlpha(0);
        this.scene.tweens.add({ targets: this.sprite, alpha: 1, scaleX: { from: 0.2, to: KNIGHT_SCALE }, scaleY: { from: 0.2, to: KNIGHT_SCALE }, duration: 300, ease: 'Back.easeOut' });
      }
    }
    if (st.level !== this.level) {
      this.level = st.level;
      this.sprite.setTexture(this.keyFor(st));
      this.scene.tweens.add({ targets: this.sprite, scaleX: { from: KNIGHT_SCALE * 1.3, to: KNIGHT_SCALE }, scaleY: { from: KNIGHT_SCALE * 1.3, to: KNIGHT_SCALE }, duration: 300, ease: 'Back.easeOut' });
    }
    const walking = st.mode === 'walking';
    this.bob += dt * (walking ? 16 : 3);
    const bobY = walking ? -Math.abs(Math.sin(this.bob)) * 6.5 : Math.sin(this.bob) * 1;
    this.container.setPosition(px + this.lunge.x, py + this.lunge.y + (this.appear === 1 ? bobY : 0));
    this.container.setDepth(depthOf(st.x, st.y));
    this.shadow.setPosition(px, py + 2);
    this.shadow.setVisible(!dead);
    this.shadow.setAlpha(this.appear);

    const sdx = st.facingX - st.facingY;
    if (Math.abs(sdx) > 0.08) this.flip = sdx < 0;
    this.sprite.setFlipX(this.flip);

    if (st.attacking && !this.lastAttacking) {
      const dx = (st.facingX - st.facingY) * 114;
      const dy = (st.facingX + st.facingY) * 66;
      const l = Math.hypot(dx, dy) || 1;
      this.lunge.x = 0;
      this.lunge.y = 0;
      this.lungeTween?.stop();
      const to = { x: (dx / l) * 19, y: (dy / l) * 11 };
      this.lungeTween = this.scene.tweens.add({ targets: this.lunge, x: to.x, y: to.y, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    }
    this.lastAttacking = st.attacking;
    if (this.flashUntil > this.scene.time.now) this.sprite.setTintFill(0xffffff);
    else if (this.militia) this.sprite.setTint(MILITIA_TINT);
    else this.sprite.clearTint();
    // militia fade out near the end of their life
    if (this.militia && st.lifeLeft >= 0 && st.lifeLeft < 1.2 && !dead) this.sprite.setAlpha(0.35 + 0.65 * Math.abs(Math.sin(this.scene.time.now * 0.02)));
  }

  /** Fills `out` (reused by the caller, no allocation) with this unit's hp bar. */
  bar(st: KnightState, out: BarInfo): BarInfo {
    out.x = this.container.x;
    out.y = this.container.y - this.sprite.displayHeight * 0.94 - 6;
    out.frac = st.hp / st.maxHp;
    out.width = 30;
    out.show = st.mode !== 'dead' && st.hp < st.maxHp - 0.01;
    return out;
  }

  destroy(): void {
    this.lungeTween?.stop();
    this.container.destroy();
    this.shadow.destroy();
  }
}
