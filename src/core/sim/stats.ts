import { MAX_TOWER_LEVEL, SELL_RATIO } from '../data/rules';
import { BOMB, KNIGHT, TOWERS } from '../data/towers';
import { resolveModifiers, type Modifiers } from '../data/upgrades';
import type { DamageType, TowerKind, UpgradeState } from '../types';

/** Damage after resistances. `armor` applies to physical, `magicResist` to magic; `armorPierce` reduces armor (min 0). */
export function calcDamage(raw: number, type: DamageType, armor: number, magicResist: number, armorPierce = 0): number {
  switch (type) {
    case 'physical':
      return raw * (1 - Math.max(0, armor - armorPierce));
    case 'magic':
      return raw * (1 - magicResist);
    default:
      return raw;
  }
}

export interface TowerStatsView {
  kind: TowerKind;
  level: number;
  /** Gold to buy this level (build cost for L1, upgrade step cost for L2/L3), star-tree discount applied. */
  cost: number;
  damageMin: number;
  damageMax: number;
  avgDamage: number;
  /** Seconds between shots / swings. */
  cooldown: number;
  /** Average damage per second (all shots / all knights). */
  dps: number;
  /** Attack range (archer/wizard/bomb) or rally radius (barracks), tiles. */
  range: number;
  /** True if the tower cannot target high fliers (bomb): show "Can't hit fliers". */
  groundOnly: boolean;
  /** Bomb: shell blast radius in tiles (star bonus included), 0 for other towers. */
  splashRadius: number;
  /** Bomb Lv3: bomblets per shell (0 = none), their damage as a fraction of the shell roll, and their blast radius. */
  bomblets: number;
  bombletDamageFactor: number;
  bombletRadius: number;
  shots: number;
  chainCount: number;
  chainRange: number;
  chainFactor: number;
  /** Archer star tier 3. */
  armorPierce: number;
  /** Wizard star tier 3; factor 1 = none. */
  slowFactor: number;
  slowDuration: number;
  // barracks
  knights: number;
  knightHp: number;
  knightArmor: number;
  knightRespawn: number;
  /** Fraction of max HP per second. */
  knightRegen: number;
  knightSprite: number;
  /** Human-readable special, empty when none. */
  special: string;
}

export function levelCost(kind: TowerKind, level: number, mods: Modifiers): number {
  const base = TOWERS[kind].levels[level - 1].cost;
  return kind === 'wizard' ? Math.round(base * mods.wizardCostMult) : base;
}

export function resolveTowerStats(kind: TowerKind, level: number, mods: Modifiers): TowerStatsView {
  const lv = Math.max(1, Math.min(MAX_TOWER_LEVEL, level));
  const def = TOWERS[kind].levels[lv - 1];
  let dmgMult = 1;
  let range = def.range;
  let armorPierce = 0;
  let slowFactor = 1;
  let slowDuration = 0;
  if (kind === 'archer') {
    dmgMult = mods.archerDamageMult;
    range *= mods.archerRangeMult;
    armorPierce = mods.archerArmorPierce;
  } else if (kind === 'wizard') {
    dmgMult = mods.wizardDamageMult;
    slowFactor = mods.wizardSlowFactor;
    slowDuration = mods.wizardSlowDuration;
  } else if (kind === 'bomb') {
    dmgMult = mods.bombDamageMult;
  }
  const isBomb = kind === 'bomb';
  const splashRadius = isBomb ? def.splashRadius * mods.bombRadiusMult : 0;
  const hasCluster = isBomb && def.bomblets > 0;
  const bomblets = hasCluster ? (mods.bombletCountOverride > 0 ? mods.bombletCountOverride : def.bomblets) : 0;
  const bombletDamageFactor = hasCluster ? (mods.bombletFactorOverride > 0 ? mods.bombletFactorOverride : def.bombletFactor) : 0;
  const bombletRadius = hasCluster ? BOMB.bombletRadius * mods.bombRadiusMult : 0;
  const damageMin = def.damageMin * dmgMult;
  const damageMax = def.damageMax * dmgMult;
  const avgDamage = (damageMin + damageMax) / 2;
  const unitCount = kind === 'barracks' ? def.knights : def.shots;
  let special = '';
  if (kind === 'archer' && def.shots > 1) special = 'Double Shot: fires at 2 targets';
  if (kind === 'wizard' && def.chainCount > 0) special = `Arc Bolt: chains to ${def.chainCount} more enemies`;
  if (hasCluster) special = `Cluster Bomb: ${bomblets} bomblets`;
  if (kind === 'barracks' && def.knights > 2) special = `${def.knights} knights`;
  return {
    kind,
    level: lv,
    cost: levelCost(kind, lv, mods),
    damageMin,
    damageMax,
    avgDamage,
    cooldown: def.cooldown,
    dps: (avgDamage * unitCount) / def.cooldown,
    range,
    groundOnly: TOWERS[kind].groundOnly,
    splashRadius,
    bomblets,
    bombletDamageFactor,
    bombletRadius,
    shots: def.shots,
    chainCount: def.chainCount,
    chainRange: def.chainRange,
    chainFactor: def.chainFactor,
    armorPierce,
    slowFactor,
    slowDuration,
    knights: def.knights,
    knightHp: def.knightHp * mods.knightHpMult,
    knightArmor: def.knightArmor,
    knightRespawn: KNIGHT.respawn * mods.knightRespawnMult,
    knightRegen: KNIGHT.regen * mods.knightRegenMult,
    knightSprite: def.knightSprite,
    special,
  };
}

// ---- Public helpers taking the raw purchased star tiers (for UI tooltips) ----

/** Gold to buy `level` of a tower (level 1 = build cost; 2/3 = the upgrade step cost). */
export function towerCost(kind: TowerKind, level: number, upgrades: UpgradeState): number {
  return levelCost(kind, level, resolveModifiers(upgrades));
}

/** Cost to upgrade from `currentLevel` to the next, or null when already max. */
export function upgradeCost(kind: TowerKind, currentLevel: number, upgrades: UpgradeState): number | null {
  if (currentLevel >= MAX_TOWER_LEVEL) return null;
  return towerCost(kind, currentLevel + 1, upgrades);
}

/** Refund when selling a tower that has `invested` gold in it. */
export function sellValue(invested: number): number {
  return Math.floor(invested * SELL_RATIO);
}

export function towerStats(kind: TowerKind, level: number, upgrades: UpgradeState): TowerStatsView {
  return resolveTowerStats(kind, level, resolveModifiers(upgrades));
}
