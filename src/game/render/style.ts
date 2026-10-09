import type { EnemyState } from '../../core';

/** Sprite scale boosts: the pack draws units tiny relative to the 250 px tiles (and towers get 1.2x on top). */
export const UNIT_BOOST = 1.35;
export const UFO_SCALE = 1.75 * UNIT_BOOST;
export const KNIGHT_SCALE = 1.9 * UNIT_BOOST;
export const BOSS_SCALE = 1.35 * 1.15;

/** Hover altitude (source px) of ground UFOs vs. high fliers. */
export const HOVER_GROUND = 30;
export const HOVER_FLIER = 96;
export const HOVER_BOSS = 70;

export function hoverOf(e: Pick<EnemyState, 'flier' | 'boss'>): number {
  return e.boss ? HOVER_BOSS : e.flier ? HOVER_FLIER : HOVER_GROUND;
}

/** Height (source px) of the centre of an enemy body above the ground: projectile aim point. */
export function bodyHeightOf(e: Pick<EnemyState, 'flier' | 'boss' | 'type'>): number {
  if (e.boss) return HOVER_BOSS + 70;
  return hoverOf(e) + 62;
}

export const MILITIA_TINT = 0xffd88a;
export const SLOW_TINT = 0x8fb8ff;
