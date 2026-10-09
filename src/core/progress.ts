import { MAX_STARS_PER_LEVEL, SETTINGS_DEFAULTS, STARS_THREE_MIN_LIVES, STARS_TWO_MIN_LIVES } from './data/rules';
import { MAX_TIER, TIER_COSTS, UPGRADE_TRACKS, emptyUpgrades } from './data/upgrades';
import type { CommandResult, UpgradeState, UpgradeTrack } from './types';

/** Stars awarded for winning with `lives` lives left: >=18 -> 3, >=6 -> 2, else 1. */
export function starsForLives(lives: number): number {
  if (lives >= STARS_THREE_MIN_LIVES) return 3;
  if (lives >= STARS_TWO_MIN_LIVES) return 2;
  return 1;
}

export const SAVE_VERSION = 1;

export interface LevelResult {
  stars: number;
  completed: boolean;
}

export interface Settings {
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
}

export interface SaveData {
  version: number;
  levels: Record<string, LevelResult>;
  /** Purchased star-tree tiers per track. */
  upgrades: UpgradeState;
  settings: Settings;
  /** Enemy ids whose "new enemy" intro card has been shown. */
  seenEnemies: string[];
  /** One-off flags, e.g. 'endingSeen', 'unlockSeen:level03'. */
  flags: string[];
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    levels: {},
    upgrades: emptyUpgrades(),
    settings: { ...SETTINGS_DEFAULTS },
    seenEnemies: [],
    flags: [],
  };
}

export function hasFlag(save: SaveData, flag: string): boolean {
  return save.flags.includes(flag);
}

export function withFlag(save: SaveData, flag: string): SaveData {
  return hasFlag(save, flag) ? save : { ...save, flags: [...save.flags, flag] };
}

export function withSeenEnemies(save: SaveData, ids: readonly string[]): SaveData {
  const add = ids.filter((id) => !save.seenEnemies.includes(id));
  return add.length ? { ...save, seenEnemies: [...save.seenEnemies, ...add] } : save;
}

// ---- stars ----

export function starsEarned(save: SaveData): number {
  let total = 0;
  for (const r of Object.values(save.levels)) total += r.stars;
  return total;
}

/** Total star cost of the purchased tiers. */
export function starsSpent(save: SaveData): number {
  let total = 0;
  for (const track of UPGRADE_TRACKS) {
    for (let t = 0; t < save.upgrades[track]; t++) total += TIER_COSTS[t];
  }
  return total;
}

export function starsAvailable(save: SaveData): number {
  return starsEarned(save) - starsSpent(save);
}

/** Cost of the next tier of a track, or null if maxed. */
export function nextTierCost(save: SaveData, track: UpgradeTrack): number | null {
  const owned = save.upgrades[track];
  return owned >= MAX_TIER ? null : TIER_COSTS[owned];
}

export function canBuyTier(save: SaveData, track: UpgradeTrack): CommandResult {
  const cost = nextTierCost(save, track);
  if (cost === null) return { ok: false, reason: 'max_level' };
  if (starsAvailable(save) < cost) return { ok: false, reason: 'gold' };
  return { ok: true };
}

/** Returns a new save with the next tier of `track` bought (or the same save if it can't be bought). */
export function buyTier(save: SaveData, track: UpgradeTrack): SaveData {
  if (!canBuyTier(save, track).ok) return save;
  return { ...save, upgrades: { ...save.upgrades, [track]: save.upgrades[track] + 1 } };
}

/** Free full refund of all purchased tiers. */
export function resetUpgrades(save: SaveData): SaveData {
  return { ...save, upgrades: emptyUpgrades() };
}

// ---- levels ----

/**
 * Level `levelId` is unlocked if it's first in `order`, or the previous level in `order` has been won.
 * Unknown ids are locked.
 */
export function isLevelUnlocked(save: SaveData, levelId: string, order: readonly string[]): boolean {
  const i = order.indexOf(levelId);
  if (i < 0) return false;
  if (i === 0) return true;
  return !!save.levels[order[i - 1]]?.completed;
}

export interface RecordResultInfo {
  save: SaveData;
  /** Stars earned in this run. */
  stars: number;
  /** Stars gained over the previous best (0 if not better). */
  gained: number;
  firstClear: boolean;
}

/** Records a victory with `livesLeft` lives; keeps the best star count. Returns a new save. */
export function recordResult(save: SaveData, levelId: string, livesLeft: number): RecordResultInfo {
  const stars = Math.min(MAX_STARS_PER_LEVEL, starsForLives(livesLeft));
  const prev = save.levels[levelId];
  const prevStars = prev?.stars ?? 0;
  const best = Math.max(prevStars, stars);
  return {
    save: { ...save, levels: { ...save.levels, [levelId]: { stars: best, completed: true } } },
    stars,
    gained: best - prevStars,
    firstClear: !prev?.completed,
  };
}

// ---- settings ----

export function withSettings(save: SaveData, patch: Partial<Settings>): SaveData {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const settings = { ...save.settings };
  if (patch.music !== undefined) settings.music = clamp(patch.music);
  if (patch.sfx !== undefined) settings.sfx = clamp(patch.sfx);
  return { ...save, settings };
}

// ---- (de)serialisation ----

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

/** Tolerant parser: returns a sanitized SaveData; any garbage falls back to defaults field by field. */
export function parseSave(raw: string | null | undefined): SaveData {
  const out = createDefaultSave();
  if (!raw) return out;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return out;
  }
  if (typeof data !== 'object' || data === null) return out;
  const d = data as Record<string, unknown>;

  if (typeof d.levels === 'object' && d.levels !== null) {
    for (const [id, v] of Object.entries(d.levels as Record<string, unknown>)) {
      if (typeof v !== 'object' || v === null) continue;
      const r = v as Record<string, unknown>;
      const stars = typeof r.stars === 'number' ? Math.max(0, Math.min(MAX_STARS_PER_LEVEL, Math.floor(r.stars))) : 0;
      out.levels[id] = { stars, completed: r.completed === true || stars > 0 };
    }
  }
  if (typeof d.upgrades === 'object' && d.upgrades !== null) {
    const u = d.upgrades as Record<string, unknown>;
    for (const track of UPGRADE_TRACKS) {
      const v = u[track];
      if (typeof v === 'number') out.upgrades[track] = Math.max(0, Math.min(MAX_TIER, Math.floor(v)));
    }
  }
  if (typeof d.settings === 'object' && d.settings !== null) {
    const s = d.settings as Record<string, unknown>;
    if (typeof s.music === 'number') out.settings.music = Math.max(0, Math.min(1, s.music));
    if (typeof s.sfx === 'number') out.settings.sfx = Math.max(0, Math.min(1, s.sfx));
  }
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];
  out.seenEnemies = strList(d.seenEnemies);
  out.flags = strList(d.flags);
  // never allow spending more stars than were earned (tamper / old data): reset upgrades
  if (starsSpent(out) > starsEarned(out)) out.upgrades = emptyUpgrades();
  return out;
}
