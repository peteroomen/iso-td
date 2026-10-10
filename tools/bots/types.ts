import type { SpecId, TowerKind, Vec2 } from '../../src/core/types';

/** One scripted step of a bot plan. Spots are addressed by their (col,row) cell so plans survive map edits. */
export type PlanAction =
  | { do: 'build'; at: readonly [number, number]; kind: TowerKind; /** do not start before this many waves have started */ wave?: number }
  | { do: 'up'; at: readonly [number, number]; wave?: number }
  /** Buy a specialization for the (Lv3) tower on that spot; skipped when the tower is missing / not level 3. Inserted by tools/bots/specs.ts. */
  | { do: 'spec'; at: readonly [number, number]; spec: SpecId; wave?: number }
  | { do: 'rally'; at: readonly [number, number]; to: readonly [number, number]; wave?: number };

export interface LevelPlan {
  /** Ordered actions, executed in order as soon as they are affordable. */
  competent: readonly PlanAction[];
  /** Expert plan (defaults to the competent one). */
  expert?: readonly PlanAction[];
}

export const b = (col: number, row: number, kind: TowerKind, wave?: number): PlanAction => ({ do: 'build', at: [col, row], kind, wave });
export const up = (col: number, row: number, wave?: number): PlanAction => ({ do: 'up', at: [col, row], wave });
export const rally = (col: number, row: number, x: number, y: number, wave?: number): PlanAction => ({ do: 'rally', at: [col, row], to: [x, y], wave });

export type AbilityMode = 'none' | 'competent' | 'expert';
export type EarlyMode = 'never' | 'competent' | 'expert';

export interface BotConfig {
  name: string;
  /** Star points assumed per previously cleared level (0 = none). */
  starsPerLevel: number;
  abilities: AbilityMode;
  early: EarlyMode;
  /** 'plan' follows the level plan; 'naive' spams cheap archers near the spawn; 'idle' builds nothing. */
  style: 'plan' | 'naive' | 'idle';
  /** Which plan to use when style === 'plan'. */
  planKind: 'competent' | 'expert';
  /** Force every build in the plan to this tower kind (variant bots). */
  onlyKind?: TowerKind;
  /**
   * Specialization policy (only matters on levels with specializations): 'auto' = the per-level rule of tools/bots/specs.ts
   * (a few specs, as many as the plan's economy affords); 'none' = never specialize.
   */
  specs: 'auto' | 'none';
  /** Comparison variants: every Lv3 tower of this spec's kind buys exactly this spec (and nothing else is specialized). */
  forceSpec?: SpecId;
}

export type { Vec2 };
