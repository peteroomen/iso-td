import type { BotConfig } from './types';

const base: Omit<BotConfig, 'name'> = { starsPerLevel: 2, abilities: 'competent', early: 'competent', style: 'plan', planKind: 'competent' };

/** All bots, in report order. */
export const BOTS: Record<string, BotConfig> = {
  competent: { name: 'competent', ...base },
  expert: { name: 'expert', ...base, starsPerLevel: 3, abilities: 'expert', early: 'expert', planKind: 'expert' },
  naive: { name: 'naive', ...base, starsPerLevel: 1, abilities: 'none', early: 'never', style: 'naive' },
  idle: { name: 'idle', ...base, starsPerLevel: 0, abilities: 'none', early: 'never', style: 'idle' },
  'archer-only': { name: 'archer-only', ...base, onlyKind: 'archer' },
  'wizard-only': { name: 'wizard-only', ...base, onlyKind: 'wizard' },
  'barracks-only': { name: 'barracks-only', ...base, onlyKind: 'barracks' },
  'bomb-only': { name: 'bomb-only', ...base, onlyKind: 'bomb' },
};

export const MAIN_BOTS = ['competent', 'expert', 'naive', 'idle'] as const;
export const VARIANT_BOTS = ['archer-only', 'wizard-only', 'barracks-only', 'bomb-only'] as const;
