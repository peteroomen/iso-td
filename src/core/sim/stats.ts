import { MAX_TOWER_LEVEL, SELL_RATIO } from '../data/rules';
import { SPECS, SPEC_TUNING } from '../data/specs';
import { BOMB, KNIGHT, TOWERS } from '../data/towers';
import { resolveModifiers, type Modifiers } from '../data/upgrades';
import type { DamageType, SpecId, TowerKind, UpgradeState } from '../types';

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
  /** Specialization these stats were resolved for (null = none). */
  spec: SpecId | null;
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
  /** Damage factor of every chain jump (Chain Lightning: 0.7 / 0.5 / 0.35); empty without a chain. */
  chainFactors: readonly number[];
  /** Eagle Eye: every Nth arrow ignores all armor (0 = never). */
  armorIgnoreEvery: number;
  /** Fire Mages: burn true dps and seconds (0 = none). */
  igniteDps: number;
  igniteDuration: number;
  /** Hunting Nets: seconds between nets (0 = none), catch radius, root seconds, boss slow factor / seconds. */
  netCooldown: number;
  netRadius: number;
  netDuration: number;
  netBossSlowFactor: number;
  netBossSlowDuration: number;
  /** Homing Missiles: seconds between volleys (0 = none), missiles per volley, raw damage each (Bombs star bonus included), splash radius. */
  missileCooldown: number;
  missileCount: number;
  missileDamage: number;
  missileSplash: number;
  /** Bomb: scatter radius of the bomblets around the impact. */
  bombletScatter: number;
  /** Bow Training: knight arrow damage range / seconds between arrows / range from the knight (0 = knights don't shoot). */
  bowDamageMin: number;
  bowDamageMax: number;
  bowCooldown: number;
  bowRange: number;
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

export function resolveTowerStats(kind: TowerKind, level: number, mods: Modifiers, spec: SpecId | null = null): TowerStatsView {
  if (spec !== null && (SPECS[spec]?.tower !== kind || level < 3)) spec = null;
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
  const T = SPEC_TUNING;
  let knights = def.knights;
  let knightHp = def.knightHp * mods.knightHpMult;
  let knightRespawn = KNIGHT.respawn * mods.knightRespawnMult;
  let chainCount = def.chainCount;
  let chainRange = def.chainRange;
  let chainFactors: readonly number[] = def.chainCount > 0 ? Array.from({ length: def.chainCount }, () => def.chainFactor) : [];
  let armorIgnoreEvery = 0;
  let igniteDps = 0;
  let igniteDuration = 0;
  let netCooldown = 0;
  let netRadius = 0;
  let netDuration = 0;
  let netBossSlowFactor = 1;
  let netBossSlowDuration = 0;
  let missileCooldown = 0;
  let missileCount = 0;
  let missileDamage = 0;
  let missileSplash = 0;
  let bowDamageMin = 0;
  let bowDamageMax = 0;
  let bowCooldown = 0;
  let bowRange = 0;
  let specRadiusMult = 1;
  let extraBomblets = 0;
  switch (spec) {
    case 'eagle_eye':
      dmgMult *= T.eagle_eye.damageMult;
      range *= T.eagle_eye.rangeMult;
      armorIgnoreEvery = T.eagle_eye.ignoreEvery;
      break;
    case 'hunting_nets':
      netCooldown = T.hunting_nets.cooldown;
      netRadius = T.hunting_nets.radius;
      netDuration = T.hunting_nets.rootDuration;
      netBossSlowFactor = T.hunting_nets.bossSlowFactor;
      netBossSlowDuration = T.hunting_nets.bossSlowDuration;
      break;
    case 'chain_lightning':
      chainCount = T.chain_lightning.jumps;
      chainRange = T.chain_lightning.range;
      chainFactors = T.chain_lightning.factors;
      break;
    case 'fire_mages':
      igniteDps = T.fire_mages.dps;
      igniteDuration = T.fire_mages.duration;
      break;
    case 'bigger_bombs':
      dmgMult *= T.bigger_bombs.damageMult;
      specRadiusMult = T.bigger_bombs.radiusMult;
      extraBomblets = T.bigger_bombs.extraBomblets;
      break;
    case 'homing_missiles':
      missileCooldown = T.homing_missiles.cooldown;
      missileCount = T.homing_missiles.count;
      missileDamage = T.homing_missiles.damage * mods.bombDamageMult;
      missileSplash = T.homing_missiles.splash * mods.bombRadiusMult;
      break;
    case 'bow_training':
      bowDamageMin = T.bow_training.damageMin;
      bowDamageMax = T.bow_training.damageMax;
      bowCooldown = T.bow_training.cooldown;
      bowRange = T.bow_training.range;
      break;
    case 'extra_recruits':
      knights += T.extra_recruits.extraKnights;
      knightHp *= T.extra_recruits.hpMult;
      knightRespawn *= T.extra_recruits.respawnMult;
      break;
    default:
      break;
  }
  const isBomb = kind === 'bomb';
  const splashRadius = isBomb ? def.splashRadius * mods.bombRadiusMult * specRadiusMult : 0;
  const hasCluster = isBomb && def.bomblets > 0;
  const bomblets = hasCluster ? (mods.bombletCountOverride > 0 ? mods.bombletCountOverride : def.bomblets) + extraBomblets : 0;
  const bombletDamageFactor = hasCluster ? (mods.bombletFactorOverride > 0 ? mods.bombletFactorOverride : def.bombletFactor) : 0;
  const bombletRadius = hasCluster ? BOMB.bombletRadius * mods.bombRadiusMult * specRadiusMult : 0;
  const bombletScatter = hasCluster ? BOMB.bombletScatter * specRadiusMult : 0;
  const damageMin = def.damageMin * dmgMult;
  const damageMax = def.damageMax * dmgMult;
  const avgDamage = (damageMin + damageMax) / 2;
  const unitCount = kind === 'barracks' ? knights : def.shots;
  let special = '';
  if (kind === 'archer' && def.shots > 1) special = 'Double Shot: fires at 2 targets';
  if (hasCluster) special = `Cluster Bomb: ${bomblets} bomblets`;
  if (kind === 'barracks' && knights > 2) special = `${knights} knights`;
  if (spec) special = special ? `${SPECS[spec].name}: ${SPECS[spec].blurb}. ${special}` : `${SPECS[spec].name}: ${SPECS[spec].blurb}`;
  return {
    kind,
    level: lv,
    spec,
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
    chainCount,
    chainRange,
    chainFactor: chainFactors[0] ?? 0,
    chainFactors,
    armorIgnoreEvery,
    igniteDps,
    igniteDuration,
    netCooldown,
    netRadius,
    netDuration,
    netBossSlowFactor,
    netBossSlowDuration,
    missileCooldown,
    missileCount,
    missileDamage,
    missileSplash,
    bombletScatter,
    bowDamageMin,
    bowDamageMax,
    bowCooldown,
    bowRange,
    armorPierce,
    slowFactor,
    slowDuration,
    knights,
    knightHp,
    knightArmor: def.knightArmor,
    knightRespawn,
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

export function towerStats(kind: TowerKind, level: number, upgrades: UpgradeState, spec: SpecId | null = null): TowerStatsView {
  return resolveTowerStats(kind, level, resolveModifiers(upgrades), spec);
}
