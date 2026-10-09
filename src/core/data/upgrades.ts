import type { UpgradeState, UpgradeTrack } from '../types';

/** Star upgrade tree (docs/DESIGN.md §5): 5 tracks x 3 tiers, costing 1/2/3 stars, bought in order. */

export const UPGRADE_TRACKS: readonly UpgradeTrack[] = ['archers', 'wizards', 'barracks', 'orbital', 'reinforcements'];
export const TIER_COSTS: readonly [number, number, number] = [1, 2, 3];
export const MAX_TIER = 3;

export interface TrackInfo {
  name: string;
  tiers: readonly [string, string, string];
}

export const TRACK_INFO: Record<UpgradeTrack, TrackInfo> = {
  archers: { name: 'Archers', tiers: ['+10% range', '+15% damage', 'Armor piercing: target armor -30%'] },
  wizards: { name: 'Wizards', tiers: ['-10% tower cost', '+15% damage', 'Bolts slow enemies by 30% for 1 s'] },
  barracks: { name: 'Barracks', tiers: ['+20% knight HP', '-30% respawn time', 'Idle regeneration x3'] },
  orbital: { name: 'Orbital Strike', tiers: ['-10 s cooldown', '+40% damage and radius', 'Burning ground (3 s, 15 dps)'] },
  reinforcements: { name: 'Reinforcements', tiers: ['+50% militia HP', '3 militia', '20 s duration, -3 s cooldown'] },
};

/** Tunable values of each tier. */
export const UPGRADE_TUNING = {
  archers: { rangeMult: 1.1, damageMult: 1.15, armorPierce: 0.3 },
  wizards: { costMult: 0.9, damageMult: 1.15, slowFactor: 0.7, slowDuration: 1 },
  barracks: { hpMult: 1.2, respawnMult: 0.7, regenMult: 3 },
  orbital: { cooldownReduction: 10, damageMult: 1.4, radiusMult: 1.4 },
  reinforcements: { hpMult: 1.5, extraCount: 1, duration: 20, cooldownReduction: 3 },
} as const;

export function emptyUpgrades(): UpgradeState {
  return { archers: 0, wizards: 0, barracks: 0, orbital: 0, reinforcements: 0 };
}

/** Everything the sim needs from the star tree, resolved to plain numbers. */
export interface Modifiers {
  archerRangeMult: number;
  archerDamageMult: number;
  archerArmorPierce: number;
  wizardCostMult: number;
  wizardDamageMult: number;
  /** 1 = no slow. */
  wizardSlowFactor: number;
  wizardSlowDuration: number;
  knightHpMult: number;
  knightRespawnMult: number;
  knightRegenMult: number;
  orbitalCooldownReduction: number;
  orbitalDamageMult: number;
  orbitalRadiusMult: number;
  orbitalBurn: boolean;
  reinforceHpMult: number;
  reinforceExtraCount: number;
  /** Absolute duration override (0 = use base). */
  reinforceDuration: number;
  reinforceCooldownReduction: number;
}

export function resolveModifiers(u: UpgradeState): Modifiers {
  const T = UPGRADE_TUNING;
  return {
    archerRangeMult: u.archers >= 1 ? T.archers.rangeMult : 1,
    archerDamageMult: u.archers >= 2 ? T.archers.damageMult : 1,
    archerArmorPierce: u.archers >= 3 ? T.archers.armorPierce : 0,
    wizardCostMult: u.wizards >= 1 ? T.wizards.costMult : 1,
    wizardDamageMult: u.wizards >= 2 ? T.wizards.damageMult : 1,
    wizardSlowFactor: u.wizards >= 3 ? T.wizards.slowFactor : 1,
    wizardSlowDuration: u.wizards >= 3 ? T.wizards.slowDuration : 0,
    knightHpMult: u.barracks >= 1 ? T.barracks.hpMult : 1,
    knightRespawnMult: u.barracks >= 2 ? T.barracks.respawnMult : 1,
    knightRegenMult: u.barracks >= 3 ? T.barracks.regenMult : 1,
    orbitalCooldownReduction: u.orbital >= 1 ? T.orbital.cooldownReduction : 0,
    orbitalDamageMult: u.orbital >= 2 ? T.orbital.damageMult : 1,
    orbitalRadiusMult: u.orbital >= 2 ? T.orbital.radiusMult : 1,
    orbitalBurn: u.orbital >= 3,
    reinforceHpMult: u.reinforcements >= 1 ? T.reinforcements.hpMult : 1,
    reinforceExtraCount: u.reinforcements >= 2 ? T.reinforcements.extraCount : 0,
    reinforceDuration: u.reinforcements >= 3 ? T.reinforcements.duration : 0,
    reinforceCooldownReduction: u.reinforcements >= 3 ? T.reinforcements.cooldownReduction : 0,
  };
}
