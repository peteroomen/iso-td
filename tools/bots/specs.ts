import { SPECS } from '../../src/core/data/specs';
import type { LevelDef, SpecId, TowerKind } from '../../src/core/types';
import type { BotConfig, PlanAction } from './types';

/**
 * Specialization policy of the scripted bots (docs/DESIGN.md section 12). Specs exist on levels 7-10 only.
 *
 * A level rule is a list of spec SLOTS, bought in this order: "the first not yet specialized tower of `kind` in the plan gets
 * `spec`, right after the plan's `after`-th build" (never before that tower exists). A slot costs the tower's remaining upgrades to
 * Lv3 plus the 300 gold, so it is a real trade-off against building / upgrading elsewhere; the plan's own later upgrade of that
 * tower falls through harmlessly. The choices are the "sensible rule per level": read from the wave mix and confirmed with the
 * forced-spec comparison bots (`spec:<id>`, see docs/BALANCE.md).
 */
export interface SpecSlot {
  kind: TowerKind;
  spec: SpecId;
  after: number;
}

export interface SpecRule {
  competent: readonly SpecSlot[];
  /** Defaults to `competent`. */
  expert?: readonly SpecSlot[];
}

const s = (kind: TowerKind, spec: SpecId, after: number): SpecSlot => ({ kind, spec, after });

export const SPEC_RULES: Record<string, SpecRule> = {
  level07: { competent: [s('archer', 'eagle_eye', 6), s('wizard', 'chain_lightning', 8), s('bomb', 'bigger_bombs', 10)] },
  level08: { competent: [s('archer', 'eagle_eye', 6), s('barracks', 'extra_recruits', 8), s('wizard', 'chain_lightning', 10)] },
  level09: { competent: [s('archer', 'eagle_eye', 4), s('wizard', 'chain_lightning', 5), s('barracks', 'extra_recruits', 6)] },
  level10: { competent: [s('archer', 'eagle_eye', 11), s('bomb', 'bigger_bombs', 13), s('wizard', 'chain_lightning', 15), s('barracks', 'extra_recruits', 17)] },
};

/** Forced-spec comparison bots specialize at least this many towers of the forced kind (if the plan has that many). */
const FORCED_TARGET = 2;

/**
 * Returns the plan with specialization purchases inserted (see SpecSlot). `cfg.specs === 'none'` (or a level without specs)
 * leaves the plan unchanged. With `cfg.forceSpec` every slot of that spec's kind uses the forced option, and when the rule has
 * fewer than FORCED_TARGET such slots the LAST slots are converted to the forced kind: the A / B variants of a kind then have
 * exactly the same economy and differ only in the option.
 */
export function withSpecs(plan: readonly PlanAction[], level: LevelDef, cfg: BotConfig): readonly PlanAction[] {
  if (!level.specsUnlocked || cfg.specs === 'none') return plan;
  const rule = SPEC_RULES[level.id];
  if (!rule) return plan;
  let slots: SpecSlot[] = [...(cfg.planKind === 'expert' ? rule.expert ?? rule.competent : rule.competent)];
  if (cfg.forceSpec) {
    const kind = SPECS[cfg.forceSpec].tower;
    slots = slots.map((x) => (x.kind === kind ? { ...x, spec: cfg.forceSpec! } : x));
    const have = slots.filter((x) => x.kind === kind).length;
    for (let n = 0; n < FORCED_TARGET - have; n++) {
      const i = slots.length - 1 - n;
      if (i >= 0) slots[i] = { kind, spec: cfg.forceSpec, after: slots[i].after };
    }
  }
  const towers: { at: readonly [number, number]; kind: TowerKind; buildIdx: number; used: boolean }[] = [];
  plan.forEach((a, i) => {
    if (a.do === 'build') towers.push({ at: a.at, kind: cfg.onlyKind ?? a.kind, buildIdx: i, used: false });
  });
  const inserts = new Map<number, PlanAction[]>();
  for (const slot of slots) {
    const t = towers.find((x) => !x.used && x.kind === slot.kind);
    if (!t) continue;
    t.used = true;
    const gate = towers[Math.min(towers.length, Math.max(1, slot.after)) - 1];
    const idx = Math.max(gate.buildIdx, t.buildIdx);
    const list = inserts.get(idx) ?? [];
    list.push({ do: 'up', at: t.at }, { do: 'up', at: t.at }, { do: 'spec', at: t.at, spec: slot.spec });
    inserts.set(idx, list);
  }
  const out: PlanAction[] = [];
  plan.forEach((a, i) => {
    out.push(a);
    const extra = inserts.get(i);
    if (extra) out.push(...extra);
  });
  return out;
}
