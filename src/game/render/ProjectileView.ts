import Phaser from 'phaser';
import type { ProjectileState } from '../../core';
import { Layers } from './Fx';
import { TH, TW, depthOf, isoX, isoY } from './iso';
import { ARROW_SCALE, BOLT_SCALE, BOMBLET_SCALE, SHELL_SCALE } from './style';
import { TEX } from './textures';

const ADD = Phaser.BlendModes.ADD;
/** Source px of apex height per tile of the sim's `arc` (shell 1.6 tiles -> ~130 px, bomblet 0.5 -> ~40 px). */
const ARC_PX_PER_TILE = 82;

/** Arrow (rotated along its velocity with a slight arc) or glowing wizard bolt. */
export class ProjectileView {
  readonly img: Phaser.GameObjects.Image;
  private readonly glow?: Phaser.GameObjects.Image;
  private px = 0;
  private py = 0;
  private started = false;
  /** world-local position / height for trails */
  gx = 0;
  gy = 0;
  h = 0;
  readonly isBolt: boolean;
  readonly isLob: boolean;
  /** Lob (shell / bomblet) extras: ground shadow, faint landing marker, fuse spark. */
  private readonly shadow?: Phaser.GameObjects.Image;
  private readonly marker?: Phaser.GameObjects.Image;
  private readonly spark?: Phaser.GameObjects.Image;
  private baseScale = 1;
  /** Frame stamp used by SimRenderer to purge views of removed entities without allocating. */
  stamp = 0;

  constructor(
    scene: Phaser.Scene,
    L: Layers,
    st: ProjectileState,
    private fromH: number,
    private toH: number,
  ) {
    this.isBolt = st.kind === 'bolt';
    this.isLob = st.kind === 'shell' || st.kind === 'bomblet';
    if (this.isLob) {
      this.baseScale = st.kind === 'shell' ? SHELL_SCALE : BOMBLET_SCALE;
      this.img = scene.add.image(0, 0, TEX.shell).setScale(this.baseScale);
      this.shadow = scene.add.image(0, 0, TEX.shadow).setAlpha(0);
      this.marker = scene.add.image(isoX(st.tx, st.ty), isoY(st.tx, st.ty), TEX.ring).setTint(0xffb35c).setAlpha(st.kind === 'shell' ? 0.3 : 0.18);
      const rx = st.radius * TW * 0.7071 * 2;
      this.marker.setDisplaySize(rx * 1.1, rx * 1.1 * (TH / TW));
      this.spark = scene.add.image(0, 0, TEX.glow).setBlendMode(ADD).setTint(0xffc65a).setScale(0.5 * this.baseScale);
      L.groundFxC.add([this.marker, this.shadow]);
      L.fxC.add(this.spark);
      L.fxC.add(this.img);
      return;
    }
    this.img = scene.add.image(0, 0, this.isBolt ? 'towers/wizard_bullet' : 'towers/arrow').setScale(this.isBolt ? BOLT_SCALE : ARROW_SCALE);
    if (this.isBolt) {
      this.glow = scene.add.image(0, 0, TEX.glow).setBlendMode(ADD).setTint(0x7fc8ff).setScale(0.85);
      L.fxC.add(this.glow);
    }
    L.fxC.add(this.img);
  }

  setHeights(from: number, to: number): void {
    this.fromH = from;
    this.toH = to;
  }

  private updateLob(st: ProjectileState): void {
    const p = Math.max(0, Math.min(1, st.progress));
    const arc = st.arc * ARC_PX_PER_TILE;
    // leaves the muzzle at fromH, lands on the ground
    this.h = this.fromH * (1 - p) * (1 - p) + 4 * p * (1 - p) * arc;
    this.gx = st.x;
    this.gy = st.y;
    const x = isoX(st.x, st.y);
    const gy = isoY(st.x, st.y);
    const apex = Math.sin(Math.PI * p);
    const sc = this.baseScale * (1 + 0.2 * apex);
    this.img.setPosition(x, gy - this.h - 6).setScale(sc).setRotation(p * 5);
    this.img.setDepth(depthOf(st.x, st.y) + 1000);
    if (this.spark) {
      const fl = 0.8 + 0.4 * Math.sin(st.elapsed * 60);
      this.spark.setPosition(x + Math.cos(p * 5 - 1.1) * 17 * sc, gy - this.h - 6 + Math.sin(p * 5 - 1.1) * 17 * sc).setScale(0.45 * sc * fl).setDepth(depthOf(st.x, st.y) + 1001);
    }
    if (this.shadow) {
      const k = (st.kind === 'shell' ? 0.45 : 0.28) * (0.55 + 0.6 * p) * (1 - 0.25 * apex);
      this.shadow.setPosition(x, gy).setScale(k).setAlpha(0.35 + 0.5 * p);
    }
    if (this.marker) this.marker.setAlpha((st.kind === 'shell' ? 0.22 : 0.14) + 0.18 * p);
  }

  update(st: ProjectileState, targetH: number): void {
    if (this.isLob) {
      this.updateLob(st);
      return;
    }
    const total = Math.hypot(st.tx - st.fromX, st.ty - st.fromY) || 1;
    const done = Math.hypot(st.x - st.fromX, st.y - st.fromY);
    const t = Math.min(1, done / total);
    const toH = targetH || this.toH;
    const arc = this.isBolt ? 6 : 24;
    this.h = this.fromH + (toH - this.fromH) * t + Math.sin(Math.PI * t) * arc;
    this.gx = st.x;
    this.gy = st.y;
    const x = isoX(st.x, st.y);
    const y = isoY(st.x, st.y) - this.h;
    if (this.started) {
      const dx = x - this.px;
      const dy = y - this.py;
      if (dx * dx + dy * dy > 0.04) this.img.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    }
    this.started = true;
    this.px = x;
    this.py = y;
    this.img.setPosition(x, y);
    this.glow?.setPosition(x, y);
    this.img.setDepth(depthOf(st.x, st.y) + 1000);
    // projectiles live in fxC (above entities): keep them depth-sorted among themselves only
  }

  destroy(): void {
    this.img.destroy();
    this.glow?.destroy();
    this.shadow?.destroy();
    this.marker?.destroy();
    this.spark?.destroy();
  }
}
