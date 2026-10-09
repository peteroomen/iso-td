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

  constructor(
    readonly level: LevelDef,
    area: PlayArea,
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
    this.scale = Math.min(area.w / bw, area.h / bh, 0.9);
    this.offX = area.x + area.w / 2 - ((minX + maxX) / 2) * this.scale;
    this.offY = area.y + area.h / 2 - ((minY + maxY) / 2) * this.scale;
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
