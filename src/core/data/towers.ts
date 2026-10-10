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
  /** Bomb only: shell blast radius in tiles (0 for other towers). */
  splashRadius: number;
  /** Bomb Lv3 Cluster Bomb: bomblets released on impact (0 = none) and their damage as a fraction of the shell's roll. */
  bomblets: number;
  bombletFactor: number;
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
  /** Projectile speed in tiles/s (0 for barracks and for the bomb, whose shells use a flight time, see BOMB). */
  projectileSpeed: number;
  /** True if the tower cannot target high fliers (and its splash never hurts them). Bomb only. */
  groundOnly: boolean;
  levels: readonly [TowerLevelDef, TowerLevelDef, TowerLevelDef];
}

const NONE = { shots: 1, chainCount: 0, chainRange: 0, chainFactor: 0, splashRadius: 0, bomblets: 0, bombletFactor: 0, knights: 0, knightHp: 0, knightArmor: 0, knightSprite: 0 };

export const TOWERS: Record<TowerKind, TowerDef> = {
  archer: {
    kind: 'archer',
    name: 'Archer Tower',
    damageType: 'physical',
    projectileSpeed: 10,
    groundOnly: false,
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
    groundOnly: false,
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
    groundOnly: false,
    levels: [
      { ...NONE, cost: 70, damageMin: 1, damageMax: 3, cooldown: 1, range: 2.5, knights: 2, knightHp: 50, knightArmor: 0, knightSprite: 1 },
      { ...NONE, cost: 110, damageMin: 3, damageMax: 5, cooldown: 1, range: 2.5, knights: 2, knightHp: 90, knightArmor: 0.15, knightSprite: 2 },
      { ...NONE, cost: 170, damageMin: 6, damageMax: 10, cooldown: 1, range: 2.5, knights: 3, knightHp: 140, knightArmor: 0.3, knightSprite: 3 },
    ],
  },
  bomb: {
    kind: 'bomb',
    name: 'Bomb Tower',
    damageType: 'physical',
    projectileSpeed: 0,
    groundOnly: true,
    levels: [
      { ...NONE, cost: 100, damageMin: 12, damageMax: 22, cooldown: 2.0, range: 3.0, splashRadius: 1.0 },
      { ...NONE, cost: 160, damageMin: 26, damageMax: 48, cooldown: 1.9, range: 3.2, splashRadius: 1.1 },
      { ...NONE, cost: 240, damageMin: 54, damageMax: 84, cooldown: 1.8, range: 3.4, splashRadius: 1.2, bomblets: 3, bombletFactor: 0.3 },
    ],
  },
};

export const TOWER_KINDS: readonly TowerKind[] = ['archer', 'wizard', 'barracks', 'bomb'];

/** Bomb tower shell / splash / cluster constants (docs/DESIGN.md section 3). */
export const BOMB = {
  /** Shell flight time = flightBase + flightPerTile * distance(tower, landing point), seconds. */
  flightBase: 0.9,
  flightPerTile: 0.08,
  /** Splash damage is 100% within `falloffInner` x radius of the centre, then falls linearly to `falloffEdge` at the edge. */
  falloffInner: 0.4,
  falloffEdge: 0.5,
  /** Visual apex heights (tiles) suggested to the renderer. */
  shellArc: 1.6,
  bombletArc: 0.5,
  /** Cluster Bomb: bomblets land uniformly within this distance of the shell's impact point... */
  bombletScatter: 0.8,
  /** ...and explode after this many seconds, with this radius (before the star-tree radius bonus). */
  bombletFuse: 0.35,
  bombletRadius: 0.5,
} as const;

/** Splash damage multiplier at distance `d` from the blast centre (0 outside the radius). */
export function splashFactor(d: number, radius: number): number {
  if (d > radius) return 0;
  const inner = radius * BOMB.falloffInner;
  if (d <= inner) return 1;
  return 1 - ((d - inner) / (radius - inner)) * (1 - BOMB.falloffEdge);
}

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
