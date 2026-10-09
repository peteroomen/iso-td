import Phaser from 'phaser';
import type { TowerState } from '../../core';
import { depthOf, isoX, isoY } from './iso';
import { Layers } from './Fx';
import { TEX } from './textures';

const BASE_OY: Record<string, number> = { archer: 0.86, wizard: 0.8, barracks: 0.82 };
export const TOWER_SCALE = 1.2;

function bodyKey(t: TowerState, door: number): string {
  if (t.kind === 'archer') return `towers/archer_level_${t.level}`;
  if (t.kind === 'wizard') return `towers/wizard_level_${t.level}`;
  return `towers/barrack_level_${t.level}_${door === 2 ? 2 : 1}`;
}

/** Visual for one tower: body sprite, archer/bow animation, wizard flash, level pips, pop tweens. */
export class TowerView {
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Image;
  private readonly unit?: Phaser.GameObjects.Image;
  private readonly bow?: Phaser.GameObjects.Image;
  private readonly glow?: Phaser.GameObjects.Image;
  private readonly pips: Phaser.GameObjects.Graphics;
  private level = 0;
  /** Frame stamp used by SimRenderer to purge views of removed entities without allocating. */
  stamp = 0;
  private lastShots: number;
  private bowT = 99;
  private flashT = 99;
  private flipped = false;
  private door = 1;
  private popTween?: Phaser.Tweens.Tween;
  readonly gx: number;
  readonly gy: number;
  readonly kind: TowerState['kind'];

  constructor(
    private readonly scene: Phaser.Scene,
    L: Layers,
    st: TowerState,
  ) {
    this.gx = st.x;
    this.gy = st.y;
    this.kind = st.kind;
    this.lastShots = st.shotCount;
    this.container = scene.add.container(isoX(st.x, st.y), isoY(st.x, st.y));
    this.container.setDepth(depthOf(st.x, st.y));
    L.entityC.add(this.container);
    this.pips = scene.add.graphics();
    this.body = scene.add.image(0, 0, bodyKey(st, 1)).setScale(TOWER_SCALE);
    this.container.add([this.body, this.pips]);
    if (st.kind === 'archer') {
      this.unit = scene.add.image(0, 0, 'towers/archer').setScale(TOWER_SCALE * 0.95);
      this.bow = scene.add.image(0, 0, 'towers/bow_animation_1').setScale(TOWER_SCALE * 0.9).setVisible(false);
      this.container.add([this.unit, this.bow]);
    } else if (st.kind === 'wizard') {
      this.glow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0x7fd0ff).setAlpha(0).setScale(0.8);
      this.container.add(this.glow);
    }
    this.applyLevel(st);
  }

  private applyLevel(st: TowerState): void {
    this.level = st.level;
    this.body.setTexture(bodyKey(st, this.door));
    this.body.setOrigin(0.5, BASE_OY[st.kind]);
    const h = this.body.height * TOWER_SCALE;
    const top = -h * BASE_OY[st.kind];
    if (this.unit) {
      this.unit.setOrigin(0.5, 0.8);
      this.unit.y = top + h * (st.level === 1 ? 0.36 : st.level === 2 ? 0.34 : 0.33);
      this.unit.x = 0;
    }
    if (this.glow) this.glow.setPosition(-14 * TOWER_SCALE, top + h * 0.3);
    this.pips.clear();
    for (let i = 0; i < st.level; i++) {
      const x = (i - (st.level - 1) / 2) * 15;
      this.pips.fillStyle(0xffd34e, 1).fillCircle(x, 30, 6.5);
      this.pips.lineStyle(2.5, 0x2e222f, 1).strokeCircle(x, 30, 6.5);
    }
  }

  /** Face the barracks door towards the rally point (screen-space dx). */
  setDoorFacing(rallyScreenDx: number, st: TowerState): void {
    const d = rallyScreenDx < 0 ? 1 : 2;
    if (d !== this.door) {
      this.door = d;
      this.body.setTexture(bodyKey(st, d));
    }
  }

  update(st: TowerState, dt: number): void {
    if (st.level !== this.level) this.applyLevel(st);
    this.bowT += dt;
    this.flashT += dt;
    const sdx = st.facingX - st.facingY;
    if (Math.abs(sdx) > 0.05) this.flipped = sdx < 0;
    if (st.shotCount !== this.lastShots) {
      this.lastShots = st.shotCount;
      this.bowT = 0;
      this.flashT = 0;
    }
    if (this.unit && this.bow) {
      this.unit.setFlipX(this.flipped);
      const frame = this.bowT < 0.3 ? Math.min(4, 1 + Math.floor(this.bowT / 0.075)) : 0;
      if (frame > 0) {
        this.bow.setVisible(true).setTexture(`towers/bow_animation_${frame}`);
        this.bow.setFlipX(!this.flipped);
        this.bow.x = this.unit.x + (this.flipped ? -15 : 15);
        this.bow.y = this.unit.y - 20;
      } else {
        this.bow.setVisible(false);
      }
    }
    if (this.glow) {
      const a = this.flashT < 0.35 ? 1 - this.flashT / 0.35 : 0;
      this.glow.setAlpha(a);
      this.glow.setScale(0.5 + a * 0.5);
      this.body.y = this.flashT < 0.15 ? -2 * (1 - this.flashT / 0.15) : 0;
    }
  }

  pop(kind: 'build' | 'upgrade'): void {
    this.popTween?.stop();
    if (kind === 'build') {
      this.container.setScale(0.2, 0.05);
      this.popTween = this.scene.tweens.add({ targets: this.container, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.easeOut' });
    } else {
      this.container.setScale(1);
      this.popTween = this.scene.tweens.add({ targets: this.container, scaleX: { from: 0.8, to: 1 }, scaleY: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      this.body.setTintFill(0xffffff);
      this.scene.time.delayedCall(110, () => this.body.active && this.body.clearTint());
    }
  }

  /** Is the world-local point on this tower's sprite? */
  hitTest(lx: number, ly: number): boolean {
    const w = this.body.displayWidth * 0.5;
    const top = this.container.y - this.body.displayHeight * BASE_OY[this.kind];
    const bottom = this.container.y + 30;
    return Math.abs(lx - this.container.x) <= w * 0.85 && ly >= top && ly <= bottom;
  }

  destroyAnimated(): void {
    this.popTween?.stop();
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.1,
      scaleY: 0.1,
      alpha: 0,
      duration: 220,
      ease: 'Back.easeIn',
      onComplete: () => this.container.destroy(),
    });
  }

  destroy(): void {
    this.popTween?.stop();
    this.container.destroy();
  }
}
