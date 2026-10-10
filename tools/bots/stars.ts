import { TIER_COSTS } from '../../src/core/data/upgrades';
import type { UpgradeState, UpgradeTrack } from '../../src/core/types';

/**
 * Order in which a sensible player spends star points. Each entry buys the next tier of that track; the budget is
 * spent strictly in this order (stop at the first unaffordable entry).
 */
const ORDER: readonly UpgradeTrack[] = [
  'orbital', // 1: -10 s cooldown
  'archers', // 1: +10% range
  'barracks', // 1: +20% knight HP
  'archers', // 2: +15% damage
  'orbital', // 2: +40% damage & radius
  'wizards', // 1: -10% cost
  'reinforcements', // 1: +50% militia HP
  'barracks', // 2: -30% respawn
  'wizards', // 2: +15% damage
  'archers', // 3: armor piercing
  'bombs', // 1: +20% blast radius
  'reinforcements', // 2: 3 militia
  'bombs', // 2: +15% bomb damage
  'orbital', // 3: burning ground
  'barracks', // 3: idle regen
  'wizards', // 3: slow
  'reinforcements', // 3: 20 s duration
  'bombs', // 3: 5 bomblets
];

export function upgradesForStars(budget: number): UpgradeState {
  const u: UpgradeState = { archers: 0, wizards: 0, barracks: 0, orbital: 0, reinforcements: 0, bombs: 0 };
  let left = budget;
  for (const track of ORDER) {
    const cost = TIER_COSTS[u[track]];
    if (cost > left) break;
    left -= cost;
    u[track]++;
  }
  return u;
}

/** Stars a bot owns when starting level `levelNumber` (1-based) having earned `perLevel` stars on each earlier level. */
export function starBudget(levelNumber: number, perLevel: number): number {
  return Math.min(30, Math.max(0, levelNumber - 1) * perLevel) /* 30 = stars earnable in the campaign; the tree costs 36 */;
}
