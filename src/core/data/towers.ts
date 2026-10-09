import type { DamageType, TowerKind } from '../types';

/**
 * Tower tables (docs/DESIGN.md §3). `cost` is the gold to buy THAT level (level 1 = build, 2/3 = upgrade step).
 * For barracks, damage/cooldown describe the knights' melee and `range` is the rally radius.
 */
export interface TowerLevelDef {
  cost: number;
  damageMin: number;
  damageMax: number;
  /** Seconds between shots (archer/wizard) or between knight swings (barracks). */
  cooldown: number;
  /** Attack range (archer/wizard) or max rally distance (barracks), tiles. */
  range: number;
  /** Simultaneous targets per shot (archer double shot = 2). */
  shots: number;
  /** Wizard arc bolt: extra chain targets / chain radius / damage factor on chained hits. */
  chainCount: number;
  chainRange: number;
  chainFactor: number;
  /** Barracks only. */
  knights: number;
  knightHp: number;
  knightArmor: number;
  /** Sprite key suffix for the knight (units/knight_level_N). */
  knightSprite: number;
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  damageType: DamageType;
  /** Projectile speed in tiles/s (0 for barracks). */
  projectileSpeed: number;
  levels: readonly [TowerLevelDef, TowerLevelDef, TowerLevelDef];
}

const NONE = { shots: 1, chainCount: 0, chainRange: 0, chainFactor: 0, knights: 0, knightHp: 0, knightArmor: 0, knightSprite: 0 };

export const TOWERS: Record<TowerKind, TowerDef> = {
  archer: {
    kind: 'archer',
    name: 'Archer Tower',
    damageType: 'physical',
    projectileSpeed: 10,
    levels: [
      { ...NONE, cost: 70, damageMin: 4, damageMax: 6, cooldown: 0.8, range: 3.2 },
      { ...NONE, cost: 110, damageMin: 8, damageMax: 12, cooldown: 0.7, range: 3.5 },
      { ...NONE, cost: 160, damageMin: 13, damageMax: 19, cooldown: 0.6, range: 3.8, shots: 2 },
    ],
  },
  wizard: {
    kind: 'wizard',
    name: 'Wizard Tower',
    damageType: 'magic',
    projectileSpeed: 7,
    levels: [
      { ...NONE, cost: 100, damageMin: 12, damageMax: 20, cooldown: 1.5, range: 3.0 },
      { ...NONE, cost: 160, damageMin: 25, damageMax: 40, cooldown: 1.4, range: 3.0 },
      { ...NONE, cost: 240, damageMin: 45, damageMax: 70, cooldown: 1.3, range: 3.2, chainCount: 2, chainRange: 1.5, chainFactor: 0.5 },
    ],
  },
  barracks: {
    kind: 'barracks',
    name: 'Barracks',
    damageType: 'physical',
    projectileSpeed: 0,
    levels: [
      { ...NONE, cost: 70, damageMin: 1, damageMax: 3, cooldown: 1, range: 2.5, knights: 2, knightHp: 50, knightArmor: 0, knightSprite: 1 },
      { ...NONE, cost: 110, damageMin: 3, damageMax: 5, cooldown: 1, range: 2.5, knights: 2, knightHp: 90, knightArmor: 0.15, knightSprite: 2 },
      { ...NONE, cost: 170, damageMin: 6, damageMax: 10, cooldown: 1, range: 2.5, knights: 3, knightHp: 140, knightArmor: 0.3, knightSprite: 3 },
    ],
  },
};

export const TOWER_KINDS: readonly TowerKind[] = ['archer', 'wizard', 'barracks'];

/** Knights (barracks units). */
export const KNIGHT = {
  speed: 1.6,
  /** Seconds after death until a barracks knight respawns at the tower. */
  respawn: 10,
  /** Fraction of max HP regenerated per second while not fighting. */
  regen: 0.02,
  /** A knight engages enemies within this distance of its rally post. */
  engageRange: 1.0,
  /** Chasing leash: a knight gives up a target that gets farther than this from its post. */
  leashRange: 1.6,
  /** Melee contact distance between a fighter and its target. */
  contactRange: 0.5,
  /** Radius of the formation ring around the post. */
  formationRadius: 0.3,
} as const;
