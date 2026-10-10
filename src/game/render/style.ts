import type { EnemyState } from '../../core';

/**
 * The sprite pack is drawn at ONE pixel scale (tile outline ~10 px, tower/UFO/knight outlines 7-10 px).
 * Magnifying raster art thickens its outline, so units stay close to native: <= ~1.25x, towers exactly 1x.
 * Enemy size differentiation is deliberately small (see `enemyScale`); tints/effects/shadows do the rest.
 */
export const UFO_SCALE = 1.05;
export const KNIGHT_SCALE = 1.2;
export const BOSS_SCALE = 1.1;
export const ARROW_SCALE = 1.1;
export const BOLT_SCALE = 1.2;

/** Render scale of a UFO from its sim size factor (0.85..1.5 -> ~1.0..1.23 at UFO_SCALE). */
export function enemyScale(defScale: number): number {
  return UFO_SCALE * (1 + (defScale - 1) * 0.35);
}

/** Hover altitude (source px) of ground UFOs vs. high fliers. */
export const HOVER_GROUND = 16;
export const HOVER_FLIER = 52;
export const HOVER_BOSS = 46;

export function hoverOf(e: Pick<EnemyState, 'flier' | 'boss'>): number {
  return e.boss ? HOVER_BOSS : e.flier ? HOVER_FLIER : HOVER_GROUND;
}

/** Height (source px) of the centre of an enemy body above the ground: projectile aim point. */
export function bodyHeightOf(e: Pick<EnemyState, 'flier' | 'boss' | 'type'>): number {
  if (e.boss) return HOVER_BOSS + 36;
  return hoverOf(e) + 32;
}

export const MILITIA_TINT = 0xffd88a;
export const SLOW_TINT = 0x8fb8ff;

/** Bomb shell / bomblet render scale (texture is 40 px, the ball itself ~25 px). */
export const SHELL_SCALE = 1.25;
export const BOMBLET_SCALE = 0.7;
