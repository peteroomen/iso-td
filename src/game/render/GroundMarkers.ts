import Phaser from 'phaser';
import type { BuildSpot } from '../../core';
import { Layers } from './Fx';
import { IsoView, TH, TW, depthOf, isoX, isoY } from './iso';
import { TEX } from './textures';

export interface RangeCircle {
  gx: number;
  gy: number;
  r: number;
  color?: number;
}

export interface Reticle {
  gx: number;
  gy: number;
  r: number;
  valid: boolean;
  /** Optional second circle (e.g. max distance from the road for reinforcements). */
  inner?: number;
  /** Draw a snap marker (grid position) */
  snap?: { gx: number; gy: number };
}

/** Ground-level overlays: build-spot glow, range ellipses, selection ring, rally flags, targeting reticle. */
export class GroundMarkers {
  private readonly g: Phaser.GameObjects.Graphics;
  hoverSpot: number | null = null;
  /** Spot ids that currently have no tower. */
  emptySpots = new Set<number>();
  /** Show the pulsing glow on empty spots (hidden while ability targeting). */
  showSpotGlow = true;
  range: RangeCircle | null = null;
  /** Second, fainter range preview (e.g. next-level range). */
  range2: RangeCircle | null = null;
  selected: { gx: number; gy: number } | null = null;
  reticle: Reticle | null = null;
  private flags: { img: Phaser.GameObjects.Image; gx: number; gy: number }[] = [];
  private readonly k: number;
  /** Exit arrows: where UFOs leave the map (and cost lives). */
  private readonly exits: { gx: number; gy: number; dx: number; dy: number }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    view: IsoView,
    private readonly L: Layers,
    private readonly spots: readonly BuildSpot[],
  ) {
    this.k = 1 / view.scale;
    this.g = scene.add.graphics();
    L.groundFxC.add(this.g);
  }

  /** Register the last in-map point of every path as an exit marker. */
  setExits(paths: readonly { pts: readonly { x: number; y: number }[] }[]): void {
    this.exits.length = 0;
    for (const p of paths) {
      const a = p.pts[p.pts.length - 2];
      const b = p.pts[p.pts.length - 1];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const dx = (b.x - a.x) / l;
      const dy = (b.y - a.y) / l;
      this.exits.push({ gx: b.x - dx * 0.75, gy: b.y - dy * 0.75, dx, dy });
    }
  }

  setRallyFlags(list: { gx: number; gy: number; preview?: boolean }[]): void {
    while (this.flags.length > list.length) this.flags.pop()!.img.destroy();
    while (this.flags.length < list.length) {
      const img = this.scene.add.image(0, 0, TEX.flag).setOrigin(0.28, 0.92).setScale(1.3);
      this.L.entityC.add(img);
      this.flags.push({ img, gx: 0, gy: 0 });
    }
    list.forEach((f, i) => {
      const fl = this.flags[i];
      fl.gx = f.gx;
      fl.gy = f.gy;
      fl.img.setPosition(isoX(f.gx, f.gy), isoY(f.gx, f.gy));
      fl.img.setDepth(depthOf(f.gx, f.gy) + 0.2);
      fl.img.setAlpha(f.preview ? 0.7 : 1);
    });
  }

  private diamond(cx: number, cy: number, inset = 0): { x: number; y: number }[] {
    const hw = TW / 2 - inset * 1.7;
    const hh = TH / 2 - inset;
    return [
      { x: cx, y: cy - hh },
      { x: cx + hw, y: cy },
      { x: cx, y: cy + hh },
      { x: cx - hw, y: cy },
    ];
  }

  private ellipse(gx: number, gy: number, r: number): { x: number; y: number; w: number; h: number } {
    return { x: isoX(gx, gy), y: isoY(gx, gy), w: 2 * r * TW * 0.7071, h: 2 * r * TH * 0.7071 };
  }

  update(time: number): void {
    const g = this.g;
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);

    if (this.showSpotGlow) {
      for (const id of this.emptySpots) {
        const s = this.spots[id];
        if (!s) continue;
        const cx = isoX(s.x, s.y);
        const cy = isoY(s.x, s.y);
        const hov = this.hoverSpot === id;
        const pts = this.diamond(cx, cy, hov ? 8 : 12);
        g.fillStyle(0xffffff, hov ? 0.4 : 0.1 + 0.12 * pulse);
        g.fillPoints(pts, true);
        g.lineStyle((hov ? 5 : 3.5) * this.k * 0.6 + 2, 0xfff4d6, hov ? 0.95 : 0.35 + 0.35 * pulse);
        g.strokePoints(pts, true);
      }
    }

    for (const ex of this.exits) {
      // pulsing chevrons on the road pointing out of the map
      for (let i = 0; i < 2; i++) {
        const off = ((time * 0.0012 + i * 0.5) % 1) * 0.9 - 0.45;
        const cx = ex.gx + ex.dx * off;
        const cy = ex.gy + ex.dy * off;
        const px = -ex.dy;
        const py = ex.dx;
        const tip = { x: isoX(cx + ex.dx * 0.22, cy + ex.dy * 0.22), y: isoY(cx + ex.dx * 0.22, cy + ex.dy * 0.22) };
        const l = { x: isoX(cx - ex.dx * 0.12 + px * 0.28, cy - ex.dy * 0.12 + py * 0.28), y: isoY(cx - ex.dx * 0.12 + px * 0.28, cy - ex.dy * 0.12 + py * 0.28) };
        const r = { x: isoX(cx - ex.dx * 0.12 - px * 0.28, cy - ex.dy * 0.12 - py * 0.28), y: isoY(cx - ex.dx * 0.12 - px * 0.28, cy - ex.dy * 0.12 - py * 0.28) };
        const a = 0.75 * Math.sin(Math.PI * ((off + 0.45) / 0.9));
        g.fillStyle(0xe5484d, a).fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
        g.lineStyle(3, 0x2e222f, a * 0.8).strokeTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
      }
    }

    if (this.selected) {
      const e = this.ellipse(this.selected.gx, this.selected.gy, 0.62);
      g.lineStyle(3.5, 0xffe27a, 0.95);
      g.strokeEllipse(e.x, e.y, e.w, e.h);
      g.fillStyle(0xffe27a, 0.14 + 0.08 * pulse);
      g.fillEllipse(e.x, e.y, e.w, e.h);
    }

    for (const rc of [this.range2, this.range]) {
      if (!rc) continue;
      const e = this.ellipse(rc.gx, rc.gy, rc.r);
      const col = rc.color ?? 0xffffff;
      const faint = rc === this.range2;
      g.fillStyle(col, faint ? 0.05 : 0.13);
      g.fillEllipse(e.x, e.y, e.w, e.h);
      g.lineStyle(faint ? 3 : 4.5, col, faint ? 0.55 : 0.85);
      g.strokeEllipse(e.x, e.y, e.w, e.h);
    }

    if (this.reticle) {
      const r = this.reticle;
      const col = r.valid ? 0x7dff8a : 0xff5a5a;
      const e = this.ellipse(r.gx, r.gy, r.r);
      g.fillStyle(col, 0.16 + 0.08 * pulse);
      g.fillEllipse(e.x, e.y, e.w, e.h);
      g.lineStyle(5, col, 0.95);
      g.strokeEllipse(e.x, e.y, e.w, e.h);
      const e2 = this.ellipse(r.gx, r.gy, r.r * (0.35 + 0.2 * pulse));
      g.lineStyle(3, 0xffffff, 0.8);
      g.strokeEllipse(e2.x, e2.y, e2.w, e2.h);
      if (r.snap) {
        const sp = this.ellipse(r.snap.gx, r.snap.gy, 0.18);
        g.fillStyle(0xffffff, 0.9);
        g.fillEllipse(sp.x, sp.y, sp.w, sp.h);
      }
    }
  }

  destroy(): void {
    this.g.destroy();
    for (const f of this.flags) f.img.destroy();
    this.flags = [];
  }
}
