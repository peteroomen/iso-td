import Phaser from 'phaser';
import type { LevelDef, Vec2 } from '../../core';
import { hash2, isoX, isoY, stringSeed } from './iso';

/** Ribbon width in grid units (fraction of a cell). */
export const ROAD_WIDTH = 0.62;
/** Dark outline thickness in grid units. */
const OUTLINE = 0.07;
/** Depth of the tile block side below the top face (source px at scale 1, see iso.ts). */
const SIDE_DEPTH = 91;
const OUTLINE_PX = 7;
/** How far past the nominal block edge the road top ends / the side face begins (grid units). */
const EDGE_PUSH = 0.07;

const INK = 0x2e222f;
const ROAD = 0xe6904e;
const ROAD_DARK = 0xc9773d;
const ROAD_LIGHT = 0xedaa6b;
const SIDE_SE = 0xb8683a;
const SIDE_SW = 0xc9733e;

type Side = 'none' | 'SE' | 'SW';

interface Seg {
  /** Clamped endpoints. */
  a: Vec2;
  b: Vec2;
  /** Direction (unit) and left normal. */
  dx: number;
  dy: number;
  /** True when the end touches the map border (the path leaves/enters the map there). */
  aEdge: boolean;
  bEdge: boolean;
}

interface EdgeEnd {
  /** Point on the map border (grid units). */
  p: Vec2;
  /** Which visible block side the road continues down; 'none' when the border faces away from the camera. */
  side: Side;
}

export interface RoadGeometry {
  segs: Seg[];
  ends: EdgeEnd[];
  /** Cells ("col,row") crossed by the ribbon. */
  cells: Set<string>;
}

function clampPt(p: Vec2, w: number, h: number): { pt: Vec2; clamped: boolean } {
  const x = Math.min(Math.max(p.x, 0), w);
  const y = Math.min(Math.max(p.y, 0), h);
  return { pt: { x, y }, clamped: x !== p.x || y !== p.y };
}

/** Clamps level.paths to the map rectangle and derives the ribbon segments. */
export function roadGeometry(level: LevelDef, width: number, height: number): RoadGeometry {
  const segs: Seg[] = [];
  const ends: EdgeEnd[] = [];
  const cells = new Set<string>();
  for (const path of level.paths) {
    const pts = path.map((p) => clampPt(p, width, height));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const l = Math.hypot(b.pt.x - a.pt.x, b.pt.y - a.pt.y);
      if (l < 1e-6) continue;
      segs.push({
        a: a.pt,
        b: b.pt,
        dx: (b.pt.x - a.pt.x) / l,
        dy: (b.pt.y - a.pt.y) / l,
        aEdge: i === 1 && a.clamped,
        bEdge: i === pts.length - 1 && b.clamped,
      });
      const n = Math.ceil(l * 4);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const cx = Math.floor(Math.min(a.pt.x + (b.pt.x - a.pt.x) * t, width - 1e-6));
        const cy = Math.floor(Math.min(a.pt.y + (b.pt.y - a.pt.y) * t, height - 1e-6));
        cells.add(`${cx},${cy}`);
      }
    }
    for (const [idx, end] of [
      [0, pts[0]],
      [pts.length - 1, pts[pts.length - 1]],
    ] as const) {
      if (!end.clamped) continue;
      const q = path[idx];
      const side: Side = end.pt.x >= width && q.x > width ? 'SE' : end.pt.y >= height && q.y > height ? 'SW' : 'none';
      ends.push({ p: end.pt, side });
    }
  }
  return { segs, ends, cells };
}

const proj = (gx: number, gy: number) => ({ x: isoX(gx, gy), y: isoY(gx, gy) });

/** Grid-space rectangle around segment `s`: `half` sideways, extended by aExt/bExt beyond the endpoints. */
function rectPoly(s: Seg, half: number, aExt: number, bExt: number): { x: number; y: number }[] {
  const nx = -s.dy;
  const ny = s.dx;
  const ax = s.a.x - s.dx * aExt;
  const ay = s.a.y - s.dy * aExt;
  const bx = s.b.x + s.dx * bExt;
  const by = s.b.y + s.dy * bExt;
  return [
    proj(ax + nx * half, ay + ny * half),
    proj(ax - nx * half, ay - ny * half),
    proj(bx - nx * half, by - ny * half),
    proj(bx + nx * half, by + ny * half),
  ];
}

/**
 * Draws the road as one continuous ribbon following level.paths (docs/DESIGN.md section 2).
 * Drawn once into a static Graphics; returns it together with the geometry it covers.
 */
export function buildRoadRibbon(scene: Phaser.Scene, level: LevelDef, width: number, height: number): { gfx: Phaser.GameObjects.Graphics; geo: RoadGeometry } {
  const geo = roadGeometry(level, width, height);
  const g = scene.add.graphics();
  const half = ROAD_WIDTH / 2;
  const seed = stringSeed(level.id);

  // Side faces where the road leaves the block: ink outline first, then the earth-coloured face.
  for (const e of geo.ends) {
    if (e.side === 'none') continue;
    const sw = e.side === 'SW';
    const at = (across: number, push: number) => (sw ? proj(e.p.x + across, e.p.y + push) : proj(e.p.x + push, e.p.y + across));
    const lo = at(-half, EDGE_PUSH);
    const hi = at(half, EDGE_PUSH);
    const loI = at(-half - OUTLINE, EDGE_PUSH);
    const hiI = at(half + OUTLINE, EDGE_PUSH);
    g.fillStyle(INK, 1);
    g.fillPoints([loI, hiI, { x: hiI.x, y: hiI.y + SIDE_DEPTH + OUTLINE_PX }, { x: loI.x, y: loI.y + SIDE_DEPTH + OUTLINE_PX }], true);
    g.fillStyle(sw ? SIDE_SW : SIDE_SE, 1);
    g.fillPoints([lo, hi, { x: hi.x, y: hi.y + SIDE_DEPTH }, { x: lo.x, y: lo.y + SIDE_DEPTH }], true);
    // lighter lip right under the road surface, like the grass lip on the pack's block sides
    g.fillStyle(ROAD, 1);
    g.fillPoints([lo, hi, { x: hi.x, y: hi.y + 17 }, { x: lo.x, y: lo.y + 17 }], true);
    g.fillStyle(INK, 1);
    g.fillPoints([{ x: lo.x, y: lo.y + 17 }, { x: hi.x, y: hi.y + 17 }, { x: hi.x, y: hi.y + 21 }, { x: lo.x, y: lo.y + 21 }], true);
  }

  // Pass 1: outline (every rectangle expanded by the outline thickness) so merging paths fuse into one shape.
  g.fillStyle(INK, 1);
  for (const s of geo.segs) {
    g.fillPoints(rectPoly(s, half + OUTLINE, s.aEdge ? EDGE_PUSH : half + OUTLINE, s.bEdge ? EDGE_PUSH : half + OUTLINE), true);
  }
  // Pass 2: road colour.
  g.fillStyle(ROAD, 1);
  for (const s of geo.segs) {
    g.fillPoints(rectPoly(s, half, s.aEdge ? 0 : half, s.bEdge ? 0 : half), true);
  }

  // Pass 3: subtle texture, pebbles and a faint lighter centre line (flat style).
  g.fillStyle(ROAD_LIGHT, 0.35);
  for (const s of geo.segs) {
    g.fillPoints(rectPoly(s, half * 0.28, s.aEdge ? 0 : half * 0.28, s.bEdge ? 0 : half * 0.28), true);
  }
  g.fillStyle(ROAD_DARK, 1);
  for (const s of geo.segs) {
    const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    const n = Math.max(1, Math.round(len * 1.6));
    for (let i = 0; i < n; i++) {
      const hx = hash2(Math.round(s.a.x * 10) + i * 7, Math.round(s.a.y * 10) + i * 13, seed);
      const hy = hash2(Math.round(s.b.x * 10) + i * 11, Math.round(s.b.y * 10) + i * 3, seed + 5);
      const hs = hash2(i * 17, Math.round(len * 10), seed + 9);
      const along = ((i + 0.15 + hx * 0.7) / n) * len;
      const side = (hy - 0.5) * 2 * half * 0.7;
      const gx = s.a.x + s.dx * along - s.dy * side;
      const gy = s.a.y + s.dy * along + s.dx * side;
      const r = 3.2 + hs * 3;
      g.fillEllipse(isoX(gx, gy), isoY(gx, gy), r * 2.2, r * 1.25);
    }
  }
  return { gfx: g, geo };
}
