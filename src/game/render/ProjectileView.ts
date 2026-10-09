import Phaser from 'phaser';
import type { ProjectileState } from '../../core';
import { Layers } from './Fx';
import { depthOf, isoX, isoY } from './iso';
import { TEX } from './textures';

const ADD = Phaser.BlendModes.ADD;

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
    this.img = scene.add.image(0, 0, this.isBolt ? 'towers/wizard_bullet' : 'towers/arrow').setScale(this.isBolt ? 3.4 : 2.7);
    if (this.isBolt) {
      this.glow = scene.add.image(0, 0, TEX.glow).setBlendMode(ADD).setTint(0x7fc8ff).setScale(1.0);
      L.fxC.add(this.glow);
    }
    L.fxC.add(this.img);
  }

  setHeights(from: number, to: number): void {
    this.fromH = from;
    this.toH = to;
  }

  update(st: ProjectileState, targetH: number): void {
    const total = Math.hypot(st.tx - st.fromX, st.ty - st.fromY) || 1;
    const done = Math.hypot(st.x - st.fromX, st.y - st.fromY);
    const t = Math.min(1, done / total);
    const toH = targetH || this.toH;
    const arc = this.isBolt ? 10 : 38;
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
  }
}
