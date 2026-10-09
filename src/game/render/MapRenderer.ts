import Phaser from 'phaser';
import type { Biome, BiomeChar, LevelDef } from '../../core';
import { buildRoadRibbon } from './RoadRibbon';
import { TILE_ORIGIN_X, TILE_ORIGIN_Y, depthOf, hash2, isoX, isoY, stringSeed } from './iso';

type Edge = 'NW' | 'NE' | 'SE' | 'SW';

/** Road tile table from docs/DESIGN.md section 2 (open edges -> file number). */
const ROAD_TABLE: [Edge[], number][] = [
  [['NW', 'SE'], 1],
  [['NE', 'SW'], 2],
  [['NW', 'NE', 'SE', 'SW'], 3],
  [['NW', 'NE', 'SW'], 4],
  [['NW', 'NE', 'SE'], 5],
  [['NE', 'SE', 'SW'], 6],
  [['NW', 'SW', 'SE'], 7],
  [['SE', 'SW'], 8],
  [['NW', 'NE'], 9],
  [['NE', 'SE'], 10],
  [['NW', 'SW'], 11],
];

export function roadNumber(open: Set<Edge>): number {
  for (const [edges, n] of ROAD_TABLE) {
    if (edges.length === open.size && edges.every((e) => open.has(e))) return n;
  }
  // degenerate (dead end / isolated): pick a straight tile along the available axis
  if (open.has('NE') || open.has('SW')) return 2;
  return 1;
}

const BIOME_OF: Record<BiomeChar, Biome> = { s: 'spring', d: 'desert', w: 'winter' };

interface DecoSpec {
  keys: string[];
  /** Origin y (0..1) so the base sits on the cell centre. */
  oy: number;
  scale: number;
  tint?: number;
}

const DECO: Record<Biome, { T: DecoSpec; r: DecoSpec; d: DecoSpec; small: DecoSpec }> = {
  spring: {
    T: { keys: ['spring_tree_1', 'spring_tree_2'], oy: 0.9, scale: 1.55 },
    r: { keys: ['spring_stone_2', 'spring_stone_3', 'spring_stone_4', 'spring_stone_1'], oy: 0.8, scale: 1.5 },
    d: { keys: ['spring_grass_decoration_1', 'spring_grass_decoration_2', 'spring_grass_decoration_4', 'spring_grass_decoration_5', 'spring_grass_decoration_6', 'spring_grass_decoration_8'], oy: 0.6, scale: 1.8 },
    small: { keys: ['spring_grass_decoration_1', 'spring_grass_decoration_2', 'spring_grass_decoration_2_1', 'spring_grass_decoration_5', 'spring_grass_decoration_7', 'spring_grass_decoration_9', 'spring_stone_ground_1'], oy: 0.6, scale: 1.7 },
  },
  desert: {
    T: { keys: ['desert_cactus_1', 'desert_cactus_2', 'desert_cactus_3', 'desert_cactus_4', 'desert_cactus_5'], oy: 0.9, scale: 1.45 },
    r: { keys: ['desert_stone_sand_1', 'desert_stone_sand_2', 'desert_stone_sand_3', 'desert_stone_sand_4'], oy: 0.8, scale: 1.5 },
    d: { keys: ['desert_sand_decoration_1', 'desert_sand_decoration_2', 'desert_sand_decoration_3', 'desert_sand_decoration_4', 'desert_sand_decoration_6'], oy: 0.6, scale: 1.8 },
    small: { keys: ['desert_sand_decoration_5', 'desert_sand_decoration_7', 'desert_sand_decoration_8', 'desert_sand_decoration_9', 'desert_sand_decoration_2'], oy: 0.6, scale: 1.7 },
  },
  winter: {
    T: { keys: ['winter_tree_winter_1', 'winter_tree_winter_2'], oy: 0.9, scale: 1.5 },
    r: { keys: ['spring_stone_2', 'spring_stone_3', 'spring_stone_4'], oy: 0.8, scale: 1.5, tint: 0xdfe9ff },
    d: { keys: ['winter_snow_decoration_1', 'winter_snow_decoration_2', 'winter_snow_decoration_3', 'winter_snow_decoration_4', 'winter_snow_decoration_5'], oy: 0.6, scale: 1.8 },
    small: { keys: ['winter_snow_decoration_6', 'winter_snow_decoration_7', 'winter_snow_decoration_8', 'winter_snow_decoration_9', 'winter_snow_decoration_3'], oy: 0.6, scale: 1.7 },
  },
};

const CRYSTAL: DecoSpec = { keys: ['crystal_1', 'crystal_2', 'crystal_3'], oy: 0.85, scale: 1.0 };

export interface MapCell {
  col: number;
  row: number;
  ch: string;
  biome: Biome;
}

/** Builds the ground tiles and static decorations of a level. */
export class MapRenderer {
  readonly width: number;
  readonly height: number;
  private readonly tileImages = new Map<string, Phaser.GameObjects.Image>();
  readonly decorations: Phaser.GameObjects.Image[] = [];
  /** The baked road ribbon (drawn once). */
  readonly roadGfx: Phaser.GameObjects.Graphics;
  /** Cells covered by the ribbon (never decorated). */
  readonly roadCells: ReadonlySet<string>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDef,
    groundC: Phaser.GameObjects.Container,
    entityC: Phaser.GameObjects.Container,
  ) {
    this.height = level.tiles.length;
    this.width = level.tiles.reduce((m, r) => Math.max(m, r.length), 0);
    this.buildGround(groundC);
    // Roads are one continuous ribbon above the ground tiles (road cells use the plain ground tile).
    const road = buildRoadRibbon(scene, level, this.width, this.height);
    groundC.add(road.gfx);
    this.roadGfx = road.gfx;
    this.roadCells = road.geo.cells;
    this.buildDecor(entityC);
  }

  biomeAt(col: number, row: number): Biome {
    if (this.level.biome === 'mixed') {
      const ch = this.level.biomeMap?.[row]?.[col] as BiomeChar | undefined;
      return BIOME_OF[ch ?? 's'];
    }
    return this.level.biome;
  }

  /** Dominant biome (used for the background colour). */
  get mainBiome(): Biome {
    return this.level.biome === 'mixed' ? 'spring' : this.level.biome;
  }

  tileAt(col: number, row: number): string {
    return this.level.tiles[row]?.[col] ?? ' ';
  }

  private buildGround(groundC: Phaser.GameObjects.Container): void {
    const cells: MapCell[] = [];
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const ch = this.tileAt(col, row);
        if (ch === ' ') continue;
        cells.push({ col, row, ch, biome: this.biomeAt(col, row) });
      }
    }
    cells.sort((a, b) => a.col + a.row - (b.col + b.row) || a.col - b.col);
    for (const c of cells) {
      let key: string;
      if (c.ch === 'B') {
        key = `tiles/buildspot_${c.biome}`;
      } else {
        key = `tiles/ground_${c.biome}`;
      }
      const img = this.scene.add
        .image(isoX(c.col + 0.5, c.row + 0.5), isoY(c.col + 0.5, c.row + 0.5), key)
        .setOrigin(TILE_ORIGIN_X, TILE_ORIGIN_Y);
      groundC.add(img);
      this.tileImages.set(`${c.col},${c.row}`, img);
    }
  }

  private addDeco(entityC: Phaser.GameObjects.Container, spec: DecoSpec, pick: number, gx: number, gy: number, flipSeed: number): void {
    const key = `deco/${spec.keys[Math.floor(pick * spec.keys.length) % spec.keys.length]}`;
    if (!this.scene.textures.exists(key)) return;
    const img = this.scene.add.image(isoX(gx, gy), isoY(gx, gy), key).setOrigin(0.5, spec.oy).setScale(spec.scale);
    if (flipSeed > 0.5) img.setFlipX(true);
    if (spec.tint !== undefined) img.setTint(spec.tint);
    img.setDepth(depthOf(gx, gy));
    entityC.add(img);
    this.decorations.push(img);
  }

  private buildDecor(entityC: Phaser.GameObjects.Container): void {
    const seed = stringSeed(this.level.id);
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const ch = this.tileAt(col, row);
        if (ch === '#' || this.roadCells.has(`${col},${row}`)) continue;
        const biome = this.biomeAt(col, row);
        const set = DECO[biome];
        const h1 = hash2(col, row, seed + 1);
        const h2 = hash2(col, row, seed + 2);
        const h3 = hash2(col, row, seed + 3);
        const cx = col + 0.5;
        const cy = row + 0.5;
        if (ch === 'T') {
          this.addDeco(entityC, set.T, h1, cx + (h2 - 0.5) * 0.18, cy + (h3 - 0.5) * 0.18, h2);
        } else if (ch === 'r') {
          this.addDeco(entityC, set.r, h1, cx + (h2 - 0.5) * 0.2, cy + (h3 - 0.5) * 0.2, h2);
        } else if (ch === 'c') {
          this.addDeco(entityC, CRYSTAL, h1, cx, cy, h2);
        } else if (ch === 'd') {
          this.addDeco(entityC, set.d, h1, cx + (h2 - 0.5) * 0.3, cy + (h3 - 0.5) * 0.3, h3);
          if (h2 > 0.55) this.addDeco(entityC, set.small, h3, cx + (h1 - 0.5) * 0.6, cy + (h2 - 0.5) * 0.6, h1);
        } else if (ch === '.') {
          // sparse deterministic scatter for richness
          if (h1 < 0.3) this.addDeco(entityC, set.small, h2, cx + (h3 - 0.5) * 0.6, cy + (h2 - 0.5) * 0.6, h3);
          if (h3 < 0.06) this.addDeco(entityC, set.T, h2, cx + (h1 - 0.5) * 0.4, cy + (h2 - 0.5) * 0.4, h1);
        }
      }
    }
  }
}
