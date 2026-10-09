import Phaser from 'phaser';
import { Rng, type Biome } from '../../core';

/**
 * Decorative isometric scenery built from the pack's tile sprites (used by the Title diorama and the level-select map).
 * Unrelated to the in-game renderer; it only needs the same projection constants.
 */

/** Iso pitch between neighbouring cells at scale 1 (see docs/DESIGN.md §2). */
export const PITCH_X = 114;
export const PITCH_Y = 64;
/** The top-face diamond centre inside a 250x235 tile image, as an origin fraction. */
const TILE_ORIGIN_Y = 0.31;

/**
 * Row characters: '.' ground, '#' road, 'B' build spot, 'T' tree/cactus, 'r' rock, 'c' crystal, 'd' small decoration,
 * ' ' nothing. `biomeMap` (same shape, chars s/d/w) overrides the biome per cell.
 */
export interface IslandSpec {
  rows: string[];
  biome: Biome;
  biomeMap?: string[];
  scale: number;
  seed?: number;
}

export interface Island {
  root: Phaser.GameObjects.Container;
  scale: number;
  cols: number;
  rows: number;
  /** Position of the top-face centre of a cell, relative to `root`. */
  cellPos(col: number, row: number): { x: number; y: number };
  /** Adds an object at a cell, depth-sorted among tiles/decorations. `layer` > 0 draws in front of the cell's own deco. */
  addProp(col: number, row: number, obj: Phaser.GameObjects.GameObject & { setPosition(x: number, y: number): unknown }, layer?: number, dx?: number, dy?: number): void;
  isLand(col: number, row: number): boolean;
}

const BIOME_CHAR: Record<string, Biome> = { s: 'spring', d: 'desert', w: 'winter' };

function roadVariant(nw: boolean, ne: boolean, se: boolean, sw: boolean): number {
  const n = (nw ? 1 : 0) + (ne ? 1 : 0) + (se ? 1 : 0) + (sw ? 1 : 0);
  if (n === 4) return 3;
  if (n === 3) {
    if (!se) return 4;
    if (!sw) return 5;
    if (!nw) return 6;
    return 7; // !ne
  }
  if (n === 2) {
    if (nw && se) return 1;
    if (ne && sw) return 2;
    if (se && sw) return 8;
    if (nw && ne) return 9;
    if (ne && se) return 10;
    return 11; // nw && sw
  }
  return nw || se ? 1 : 2;
}

function pickDeco(biome: Biome, ch: string, rng: Rng): { key: string; originY: number } | null {
  const pick = (prefix: string, n: number): string => `${prefix}${rng.int(1, n)}`;
  switch (ch) {
    case 'T':
      if (biome === 'spring') return { key: pick('deco/spring_tree_', 2), originY: 0.86 };
      if (biome === 'winter') return { key: pick('deco/winter_tree_winter_', 2), originY: 0.86 };
      return { key: pick('deco/desert_cactus_', 5), originY: 0.86 };
    case 'r':
      if (biome === 'spring') return { key: pick('deco/spring_stone_', 4), originY: 0.7 };
      if (biome === 'winter') return { key: pick('deco/spring_stone_ground_', 4), originY: 0.7 };
      return { key: pick('deco/desert_stone_sand_', 4), originY: 0.7 };
    case 'c':
      return { key: pick('deco/crystal_', 3), originY: 0.82 };
    case 'd':
      if (biome === 'spring') return { key: `deco/spring_grass_decoration_${[1, 2, 4, 5, 6, 7, 8, 9][rng.int(0, 7)]}`, originY: 0.55 };
      if (biome === 'winter') return { key: pick('deco/winter_snow_decoration_', 9), originY: 0.55 };
      return { key: pick('deco/desert_sand_decoration_', 9), originY: 0.55 };
    default:
      return null;
  }
}

export function buildIsland(scene: Phaser.Scene, x: number, y: number, spec: IslandSpec): Island {
  const { rows, scale } = spec;
  const nRows = rows.length;
  const nCols = Math.max(...rows.map((r) => r.length));
  const rng = new Rng(spec.seed ?? 7);
  const root = scene.add.container(x, y);
  const cx = (nCols - 1) / 2;
  const cy = (nRows - 1) / 2;
  const cellPos = (col: number, row: number) => ({
    x: (col - cx - (row - cy)) * PITCH_X * scale,
    y: (col - cx + (row - cy)) * PITCH_Y * scale,
  });
  const at = (col: number, row: number): string => (col < 0 || row < 0 || row >= nRows ? ' ' : (rows[row][col] ?? ' '));
  const isLand = (col: number, row: number) => at(col, row) !== ' ';
  const biomeAt = (col: number, row: number): Biome => {
    const ch = spec.biomeMap?.[row]?.[col];
    return (ch && BIOME_CHAR[ch]) || spec.biome;
  };

  const items: Phaser.GameObjects.Image[] = [];
  for (let row = 0; row < nRows; row++) {
    for (let col = 0; col < nCols; col++) {
      const ch = at(col, row);
      if (ch === ' ') continue;
      const biome = biomeAt(col, row);
      const p = cellPos(col, row);
      let key = `tiles/ground_${biome}`;
      if (ch === 'B') key = `tiles/buildspot_${biome}`;
      else if (ch === '#') {
        const open = (c: number, r: number) => at(c, r) === '#' || c < 0 || r < 0 || c >= nCols || r >= nRows;
        // NW=(x-1), NE=(y-1), SE=(x+1), SW=(y+1)
        key = `roads/road_${biome}_${roadVariant(open(col - 1, row), open(col, row - 1), open(col + 1, row), open(col, row + 1))}`;
      }
      const tile = scene.add.image(p.x, p.y, key).setScale(scale).setOrigin(0.5, TILE_ORIGIN_Y);
      tile.setDepth((col + row) * 10);
      items.push(tile);
      const deco = pickDeco(biome, ch, rng);
      if (deco) {
        const img = scene.add
          .image(p.x + rng.range(-4, 4) * scale * 2, p.y + rng.range(-2, 2) * scale * 2, deco.key)
          .setScale(scale * (ch === 'T' ? 0.95 : 1))
          .setOrigin(0.5, deco.originY);
        img.setDepth((col + row) * 10 + 1);
        items.push(img);
      }
    }
  }
  root.add(items);
  root.sort('depth');

  return {
    root,
    scale,
    cols: nCols,
    rows: nRows,
    cellPos,
    isLand,
    addProp(col, row, obj, layer = 5, dx = 0, dy = 0) {
      const p = cellPos(col, row);
      obj.setPosition(p.x + dx, p.y + dy);
      (obj as unknown as Phaser.GameObjects.Components.Depth).setDepth((col + row) * 10 + layer);
      root.add(obj);
      root.sort('depth');
    },
  };
}
