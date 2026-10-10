import type { SpecId } from '../../src/core/types';
import type { BotConfig } from './types';

const base: Omit<BotConfig, 'name'> = { starsPerLevel: 2, abilities: 'competent', early: 'competent', style: 'plan', planKind: 'competent', specs: 'auto' };

/** All bots, in report order. */
export const BOTS: Record<string, BotConfig> = {
  competent: { name: 'competent', ...base },
  expert: { name: 'expert', ...base, starsPerLevel: 3, abilities: 'expert', early: 'expert', planKind: 'expert' },
  naive: { name: 'naive', ...base, specs: 'none', starsPerLevel: 1, abilities: 'none', early: 'never', style: 'naive' },
  nospec: { name: 'nospec', ...base, specs: 'none' },
  idle: { name: 'idle', ...base, specs: 'none', starsPerLevel: 0, abilities: 'none', early: 'never', style: 'idle' },
  'archer-only': { name: 'archer-only', ...base, onlyKind: 'archer' },
  'wizard-only': { name: 'wizard-only', ...base, onlyKind: 'wizard' },
  'barracks-only': { name: 'barracks-only', ...base, onlyKind: 'barracks' },
  'bomb-only': { name: 'bomb-only', ...base, onlyKind: 'bomb' },
};

/** One bot per specialization: the competent plan, but every Lv3 tower of that kind buys exactly this spec and nothing else is specialized. */
export const SPEC_BOT_IDS: readonly SpecId[] = ['eagle_eye', 'hunting_nets', 'chain_lightning', 'fire_mages', 'bigger_bombs', 'homing_missiles', 'bow_training', 'extra_recruits'];
for (const id of SPEC_BOT_IDS) BOTS[`spec:${id}`] = { name: `spec:${id}`, ...base, forceSpec: id };

export const MAIN_BOTS = ['competent', 'expert', 'naive', 'idle'] as const;
export const SPEC_BOTS = ['nospec', ...SPEC_BOT_IDS.map((i) => `spec:${i}`)] as const;
export const VARIANT_BOTS = ['archer-only', 'wizard-only', 'barracks-only', 'bomb-only'] as const;
