import { unlockedSpecsFor } from '../../src/core/data/levels';
import { SPECS, SPECS_BY_TOWER } from '../../src/core/data/specs';
import type { LevelDef, SpecId, TowerKind } from '../../src/core/types';
import type { BotConfig, PlanAction } from './types';

/**
 * Specialization policy of the scripted bots (docs/DESIGN.md section 12). Specs are unlocked from level 4 on, two per level
 * (`LevelDef.newSpecs`); a bot only ever buys specs that its level has unlocked (cumulatively), see `specsAvailable`.
 *
 * A level rule is a list of spec SLOTS, bought in this order: "the first not yet specialized tower of `kind` in the plan gets
 * `spec`, right after the plan's `after`-th build" (never before that tower exists). A slot costs the tower's remaining upgrades to
 * Lv3 plus the 300 gold, so it is a real trade-off against building / upgrading elsewhere; the plan's own later upgrade of that
 * tower falls through harmlessly. The choices are the "sensible rule per level": read from the wave mix and confirmed with the
 * forced-spec comparison bots (`spec:<id>`, see docs/BALANCE.md). A slot whose preferred spec is not unlocked on the level uses the
 * other option of the same kind if that one is unlocked, and is dropped otherwise.
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

/** Used for levels without their own rule (and by the measurement bots): one slot per tower kind, later in the build order for the cheaper-to-skip kinds. */
const GENERIC_RULE: SpecRule = {
  competent: [s('archer', 'eagle_eye', 5), s('wizard', 'chain_lightning', 5), s('bomb', 'bigger_bombs', 5), s('barracks', 'extra_recruits', 5)],
};

export const SPEC_RULES: Record<string, SpecRule> = {
  // L4-L7: only the specs unlocked so far are bought (a slot falls back to the other option of its kind, or is dropped)
  level04: { competent: [s('wizard', 'chain_lightning', 5), s('bomb', 'homing_missiles', 7)] },
  level05: { competent: [s('archer', 'hunting_nets', 5), s('barracks', 'bow_training', 7), s('wizard', 'chain_lightning', 9), s('bomb', 'homing_missiles', 11)] },
  level06: { competent: [s('bomb', 'bigger_bombs', 6), s('barracks', 'extra_recruits', 8), s('wizard', 'chain_lightning', 10), s('archer', 'hunting_nets', 12)] },
  level07: { competent: [s('archer', 'eagle_eye', 5), s('wizard', 'fire_mages', 7), s('bomb', 'bigger_bombs', 9)] },
  level08: { competent: [s('archer', 'eagle_eye', 6), s('barracks', 'extra_recruits', 8), s('wizard', 'chain_lightning', 10)] },
  level09: { competent: [s('archer', 'eagle_eye', 4), s('wizard', 'chain_lightning', 5), s('barracks', 'extra_recruits', 6)] },
  level10: { competent: [s('archer', 'eagle_eye', 6), s('wizard', 'chain_lightning', 8), s('bomb', 'bigger_bombs', 10), s('barracks', 'extra_recruits', 12)] },
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
  const avail = specsAvailable(level, cfg);
  if (avail.length === 0 || cfg.specs === 'none') return plan;
  if (cfg.forceSpec && !avail.includes(cfg.forceSpec)) return plan;
  const rule = SPEC_RULES[level.id] ?? GENERIC_RULE;
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
  // only unlocked specs are ever bought: the other option of the kind stands in, otherwise the slot is dropped
  slots = slots.flatMap((x) => {
    const spec = [x.spec, ...SPECS_BY_TOWER[x.kind]].find((id) => avail.includes(id));
    return spec ? [{ ...x, spec }] : [];
  });
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

/** Specs a bot may buy on `level`: the level's cumulative unlock set (every spec for the `allSpecs` measurement bots). */
export function specsAvailable(level: LevelDef, cfg: Pick<BotConfig, 'availSpecs'>): readonly SpecId[] {
  return cfg.availSpecs ?? unlockedSpecsFor(level);
}
