import type { Vec2 } from '../types';

export interface PathInfo {
  readonly index: number;
  readonly pts: readonly Vec2[];
  /** cum[i] = distance from start to pts[i]. */
  readonly cum: readonly number[];
  readonly length: number;
}

export interface PathPoint {
  x: number;
  y: number;
  /** Unit tangent. */
  dx: number;
  dy: number;
}

export function buildPath(index: number, pts: readonly Vec2[]): PathInfo {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { index, pts, cum, length: cum[cum.length - 1] };
}

/** Point at distance `d` along the path (clamped to [0, length]) with its unit tangent. */
export function pointAt(path: PathInfo, d: number, out: PathPoint = { x: 0, y: 0, dx: 1, dy: 0 }): PathPoint {
  const { pts, cum } = path;
  const dist = d < 0 ? 0 : d > path.length ? path.length : d;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < dist) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const segLen = cum[i] - cum[i - 1];
  const t = segLen > 0 ? (dist - cum[i - 1]) / segLen : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  if (segLen > 0) {
    out.dx = (b.x - a.x) / segLen;
    out.dy = (b.y - a.y) / segLen;
  }
  return out;
}

export interface NearestResult {
  x: number;
  y: number;
  dist: number;
  pathIndex: number;
  progress: number;
}

/**
 * Nearest point on any path to `p`, considering only the part of each path inside the map
 * (off-map approach segments don't count). Exact projection onto segments, clipped to the map rectangle.
 */
export function nearestOnPaths(paths: readonly PathInfo[], p: Vec2, width: number, height: number): NearestResult | null {
  let best: NearestResult | null = null;
  for (const path of paths) {
    for (let i = 1; i < path.pts.length; i++) {
      const a = path.pts[i - 1];
      const b = path.pts[i];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy;
      if (len2 === 0) continue;
      let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      let qx = a.x + vx * t;
      let qy = a.y + vy * t;
      // keep inside the map rectangle
      qx = qx < 0 ? 0 : qx > width ? width : qx;
      qy = qy < 0 ? 0 : qy > height ? height : qy;
      const dist = Math.hypot(p.x - qx, p.y - qy);
      if (!best || dist < best.dist) {
        best = { x: qx, y: qy, dist, pathIndex: path.index, progress: path.cum[i - 1] + Math.hypot(qx - a.x, qy - a.y) };
      }
    }
  }
  return best;
}
