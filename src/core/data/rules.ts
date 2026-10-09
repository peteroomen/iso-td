/** Global rules & tuning constants (see docs/DESIGN.md §1). */

export const FIXED_DT = 1 / 60;
export const DEFAULT_LIVES = 20;
export const DEFAULT_WAVE_GAP = 18;

/** Early call: gold = floor(remaining * EARLY_GOLD_PER_SEC); ability cooldowns -= remaining * EARLY_COOLDOWN_PER_SEC. */
export const EARLY_GOLD_PER_SEC = 1.5;
export const EARLY_COOLDOWN_PER_SEC = 0.5;

export const SELL_RATIO = 0.6;
export const MAX_TOWER_LEVEL = 3;

/** Enemies wobble on the road by a uniform random lateral offset in +-LATERAL_OFFSET tiles. */
export const LATERAL_OFFSET = 0.2;

/** Stars on victory. */
export const STARS_THREE_MIN_LIVES = 18;
export const STARS_TWO_MIN_LIVES = 6;
export const MAX_STARS_PER_LEVEL = 3;

/** Visual/animation windows exposed as `attacking` flags (seconds). */
export const ATTACK_ANIM_TIME = 0.3;

/** Rally point must lie within this distance of an enemy path (UI click tolerance). */
export const RALLY_PATH_TOLERANCE = 0.75;

export const SETTINGS_DEFAULTS = { music: 0.5, sfx: 0.8 } as const;
