import { ENEMIES } from './data/enemies';
import { DEFAULT_WAVE_GAP } from './data/rules';
import type { BuildSpot, LevelDef, Vec2 } from './types';

const VALID_TILES = new Set(['.', '#', 'B', 'T', 'r', 'c', 'd', ' ']);

export function levelWidth(level: LevelDef): number {
  return level.tiles.reduce((m, r) => Math.max(m, r.length), 0);
}

export function levelHeight(level: LevelDef): number {
  return level.tiles.length;
}

export function waveGapOf(level: LevelDef): number {
  return level.waveGap ?? DEFAULT_WAVE_GAP;
}

/** Build spots from the 'B' cells, id = index in row-major order. */
export function deriveSpots(level: LevelDef): BuildSpot[] {
  const spots: BuildSpot[] = [];
  level.tiles.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'B') spots.push({ id: spots.length, col: x, row: y, x: x + 0.5, y: y + 0.5 });
    }
  });
  return spots;
}

/** Cells that are road ('#'). */
export function isRoad(level: LevelDef, col: number, row: number): boolean {
  return level.tiles[row]?.[col] === '#';
}

/**
 * Returns a list of human-readable problems; empty = valid.
 * Paths must run over '#' cells only (except the off-map end points), be axis-aligned, start and end just off the
 * map border; every road cell must have >= 2 connections so a road tile exists for it (no dead ends).
 */
export function validateLevel(level: LevelDef): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(`${level.id}: ${m}`);
  const h = level.tiles.length;
  const w = levelWidth(level);
  if (h === 0 || w === 0) {
    err('empty tile grid');
    return errs;
  }
  level.tiles.forEach((row, y) => {
    if (row.length !== w) err(`row ${y} has length ${row.length}, expected ${w}`);
    for (const ch of row) if (!VALID_TILES.has(ch)) err(`row ${y} has invalid tile char '${ch}'`);
  });
  if (level.biome === 'mixed') {
    if (!level.biomeMap) err("biome 'mixed' needs a biomeMap");
  }
  if (level.biomeMap) {
    if (level.biomeMap.length !== h) err('biomeMap height mismatch');
    level.biomeMap.forEach((row, y) => {
      if (row.length !== w) err(`biomeMap row ${y} has length ${row.length}, expected ${w}`);
      for (const ch of row) if (ch !== 's' && ch !== 'd' && ch !== 'w') err(`biomeMap row ${y} has invalid char '${ch}'`);
    });
  }
  if (!(level.startGold > 0)) err('startGold must be > 0');
  if (!(level.lives > 0)) err('lives must be > 0');
  for (const k of ['archer', 'wizard', 'barracks', 'bomb'] as const) {
    const c = level.towerCap[k];
    if (!Number.isInteger(c) || c < 1 || c > 3) err(`towerCap.${k} must be 1..3`);
  }
  if (level.paths.length === 0) err('no paths');

  const spots = deriveSpots(level);
  if (spots.length === 0) err('no build spots');

  const inside = (px: number, py: number) => px >= 0 && py >= 0 && px <= w && py <= h;
  const endpointCells = new Set<string>();
  const roadAt = (col: number, row: number) => level.tiles[row]?.[col] === '#';

  level.paths.forEach((path, pi) => {
    if (path.length < 2) {
      err(`path ${pi} needs at least 2 points`);
      return;
    }
    const first = path[0];
    const last = path[path.length - 1];
    if (inside(first.x, first.y)) err(`path ${pi} must start off-map`);
    if (inside(last.x, last.y)) err(`path ${pi} must end off-map`);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (a.x !== b.x && a.y !== b.y) err(`path ${pi} segment ${i} is not axis-aligned`);
      if (a.x === b.x && a.y === b.y) err(`path ${pi} segment ${i} has zero length`);
      // interior vertices must be cell centres
      if (i < path.length - 1) {
        if (Math.abs((b.x % 1) - 0.5) > 1e-9 || Math.abs((b.y % 1) - 0.5) > 1e-9) err(`path ${pi} point ${i} is not a cell centre`);
      }
      // sample the segment: every on-map sample must be on road
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / 0.05));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        if (!roadAt(Math.floor(px), Math.floor(py))) {
          err(`path ${pi} leaves the road at (${px.toFixed(2)}, ${py.toFixed(2)})`);
          break;
        }
      }
    }
    // spawn / exit cells must sit on the map border (so the off-map side counts as a road connection)
    const norm = (a: Vec2, b: Vec2): Vec2 => {
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    };
    const d0 = norm(path[0], path[1]);
    const d1 = norm(path[path.length - 2], path[path.length - 1]);
    const cells = [
      { col: Math.floor(first.x + d0.x), row: Math.floor(first.y + d0.y) },
      { col: Math.floor(last.x - d1.x), row: Math.floor(last.y - d1.y) },
    ];
    for (const c of cells) {
      if (c.col !== 0 && c.row !== 0 && c.col !== w - 1 && c.row !== h - 1) err(`path ${pi} spawn/exit cell (${c.col},${c.row}) is not on the map border`);
      endpointCells.add(`${c.col},${c.row}`);
    }
  });

  // road dead ends
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < level.tiles[y].length; x++) {
      if (level.tiles[y][x] !== '#') continue;
      let n = 0;
      if (roadAt(x + 1, y)) n++;
      if (roadAt(x - 1, y)) n++;
      if (roadAt(x, y + 1)) n++;
      if (roadAt(x, y - 1)) n++;
      if (endpointCells.has(`${x},${y}`)) n++;
      if (n < 2) err(`road cell (${x},${y}) is a dead end`);
    }
  }

  // spots near a road
  for (const s of spots) {
    let near = false;
    for (let y = 0; y < h && !near; y++) {
      for (let x = 0; x < level.tiles[y].length; x++) {
        if (level.tiles[y][x] === '#' && Math.hypot(x - s.col, y - s.row) <= 2.0) {
          near = true;
          break;
        }
      }
    }
    if (!near) err(`build spot ${s.id} at (${s.col},${s.row}) is not near a road`);
  }

  // waves
  if (level.waves.length === 0) err('no waves');
  level.waves.forEach((wave, wi) => {
    if (wave.groups.length === 0) err(`wave ${wi + 1} has no groups`);
    wave.groups.forEach((g, gi) => {
      if (!ENEMIES[g.enemy]) err(`wave ${wi + 1} group ${gi}: unknown enemy '${g.enemy}'`);
      if (!(g.count > 0) || !Number.isInteger(g.count)) err(`wave ${wi + 1} group ${gi}: bad count`);
      if (!(g.interval >= 0)) err(`wave ${wi + 1} group ${gi}: bad interval`);
      if (!(g.delay >= 0)) err(`wave ${wi + 1} group ${gi}: bad delay`);
      if (!Number.isInteger(g.path) || g.path < 0 || g.path >= level.paths.length) err(`wave ${wi + 1} group ${gi}: bad path index ${g.path}`);
    });
  });
  for (const hint of level.hints ?? []) {
    if (hint.waveIndex < 0 || hint.waveIndex > level.waves.length) err(`hint waveIndex ${hint.waveIndex} out of range`);
  }
  return errs;
}
