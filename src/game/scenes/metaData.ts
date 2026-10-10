import { LEVELS, TOWER_KINDS, hasFlag, type Biome, type LevelDef, type SaveData, type TowerKind } from '../../core';
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

export type TowerIconKind = TowerKind;

/** Sprite key of a tower at a given level (1..3). */
export function towerSprite(kind: TowerIconKind, level: number): string {
  const lv = Math.max(1, Math.min(3, Math.round(level)));
  if (kind === 'archer') return `towers/archer_level_${lv}`;
  if (kind === 'wizard') return `towers/wizard_level_${lv}`;
  if (kind === 'bomb') return `towers/bomb_level_${lv}`;
  return `towers/barrack_level_${lv}_1`;
}

/** Scale an image so it fits inside a w x h box. */
export function fitImage<T extends { width: number; height: number; setScale(s: number): unknown }>(img: T, w: number, h: number): T {
  img.setScale(Math.min(w / img.width, h / img.height));
  return img;
}

// ---------------------------------------------------------------------------------------------------------------
// tower-cap unlocks
// ---------------------------------------------------------------------------------------------------------------

export interface TowerUnlock {
  /** 'all' when every tower kind got the same new cap (e.g. level 2: "All Lv2 towers"). */
  kind: TowerIconKind | 'all';
  level: number;
  /** Short headline, e.g. "Archer Lv3". */
  title: string;
  /** One-line description of the new tier. */
  text: string;
}

const KIND_NAMES: Record<TowerIconKind, string> = { archer: 'Archer', wizard: 'Wizard', barracks: 'Barracks', bomb: 'Bomb' };

const TIER_TEXT: Record<TowerIconKind, Record<number, string>> = {
  archer: { 2: 'Faster, harder-hitting arrows', 3: 'Double Shot: hits 2 targets' },
  wizard: { 2: 'Heavier magic bolts', 3: 'Arc Bolt: chains to 2 more enemies' },
  barracks: { 2: 'Tougher knights', 3: '3 knights with heavy armor' },
  bomb: { 2: 'Heavier shells, bigger blast', 3: 'Cluster Bomb: shells burst into bomblets' },
};

/** All tower kinds in menu order (archer, wizard, barracks, bomb). */
export const KINDS: readonly TowerIconKind[] = TOWER_KINDS;

/**
 * Tower tiers that level `index` (0-based) makes available for the first time: its `towerCap` compared with the
 * highest cap of every earlier level. Level 1 (the baseline) never announces anything.
 */
export function levelUnlocks(index: number): TowerUnlock[] {
  const nodes = levelNodes();
  const def = nodes[index]?.def;
  if (!def || index === 0) return [];
  const prev: Record<TowerIconKind, number> = { archer: 1, wizard: 1, barracks: 1, bomb: 1 };
  for (let i = 0; i < index; i++) {
    const d = nodes[i].def;
    if (!d) continue;
    for (const k of KINDS) prev[k] = Math.max(prev[k], d.towerCap[k]);
  }
  const gains = KINDS.filter((k) => def.towerCap[k] > prev[k]);
  if (gains.length === 0) return [];
  const lv = def.towerCap[gains[0]];
  if (gains.length === KINDS.length && gains.every((k) => def.towerCap[k] === lv)) {
    return [{ kind: 'all', level: lv, title: `All Lv${lv} towers`, text: 'Archers, Wizards, Barracks and Bombs can reach Lv' + lv }];
  }
  return gains.map((k) => {
    const level = def.towerCap[k];
    return { kind: k, level, title: `${KIND_NAMES[k]} Lv${level}`, text: TIER_TEXT[k][level] ?? `Upgrade to level ${level}` };
  });
}

/** Unlocks to announce for level `id`: only on a level the player has not beaten yet and has not been told about. */
export function pendingUnlocks(save: SaveData, id: string): TowerUnlock[] {
  if (save.levels[id]?.completed || hasFlag(save, unlockFlag(id))) return [];
  const node = levelNodes().find((n) => n.id === id);
  return node ? levelUnlocks(node.index) : [];
}

export function unlockFlag(levelId: string): string {
  return 'unlockSeen:' + levelId;
}

/** Display name of a tower kind. */
export function towerName(kind: TowerIconKind): string {
  return KIND_NAMES[kind];
}
