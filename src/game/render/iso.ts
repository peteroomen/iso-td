import type { LevelDef, Vec2 } from '../../core';

/**
 * Isometric projection (docs/DESIGN.md section 2): sx = (gx - gy) * TW/2, sy = (gx + gy) * TH/2.
 * Source tile art is 250x235 with a 30 degree top diamond (250 x ~144) and ~91 px of block side below.
 */
export const TW = 228;
export const TH = 132;
export const TILE_SRC_W = 250;
export const TILE_SRC_H = 235;
/** Origin of the top-face diamond centre inside the tile image. */
export const TILE_ORIGIN_X = 125 / TILE_SRC_W;
export const TILE_ORIGIN_Y = 72 / TILE_SRC_H;

export function isoX(gx: number, gy: number): number {
  return ((gx - gy) * TW) / 2;
}
export function isoY(gx: number, gy: number): number {
  return ((gx + gy) * TH) / 2;
}
export function iso(gx: number, gy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  out.x = isoX(gx, gy);
  out.y = isoY(gx, gy);
  return out;
}
/** Inverse projection (world-local iso coords -> grid units). */
export function unIso(sx: number, sy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  const a = (2 * sx) / TW; // gx - gy
  const b = (2 * sy) / TH; // gx + gy
  out.x = (a + b) / 2;
  out.y = (b - a) / 2;
  return out;
}

export interface PlayArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Maps grid space to screen: the `world` container is placed at (offX, offY) with scale `scale`;
 * everything inside the container uses plain iso coordinates.
 */
export class IsoView {
  scale = 1;
  offX = 0;
  offY = 0;
  /** Scale / offset that fit the whole map into the play area (the default view). */
  fitScale = 1;
  fitOffX = 0;
  fitOffY = 0;
  /** Zoom relative to the fit view (1 = whole map visible); `scale = fitScale * zoom`. */
  zoom = 1;
  /** Iso-space bounds of the map art (before scale / offset). */
  readonly bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  constructor(
    readonly level: LevelDef,
    readonly area: PlayArea,
  ) {
    const h = level.tiles.length;
    const w = level.tiles.reduce((m, r) => Math.max(m, r.length), 0);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = level.tiles[y][x] ?? ' ';
        if (ch === ' ') continue;
        const cx = isoX(x + 0.5, y + 0.5);
        const cy = isoY(x + 0.5, y + 0.5);
        minX = Math.min(minX, cx - TILE_SRC_W * TILE_ORIGIN_X);
        maxX = Math.max(maxX, cx + TILE_SRC_W * (1 - TILE_ORIGIN_X));
        minY = Math.min(minY, cy - TILE_SRC_H * TILE_ORIGIN_Y - (ch === 'T' || ch === 'c' ? 70 : 20));
        maxY = Math.max(maxY, cy + TILE_SRC_H * (1 - TILE_ORIGIN_Y));
      }
    }
    // headroom for towers on the top row
    minY -= 40;
    const bw = maxX - minX;
    const bh = maxY - minY;
    this.bounds.minX = minX;
    this.bounds.maxX = maxX;
    this.bounds.minY = minY;
    this.bounds.maxY = maxY;
    this.scale = Math.min(area.w / bw, area.h / bh, 0.9);
    this.offX = area.x + area.w / 2 - ((minX + maxX) / 2) * this.scale;
    this.offY = area.y + area.h / 2 - ((minY + maxY) / 2) * this.scale;
    this.fitScale = this.scale;
    this.fitOffX = this.offX;
    this.fitOffY = this.offY;
  }

  /** Smallest / largest allowed zoom (relative to fit). Never shows the art much above native size. */
  get minZoom(): number {
    return 0.92;
  }
  get maxZoom(): number {
    return Math.max(1.25, Math.min(2.5, 1.6 / this.fitScale));
  }

  /** Zooms to `z` keeping the screen point (fx, fy) fixed, then clamps the pan. */
  setZoomAt(z: number, fx: number, fy: number): void {
    z = Math.min(this.maxZoom, Math.max(this.minZoom, z));
    const lx = (fx - this.offX) / this.scale;
    const ly = (fy - this.offY) / this.scale;
    this.zoom = z;
    this.scale = this.fitScale * z;
    this.offX = fx - lx * this.scale;
    this.offY = fy - ly * this.scale;
    this.clampPan();
  }

  /** Moves the map by a screen-space delta (clamped). */
  panBy(dx: number, dy: number): void {
    this.offX += dx;
    this.offY += dy;
    this.clampPan();
  }

  resetView(): void {
    this.zoom = 1;
    this.scale = this.fitScale;
    this.offX = this.fitOffX;
    this.offY = this.fitOffY;
  }

  get isFit(): boolean {
    return Math.abs(this.zoom - 1) < 0.01 && Math.abs(this.offX - this.fitOffX) < 1 && Math.abs(this.offY - this.fitOffY) < 1;
  }

  /** Keeps the map on screen: centred while it is smaller than the play area, otherwise its edges may not pass a small slack inside the area. */
  clampPan(): void {
    const a = this.area;
    const b = this.bounds;
    const s = this.scale;
    const slack = 0.12;
    const axis = (off: number, lo: number, hi: number, aMin: number, aLen: number): number => {
      const len = (hi - lo) * s;
      if (len <= aLen) return aMin + aLen / 2 - ((lo + hi) / 2) * s;
      const pad = aLen * slack;
      const max = aMin + pad - lo * s; // map's low edge may not move right of area start + pad
      const min = aMin + aLen - pad - hi * s;
      return Math.min(max, Math.max(min, off));
    };
    this.offX = axis(this.offX, b.minX, b.maxX, a.x, a.w);
    this.offY = axis(this.offY, b.minY, b.maxY, a.y, a.h);
  }

  /** Grid -> screen (canvas) coordinates. */
  toScreen(gx: number, gy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
    out.x = isoX(gx, gy) * this.scale + this.offX;
    out.y = isoY(gx, gy) * this.scale + this.offY;
    return out;
  }

  /** Screen (canvas) -> grid. */
  toGrid(sx: number, sy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
    return unIso((sx - this.offX) / this.scale, (sy - this.offY) / this.scale, out);
  }

  /** Screen -> world-local iso coordinates. */
  toLocal(sx: number, sy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
    out.x = (sx - this.offX) / this.scale;
    out.y = (sy - this.offY) / this.scale;
    return out;
  }
}

/** Depth used to sort anything standing on the ground at grid position (gx, gy). */
export function depthOf(gx: number, gy: number): number {
  return (gx + gy) * 10;
}

/** Deterministic hash -> [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export function stringSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
