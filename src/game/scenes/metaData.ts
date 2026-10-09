import { LEVELS, type Biome, type LevelDef, type SaveData } from '../../core';
import { getSave } from '../services/save';

/** Data helpers shared by the meta scenes (level map, upgrades). */

export const NODE_COUNT = 10;

const FALLBACK_NAMES = [
  'Meadow Landing', 'Cloverfield', 'Forked Creek', 'Dune Gate', 'Twin Canyons', 'Mirage Loop', 'Frostbite Pass',
  'Glacier Merge', 'Icicle Hold', 'The Mothership',
];

export interface LevelNode {
  /** 0-based */
  index: number;
  /** 1-based display number */
  number: number;
  id: string;
  def?: LevelDef;
  name: string;
  biome: Biome | 'mixed';
  boss: boolean;
}

function biomeOfIndex(i: number): Biome | 'mixed' {
  if (i < 3) return 'spring';
  if (i < 6) return 'desert';
  if (i < 9) return 'winter';
  return 'mixed';
}

/** The 10 campaign nodes; levels that are not defined yet (during development) are still listed (as "coming soon"). */
export function levelNodes(): LevelNode[] {
  const nodes: LevelNode[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const id = `level${String(i + 1).padStart(2, '0')}`;
    const def = LEVELS.find((l) => l.id === id) ?? LEVELS[i];
    nodes.push({
      index: i,
      number: i + 1,
      id: def?.id ?? id,
      def,
      name: def?.name ?? FALLBACK_NAMES[i],
      biome: def?.biome ?? biomeOfIndex(i),
      boss: i === NODE_COUNT - 1,
    });
  }
  return nodes;
}

export function levelOrder(): string[] {
  return levelNodes().map((n) => n.id);
}

const params = new URLSearchParams(window.location.search);

export function urlParam(name: string): string | null {
  return params.get(name);
}

export function devUnlockAll(): boolean {
  return params.get('unlockAll') === '1';
}

/**
 * The save as the meta UI should see it. With `?unlockAll=1` every level counts as completed (in memory only,
 * nothing is written to storage), so the whole map is playable.
 */
export function metaSave(): SaveData {
  const s = getSave();
  if (!devUnlockAll()) return s;
  const levels = { ...s.levels };
  for (const id of levelOrder()) levels[id] = { stars: levels[id]?.stars ?? 0, completed: true };
  return { ...s, levels };
}

export const BIOME_NAMES: Record<Biome | 'mixed', string> = {
  spring: 'Spring Meadows',
  desert: 'Desert Dunes',
  winter: 'Frozen Peaks',
  mixed: 'Invasion Fleet',
};

export const BIOME_COLORS: Record<Biome | 'mixed', number> = {
  spring: 0x6cc24a,
  desert: 0xe8a845,
  winter: 0x8fd0ff,
  mixed: 0xc06bff,
};

export type TowerIconKind = 'archer' | 'wizard' | 'barracks';

/** Sprite key of a tower at a given level (1..3). */
export function towerSprite(kind: TowerIconKind, level: number): string {
  const lv = Math.max(1, Math.min(3, Math.round(level)));
  if (kind === 'archer') return `towers/archer_level_${lv}`;
  if (kind === 'wizard') return `towers/wizard_level_${lv}`;
  return `towers/barrack_level_${lv}_1`;
}

/** Scale an image so it fits inside a w x h box. */
export function fitImage<T extends { width: number; height: number; setScale(s: number): unknown }>(img: T, w: number, h: number): T {
  img.setScale(Math.min(w / img.width, h / img.height));
  return img;
}
